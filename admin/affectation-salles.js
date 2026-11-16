// =================================================
// AFFECTATION DES SALLES / AMPHIS - VERSION AMÉLIORÉE
// Règle : Enregistrer d'abord ce qui est propre, laisser le reste intact
// =================================================

import { app } from "../firebase-config.js";
import {
    getFirestore,
    getDocs,
    collection,
    onSnapshot,
    doc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const db = getFirestore(app);
console.log("✓ affectation-salles.js (version sécurisée) chargé.");

// =================================================
// OUTILS DE VALIDATION ET DATES
// =================================================

function jourCivilAffectation(valeur) {
    let date;
    if (valeur instanceof Date) date = valeur;
    else if (valeur && typeof valeur.toDate === "function") date = valeur.toDate();
    else if (valeur && Number.isInteger(valeur.seconds)) {
        const ns = valeur.nanoseconds ?? 0;
        if (!Number.isInteger(ns) || ns < 0 || ns >= 1e9) throw new Error("Date Timestamp invalide.");
        date = new Date(valeur.seconds * 1000 + ns / 1e6);
    } else if (typeof valeur === "string") {
        const m = valeur.match(/^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/);
        if (!m) throw new Error("Date non ISO ou invalide.");
        const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
        const verif = new Date(0);
        verif.setUTCFullYear(y, mo - 1, d);
        verif.setUTCHours(0, 0, 0, 0);
        if (verif.getUTCFullYear() !== y || verif.getUTCMonth() !== mo - 1 || verif.getUTCDate() !== d) {
            throw new Error("Jour civil invalide.");
        }
        if (!m[4]) return `${m[1]}-${m[2]}-${m[3]}`;
        date = new Date(valeur);
    } else {
        throw new Error("Format de date non pris en charge.");
    }
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error("Date invalide.");
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function cleCreneauAffectation(cellule) {
    if (!cellule || cellule.creneauOrdre == null || cellule.creneauOrdre === "" || typeof cellule.creneauOrdre === "boolean") {
        throw new Error("Créneau absent ou invalide.");
    }
    const ordre = Number(cellule.creneauOrdre);
    if (!Number.isInteger(ordre) || ordre <= 0) throw new Error("Ordre de créneau invalide.");
    return jourCivilAffectation(cellule.date) + "|" + ordre;
}

function memeCreneau(celluleA, celluleB) {
    return cleCreneauAffectation(celluleA) === cleCreneauAffectation(celluleB);
}

function catalogueLocauxValide(salles) {
    if (!Array.isArray(salles)) throw new Error("Catalogue des locaux invalide.");
    const codes = new Set();
    salles.forEach(s => {
        if (!s || typeof s.code !== "string" || !s.code.trim() || s.code !== s.code.trim()) {
            throw new Error("Code local vide ou non normalisé.");
        }
        if (codes.has(s.code)) throw new Error("Code local dupliqué : " + s.code);
        codes.add(s.code);
        if (typeof s.capacite === "boolean" || s.capacite == null || String(s.capacite).trim() === "" ||
            !Number.isInteger(Number(s.capacite)) || Number(s.capacite) <= 0) {
            throw new Error("Capacité invalide : " + s.code);
        }
    });
}

function codesLocauxStricts(amphis) {
    if (!Array.isArray(amphis)) throw new Error("Liste de locaux invalide.");
    const codes = amphis.map(l => typeof l === "string" ? l : (l && (l.code || l.localCode)));
    const vus = new Set();
    codes.forEach(c => {
        if (typeof c !== "string" || !c.trim() || c !== c.trim()) throw new Error("Code d'affectation invalide.");
        if (vus.has(c)) throw new Error("Local affecté en double : " + c);
        vus.add(c);
    });
    return codes;
}

function validerPlanningDates(planning) {
    if (!planning || !Array.isArray(planning.filieres) || !planning.filieres.length || !planning.niveauCode) {
        throw new Error("Structure du planning invalide.");
    }
    const vus = new Set();
    planning.filieres.forEach(f => {
        if (!f || !f.filiereCode || vus.has(f.filiereCode) || !Array.isArray(f.cellules)) {
            throw new Error("Filière absente, dupliquée ou cellules invalides.");
        }
        if (f.niveauCode != null && f.niveauCode !== planning.niveauCode) {
            throw new Error("Niveau de filière contradictoire avec le planning : " + f.filiereCode);
        }
        vus.add(f.filiereCode);
        f.cellules.forEach(c => {
            if (!c || typeof c.estOccupee !== "boolean") throw new Error("Cellule invalide.");
            if (c.estOccupee) cleCreneauAffectation(c);
        });
    });
}

function filiereAvecNiveau(filiere, niveauCode) {
    if (!filiere || !niveauCode || (filiere.niveauCode != null && filiere.niveauCode !== niveauCode)) {
        throw new Error("Niveau de filière contradictoire ou absent du planning.");
    }
    return { ...filiere, niveauCode };
}

function lireEffectifStrict(effectifs, annee, niveau, filiere) {
    if (typeof annee !== "string" || !annee.trim()) throw new Error("Année universitaire explicite requise.");
    const lignes = effectifs.filter(l => l && l.anneeUniversitaire === annee && l.niveauCode === niveau && l.filiereCode === filiere);
    if (lignes.length !== 1) throw new Error("Effectif absent ou ambigu pour " + annee + " / " + niveau + " / " + filiere);
    const v = lignes[0].effectif;
    if (typeof v === "boolean" || v == null || String(v).trim() === "" || !Number.isInteger(Number(v)) || Number(v) <= 0) {
        throw new Error("Effectif invalide : " + filiere);
    }
    return Number(v);
}

function repartitionValidee(filiere, locaux, effectif, salles) {
    const r = filiere.repartitionLocaux;
    if (!Array.isArray(r) || r.length !== locaux.length) throw new Error("Répartition par local absente ou incomplète.");
    const vus = new Set();
    let total = 0;
    r.forEach(a => {
        if (!a || !locaux.includes(a.codeLocal) || vus.has(a.codeLocal)) throw new Error("Code de répartition invalide ou dupliqué.");
        vus.add(a.codeLocal);
        if (typeof a.effectif === "boolean" || !Number.isInteger(a.effectif) || a.effectif <= 0) throw new Error("Effectif par local invalide.");
        const s = salles.find(s => s.code === a.codeLocal);
        if (!s || a.effectif > Number(s.capacite)) throw new Error("Répartition supérieure à la capacité du local.");
        total += a.effectif;
    });
    if (total !== effectif) throw new Error("Somme de la répartition différente de l'effectif annuel.");
    return r.map(a => ({ codeLocal: a.codeLocal, effectif: a.effectif }));
}

function clesExamens(filiere) {
    return [...new Set((filiere.cellules || []).filter(c => c.estOccupee).map(c => cleCreneauAffectation(c)))];
}

// =================================================
// CAPACITÉ RÉSIDUELLE (renforcée contre les conflits de niveau)
// =================================================

function capaciteRestanteLocal(filiere, code, salles, affectations) {
    const capacite = Number(salles.find(s => s.code === code).capacite);
    let restant = capacite;

    for (const cle of clesExamens(filiere)) {
        let utilise = 0;
        for (const a of affectations) {
            if (!a.locaux.includes(code) || !clesExamens(a.filiere).includes(cle)) continue;

            // Règle stricte : interdiction de partage entre niveaux différents
            if (!filiere.niveauCode || !a.filiere.niveauCode) throw new Error("Niveau canonique de réservation absent.");
            if (filiere.niveauCode !== a.filiere.niveauCode) {
                return 0; // Conflit de niveau → capacité nulle
            }

            const r = a.repartitionLocaux || a.filiere.repartitionLocaux;
            if (!Array.isArray(r)) throw new Error("Répartition de réservation absente.");
            utilise += r.find(x => x.codeLocal === code)?.effectif || 0;
        }
        restant = Math.min(restant, capacite - utilise);
    }
    return Math.max(0, restant);
}

// =================================================
// CONFLITS ENTRE FILIÈRES (même calendrier)
// =================================================

function construireConflitsFilieres(planning) {
    const conflits = [];
    if (!planning || !Array.isArray(planning.filieres)) return conflits;

    for (let i = 0; i < planning.filieres.length; i++) {
        const filiereA = planning.filieres[i];
        for (let j = i + 1; j < planning.filieres.length; j++) {
            const filiereB = planning.filieres[j];

            // Même niveau = pas de conflit métier
            if (filiereA.niveauCode === filiereB.niveauCode) continue;

            const examensA = (filiereA.cellules || []).filter(c => c.estOccupee);
            const examensB = (filiereB.cellules || []).filter(c => c.estOccupee);

            for (const celluleA of examensA) {
                for (const celluleB of examensB) {
                    if (memeCreneau(celluleA, celluleB)) {
                        const dejaDeclare = conflits.some(c =>
                            c.filiereA === filiereA.filiereCode &&
                            c.filiereB === filiereB.filiereCode &&
                            memeCreneau({ date: c.date, creneauOrdre: c.creneauOrdre }, celluleA)
                        );
                        if (!dejaDeclare) {
                            conflits.push({
                                filiereA: filiereA.filiereCode,
                                filiereB: filiereB.filiereCode,
                                date: celluleA.date,
                                creneauOrdre: celluleA.creneauOrdre
                            });
                        }
                    }
                }
            }
        }
    }
    return conflits;
}

function construireCarteConflits(conflits) {
    const carte = {};
    (conflits || []).forEach(c => {
        if (!carte[c.filiereA]) carte[c.filiereA] = [];
        if (!carte[c.filiereB]) carte[c.filiereB] = [];
        carte[c.filiereA].push(c.filiereB);
        carte[c.filiereB].push(c.filiereA);
    });
    return carte;
}

// =================================================
// RECHERCHE DE LA MEILLEURE COMBINAISON
// =================================================

function rechercherMeilleureCombinaisonLocaux(
    filiere,
    effectif,
    sallesAmphis,
    carteConflits,
    affectationsFilieresCourantes,
    affectationsPrecedentes
) {
    catalogueLocauxValide(sallesAmphis);
    if (typeof effectif === "boolean" || effectif == null || String(effectif).trim() === "" ||
        !Number.isInteger(Number(effectif)) || Number(effectif) <= 0) {
        throw new Error("Effectif invalide.");
    }
    validerPlanningDates({ niveauCode: filiere.niveauCode, filieres: [filiere] });

    const courantes = Array.isArray(affectationsFilieresCourantes)
        ? affectationsFilieresCourantes
        : Array.from(affectationsFilieresCourantes?.values?.() || []);

    const toutes = [...(affectationsPrecedentes || []), ...courantes];
    toutes.forEach(a => {
        codesLocauxStricts(a.locaux);
        validerPlanningDates({ niveauCode: a.filiere.niveauCode, filieres: [a.filiere] });
    });

    // Locaux avec capacité résiduelle > 0 (et respect des niveaux)
    const locauxDisponibles = sallesAmphis
        .filter(s => s.disponible === "Oui")
        .map(s => ({
            ...s,
            capaciteRestante: capaciteRestanteLocal(filiere, s.code, sallesAmphis, toutes)
        }))
        .filter(s => s.capaciteRestante > 0);

    const combinaisons = [];

    function rechercherCombinaisons(debut, combinaison, capaciteDisponible) {
        if (combinaison.length && capaciteDisponible >= effectif) {
            let restant = Number(effectif);
            const repartitionLocaux = [];
            for (let j = 0; j < combinaison.length; j++) {
                const s = locauxDisponibles.find(s => s.code === combinaison[j]);
                const quantite = Math.min(s.capaciteRestante, restant - (combinaison.length - j - 1));
                if (quantite <= 0) return;
                repartitionLocaux.push({ codeLocal: s.code, effectif: quantite });
                restant -= quantite;
            }
            if (restant !== 0) return;

            const capaciteTotale = combinaison.reduce((sum, c) =>
                sum + Number(sallesAmphis.find(x => x.code === c).capacite), 0);

            combinaisons.push({
                locaux: combinaison.slice(),
                capaciteTotale,
                capaciteDisponible,
                tauxOccupation: effectif / capaciteTotale,
                repartitionLocaux
            });
            return;
        }

        for (let i = debut; i < locauxDisponibles.length; i++) {
            combinaison.push(locauxDisponibles[i].code);
            rechercherCombinaisons(i + 1, combinaison, capaciteDisponible + locauxDisponibles[i].capaciteRestante);
            combinaison.pop();
        }
    }

    rechercherCombinaisons(0, [], 0);

    if (combinaisons.length === 0) {
        return {
            succes: false,
            locaux: [],
            capaciteTotale: 0,
            tauxOccupation: 0,
            combinaisons: [],
            message: "Aucune combinaison de locaux compatible (contraintes de niveau + capacité)."
        };
    }

    // Priorité : moins de locaux, puis capacité totale minimale
    combinaisons.sort((a, b) => {
        if (a.locaux.length !== b.locaux.length) return a.locaux.length - b.locaux.length;
        return a.capaciteTotale - b.capaciteTotale;
    });

    const meilleure = combinaisons[0];
    return {
        succes: true,
        locaux: meilleure.locaux,
        capaciteTotale: meilleure.capaciteTotale,
        tauxOccupation: meilleure.tauxOccupation,
        repartitionLocaux: meilleure.repartitionLocaux,
        message: meilleure.locaux.length === 1
            ? "Un seul local suffit."
            : "Plusieurs locaux nécessaires.",
        combinaisons
    };
}

// =================================================
// AFFECTATION AVEC BACKTRACKING (partiel autorisé)
// =================================================

function affecterLocauxFixes(planning, sallesAmphis, effectifs, affectationsPrecedentes = [], anneeUniversitaire) {
    if (!planning || !Array.isArray(planning.filieres) || !Array.isArray(sallesAmphis) ||
        !Array.isArray(effectifs) || !Array.isArray(affectationsPrecedentes)) {
        return { succes: false, affectations: [], message: "Données insuffisantes." };
    }

    try {
        catalogueLocauxValide(sallesAmphis);
        validerPlanningDates(planning);
        planning = { ...planning, filieres: planning.filieres.map(f => filiereAvecNiveau(f, planning.niveauCode)) };
        affectationsPrecedentes.forEach(prec => {
            codesLocauxStricts(prec.locaux);
            validerPlanningDates({ niveauCode: prec.filiere.niveauCode, filieres: [prec.filiere] });
        });
        if (!anneeUniversitaire) throw new Error("Année universitaire explicite requise.");
    } catch (erreur) {
        return { succes: false, affectations: [], message: erreur.message };
    }

    const conflits = construireConflitsFilieres(planning);
    const carteConflits = construireCarteConflits(conflits);

    const filieresTriees = planning.filieres.slice().sort((a, b) =>
        compterMatieresProgrammeesParFiliere(b) - compterMatieresProgrammeesParFiliere(a)
    );

    const donneesFilieres = filieresTriees.map(filiere => {
        try {
            const effectif = lireEffectifStrict(effectifs, anneeUniversitaire, planning.niveauCode, filiere.filiereCode);
            return { filiere, valide: true, effectif, message: "" };
        } catch (erreur) {
            return { filiere, valide: false, effectif: null, message: erreur.message };
        }
    });

    const LIMITE_RECHERCHE = 8000;
    let noeudsExplores = 0;
    let limiteAtteinte = false;
    let meilleureSolution = new Map();
    let meilleurNombreAffecte = -1;

    function compterMatieresProgrammeesParFiliere(filiere) {
        const matieres = new Set();
        (filiere.cellules || []).forEach(c => {
            if (c && c.estOccupee && c.matiereLibelle) matieres.add(String(c.matiereLibelle).trim());
        });
        return matieres.size;
    }

    function copierSolution(solution) {
        return new Map(Array.from(solution.entries()).map(([k, v]) => [k, { ...v, locaux: v.locaux.slice() }]));
    }

    function enregistrerMeilleureSolution(solution) {
        const nombre = Array.from(solution.values()).filter(a => a.succes).length;
        if (nombre > meilleurNombreAffecte) {
            meilleurNombreAffecte = nombre;
            meilleureSolution = copierSolution(solution);
        }
    }

    function rechercher(index, affectationsCourantes) {
        if (noeudsExplores >= LIMITE_RECHERCHE) {
            limiteAtteinte = true;
            enregistrerMeilleureSolution(affectationsCourantes);
            return;
        }
        noeudsExplores++;
        enregistrerMeilleureSolution(affectationsCourantes);

        if (index >= donneesFilieres.length) return;
        if (meilleurNombreAffecte === donneesFilieres.length) return;

        const donnee = donneesFilieres[index];
        const filiere = donnee.filiere;
        const code = filiere.filiereCode;

        if (!donnee.valide) {
            const branche = new Map(affectationsCourantes);
            branche.set(code, {
                filiereCode: code,
                effectif: donnee.effectif,
                succes: false,
                locaux: [],
                message: donnee.message
            });
            rechercher(index + 1, branche);
            return;
        }

        const resultatRecherche = rechercherMeilleureCombinaisonLocaux(
            filiere,
            donnee.effectif,
            sallesAmphis,
            carteConflits,
            Array.from(affectationsCourantes.values()).filter(a => a.succes),
            affectationsPrecedentes
        );

        const combinaisons = Array.isArray(resultatRecherche.combinaisons)
            ? resultatRecherche.combinaisons
            : (resultatRecherche.succes ? [{
                locaux: resultatRecherche.locaux,
                capaciteTotale: resultatRecherche.capaciteTotale,
                tauxOccupation: resultatRecherche.tauxOccupation,
                repartitionLocaux: resultatRecherche.repartitionLocaux
            }] : []);

        for (const combinaison of combinaisons) {
            if (limiteAtteinte) break;

            const branche = new Map(affectationsCourantes);
            branche.set(code, {
                filiereCode: code,
                effectif: donnee.effectif,
                succes: true,
                locaux: combinaison.locaux.slice(),
                filiere,
                repartitionLocaux: combinaison.repartitionLocaux.map(a => ({ ...a })),
                capaciteTotale: combinaison.capaciteTotale,
                tauxOccupation: combinaison.tauxOccupation,
                message: combinaison.locaux.length === 1
                    ? "Un local : capacité résiduelle suffisante."
                    : "Plusieurs locaux : capacité résiduelle suffisante."
            });

            rechercher(index + 1, branche);
            if (meilleurNombreAffecte === donneesFilieres.length) return;
        }

        // Explorer aussi le cas "non affectée"
        if (!limiteAtteinte) {
            const branche = new Map(affectationsCourantes);
            branche.set(code, {
                filiereCode: code,
                effectif: donnee.effectif,
                succes: false,
                locaux: [],
                message: resultatRecherche.message || "Aucune combinaison compatible."
            });
            rechercher(index + 1, branche);
        }
    }

    rechercher(0, new Map());

    const resultats = donneesFilieres.map(donnee => {
        const code = donnee.filiere.filiereCode;
        const resultat = meilleureSolution.get(code);
        if (resultat) return resultat;
        return {
            filiereCode: code,
            effectif: donnee.effectif,
            succes: false,
            locaux: [],
            message: limiteAtteinte
                ? "Affectation non résolue : limite de recherche atteinte."
                : (donnee.message || "Affectation non résolue.")
        };
    });

    const nombreAffecte = resultats.filter(r => r.succes).length;

    return {
        succes: nombreAffecte === donneesFilieres.length,
        affectations: resultats,
        message: nombreAffecte === donneesFilieres.length
            ? "Toutes les filières sont affectées."
            : `Solution partielle : ${nombreAffecte} filière(s) affectée(s) sur ${donneesFilieres.length}.`,
        rechercheLimitee: limiteAtteinte,
        nombreAffecte,
        nombreFilieres: donneesFilieres.length
    };
}

// =================================================
// GÉNÉRATION + ENREGISTREMENT PARTIEL (règle principale)
// =================================================

const btnGenererAffectations = document.getElementById("btnGenererAffectations");

if (btnGenererAffectations) {
    btnGenererAffectations.addEventListener("click", async function () {
        const statut = document.getElementById("statutAffectationSalles");
        const resume = document.getElementById("resumeAffectationSalles");

        btnGenererAffectations.disabled = true;
        if (statut) statut.textContent = "Chargement des calendriers...";

        try {
            const donnees = await window.generationExamens.obtenirDonnees();
            const sallesAmphis = donnees.sallesAmphis || [];
            const effectifs = donnees.effectifs || [];
            catalogueLocauxValide(sallesAmphis);

            if (sallesAmphis.length === 0 || effectifs.length === 0) {
                throw new Error("Les salles/amphis ou les effectifs sont absents.");
            }

            const annee = document.getElementById("anneeAffectationSalles")?.value;
            const semestre = document.getElementById("semestreAffectationSalles")?.value;
            const regime = document.getElementById("regimeAffectationSalles")?.value;
            const session = document.getElementById("sessionAffectationSalles")?.value;

            if (!annee || !semestre || !regime || !session) {
                throw new Error("Veuillez sélectionner l'année, le semestre, le régime et la session.");
            }

            const snapshot = await getDocs(collection(db, "calendriers"));
            const calendriersSelectionnes = snapshot.docs.filter(d => {
                const c = d.data();
                return String(c.anneeUniversitaire ?? "").trim() === annee &&
                       String(c.semestreCode ?? "").trim() === semestre &&
                       String(c.regimeCode ?? "").trim() === regime &&
                       String(c.sessionCode ?? "").trim() === session;
            });

            if (calendriersSelectionnes.length === 0) {
                throw new Error("Aucun calendrier trouvé pour la sélection.");
            }

            const calendriersTries = classerCalendriersPourAffectation(calendriersSelectionnes);
            const reservationsExternes = reservationsHorsSelection(snapshot.docs, calendriersSelectionnes, sallesAmphis, effectifs);
            const affectationsPrecedentesGlobales = reservationsExternes.slice();

            let calendriersTraites = 0;
            let calendriersEnregistres = 0;
            let calendriersPartiels = 0;
            const erreurs = [];
            const calendriersAEnregistrer = [];

            for (const documentCalendrier of calendriersTries) {
                const donneesCalendrier = documentCalendrier.data();
                const planning = donneesCalendrier.planning;

                if (!planning || !Array.isArray(planning.filieres)) {
                    erreurs.push(documentCalendrier.id + " : structure du planning invalide.");
                    continue;
                }

                try {
                    validerPlanningDates(planning);
                } catch (e) {
                    erreurs.push(documentCalendrier.id + " : " + e.message);
                    continue;
                }

                calendriersTraites++;

                const resultat = affecterLocauxFixes(
                    planning,
                    sallesAmphis,
                    effectifs,
                    affectationsPrecedentesGlobales,
                    donneesCalendrier.anneeUniversitaire
                );

                // ===== RÈGLE PRINCIPALE : on ne touche que les filières réussies =====
                const filieresMisesAJour = planning.filieres.map(filiere => {
                    const aff = resultat.affectations.find(a => a.filiereCode === filiere.filiereCode);

                    if (aff && aff.succes && Array.isArray(aff.locaux) && aff.locaux.length > 0) {
                        // Affectation propre → on l'enregistre
                        return {
                            ...filiere,
                            amphis: aff.locaux,
                            repartitionLocaux: aff.repartitionLocaux
                        };
                    }

                    // Échec ou pas d'affectation → on conserve l'ancienne version
                    return filiere;
                });

                const planningMisAJour = {
                    ...planning,
                    filieres: filieresMisesAJour
                };

                calendriersAEnregistrer.push({
                    id: documentCalendrier.id,
                    planning: planningMisAJour
                });

                // On ajoute uniquement les réussites pour les contrôles suivants
                resultat.affectations.forEach(aff => {
                    if (aff.succes && aff.locaux.length > 0) {
                        const filiereComplete = filieresMisesAJour.find(f => f.filiereCode === aff.filiereCode);
                        if (filiereComplete) {
                            affectationsPrecedentesGlobales.push({
                                calendrierId: documentCalendrier.id,
                                filiere: filiereAvecNiveau(filiereComplete, planning.niveauCode),
                                locaux: aff.locaux,
                                repartitionLocaux: aff.repartitionLocaux
                            });
                        }
                    }
                });

                if (resultat.nombreAffecte < resultat.nombreFilieres) {
                    calendriersPartiels++;
                }
            }

            // Validation globale (sécurité)
            const anomalies = verifierAffectationsPartagees(
                calendriersAEnregistrer.map(e => ({
                    ...e,
                    anneeUniversitaire: calendriersSelectionnes.find(d => d.id === e.id).data().anneeUniversitaire
                })),
                sallesAmphis,
                effectifs,
                reservationsExternes
            );

            if (anomalies.length > 0) {
                if (statut) statut.textContent = `Enregistrement bloqué : ${anomalies.length} anomalie(s) de conflit de niveau ou capacité.`;
                if (resume) resume.textContent = ["Anomalies détectées :", ...anomalies].join("\n");
                return;
            }

            // ===== ENREGISTREMENT (même en cas de succès partiel) =====
            if (calendriersAEnregistrer.length > 0) {
                const batch = writeBatch(db);
                for (const element of calendriersAEnregistrer) {
                    batch.update(doc(db, "calendriers", element.id), { planning: element.planning });
                }
                await batch.commit();
                calendriersEnregistres = calendriersAEnregistrer.length;
            }

            const bilan = `Calendriers traités : ${calendriersTraites} | Enregistrés : ${calendriersEnregistres} | Partiels : ${calendriersPartiels}`;
            if (statut) statut.textContent = bilan + " | Les filières réussies ont été sauvegardées.";
            if (resume) {
                resume.textContent = [
                    bilan,
                    erreurs.length ? "Erreurs :\n" + erreurs.join("\n") : "Aucune erreur bloquante."
                ].join("\n");
            }

        } catch (erreur) {
            console.error(erreur);
            if (statut) statut.textContent = "Échec : " + erreur.message;
        } finally {
            btnGenererAffectations.disabled = false;
        }
    });
}

// Les fonctions classerCalendriersPourAffectation, reservationsHorsSelection,
// verifierAffectationsPartagees et les filtres restent globalement identiques
// à votre version précédente (vous pouvez les coller à la suite).
