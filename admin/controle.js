// =====================================================
// CONTRÔLE DU PLANNING DES EXAMENS  (version améliorée)
//
// Script classique (pas de module) : expose window.controleExamens.
//
// Améliorations :
//  - dates ISO strictes et créneaux stricts (mêmes règles que affectation-salles.js)
//  - gardes partout (plus de plantage si un champ manque)
//  - libellés de matières normalisés (espaces)
//  - comparaisons par Set (au lieu de some() imbriqués)
//  - équilibrage « Dégradé » → avertissement
//  - anomalies structurées (`anomalies`) + chaînes conservées
//    (`anomaliesBloquantes`, `avertissements`) pour compatibilité
//  - option { silencieux: true } pour ne pas polluer la console
//  - nouveau contrôle : locaux affectés (verifierLocauxAffectes)
// =====================================================

(function () {
    "use strict";

    // -------------------------------------------------
    // OUTILS COMMUNS
    // -------------------------------------------------

    function creerJournal(silencieux) {
        const muet = function () {};

        if (silencieux) {
            return { log: muet, warn: muet, error: muet };
        }

        return {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console)
        };
    }

    // Libellé normalisé : espaces de début/fin supprimés, espaces multiples réduits
    function normaliserLibelle(valeur) {
        return String(valeur ?? "").trim().replace(/\s+/g, " ");
    }

    // Jour civil "AAAA-MM-JJ" ou null si la valeur est invalide.
    // Formats acceptés : Timestamp Firestore, Date, texte ISO.
    // Aucun parsing dépendant de la langue, aucune date corrigée silencieusement.
    function jourCivilStrict(valeur) {
        try {
            let date;

            if (valeur instanceof Date) {
                date = valeur;
            } else if (valeur && typeof valeur.toDate === "function") {
                date = valeur.toDate();
            } else if (valeur && Number.isInteger(valeur.seconds)) {
                date = new Date(
                    valeur.seconds * 1000 + (valeur.nanoseconds ?? 0) / 1e6
                );
            } else if (typeof valeur === "string") {
                const m = valeur.trim().match(
                    /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/
                );

                if (!m) return null;

                const y = Number(m[1]);
                const mo = Number(m[2]);
                const d = Number(m[3]);

                const verif = new Date(0);
                verif.setUTCFullYear(y, mo - 1, d);
                verif.setUTCHours(0, 0, 0, 0);

                if (
                    verif.getUTCFullYear() !== y ||
                    verif.getUTCMonth() !== mo - 1 ||
                    verif.getUTCDate() !== d
                ) {
                    return null;
                }

                if (!m[4]) return m[1] + "-" + m[2] + "-" + m[3];

                date = new Date(valeur.trim());
            } else {
                return null;
            }

            if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
                return null;
            }

            return (
                String(date.getFullYear()).padStart(4, "0") + "-" +
                String(date.getMonth() + 1).padStart(2, "0") + "-" +
                String(date.getDate()).padStart(2, "0")
            );
        } catch (_) {
            return null;
        }
    }

    // Ordre de créneau : entier strictement positif, sinon null.
    // (null, "", false, 0 et négatifs sont refusés)
    function lireCreneauStrict(valeur) {
        if (valeur == null || valeur === "" || typeof valeur === "boolean") {
            return null;
        }

        const n = Number(valeur);

        return Number.isInteger(n) && n > 0 ? n : null;
    }

    function creerAnomalie(type, bloquant, message, details) {
        return { type, bloquant, message, details: details ?? null };
    }

    // -------------------------------------------------
    // GRILLES DE CRÉNEAUX PAR SESSION
    // Modifiables à l'exécution avec definirGrilles(...)
    // -------------------------------------------------

    const GRILLE_3_CRENEAUX = [
        { creneauOrdre: 1, heureDebut: "08:00", heureFin: "10:00" },
        { creneauOrdre: 2, heureDebut: "10:30", heureFin: "12:30" },
        { creneauOrdre: 3, heureDebut: "14:00", heureFin: "16:00" }
    ];

    const GRILLE_2_CRENEAUX = GRILLE_3_CRENEAUX.slice(0, 2);

    let grilles = {
        DS_S1: GRILLE_3_CRENEAUX,
        PRINCIPALE_S1: GRILLE_3_CRENEAUX,
        RATTRAPAGE_S1: GRILLE_2_CRENEAUX,
        DS_S2: GRILLE_3_CRENEAUX,
        PRINCIPALE_S2: GRILLE_2_CRENEAUX,
        RATTRAPAGE_S2: GRILLE_2_CRENEAUX
    };

    // Accepte :
    //  - un tableau de lignes { sessionCode, creneauOrdre, heureDebut, heureFin }
    //  - un objet { sessionCode: [ { creneauOrdre, heureDebut, heureFin }, ... ] }
    function definirGrilles(source) {
        const nouvelles = {};

        const ajouter = function (code, ligne) {
            const session = String(code ?? "").trim();
            const ordre = lireCreneauStrict(ligne && ligne.creneauOrdre);

            if (!session || ordre === null) {
                throw new Error("Ligne de grille invalide : " + JSON.stringify(ligne));
            }

            if (!nouvelles[session]) nouvelles[session] = [];

            if (nouvelles[session].some(l => l.creneauOrdre === ordre)) {
                throw new Error("Créneau dupliqué dans la grille " + session + " : " + ordre);
            }

            nouvelles[session].push({
                creneauOrdre: ordre,
                heureDebut: String(ligne.heureDebut ?? "").trim(),
                heureFin: String(ligne.heureFin ?? "").trim()
            });
        };

        if (Array.isArray(source)) {
            source.forEach(ligne => ajouter(ligne && ligne.sessionCode, ligne));
        } else if (source && typeof source === "object") {
            Object.entries(source).forEach(function ([code, liste]) {
                if (!Array.isArray(liste)) throw new Error("Grille invalide pour " + code);
                liste.forEach(ligne => ajouter(code, ligne));
            });
        } else {
            throw new Error("Format de grilles non pris en charge.");
        }

        Object.values(nouvelles).forEach(liste =>
            liste.sort((a, b) => a.creneauOrdre - b.creneauOrdre)
        );

        grilles = nouvelles;
    }

    function lireGrilles() {
        return JSON.parse(JSON.stringify(grilles));
    }

    // "08:00", "8h00", "08h30" -> minutes depuis minuit ; null si illisible
    function minutesDepuisHeure(valeur) {
        const m = String(valeur ?? "").match(/(\d{1,2})\s*[:hH]\s*(\d{2})/);

        return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    }

    // =====================================================
    // 1. Vérifier que toutes les matières prévues sont placées
    // =====================================================

    function verifierMatieresPlacees(planning, options = {}) {
        const journal = creerJournal(options.silencieux);

        journal.log("------------------------------------------");
        journal.log("CONTRÔLE DES MATIÈRES PLACÉES");
        journal.log("------------------------------------------");

        if (!planning) {
            journal.error("❌ Planning introuvable.");

            return {
                valide: false,
                totalPrevu: 0,
                totalPlace: 0,
                matieresManquantes: [],
                matieresNonPrevues: []
            };
        }

        const cle = (filiereCode, libelle) =>
            filiereCode + "|" + normaliserLibelle(libelle);

        // Matières prévues
        const matieresPrevues = [];

        (planning.matieresCommunes || []).forEach(function (matiere) {
            (matiere.filieres || []).forEach(function (filiereCode) {
                matieresPrevues.push({
                    filiereCode: filiereCode,
                    matiereLibelle: matiere.matiereLibelle
                });
            });
        });

        (planning.matieresSpecifiques || []).forEach(function (matiere) {
            matieresPrevues.push({
                filiereCode: matiere.filiereCode,
                matiereLibelle: matiere.matiereLibelle
            });
        });

        // Matières placées
        const matieresPlacees = [];

        (planning.filieres || []).forEach(function (filiere) {
            (filiere.cellules || []).forEach(function (cellule) {
                if (cellule.estOccupee !== true || !cellule.matiereLibelle) {
                    return;
                }

                matieresPlacees.push({
                    filiereCode: filiere.filiereCode,
                    matiereLibelle: cellule.matiereLibelle
                });
            });
        });

        const clesPrevues = new Set(
            matieresPrevues.map(m => cle(m.filiereCode, m.matiereLibelle))
        );

        const clesPlacees = new Set(
            matieresPlacees.map(m => cle(m.filiereCode, m.matiereLibelle))
        );

        const matieresManquantes = matieresPrevues.filter(
            m => !clesPlacees.has(cle(m.filiereCode, m.matiereLibelle))
        );

        const matieresNonPrevues = matieresPlacees.filter(
            m => !clesPrevues.has(cle(m.filiereCode, m.matiereLibelle))
        );

        const resultat = {
            valide:
                matieresManquantes.length === 0 &&
                matieresNonPrevues.length === 0,
            totalPrevu: matieresPrevues.length,
            totalPlace: matieresPlacees.length,
            matieresManquantes: matieresManquantes,
            matieresNonPrevues: matieresNonPrevues
        };

        journal.log("Matières prévues :", resultat.totalPrevu);
        journal.log("Matières placées :", resultat.totalPlace);
        journal.log("Matières manquantes :", matieresManquantes.length);
        journal.log("Matières non prévues :", matieresNonPrevues.length);

        if (resultat.valide) {
            journal.log("✓ Correspondance entre matières prévues et placées.");
        } else {
            journal.warn("⚠️ Matières manquantes :", matieresManquantes);
            journal.warn("⚠️ Matières non prévues :", matieresNonPrevues);
        }

        return resultat;
    }

    // =====================================================
    // 2. Vérifier les doublons de matières par filière
    // =====================================================

    function verifierDoublonsMatieres(planning, options = {}) {
        const journal = creerJournal(options.silencieux);

        journal.log("------------------------------------------");
        journal.log("CONTRÔLE DES DOUBLONS DE MATIÈRES");
        journal.log("------------------------------------------");

        if (!planning) {
            journal.error("❌ Planning introuvable.");

            return { valide: false, doublons: [] };
        }

        const occurrences = new Map();

        (planning.filieres || []).forEach(function (filiere) {
            (filiere.cellules || []).forEach(function (cellule) {
                if (!cellule.estOccupee || !cellule.matiereLibelle) {
                    return;
                }

                const libelle = normaliserLibelle(cellule.matiereLibelle);
                const cle = filiere.filiereCode + "|" + libelle;

                if (!occurrences.has(cle)) {
                    occurrences.set(cle, {
                        filiereCode: filiere.filiereCode,
                        matiereLibelle: libelle,
                        nombre: 0
                    });
                }

                occurrences.get(cle).nombre++;
            });
        });

        const doublons = [...occurrences.values()].filter(o => o.nombre > 1);

        const resultat = {
            valide: doublons.length === 0,
            doublons: doublons
        };

        journal.log("Doublons détectés :", doublons.length);

        if (resultat.valide) {
            journal.log("✓ Aucun doublon de matière dans une même filière.");
        } else {
            journal.warn("⚠️ Doublons détectés :", doublons);
        }

        return resultat;
    }

    // =====================================================
    // 3. Vérifier le placement des matières communes
    // =====================================================

    function verifierMatieresCommunes(planning, options = {}) {
        const journal = creerJournal(options.silencieux);

        journal.log("------------------------------------------");
        journal.log("CONTRÔLE DES MATIÈRES COMMUNES");
        journal.log("------------------------------------------");

        if (!planning) {
            journal.error("❌ Planning introuvable.");

            return { valide: false, erreurs: [] };
        }

        const erreurs = [];

        (planning.matieresCommunes || []).forEach(function (matiereCommune) {
            const matiereLibelle = normaliserLibelle(matiereCommune.matiereLibelle);
            const filieres = matiereCommune.filieres || [];
            const placements = [];

            filieres.forEach(function (filiereCode) {
                const filiere = (planning.filieres || []).find(
                    f => f.filiereCode === filiereCode
                );

                if (!filiere) {
                    erreurs.push({
                        matiereLibelle: matiereLibelle,
                        filiereCode: filiereCode,
                        erreur: "Filière introuvable dans le planning"
                    });
                    return;
                }

                const cellules = (filiere.cellules || []).filter(
                    c =>
                        c.estOccupee === true &&
                        normaliserLibelle(c.matiereLibelle) === matiereLibelle
                );

                if (cellules.length === 0) {
                    erreurs.push({
                        matiereLibelle: matiereLibelle,
                        filiereCode: filiereCode,
                        erreur: "Matière commune non placée"
                    });
                    return;
                }

                if (cellules.length > 1) {
                    erreurs.push({
                        matiereLibelle: matiereLibelle,
                        filiereCode: filiereCode,
                        erreur: "Matière commune présente plusieurs fois"
                    });
                    return;
                }

                const cellule = cellules[0];
                const date = jourCivilStrict(cellule.date);
                const creneau = lireCreneauStrict(cellule.creneauOrdre);

                if (date === null || creneau === null) {
                    erreurs.push({
                        matiereLibelle: matiereLibelle,
                        filiereCode: filiereCode,
                        erreur: "Date ou créneau invalide"
                    });
                    return;
                }

                placements.push({
                    filiereCode: filiereCode,
                    date: date,
                    creneauOrdre: creneau,
                    dateAffichage: cellule.dateAffichage
                });
            });

            // Ne comparer que si tous les placements sont disponibles
            if (placements.length !== filieres.length || placements.length === 0) {
                return;
            }

            const premier = placements[0];

            placements.forEach(function (placement) {
                if (
                    placement.date !== premier.date ||
                    placement.creneauOrdre !== premier.creneauOrdre
                ) {
                    erreurs.push({
                        matiereLibelle: matiereLibelle,
                        filiereCode: placement.filiereCode,
                        erreur: "La matière commune n'est pas placée au même jour/créneau",
                        dateAttendue: premier.dateAffichage,
                        creneauAttendu: premier.creneauOrdre,
                        dateTrouvee: placement.dateAffichage,
                        creneauTrouve: placement.creneauOrdre
                    });
                }
            });
        });

        const resultat = { valide: erreurs.length === 0, erreurs: erreurs };

        journal.log("Erreurs détectées :", erreurs.length);

        if (resultat.valide) {
            journal.log("✓ Toutes les matières communes sont placées au même jour/créneau.");
        } else {
            journal.warn("⚠️ Problèmes détectés dans les matières communes :", erreurs);
        }

        return resultat;
    }

    // =====================================================
    // 4. Vérifier les créneaux successifs pour une filière
    // =====================================================

    function verifierCreneauxSuccessifs(planning, options = {}) {
        const journal = creerJournal(options.silencieux);

        journal.log("------------------------------------------");
        journal.log("CONTRÔLE DES CRÉNEAUX SUCCESSIFS");
        journal.log("------------------------------------------");

        if (!planning) {
            journal.error("❌ Planning introuvable.");

            return { valide: false, erreurs: [] };
        }

        const erreurs = [];

        (planning.filieres || []).forEach(function (filiere) {
            // jour civil -> liste des examens du jour
            const parDate = new Map();

            (filiere.cellules || []).forEach(function (cellule) {
                if (cellule.estOccupee !== true || !cellule.matiereLibelle) {
                    return;
                }

                const date = jourCivilStrict(cellule.date);
                const creneau = lireCreneauStrict(cellule.creneauOrdre);

                if (date === null || creneau === null) {
                    erreurs.push({
                        filiereCode: filiere.filiereCode,
                        matiereLibelle: cellule.matiereLibelle,
                        erreur: "Date ou créneau invalide"
                    });
                    return;
                }

                if (!parDate.has(date)) parDate.set(date, []);

                parDate.get(date).push({
                    matiereLibelle: cellule.matiereLibelle,
                    creneauOrdre: creneau,
                    dateAffichage: cellule.dateAffichage
                });
            });

            parDate.forEach(function (cellules) {
                const parOrdre = new Map();

                cellules.forEach(c => {
                    if (!parOrdre.has(c.creneauOrdre)) {
                        parOrdre.set(c.creneauOrdre, c);
                    }
                });

                cellules.forEach(function (cellule) {
                    const suivant = parOrdre.get(cellule.creneauOrdre + 1);

                    if (suivant) {
                        erreurs.push({
                            filiereCode: filiere.filiereCode,
                            date: cellule.dateAffichage,
                            matiere1: cellule.matiereLibelle,
                            creneau1: cellule.creneauOrdre,
                            matiere2: suivant.matiereLibelle,
                            creneau2: suivant.creneauOrdre,
                            erreur:
                                "Deux examens sont placés dans des créneaux successifs le même jour."
                        });
                    }
                });
            });
        });

        const resultat = { valide: erreurs.length === 0, erreurs: erreurs };

        journal.log("Erreurs détectées :", erreurs.length);

        if (resultat.valide) {
            journal.log("✓ Aucune filière n'a deux examens dans des créneaux successifs le même jour.");
        } else {
            journal.warn("⚠️ Créneaux successifs détectés :", erreurs);
        }

        return resultat;
    }

    // =====================================================
    // 5. Vérifier l'équilibrage des charges des créneaux
    // =====================================================

    function verifierEquilibrageCreneaux(planning, options = {}) {
        const journal = creerJournal(options.silencieux);

        journal.log("------------------------------------------");
        journal.log("CONTRÔLE DE L'ÉQUILIBRAGE DES CRÉNEAUX");
        journal.log("------------------------------------------");

        const indetermine = function (charges) {
            return {
                valide: false,
                charges: charges || {},
                minimum: 0,
                maximum: 0,
                ecart: 0,
                equilibre: "Indéterminé"
            };
        };

        if (!planning) {
            journal.error("❌ Planning introuvable.");
            return indetermine();
        }

        const generation = window.generationExamens;

        if (!generation || typeof generation.calculerChargeDesCreneaux !== "function") {
            journal.warn("⚠️ generationExamens.calculerChargeDesCreneaux est indisponible.");
            return indetermine();
        }

        let charges;

        try {
            charges = generation.calculerChargeDesCreneaux(planning);
        } catch (erreur) {
            journal.warn("⚠️ Calcul des charges impossible :", erreur);
            return indetermine();
        }

        const valeurs = Object.values(charges || {}).map(Number);

        if (valeurs.length === 0 || valeurs.some(v => !Number.isFinite(v))) {
            journal.warn("⚠️ Charges inexistantes ou invalides.");
            return indetermine(charges);
        }

        const minimum = Math.min(...valeurs);
        const maximum = Math.max(...valeurs);
        const ecart = maximum - minimum;

        let equilibre;

        if (ecart <= 1) {
            equilibre = "Excellent";
        } else if (ecart <= 2) {
            equilibre = "Acceptable";
        } else {
            equilibre = "Dégradé";
        }

        journal.log("Charge minimale :", minimum);
        journal.log("Charge maximale :", maximum);
        journal.log("Écart MAX - MIN :", ecart);
        journal.log("Équilibrage :", equilibre);

        return {
            valide: true,
            charges: charges,
            minimum: minimum,
            maximum: maximum,
            ecart: ecart,
            seuilIdeal: 1,
            seuilAcceptable: 2,
            equilibre: equilibre
        };
    }

    // =====================================================
    // 6. Vérifier que les filières ayant des examens ont des locaux
    // =====================================================

    function verifierLocauxAffectes(planning) {
        const filieresSansLocal = [];

        ((planning && planning.filieres) || []).forEach(function (filiere) {
            const aDesExamens = (filiere.cellules || []).some(
                c => c.estOccupee === true
            );

            if (
                aDesExamens &&
                (!Array.isArray(filiere.amphis) || filiere.amphis.length === 0)
            ) {
                filieresSansLocal.push(filiere.filiereCode);
            }
        });

        return {
            valide: filieresSansLocal.length === 0,
            filieresSansLocal: filieresSansLocal
        };
    }

    // =====================================================
    // 6 bis. Vérifier que les créneaux appartiennent à la grille de la session
    //
    // options.sessionCode (ou planning.sessionCode) est nécessaire.
    // - créneau absent de la grille            : erreur bloquante
    // - horaires affichés ≠ horaires de grille : incohérence (avertissement)
    // =====================================================

    function verifierCreneauxGrille(planning, options = {}) {
        const journal = creerJournal(options.silencieux);

        const sessionCode = String(
            options.sessionCode ?? (planning && planning.sessionCode) ?? ""
        ).trim();

        const resultat = {
            valide: true,
            grilleConnue: false,
            sessionCode: sessionCode,
            erreurs: [],
            incoherences: []
        };

        if (!planning) {
            return { ...resultat, valide: false };
        }

        const grille = sessionCode ? grilles[sessionCode] : null;

        if (!grille) {
            journal.warn(
                "⚠️ Grille de créneaux inconnue ou session non précisée :",
                sessionCode || "(vide)"
            );
            return resultat;
        }

        resultat.grilleConnue = true;

        const parOrdre = new Map(grille.map(l => [l.creneauOrdre, l]));
        const autorises = grille.map(l => l.creneauOrdre);

        (planning.filieres || []).forEach(function (filiere) {
            (filiere.cellules || []).forEach(function (cellule) {
                if (cellule.estOccupee !== true) return;

                const ordre = lireCreneauStrict(cellule.creneauOrdre);

                // Créneau invalide : déjà signalé par les autres contrôles
                if (ordre === null) return;

                const ligne = parOrdre.get(ordre);

                if (!ligne) {
                    resultat.erreurs.push({
                        filiereCode: filiere.filiereCode,
                        matiereLibelle: cellule.matiereLibelle,
                        date: cellule.dateAffichage,
                        creneauOrdre: ordre,
                        creneauxAutorises: autorises,
                        erreur: "Créneau absent de la grille de la session " + sessionCode
                    });
                    return;
                }

                const debutCellule = minutesDepuisHeure(cellule.heureDebutAffichage);
                const finCellule = minutesDepuisHeure(cellule.heureFinAffichage);
                const debutGrille = minutesDepuisHeure(ligne.heureDebut);
                const finGrille = minutesDepuisHeure(ligne.heureFin);

                if (
                    debutCellule !== null && debutGrille !== null &&
                    finCellule !== null && finGrille !== null &&
                    (debutCellule !== debutGrille || finCellule !== finGrille)
                ) {
                    resultat.incoherences.push({
                        filiereCode: filiere.filiereCode,
                        matiereLibelle: cellule.matiereLibelle,
                        date: cellule.dateAffichage,
                        creneauOrdre: ordre,
                        horaireCellule: cellule.heureDebutAffichage + "–" + cellule.heureFinAffichage,
                        horaireGrille: ligne.heureDebut + "–" + ligne.heureFin
                    });
                }
            });
        });

        resultat.valide = resultat.erreurs.length === 0;

        if (resultat.erreurs.length > 0) {
            journal.warn("⚠️ Créneaux hors grille :", resultat.erreurs);
        }

        if (resultat.incoherences.length > 0) {
            journal.warn("⚠️ Horaires différents de la grille :", resultat.incoherences);
        }

        return resultat;
    }

    // =====================================================
    // 7. Contrôle global du planning
    //
    // options :
    //   silencieux                    : pas de logs console
    //   exigerLocaux                  : une filière sans local devient bloquante
    //                                   (à utiliser avant publication, pas avant affectation)
    //   matieresNonPlaceesBloquantes  : une matière prévue non placée devient bloquante
    //   sessionCode                   : code de session (ex. "DS_S1") pour contrôler
    //                                   les créneaux par rapport à la grille
    //
    // Résultat :
    //   anomaliesBloquantes / avertissements : tableaux de textes (compatibilité)
    //   anomalies : tableau structuré { type, bloquant, message, details }
    // =====================================================

    function verifierPlanningGlobal(planning, options = {}) {
        const journal = creerJournal(options.silencieux);
        const sousOptions = { silencieux: options.silencieux === true };

        journal.log("");
        journal.log("==========================================");
        journal.log("CONTRÔLE GLOBAL DU PLANNING");
        journal.log("==========================================");

        if (!planning) {
            journal.error("❌ Planning introuvable.");

            return {
                valide: false,
                anomaliesBloquantes: ["Planning introuvable"],
                avertissements: [],
                anomalies: [
                    creerAnomalie("PLANNING_INTROUVABLE", true, "Planning introuvable")
                ]
            };
        }

        const controleMatieres = verifierMatieresPlacees(planning, sousOptions);
        const controleDoublons = verifierDoublonsMatieres(planning, sousOptions);
        const controleCommunes = verifierMatieresCommunes(planning, sousOptions);
        const controleSuccessifs = verifierCreneauxSuccessifs(planning, sousOptions);
        const controleEquilibrage = verifierEquilibrageCreneaux(planning, sousOptions);
        const controleLocaux = verifierLocauxAffectes(planning);
        const controleGrille = verifierCreneauxGrille(planning, {
            silencieux: sousOptions.silencieux,
            sessionCode: options.sessionCode
        });

        const anomalies = [];

        if (!controleDoublons.valide) {
            anomalies.push(creerAnomalie(
                "DOUBLONS_MATIERES", true, "Doublons de matières", controleDoublons.doublons
            ));
        }

        if (!controleCommunes.valide) {
            anomalies.push(creerAnomalie(
                "MATIERES_COMMUNES", true, "Matières communes", controleCommunes.erreurs
            ));
        }

        if (!controleSuccessifs.valide) {
            anomalies.push(creerAnomalie(
                "CRENEAUX_SUCCESSIFS", true, "Créneaux successifs", controleSuccessifs.erreurs
            ));
        }

        if (controleMatieres.matieresManquantes.length > 0) {
            anomalies.push(creerAnomalie(
                "MATIERES_NON_PLACEES",
                options.matieresNonPlaceesBloquantes === true,
                "Matières non placées",
                controleMatieres.matieresManquantes
            ));
        }

        if (controleMatieres.matieresNonPrevues.length > 0) {
            anomalies.push(creerAnomalie(
                "MATIERES_NON_PREVUES", false, "Matières non prévues",
                controleMatieres.matieresNonPrevues
            ));
        }

        if (!controleEquilibrage.valide || controleEquilibrage.equilibre === "Dégradé") {
            anomalies.push(creerAnomalie(
                "EQUILIBRAGE_CRENEAUX", false, "Équilibrage des créneaux", controleEquilibrage
            ));
        }

        if (!controleLocaux.valide) {
            anomalies.push(creerAnomalie(
                "FILIERES_SANS_LOCAL",
                options.exigerLocaux === true,
                "Filières sans local",
                controleLocaux.filieresSansLocal
            ));
        }

        if (!controleGrille.valide) {
            anomalies.push(creerAnomalie(
                "CRENEAU_HORS_GRILLE", true, "Créneaux hors grille", controleGrille.erreurs
            ));
        }

        if (controleGrille.incoherences.length > 0) {
            anomalies.push(creerAnomalie(
                "HORAIRE_INCOHERENT", false, "Horaires différents de la grille",
                controleGrille.incoherences
            ));
        }

        if (!controleGrille.grilleConnue) {
            anomalies.push(creerAnomalie(
                "GRILLE_INCONNUE", false,
                controleGrille.sessionCode
                    ? "Grille de créneaux inconnue pour la session " + controleGrille.sessionCode
                    : "Session non précisée : créneaux non comparés à la grille",
                null
            ));
        }

        const anomaliesBloquantes = anomalies.filter(a => a.bloquant).map(a => a.message);
        const avertissements = anomalies.filter(a => !a.bloquant).map(a => a.message);

        const resultat = {
            valide: anomaliesBloquantes.length === 0,
            anomaliesBloquantes: anomaliesBloquantes,
            avertissements: avertissements,
            anomalies: anomalies,
            matieresPlacees: controleMatieres,
            doublons: controleDoublons,
            matieresCommunes: controleCommunes,
            creneauxSuccessifs: controleSuccessifs,
            equilibrage: controleEquilibrage,
            locaux: controleLocaux,
            grille: controleGrille
        };

        journal.log("");
        journal.log("------------------------------------------");
        journal.log("RÉSULTAT DU CONTRÔLE GLOBAL");
        journal.log("------------------------------------------");
        journal.log("Anomalies bloquantes :", anomaliesBloquantes);
        journal.log("Avertissements :", avertissements);
        journal.log(resultat.valide ? "✅ PLANNING AUTORISÉ" : "❌ PLANNING BLOQUÉ");
        journal.log("Détail complet :", resultat);
        journal.log("------------------------------------------");

        return resultat;
    }

    // =====================================================
    // API PUBLIQUE DU CONTRÔLE
    // =====================================================

    window.controleExamens = {
        verifierPlanningGlobal: verifierPlanningGlobal,
        verifierMatieresPlacees: verifierMatieresPlacees,
        verifierDoublonsMatieres: verifierDoublonsMatieres,
        verifierMatieresCommunes: verifierMatieresCommunes,
        verifierCreneauxSuccessifs: verifierCreneauxSuccessifs,
        verifierEquilibrageCreneaux: verifierEquilibrageCreneaux,
        verifierLocauxAffectes: verifierLocauxAffectes,
        verifierCreneauxGrille: verifierCreneauxGrille,
        definirGrilles: definirGrilles,
        lireGrilles: lireGrilles,
        outils: {
            jourCivilStrict: jourCivilStrict,
            lireCreneauStrict: lireCreneauStrict,
            normaliserLibelle: normaliserLibelle
        }
    };
})();
