// =====================================================
// GENERATION.JS
// Planification des examens - FSGF
// =====================================================
// Rôle actuel :
// 1. Lire les données depuis Firestore
// 2. Vérifier les données nécessaires
// 3. Regrouper les matières par niveau
// 4. Regrouper ensuite par filière
// 5. Identifier les matières communes
// 6. Construire la grille Dates × Créneaux
//
// IMPORTANT :
// Cette version ne génère pas encore les examens.
// Les règles de planification seront ajoutées
// progressivement dans les prochaines étapes.
//
// RÈGLES MÉTIER À CONSERVER :
// - 1 niveau = 1 calendrier
// - matière commune = présente dans au moins 2 filières
// - éviter deux matières successives d'une même filière
//   le même jour
// - équilibrer les matières entre les créneaux
// - équilibre global considéré atteint si l'écart
//   entre le créneau le plus chargé et le moins chargé
//   est inférieur ou égal à 1
// =====================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    collection,
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// =====================================================
// FIRESTORE
// =====================================================

const db = getFirestore(app);

// =====================================================
// DONNÉES DU MOTEUR DE GÉNÉRATION
// =====================================================

let donneesGeneration = {
    matieres: [],
    sessions: [],
    creneaux: [],
    sallesAmphis: [],
    effectifs: []
};

// =====================================================
// ÉTAT DU MOTEUR
// =====================================================

let generationChargee = false;

// =====================================================
// DERNIER CALENDRIER ENREGISTRÉ
// =====================================================

let dernierCalendrierEnregistre = null;

// =====================================================
// CHARGER UNE COLLECTION FIRESTORE
// =====================================================

async function chargerCollection(nomCollection) {
    const snapshot = await getDocs(collection(db, nomCollection));
    const donnees = [];
    snapshot.forEach(function (document) {
        donnees.push({
            id: document.id,
            ...document.data()
        });
    });
    return donnees;
}

// =====================================================
// CHARGER TOUTES LES DONNÉES
// =====================================================

async function chargerDonneesGeneration() {
    console.log("==========================================");
    console.log("CHARGEMENT DES DONNÉES POUR LA GÉNÉRATION");
    console.log("==========================================");

    try {
        if (!window.donneesChargees) {
            throw new Error("Les données de data.js ne sont pas disponibles.");
        }

        const chargementOK = await window.donneesChargees;
        if (!chargementOK) {
            throw new Error("Le chargement des données Excel a échoué.");
        }

        const snapshotMatieres = await getDocs(collection(db, "matieres"));
        donneesGeneration.matieres = snapshotMatieres.docs.map(function (documentFirestore) {
            return documentFirestore.data();
        });

        const snapshotSessions = await getDocs(collection(db, "sessions"));
        donneesGeneration.sessions = snapshotSessions.docs.map(function (documentFirestore) {
            return documentFirestore.data();
        });

        const snapshotCreneaux = await getDocs(collection(db, "creneaux"));
        donneesGeneration.creneaux = snapshotCreneaux.docs.map(function (documentFirestore) {
            return documentFirestore.data();
        });

        const snapshotSallesAmphis = await getDocs(collection(db, "salles_amphis"));
        donneesGeneration.sallesAmphis = snapshotSallesAmphis.docs.map(function (documentFirestore) {
            return documentFirestore.data();
        });

        const snapshotEffectifs = await getDocs(collection(db, "effectifs"));
        donneesGeneration.effectifs = snapshotEffectifs.docs.map(function (documentFirestore) {
            return documentFirestore.data();
        });

        console.log("Matières :", donneesGeneration.matieres.length);
        console.log("Sessions :", donneesGeneration.sessions.length);
        console.log("Créneaux :", donneesGeneration.creneaux.length);
        console.log("Salles / amphis :", donneesGeneration.sallesAmphis.length);
        console.log("Effectifs :", donneesGeneration.effectifs.length);
        console.log("✓ Données de génération récupérées depuis Firestore");

        return true;
    } catch (erreur) {
        console.error("❌ Erreur lors du chargement des données de génération :", erreur);
        return false;
    }
}

// =====================================================
// VÉRIFIER LES DONNÉES
// =====================================================

function verifierDonneesGeneration() {
    console.log("==========================================");
    console.log("VÉRIFICATION DES DONNÉES");
    console.log("==========================================");

    if (donneesGeneration.matieres.length === 0) {
        console.error("❌ Aucune matière disponible.");
        return false;
    }
    if (donneesGeneration.sessions.length === 0) {
        console.error("❌ Aucune session disponible.");
        return false;
    }
    if (donneesGeneration.creneaux.length === 0) {
        console.error("❌ Aucun créneau disponible.");
        return false;
    }
    if (donneesGeneration.sallesAmphis.length === 0) {
        console.error("❌ Aucune salle / amphi disponible.");
        return false;
    }

    console.log("✓ Matières disponibles");
    console.log("✓ Sessions disponibles");
    console.log("✓ Créneaux disponibles");
    console.log("✓ Salles / amphis disponibles");
    console.log("------------------------------------------");
    console.log("✓ VÉRIFICATION TERMINÉE");
    console.log("------------------------------------------");

    return true;
}

// =====================================================
// OBTENIR LES NIVEAUX
// =====================================================

function obtenirNiveaux() {
    const niveaux = [];
    donneesGeneration.matieres.forEach(function (matiere) {
        const niveau = matiere.niveauCode;
        if (!niveau) return;
        if (!niveaux.includes(niveau)) {
            niveaux.push(niveau);
        }
    });
    niveaux.sort();
    return niveaux;
}

// =====================================================
// OBTENIR LES FILIÈRES D'UN NIVEAU
// =====================================================

function obtenirFilieresDuNiveau(niveauCode) {
    const filieres = [];
    donneesGeneration.matieres.forEach(function (matiere) {
        if (matiere.niveauCode !== niveauCode) return;
        const filiere = matiere.filiereCode;
        if (!filiere) return;
        if (!filieres.includes(filiere)) {
            filieres.push(filiere);
        }
    });
    filieres.sort();
    return filieres;
}

// =====================================================
// OBTENIR LES MATIÈRES D'UNE FILIÈRE
// =====================================================

function obtenirMatieresDeFiliere(niveauCode, filiereCode) {
    return donneesGeneration.matieres.filter(function (matiere) {
        return matiere.niveauCode === niveauCode && matiere.filiereCode === filiereCode;
    });
}

// =====================================================
// IDENTIFIER LES MATIÈRES COMMUNES
// =====================================================

function identifierMatieresCommunes(niveauCode) {
    console.log("------------------------------------------");
    console.log("IDENTIFICATION DES MATIÈRES COMMUNES");
    console.log("Niveau :", niveauCode);
    console.log("------------------------------------------");

    const compteurMatieres = new Map();

    donneesGeneration.matieres.forEach(function (matiere) {
        if (matiere.niveauCode !== niveauCode) return;
        const matiereLibelle = matiere.matiereLibelle;
        const filiereCode = matiere.filiereCode;
        if (!matiereLibelle || !filiereCode) return;

        if (!compteurMatieres.has(matiereLibelle)) {
            compteurMatieres.set(matiereLibelle, new Set());
        }
        compteurMatieres.get(matiereLibelle).add(filiereCode);
    });

    const matieresCommunes = [];
    compteurMatieres.forEach(function (filieres, matiereLibelle) {
        if (filieres.size >= 2) {
            matieresCommunes.push({
                matiereLibelle: matiereLibelle,
                filieres: Array.from(filieres),
                nombreFilieres: filieres.size
            });
        }
    });

    matieresCommunes.sort(function (a, b) {
        return a.matiereLibelle.localeCompare(b.matiereLibelle);
    });

    console.log("Matières communes détectées :", matieresCommunes.length);
    matieresCommunes.forEach(function (matiere) {
        console.log("✓", matiere.matiereLibelle, "→", matiere.nombreFilieres, "filières :", matiere.filieres);
    });
    console.log("------------------------------------------");

    return matieresCommunes;
}

// =====================================================
// PRÉPARATION DES MATIÈRES À PLANIFIER
// =====================================================

function preparerMatieresPourPlanification(niveauCode) {
    const matieresNiveau = donneesGeneration.matieres.filter(function (matiere) {
        return matiere.niveauCode === niveauCode;
    });

    if (matieresNiveau.length === 0) {
        console.warn("⚠️ Aucune matière trouvée pour le niveau :", niveauCode);
        return {
            niveauCode: niveauCode,
            matieresCommunes: [],
            matieresSpecifiques: []
        };
    }

    const groupesMatieres = {};
    matieresNiveau.forEach(function (matiere) {
        const libelle = String(matiere.matiereLibelle || "").trim();
        if (!libelle) return;
        if (!groupesMatieres[libelle]) {
            groupesMatieres[libelle] = [];
        }
        groupesMatieres[libelle].push(matiere);
    });

    const matieresCommunes = [];
    const matieresSpecifiques = [];

    Object.keys(groupesMatieres).forEach(function (libelle) {
        const occurrences = groupesMatieres[libelle];
        const filieres = [];
        occurrences.forEach(function (matiere) {
            if (matiere.filiereCode && !filieres.includes(matiere.filiereCode)) {
                filieres.push(matiere.filiereCode);
            }
        });

        const information = {
            matiereLibelle: libelle,
            filieres: filieres,
            occurrences: occurrences
        };

        if (filieres.length >= 2) {
            matieresCommunes.push(information);
        } else {
            matieresSpecifiques.push(information);
        }
    });

    console.log("PRÉPARATION DES MATIÈRES POUR LE NIVEAU :", niveauCode);
    console.log("→ Matières communes :", matieresCommunes.length);
    console.table(matieresCommunes.map(function (matiere) {
        return {
            Matiere: matiere.matiereLibelle,
            Filieres: matiere.filieres.join(" / ")
        };
    }));
    console.log("→ Matières spécifiques :", matieresSpecifiques.length);
    console.table(matieresSpecifiques.map(function (matiere) {
        return {
            Matiere: matiere.matiereLibelle,
            Filiere: matiere.filieres.join(" / ")
        };
    }));

    return {
        niveauCode: niveauCode,
        matieresCommunes: matieresCommunes,
        matieresSpecifiques: matieresSpecifiques
    };
}

// =====================================================
// PRÉPARER LES MATIÈRES POUR UNE SESSION
// =====================================================

function preparerMatieresPourSession(niveauCode, sessionCode) {
    console.log("------------------------------------------");
    console.log("PRÉPARATION DES MATIÈRES POUR LA SESSION");
    console.log("Niveau :", niveauCode);
    console.log("Session :", sessionCode);
    console.log("------------------------------------------");

    const session = obtenirSession(sessionCode);
    if (!session) {
        console.error("❌ Session introuvable :", sessionCode);
        return null;
    }

    const matieresNiveau = donneesGeneration.matieres.filter(function (matiere) {
        return (
            matiere.niveauCode === niveauCode &&
            matiere.regimeCode === session.regimeCode &&
            matiere.semestreCode === session.semestreCode
        );
    });

    console.log("Régime :", session.regimeCode);
    console.log("Semestre :", session.semestreCode);
    console.log("Matières compatibles :", matieresNiveau.length);

    const groupes = {};
    matieresNiveau.forEach(function (matiere) {
        const libelle = matiere.matiereLibelle;
        if (!groupes[libelle]) {
            groupes[libelle] = [];
        }
        groupes[libelle].push(matiere);
    });

    const matieresCommunes = [];
    const matieresSpecifiques = [];

    Object.keys(groupes).forEach(function (libelle) {
        const groupe = groupes[libelle];
        const filieres = [...new Set(groupe.map(function (matiere) {
            return matiere.filiereCode;
        }))];

        const premiereMatiere = groupe[0];

        if (filieres.length >= 2) {
            matieresCommunes.push({
                matiereLibelle: libelle,
                filieres: filieres,
                regimeCode: premiereMatiere.regimeCode,
                semestreCode: premiereMatiere.semestreCode
            });
        } else {
            matieresSpecifiques.push({
                matiereLibelle: libelle,
                filiereCode: filieres[0],
                regimeCode: premiereMatiere.regimeCode,
                semestreCode: premiereMatiere.semestreCode
            });
        }
    });

    console.log("→ Matières communes :", matieresCommunes.length);
    matieresCommunes.forEach(function (matiere) {
        console.log("  ", matiere.matiereLibelle, "|", matiere.filieres.join(" / "));
    });
    console.log("→ Matières spécifiques :", matieresSpecifiques.length);
    matieresSpecifiques.forEach(function (matiere) {
        console.log("  ", matiere.matiereLibelle, "|", matiere.filiereCode);
    });

    return {
        niveauCode: niveauCode,
        sessionCode: sessionCode,
        regimeCode: session.regimeCode,
        semestreCode: session.semestreCode,
        matieresCommunes: matieresCommunes,
        matieresSpecifiques: matieresSpecifiques
    };
}

// =====================================================
// OBTENIR UNE SESSION
// =====================================================

function obtenirSession(sessionCode) {
    return donneesGeneration.sessions.find(function (session) {
        return session.sessionCode === sessionCode;
    });
}

// =====================================================
// OBTENIR LES CRÉNEAUX D'UNE SESSION
// =====================================================

function obtenirCreneauxDeSession(sessionCode) {
    const creneaux = donneesGeneration.creneaux.filter(function (creneau) {
        return creneau.sessionCode === sessionCode;
    });
    creneaux.sort(function (a, b) {
        return Number(a.creneauOrdre) - Number(b.creneauOrdre);
    });
    return creneaux;
}

// =====================================================
// CONVERTIR UNE DATE EXCEL EN OBJET DATE
// =====================================================

function convertirDateExcelPourGeneration(valeur) {
    if (valeur instanceof Date) {
        return new Date(valeur.getFullYear(), valeur.getMonth(), valeur.getDate());
    }
    if (typeof valeur === "number") {
        const date = new Date(Date.UTC(1899, 11, 30));
        date.setUTCDate(date.getUTCDate() + valeur);
        return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    }
    if (typeof valeur === "string" && valeur.trim() !== "") {
        const date = new Date(valeur);
        if (!isNaN(date.getTime())) {
            return new Date(date.getFullYear(), date.getMonth(), date.getDate());
        }
    }
    return null;
}

// =====================================================
// FORMATER UNE DATE
// =====================================================

function formaterDateGeneration(date) {
    const jour = String(date.getDate()).padStart(2, "0");
    const mois = String(date.getMonth() + 1).padStart(2, "0");
    const annee = date.getFullYear();
    return jour + "/" + mois + "/" + annee;
}

// =====================================================
// GÉNÉRER LA LISTE DES DATES
// =====================================================

function genererListeDates(dateDebut, dateFin) {
    const dates = [];
    const debut = convertirDateExcelPourGeneration(dateDebut);
    const fin = convertirDateExcelPourGeneration(dateFin);

    if (!debut || !fin) {
        console.error("❌ Dates de session invalides.");
        return dates;
    }
    if (debut > fin) {
        console.error("❌ La date de début est après la date de fin.");
        return dates;
    }

    let dateCourante = new Date(debut);
    while (dateCourante <= fin) {
        if (dateCourante.getDay() !== 0) {
            dates.push({
                date: new Date(dateCourante),
                dateAffichage: formaterDateGeneration(dateCourante)
            });
        }
        dateCourante.setDate(dateCourante.getDate() + 1);
    }
    return dates;
}

// =====================================================
// CONSTRUIRE LA GRILLE D'UNE SESSION
// =====================================================

function construireGrilleSession(sessionCode) {
    console.log("==========================================");
    console.log("CONSTRUCTION DE LA GRILLE");
    console.log("Session :", sessionCode);
    console.log("==========================================");

    const session = obtenirSession(sessionCode);
    if (!session) {
        console.error("❌ Session introuvable :", sessionCode);
        return [];
    }

    const creneaux = obtenirCreneauxDeSession(sessionCode);
    if (creneaux.length === 0) {
        console.error("❌ Aucun créneau trouvé pour :", sessionCode);
        return [];
    }

    const dates = genererListeDates(session.dateDebut, session.dateFin);
    if (dates.length === 0) {
        console.error("❌ Aucune date disponible pour la session.");
        return [];
    }

    const grille = [];
    dates.forEach(function (dateInfo) {
        creneaux.forEach(function (creneau) {
            grille.push({
                sessionCode: sessionCode,
                date: dateInfo.date,
                dateAffichage: dateInfo.dateAffichage,
                creneauOrdre: Number(creneau.creneauOrdre),
                heureDebut: creneau.heureDebut,
                heureFin: creneau.heureFin,
                heureDebutAffichage: creneau.heureDebutAffichage || "",
                heureFinAffichage: creneau.heureFinAffichage || "",
                nombreMatieres: 0
            });
        });
    });

    console.log("Dates disponibles :", dates.length);
    console.log("Créneaux par jour :", creneaux.length);
    console.log("Nombre total de positions :", grille.length);
    console.table(grille.map(function (position) {
        return {
            Date: position.dateAffichage,
            Créneau: position.creneauOrdre,
            Horaire: (position.heureDebutAffichage || "") + " - " + (position.heureFinAffichage || ""),
            Matieres: position.nombreMatieres
        };
    }));
    console.log("------------------------------------------");
    console.log("✓ GRILLE CONSTRUITE");
    console.log("------------------------------------------");

    return grille;
}

// =====================================================
// CONSTRUIRE LA MATRICE DU PLANNING
// =====================================================

function construireMatricePlanning(niveauCode, sessionCode) {
    const structure = preparerMatieresPourSession(niveauCode, sessionCode);
    const grille = construireGrilleSession(sessionCode);

    if (!grille || grille.length === 0) {
        console.error("❌ Impossible de construire la matrice : grille vide.");
        return null;
    }

    const filieres = obtenirFilieresDuNiveau(niveauCode);
    if (!filieres || filieres.length === 0) {
        console.error("❌ Aucune filière trouvée pour le niveau :", niveauCode);
        return null;
    }

    const planning = {
        niveauCode: niveauCode,
        sessionCode: sessionCode,
        filieres: []
    };

    filieres.forEach(function (filiereCode) {
        const ligneFiliere = {
            filiereCode: filiereCode,
            amphis: [],
            cellules: []
        };

        grille.forEach(function (position) {
            ligneFiliere.cellules.push({
                date: position.date,
                dateAffichage: position.dateAffichage,
                creneauOrdre: position.creneauOrdre,
                heureDebut: position.heureDebut,
                heureFin: position.heureFin,
                heureDebutAffichage: position.heureDebutAffichage || "",
                heureFinAffichage: position.heureFinAffichage || "",
                matiereLibelle: "",
                regimeCode: "",
                semestreCode: "",
                estOccupee: false,
                estCommune: false
            });
        });

        planning.filieres.push(ligneFiliere);
    });

    planning.matieresCommunes = structure.matieresCommunes;
    planning.matieresSpecifiques = structure.matieresSpecifiques;

    console.log("MATRICE DU PLANNING CONSTRUITE");
    console.log("Niveau :", niveauCode);
    console.log("Session :", sessionCode);
    console.log("Filières :", planning.filieres.map(function (filiere) {
        return filiere.filiereCode;
    }));
    console.log("Nombre de positions par filière :", grille.length);
    console.log("Matières communes disponibles :", planning.matieresCommunes.length);
    console.log("Matières spécifiques disponibles :", planning.matieresSpecifiques.length);

    planning.filieres.forEach(function (filiere) {
        console.log("Filière :", filiere.filiereCode, "→", filiere.cellules.length, "cellules");
    });

    return planning;
}

// =====================================================
// PLACEMENT DES MATIÈRES COMMUNES (amélioré)
// =====================================================
// Améliorations techniques (logique métier conservée) :
// - Vérifie l'absence de matières successives le même jour
//   pour CHAQUE filière concernée
// - Parmi les positions valides, choisit celle qui
//   équilibre le mieux les charges globales
// =====================================================

function placerMatieresCommunes(planning) {
    if (!planning) {
        console.error("❌ Planning absent.");
        return null;
    }

    if (!planning.matieresCommunes || planning.matieresCommunes.length === 0) {
        console.log("ℹ️ Aucune matière commune à placer.");
        return planning;
    }

    console.log("------------------------------------------");
    console.log("PLACEMENT DES MATIÈRES COMMUNES");
    console.log("------------------------------------------");

    planning.matieresCommunes.forEach(function (matiereCommune) {
        const filieresConcernees = matiereCommune.filieres;

        if (!filieresConcernees || filieresConcernees.length < 2) {
            console.warn("⚠️ Matière commune invalide :", matiereCommune.matiereLibelle);
            return;
        }

        const premiereFiliere = planning.filieres.find(function (filiere) {
            return filieresConcernees.includes(filiere.filiereCode);
        });

        if (!premiereFiliere) {
            console.warn("⚠️ Filière introuvable pour :", matiereCommune.matiereLibelle);
            return;
        }

        // -------------------------------------------------
        // Collecter toutes les positions candidates valides
        // -------------------------------------------------
        const positionsCandidates = [];

        for (let i = 0; i < premiereFiliere.cellules.length; i++) {
            const celluleCandidate = premiereFiliere.cellules[i];

            // 1. La position doit être libre dans TOUTES les filières concernées
            const positionLibrePartout = filieresConcernees.every(function (filiereCode) {
                const filiere = planning.filieres.find(function (f) {
                    return f.filiereCode === filiereCode;
                });
                if (!filiere) return false;

                const cellule = filiere.cellules.find(function (c) {
                    return (
                        c.dateAffichage === celluleCandidate.dateAffichage &&
                        c.creneauOrdre === celluleCandidate.creneauOrdre
                    );
                });
                return cellule && cellule.estOccupee === false;
            });

            if (!positionLibrePartout) continue;

            // 2. Vérifier l'absence de matières successives le même jour
            //    pour CHAQUE filière concernée
            const pasDeSuccessives = filieresConcernees.every(function (filiereCode) {
                const filiere = planning.filieres.find(function (f) {
                    return f.filiereCode === filiereCode;
                });
                if (!filiere) return false;

                const cellulesMemeJour = filiere.cellules.filter(function (c) {
                    return c.dateAffichage === celluleCandidate.dateAffichage;
                });

                const precedente = cellulesMemeJour.find(function (c) {
                    return c.creneauOrdre === celluleCandidate.creneauOrdre - 1;
                });
                const suivante = cellulesMemeJour.find(function (c) {
                    return c.creneauOrdre === celluleCandidate.creneauOrdre + 1;
                });

                if (precedente && precedente.estOccupee) return false;
                if (suivante && suivante.estOccupee) return false;
                return true;
            });

            if (!pasDeSuccessives) continue;

            positionsCandidates.push(celluleCandidate);
        }

        // -------------------------------------------------
        // Aucune position valide
        // -------------------------------------------------
        if (positionsCandidates.length === 0) {
            console.error(
                "❌ Aucune position disponible pour la matière commune :",
                matiereCommune.matiereLibelle
            );
            return;
        }

        // -------------------------------------------------
        // Choisir la meilleure position (équilibrage)
        // -------------------------------------------------
        const chargesActuelles = calculerChargeDesCreneaux(planning);

        let positionChoisie = null;
        let meilleurEcart = Infinity;
        let meilleureDispersion = Infinity;
        let meilleureChargeAvant = Infinity;

        positionsCandidates.forEach(function (position) {
            const chargesSimulees = { ...chargesActuelles };
            const creneau = position.creneauOrdre;
            chargesSimulees[creneau] = (chargesSimulees[creneau] || 0) + 1;

            const valeurs = Object.values(chargesSimulees);
            const chargeMin = Math.min(...valeurs);
            const chargeMax = Math.max(...valeurs);
            const ecart = chargeMax - chargeMin;

            const moyenne = valeurs.reduce(function (s, v) { return s + v; }, 0) / valeurs.length;
            const dispersion = valeurs.reduce(function (s, v) {
                return s + Math.pow(v - moyenne, 2);
            }, 0);

            const chargeAvant = chargesActuelles[creneau] || 0;

            if (
                ecart < meilleurEcart ||
                (ecart === meilleurEcart && dispersion < meilleureDispersion) ||
                (ecart === meilleurEcart && dispersion === meilleureDispersion && chargeAvant < meilleureChargeAvant)
            ) {
                positionChoisie = position;
                meilleurEcart = ecart;
                meilleureDispersion = dispersion;
                meilleureChargeAvant = chargeAvant;
            }
        });

        // Sécurité : si aucune position n'a été retenue (ne devrait pas arriver)
        if (!positionChoisie) {
            positionChoisie = positionsCandidates[0];
        }

        // -------------------------------------------------
        // Affectation dans toutes les filières concernées
        // -------------------------------------------------
        filieresConcernees.forEach(function (filiereCode) {
            const filiere = planning.filieres.find(function (f) {
                return f.filiereCode === filiereCode;
            });
            if (!filiere) return;

            const cellule = filiere.cellules.find(function (c) {
                return (
                    c.dateAffichage === positionChoisie.dateAffichage &&
                    c.creneauOrdre === positionChoisie.creneauOrdre
                );
            });
            if (!cellule) return;

            cellule.matiereLibelle = matiereCommune.matiereLibelle;
            cellule.estOccupee = true;
            cellule.estCommune = true;
        });

        console.log("✓ Matière commune placée :", matiereCommune.matiereLibelle);
        console.log("  Filières :", filieresConcernees.join(" / "));
        console.log("  Date :", positionChoisie.dateAffichage);
        console.log(
            "  Créneau :",
            positionChoisie.creneauOrdre,
            "(" + (positionChoisie.heureDebutAffichage || "") + " - " + (positionChoisie.heureFinAffichage || "") + ")"
        );
    });

    console.log("------------------------------------------");
    console.log("✓ MATIÈRES COMMUNES PLACÉES");
    console.log("------------------------------------------");

    planning.filieres.forEach(function (filiere) {
        const matieresPlacees = filiere.cellules.filter(function (cellule) {
            return cellule.estOccupee;
        });
        console.log(filiere.filiereCode + " → " + matieresPlacees.length + " matière(s) placée(s)");
    });

    return planning;
}

// =====================================================
// TROUVER UNE POSITION POUR UNE MATIÈRE SPÉCIFIQUE
// =====================================================

function trouverPositionPourMatiereSpecifique(planning, filiereCode) {
    const ECART_MAX_AUTORISE = 1;

    const filiere = planning.filieres.find(function (f) {
        return f.filiereCode === filiereCode;
    });

    if (!filiere) {
        console.error("❌ Filière introuvable dans le planning :", filiereCode);
        return null;
    }

    const chargesCreneaux = calculerChargeDesCreneaux(planning);
    console.log("Charge globale utilisée pour", filiereCode, ":", chargesCreneaux);

    const positionsPossibles = filiere.cellules.filter(function (cellule) {
        if (cellule.estOccupee) return false;

        const cellulesMemeJour = filiere.cellules.filter(function (autre) {
            return autre.dateAffichage === cellule.dateAffichage;
        });

        const cellulePrecedente = cellulesMemeJour.find(function (autre) {
            return autre.creneauOrdre === cellule.creneauOrdre - 1;
        });
        const celluleSuivante = cellulesMemeJour.find(function (autre) {
            return autre.creneauOrdre === cellule.creneauOrdre + 1;
        });

        if (cellulePrecedente && cellulePrecedente.estOccupee) return false;
        if (celluleSuivante && celluleSuivante.estOccupee) return false;

        return true;
    });

    if (positionsPossibles.length === 0) {
        console.error("❌ Aucune cellule disponible pour :", filiereCode);
        return null;
    }

    let positionChoisie = null;
    let meilleurEcart = Infinity;
    let meilleureDispersion = Infinity;
    let meilleureChargeAvant = Infinity;

    positionsPossibles.forEach(function (position) {
        const chargesSimulees = { ...chargesCreneaux };
        const creneau = position.creneauOrdre;
        chargesSimulees[creneau] = (chargesSimulees[creneau] || 0) + 1;

        const valeursCharges = Object.values(chargesSimulees);
        const chargeMin = Math.min(...valeursCharges);
        const chargeMax = Math.max(...valeursCharges);
        const ecart = chargeMax - chargeMin;

        const moyenne = valeursCharges.reduce(function (somme, charge) {
            return somme + charge;
        }, 0) / valeursCharges.length;

        const dispersion = valeursCharges.reduce(function (somme, charge) {
            return somme + Math.pow(charge - moyenne, 2);
        }, 0);

        const chargeAvant = chargesCreneaux[creneau] || 0;

        if (
            ecart < meilleurEcart ||
            (ecart === meilleurEcart && dispersion < meilleureDispersion) ||
            (ecart === meilleurEcart && dispersion === meilleureDispersion && chargeAvant < meilleureChargeAvant)
        ) {
            positionChoisie = position;
            meilleurEcart = ecart;
            meilleureDispersion = dispersion;
            meilleureChargeAvant = chargeAvant;
        }
    });

    console.log(
        "✓ Position trouvée :",
        filiereCode,
        "|",
        positionChoisie.dateAffichage,
        "| Créneau",
        positionChoisie.creneauOrdre,
        "|",
        positionChoisie.heureDebutAffichage,
        "-",
        positionChoisie.heureFinAffichage,
        "| Charge avant placement :",
        chargesCreneaux[positionChoisie.creneauOrdre] || 0
    );

    return positionChoisie;
}

// =====================================================
// PLACEMENT DES MATIÈRES SPÉCIFIQUES
// =====================================================

function placerMatieresSpecifiques(planning) {
    console.log("------------------------------------------");
    console.log("PLACEMENT DES MATIÈRES SPÉCIFIQUES");
    console.log("------------------------------------------");

    if (!planning) {
        console.error("❌ Planning introuvable.");
        return planning;
    }

    const matieresSpecifiques = planning.matieresSpecifiques || [];

    if (matieresSpecifiques.length === 0) {
        console.log("ℹ️ Aucune matière spécifique à placer.");
        return planning;
    }

    matieresSpecifiques.forEach(function (matiere) {
        const filiereCode = matiere.filiereCode;

        console.log("→ Placement :", matiere.matiereLibelle, "| Filière :", filiereCode);

        const position = trouverPositionPourMatiereSpecifique(planning, filiereCode);

        if (!position) {
            console.warn(
                "⚠️ Impossible de placer la matière :",
                matiere.matiereLibelle,
                "| Filière :",
                filiereCode
            );
            return;
        }

        position.estOccupee = true;
        position.matiereLibelle = matiere.matiereLibelle;
        position.regimeCode = matiere.regimeCode;
        position.semestreCode = matiere.semestreCode;
        position.filiereCode = filiereCode;

        console.log("✓ Matière spécifique placée :", matiere.matiereLibelle);
        console.log("  Filière :", filiereCode);
        console.log("  Date :", position.dateAffichage);
        console.log(
            "  Créneau :",
            position.creneauOrdre,
            "(",
            position.heureDebutAffichage,
            "-",
            position.heureFinAffichage,
            ")"
        );
    });

    console.log("------------------------------------------");
    console.log("✓ MATIÈRES SPÉCIFIQUES PLACÉES");
    console.log("------------------------------------------");

    return planning;
}

// =====================================================
// CALCULER LA CHARGE DES CRÉNEAUX DU NIVEAU
// =====================================================

function calculerChargeDesCreneaux(planning) {
    const charges = {};
    const examensComptes = new Set();

    planning.filieres.forEach(function (filiere) {
        filiere.cellules.forEach(function (cellule) {
            const creneau = cellule.creneauOrdre;
            if (charges[creneau] === undefined) {
                charges[creneau] = 0;
            }
        });
    });

    planning.filieres.forEach(function (filiere) {
        filiere.cellules.forEach(function (cellule) {
            if (!cellule.estOccupee) return;

            const creneau = cellule.creneauOrdre;
            const cleExamen = cellule.estCommune
                ? "COMMUNE|" + cellule.dateAffichage + "|" + creneau + "|" + cellule.matiereLibelle
                : "SPECIFIQUE|" + filiere.filiereCode + "|" + cellule.dateAffichage + "|" + creneau + "|" + cellule.matiereLibelle;

            if (examensComptes.has(cleExamen)) return;

            examensComptes.add(cleExamen);
            charges[creneau]++;
        });
    });

    console.log("------------------------------------------");
    console.log("CHARGE DES CRÉNEAUX — ÉPREUVES DISTINCTES");
    console.log("------------------------------------------");
    console.table(charges);

    return charges;
}

// =====================================================
// VÉRIFIER L'ÉQUILIBRE GLOBAL DES CRÉNEAUX
// =====================================================

function verifierEquilibreGlobalCreneaux(planning) {
    const charges = calculerChargeDesCreneaux(planning);
    const valeursCharges = Object.values(charges);

    if (valeursCharges.length === 0) {
        console.warn("⚠️ Aucune charge de créneau à vérifier.");
        return null;
    }

    const chargeMin = Math.min(...valeursCharges);
    const chargeMax = Math.max(...valeursCharges);
    const ecart = chargeMax - chargeMin;
    const equilibreAtteint = ecart <= 1;

    console.log("Équilibre global des créneaux :", charges, "| Écart :", ecart);

    if (!equilibreAtteint) {
        const detail = Object.entries(charges)
            .sort(function (a, b) {
                return Number(a[0]) - Number(b[0]);
            })
            .map(function ([creneau, charge]) {
                return "Créneau " + creneau + " : " + charge + " épreuve(s)";
            })
            .join("\n");

        alert(
            "L'équilibre global des créneaux non atteint.\n\n" +
            "Écart global : " + ecart + " épreuve(s).\n\n" +
            detail +
            "\n\nUne correction manuelle du planning est recommandée."
        );
    } else {
        console.log("✓ Équilibre global des créneaux atteint.");
    }

    return {
        equilibreAtteint: equilibreAtteint,
        ecart: ecart,
        charges: charges
    };
}

// =====================================================
// CONSTRUIRE LA STRUCTURE DU NIVEAU
// =====================================================

function construireStructureNiveau(niveauCode) {
    const structure = {
        niveauCode: niveauCode,
        filieres: []
    };

    const filieres = obtenirFilieresDuNiveau(niveauCode);
    filieres.forEach(function (filiereCode) {
        const matieres = obtenirMatieresDeFiliere(niveauCode, filiereCode);
        structure.filieres.push({
            filiereCode: filiereCode,
            matieres: matieres
        });
    });

    return structure;
}

// =====================================================
// CONSTRUIRE TOUTE LA STRUCTURE
// =====================================================

function construireStructureGeneration() {
    console.log("==========================================");
    console.log("STRUCTURE DE PLANIFICATION");
    console.log("==========================================");

    const niveaux = obtenirNiveaux();
    console.log("Niveaux détectés :", niveaux);

    const structure = [];
    niveaux.forEach(function (niveauCode) {
        const niveau = construireStructureNiveau(niveauCode);
        structure.push(niveau);

        console.log("------------------------------------------");
        console.log("Niveau :", niveauCode);
        console.log("Filières :", niveau.filieres.map(function (filiere) {
            return filiere.filiereCode;
        }));

        niveau.filieres.forEach(function (filiere) {
            console.log("  Filière :", filiere.filiereCode);
            console.log("  Matières :", filiere.matieres.map(function (matiere) {
                return matiere.matiereLibelle;
            }));
        });
    });

    console.log("------------------------------------------");
    console.log("✓ STRUCTURE CONSTRUITE");
    console.log("------------------------------------------");

    return structure;
}

// =====================================================
// PRÉPARER LE MOTEUR
// =====================================================

async function preparerGeneration() {
    console.log("");
    console.log("==========================================");
    console.log("MOTEUR DE GÉNÉRATION DES EXAMENS");
    console.log("==========================================");

    const chargement = await chargerDonneesGeneration();
    if (!chargement) {
        console.error("❌ Impossible de préparer la génération.");
        return null;
    }

    const verification = verifierDonneesGeneration();
    if (!verification) {
        console.error("❌ Les données ne sont pas suffisantes.");
        return null;
    }

    const structure = construireStructureGeneration();

    console.log("");
    console.log("✓ MOTEUR PRÊT");
    console.log("==========================================");

    return structure;
}

// =====================================================
// CHARGER UN CALENDRIER DEPUIS FIRESTORE
// =====================================================

async function chargerCalendrier(niveauCode, semestreCode, regimeCode, sessionCode) {
    const session = obtenirSession(sessionCode);
    if (!session) {
        console.error("❌ Session introuvable :", sessionCode);
        return null;
    }

    const anneeUniversitaire = session.anneeUniversitaire;
    const idCalendrier =
        "calendrier_" +
        anneeUniversitaire + "_" +
        niveauCode + "_" +
        semestreCode + "_" +
        regimeCode + "_" +
        sessionCode;

    console.log("🔎 Recherche du calendrier dans Firestore :", idCalendrier);

    const referenceCalendrier = doc(db, "calendriers", idCalendrier);
    const documentCalendrier = await getDoc(referenceCalendrier);

    if (!documentCalendrier.exists()) {
        console.log("ℹ️ Aucun calendrier enregistré pour :", idCalendrier);
        return null;
    }

    const donnees = documentCalendrier.data();
    console.log("✓ Calendrier trouvé dans Firestore :", idCalendrier);

    return {
        ...donnees.planning,
        anneeUniversitaire: donnees.anneeUniversitaire || anneeUniversitaire
    };
}

// =====================================================
// ENREGISTRER UN CALENDRIER DANS FIRESTORE
// =====================================================

async function enregistrerCalendrier(planning) {
    console.log("==========================================");
    console.log("ENREGISTREMENT DU CALENDRIER");
    console.log("==========================================");

    if (!planning) {
        console.error("❌ Aucun planning à enregistrer.");
        return null;
    }
    if (!planning.niveauCode) {
        console.error("❌ Niveau du planning absent.");
        return null;
    }
    if (!planning.sessionCode) {
        console.error("❌ Session du planning absente.");
        return null;
    }

    const session = obtenirSession(planning.sessionCode);
    if (!session) {
        console.error("❌ Session introuvable :", planning.sessionCode);
        return null;
    }

    const anneeUniversitaire = session.anneeUniversitaire;
    if (!anneeUniversitaire) {
        console.error("❌ Année universitaire absente de la session.");
        return null;
    }

    const semestreCode = session.semestreCode;
    const regimeCode = session.regimeCode;
    if (!semestreCode || !regimeCode) {
        console.error("❌ Semestre ou régime absent de la session.");
        return null;
    }

    const idCalendrier =
        "calendrier_" +
        anneeUniversitaire + "_" +
        planning.niveauCode + "_" +
        semestreCode + "_" +
        regimeCode + "_" +
        planning.sessionCode;

    console.log("ID du calendrier :", idCalendrier);

    const referenceCalendrier = doc(db, "calendriers", idCalendrier);
    const documentExistant = await getDoc(referenceCalendrier);

    if (documentExistant.exists()) {
        console.log("⚠️ Le calendrier existe déjà dans Firestore :", idCalendrier);
    } else {
        console.log("✓ Aucun calendrier existant. Création du calendrier :", idCalendrier);
    }

    const controleInitial = {
        valide: false,
        dateControle: null,
        matieresNonPlacees: [],
        doublons: [],
        erreursCommunes: [],
        erreursCreneauxSuccessifs: [],
        ecartEquilibrage: null
    };

    const documentCalendrier = {
        anneeUniversitaire: anneeUniversitaire,
        niveauCode: planning.niveauCode,
        semestreCode: semestreCode,
        regimeCode: regimeCode,
        sessionCode: planning.sessionCode,
        sessionLibelle: session.sessionLibelle || "",
        statut: "brouillon",
        creeLe: documentExistant.exists()
            ? documentExistant.data().creeLe
            : serverTimestamp(),
        modifieLe: serverTimestamp(),
        planning: planning,
        controle: controleInitial
    };

    try {
        if (documentExistant.exists()) {
            await updateDoc(referenceCalendrier, documentCalendrier);
            console.log("✓ Calendrier existant mis à jour :", idCalendrier);
        } else {
            await setDoc(referenceCalendrier, documentCalendrier);
            console.log("✓ Nouveau calendrier créé :", idCalendrier);
        }

        console.log("✓ Calendrier enregistré dans Firestore.");
        console.log("Document :", idCalendrier);
        console.log("Niveau :", planning.niveauCode);
        console.log("Session :", planning.sessionCode);
        console.log("Statut : brouillon");

        return {
            id: idCalendrier,
            anneeUniversitaire: anneeUniversitaire,
            niveauCode: planning.niveauCode,
            semestreCode: semestreCode,
            regimeCode: regimeCode,
            sessionCode: planning.sessionCode,
            statut: "brouillon"
        };
    } catch (erreur) {
        console.error("❌ Erreur lors de l'enregistrement du calendrier :", erreur);
        return null;
    }
}

// =====================================================
// PUBLIER UN CALENDRIER DANS FIRESTORE
// =====================================================

async function publierCalendrier(idCalendrier) {
    console.log("==========================================");
    console.log("📢 PUBLICATION DU CALENDRIER");
    console.log("==========================================");

    if (!idCalendrier) {
        console.error("❌ Aucun calendrier à publier.");
        return false;
    }

    console.log("ID du calendrier à publier :", idCalendrier);

    try {
        const referenceCalendrier = doc(db, "calendriers", idCalendrier);
        const documentCalendrier = await getDoc(referenceCalendrier);

        if (!documentCalendrier.exists()) {
            console.error("❌ Calendrier introuvable :", idCalendrier);
            return false;
        }

        const donneesCalendrier = documentCalendrier.data();
        console.log("✓ Calendrier trouvé :", idCalendrier);
        console.log("Statut actuel :", donneesCalendrier.statut);

        if (donneesCalendrier.statut !== "brouillon") {
            console.warn("⚠️ Le calendrier n'est pas un brouillon.");
            console.warn("Statut actuel :", donneesCalendrier.statut);
            return false;
        }

        await setDoc(
            referenceCalendrier,
            {
                statut: "publie",
                modifieLe: serverTimestamp()
            },
            { merge: true }
        );

        console.log("------------------------------------------");
        console.log("✅ CALENDRIER PUBLIÉ DANS FIRESTORE");
        console.log("Document :", idCalendrier);
        console.log("Statut : publie");
        console.log("------------------------------------------");

        return true;
    } catch (erreur) {
        console.error("❌ Erreur lors de la publication :", erreur);
        return false;
    }
}

// =====================================================
// ACCÈS AUX DONNÉES CHARGÉES POUR LES AUTRES MODULES
// =====================================================

function obtenirDonneesGeneration() {
    return donneesGeneration;
}

// =====================================================
// EXPOSER LES FONCTIONS
// =====================================================

function definirDernierCalendrierEnregistre(idCalendrier) {
    dernierCalendrierEnregistre = idCalendrier;
    console.log("✓ Dernier calendrier enregistré défini :", dernierCalendrierEnregistre);
}

window.generationExamens = {
    definirDernierCalendrierEnregistre: definirDernierCalendrierEnregistre,
    chargerDonnees: chargerDonneesGeneration,
    obtenirDonnees: obtenirDonneesGeneration,
    verifierDonnees: verifierDonneesGeneration,
    obtenirNiveaux: obtenirNiveaux,
    obtenirFilieres: obtenirFilieresDuNiveau,
    obtenirMatieres: obtenirMatieresDeFiliere,
    identifierMatieresCommunes: identifierMatieresCommunes,
    preparerMatieresPourPlanification: preparerMatieresPourPlanification,
    obtenirSession: obtenirSession,
    obtenirCreneauxDeSession: obtenirCreneauxDeSession,
    genererListeDates: genererListeDates,
    construireGrilleSession: construireGrilleSession,
    construireMatricePlanning: construireMatricePlanning,
    placerMatieresCommunes: placerMatieresCommunes,
    preparerMatieresPourSession: preparerMatieresPourSession,
    trouverPositionPourMatiereSpecifique: trouverPositionPourMatiereSpecifique,
    calculerChargeDesCreneaux: calculerChargeDesCreneaux,
    placerMatieresSpecifiques: placerMatieresSpecifiques,
    construireStructure: construireStructureGeneration,
    chargerCalendrier: chargerCalendrier,
    enregistrerCalendrier: enregistrerCalendrier,
    publierCalendrier: publierCalendrier,
    preparer: preparerGeneration
};

// =====================================================
// INITIALISATION
// =====================================================

document.addEventListener("DOMContentLoaded", async function () {
    console.log("✓ generation.js chargé.");

    await preparerGeneration();

    // -------------------------------------------------
    // BOUTON : GÉNÉRER LE CALENDRIER
    // -------------------------------------------------
    const boutonGenerer = document.getElementById("btnGenererCalendrier");
    console.log("🔎 Bouton trouvé :", boutonGenerer);

    if (!boutonGenerer) {
        console.error("❌ Bouton btnGenererCalendrier introuvable.");
        return;
    }

    boutonGenerer.addEventListener("click", async function () {
        console.log("==========================================");
        console.log("🚀 BOUTON GÉNÉRER LE CALENDRIER");
        console.log("==========================================");

        const niveauCode = "L1";
        const sessionCode = "PRINCIPALE_S1";

        console.log("Niveau :", niveauCode);
        console.log("Session :", sessionCode);

        const planning = construireMatricePlanning(niveauCode, sessionCode);

        placerMatieresCommunes(planning);
        console.log("✓ Matières communes placées.");
        console.log("Planning après placement des matières communes :", planning);

        console.log("🔎 AVANT PLACEMENT SPÉCIFIQUE");
        placerMatieresSpecifiques(planning);
        console.log("🔎 APRÈS PLACEMENT SPÉCIFIQUE");

        verifierEquilibreGlobalCreneaux(planning);
        console.log("✓ Matières spécifiques placées.");
        console.log("Planning après placement des matières spécifiques :", planning);

        const resultatControle = controleExamens.verifierPlanningGlobal(planning);
        console.log("✓ Résultat du contrôle global :", resultatControle);

        if (!resultatControle || !resultatControle.valide) {
            console.warn("⚠️ Le planning n'est pas valide. Enregistrement annulé.");
            return;
        }

        const calendrierEnregistre = await enregistrerCalendrier(planning);

        if (calendrierEnregistre) {
            dernierCalendrierEnregistre = calendrierEnregistre.id;
            console.log("✅ CALENDRIER ENREGISTRÉ COMME BROUILLON");
            console.log("📌 Dernier calendrier enregistré :", dernierCalendrierEnregistre);

            const boutonPublier = document.getElementById("btnPublierCalendrierAdmin");
            if (boutonPublier) {
                boutonPublier.disabled = false;
                console.log("✓ Bouton Publier activé.");
            }
        } else {
            console.error("❌ Échec de l'enregistrement du calendrier.");
        }
    });

    console.log("✓ Bouton Générer le calendrier connecté.");

    // =================================================
    // BOUTON : PUBLIER LE CALENDRIER
    // =================================================
    const boutonPublier = document.getElementById("btnPublierCalendrierAdmin");
    console.log("🔎 Bouton Publier trouvé :", boutonPublier);

    if (boutonPublier) {
        boutonPublier.addEventListener("click", async function () {
            console.log("==========================================");
            console.log("📢 BOUTON PUBLIER LE CALENDRIER");
            console.log("==========================================");

            if (!dernierCalendrierEnregistre) {
                console.error("❌ Aucun calendrier enregistré à publier.");
                return;
            }

            const publicationOK = await publierCalendrier(dernierCalendrierEnregistre);

            if (publicationOK) {
                console.log("🎉 PUBLICATION TERMINÉE AVEC SUCCÈS.");
                boutonPublier.disabled = true;
            } else {
                console.error("❌ La publication a échoué.");
            }
        });

        console.log("✓ Bouton Publier connecté.");
    }
});
