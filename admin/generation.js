// =====================================================
// GENERATION.JS - Moteur de Planification des Examens
// Version refactorisée & optimisée
// =====================================================

// [P1 - Architecture] Imports ES Modules
import { app } from "../firebase-config.js";
import { donneesChargees as promiseDonneesChargees } from "./data.js";
import { controleExamens as moduleControleExamens } from "./controle.js";

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
// FIRESTORE & ÉTAT
// =====================================================

const db = getFirestore(app);

let donneesGeneration = {
    matieres: [],
    sessions: [],
    creneaux: [],
    sallesAmphis: [],
    effectifs: []
};

let generationChargee = false;
let dernierCalendrierEnregistre = null;

// =====================================================
// [P2 - Nettoyage] CHARGER UNE COLLECTION (AVEC ID)
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
// CHARGER TOUTES LES DONNÉES EN PARALLÈLE
// =====================================================

async function chargerDonneesGeneration() {
    console.log("==========================================");
    console.log("CHARGEMENT DES DONNÉES POUR LA GÉNÉRATION");
    console.log("==========================================");

    try {
        // [P1 - Architecture] Vérification modulaire avec fallback window
        const attenteDonnees = promiseDonneesChargees || window.donneesChargees;

        if (!attenteDonnees) {
            throw new Error("Le module data.js n'a pas initialisé les données.");
        }

        const chargementOK = await attenteDonnees;
        if (!chargementOK) {
            throw new Error("Le chargement des données sources a échoué.");
        }

        // [P2 - Nettoyage / Performance] Chargement parallélisé via chargerCollection
        const [matieres, sessions, creneaux, sallesAmphis, effectifs] = await Promise.all([
            chargerCollection("matieres"),
            chargerCollection("sessions"),
            chargerCollection("creneaux"),
            chargerCollection("salles_amphis"),
            chargerCollection("effectifs")
        ]);

        donneesGeneration.matieres = matieres;
        donneesGeneration.sessions = sessions;
        donneesGeneration.creneaux = creneaux;
        donneesGeneration.sallesAmphis = sallesAmphis;
        donneesGeneration.effectifs = effectifs;

        console.log("Matières chargées :", donneesGeneration.matieres.length);
        console.log("Sessions chargées :", donneesGeneration.sessions.length);
        console.log("Créneaux chargés :", donneesGeneration.creneaux.length);
        console.log("Salles / amphis :", donneesGeneration.sallesAmphis.length);
        console.log("Effectifs :", donneesGeneration.effectifs.length);
        console.log("✓ Données prêtes avec identifiants Firestore.");

        generationChargee = true;
        return true;

    } catch (erreur) {
        console.error("❌ Erreur lors du chargement des données :", erreur);
        return false;
    }
}

// =====================================================
// VÉRIFIER LES DONNÉES
// =====================================================

function verifierDonneesGeneration() {
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
    return true;
}

// =====================================================
// FONCTIONS UTILITAIRES FILIÈRES / CRÉNEAUX / DATES
// =====================================================

function obtenirNiveaux() {
    const niveaux = [];
    donneesGeneration.matieres.forEach(function (matiere) {
        if (matiere.niveauCode && !niveaux.includes(matiere.niveauCode)) {
            niveaux.push(matiere.niveauCode);
        }
    });
    return niveaux.sort();
}

function obtenirFilieresDuNiveau(niveauCode) {
    const filieres = [];
    donneesGeneration.matieres.forEach(function (matiere) {
        if (matiere.niveauCode === niveauCode && matiere.filiereCode) {
            if (!filieres.includes(matiere.filiereCode)) {
                filieres.push(matiere.filiereCode);
            }
        }
    });
    return filieres.sort();
}

function obtenirMatieresDeFiliere(niveauCode, filiereCode) {
    return donneesGeneration.matieres.filter(function (m) {
        return m.niveauCode === niveauCode && m.filiereCode === filiereCode;
    });
}

function obtenirSession(sessionCode) {
    return donneesGeneration.sessions.find(function (s) {
        return s.sessionCode === sessionCode;
    });
}

function obtenirCreneauxDeSession(sessionCode) {
    return donneesGeneration.creneaux
        .filter(function (c) { return c.sessionCode === sessionCode; })
        .sort(function (a, b) { return Number(a.creneauOrdre) - Number(b.creneauOrdre); });
}

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

function formaterDateGeneration(date) {
    const jour = String(date.getDate()).padStart(2, "0");
    const mois = String(date.getMonth() + 1).padStart(2, "0");
    return jour + "/" + mois + "/" + date.getFullYear();
}

function genererListeDates(dateDebut, dateFin) {
    const dates = [];
    const debut = convertirDateExcelPourGeneration(dateDebut);
    const fin = convertirDateExcelPourGeneration(dateFin);

    if (!debut || !fin || debut > fin) {
        console.error("❌ Dates de session invalides.");
        return dates;
    }

    let dateCourante = new Date(debut);
    while (dateCourante <= fin) {
        // Règle : Pas d'examen le dimanche
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
// [P0 - Métier] HELPER DE VÉRIFICATION D'ADJACENCE
// =====================================================

/**
 * Vérifie qu'aucun examen n'est déjà placé immédiatement
 * avant (N-1) ou après (N+1) le même jour pour la même filière.
 */
function verifierCreneauAdjacentLibre(cellulesFiliere, dateAffichage, creneauOrdre) {
    const cellulesMemeJour = cellulesFiliere.filter(function (c) {
        return c.dateAffichage === dateAffichage;
    });

    const precedent = cellulesMemeJour.find(function (c) {
        return c.creneauOrdre === creneauOrdre - 1;
    });

    const suivant = cellulesMemeJour.find(function (c) {
        return c.creneauOrdre === creneauOrdre + 1;
    });

    if (precedent && precedent.estOccupee) return false;
    if (suivant && suivant.estOccupee) return false;

    return true;
}

// =====================================================
// PRÉPARATION DU PLANNING & DES MATIÈRES
// =====================================================

function preparerMatieresPourSession(niveauCode, sessionCode) {
    const session = obtenirSession(sessionCode);
    if (!session) {
        console.error("❌ Session introuvable :", sessionCode);
        return null;
    }

    const matieresNiveau = donneesGeneration.matieres.filter(function (m) {
        return (
            m.niveauCode === niveauCode &&
            m.regimeCode === session.regimeCode &&
            m.semestreCode === session.semestreCode
        );
    });

    const groupes = {};
    matieresNiveau.forEach(function (matiere) {
        const libelle = matiere.matiereLibelle;
        if (!groupes[libelle]) groupes[libelle] = [];
        groupes[libelle].push(matiere);
    });

    const matieresCommunes = [];
    const matieresSpecifiques = [];

    Object.keys(groupes).forEach(function (libelle) {
        const groupe = groupes[libelle];
        const filieres = [...new Set(groupe.map(function (m) { return m.filiereCode; }))];
        const premiere = groupe[0];

        if (filieres.length >= 2) {
            matieresCommunes.push({
                matiereLibelle: libelle,
                filieres: filieres,
                regimeCode: premiere.regimeCode,
                semestreCode: premiere.semestreCode
            });
        } else {
            matieresSpecifiques.push({
                matiereLibelle: libelle,
                filiereCode: filieres[0],
                regimeCode: premiere.regimeCode,
                semestreCode: premiere.semestreCode
            });
        }
    });

    return {
        niveauCode,
        sessionCode,
        regimeCode: session.regimeCode,
        semestreCode: session.semestreCode,
        matieresCommunes,
        matieresSpecifiques
    };
}

function construireGrilleSession(sessionCode) {
    const session = obtenirSession(sessionCode);
    if (!session) return [];

    const creneaux = obtenirCreneauxDeSession(sessionCode);
    const dates = genererListeDates(session.dateDebut, session.dateFin);
    const grille = [];

    dates.forEach(function (dateInfo) {
        creneaux.forEach(function (creneau) {
            grille.push({
                sessionCode,
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

    return grille;
}

function construireMatricePlanning(niveauCode, sessionCode) {
    const structure = preparerMatieresPourSession(niveauCode, sessionCode);
    const grille = construireGrilleSession(sessionCode);
    const filieres = obtenirFilieresDuNiveau(niveauCode);

    if (!structure || !grille.length || !filieres.length) {
        console.error("❌ Données insuffisantes pour la matrice.");
        return null;
    }

    const planning = {
        niveauCode,
        sessionCode,
        filieres: []
    };

    filieres.forEach(function (filiereCode) {
        const ligneFiliere = {
            filiereCode,
            amphis: [],
            cellules: grille.map(function (pos) {
                return {
                    date: pos.date,
                    dateAffichage: pos.dateAffichage,
                    creneauOrdre: pos.creneauOrdre,
                    heureDebut: pos.heureDebut,
                    heureFin: pos.heureFin,
                    heureDebutAffichage: pos.heureDebutAffichage,
                    heureFinAffichage: pos.heureFinAffichage,
                    matiereLibelle: "",
                    regimeCode: "",
                    semestreCode: "",
                    estOccupee: false,
                    estCommune: false
                };
            })
        };
        planning.filieres.push(ligneFiliere);
    });

    planning.matieresCommunes = structure.matieresCommunes;
    planning.matieresSpecifiques = structure.matieresSpecifiques;

    return planning;
}

// =====================================================
// [P0 - Métier] PLACEMENT DES MATIÈRES COMMUNES
// =====================================================

function placerMatieresCommunes(planning) {
    if (!planning || !planning.matieresCommunes) return planning;

    planning.matieresCommunes.forEach(function (matiereCommune) {
        const filieresConcernees = matiereCommune.filieres;
        const premiereFiliere = planning.filieres.find(function (f) {
            return filieresConcernees.includes(f.filiereCode);
        });

        if (!premiereFiliere) return;

        let positionChoisie = null;

        for (let i = 0; i < premiereFiliere.cellules.length; i++) {
            const candidat = premiereFiliere.cellules[i];

            // Doit être disponible ET sans adjacence occupée pour TOUTES les filières concernées
            const positionValidePourToutes = filieresConcernees.every(function (filiereCode) {
                const filiere = planning.filieres.find(function (f) {
                    return f.filiereCode === filiereCode;
                });
                if (!filiere) return false;

                const cellule = filiere.cellules.find(function (c) {
                    return c.dateAffichage === candidat.dateAffichage &&
                           c.creneauOrdre === candidat.creneauOrdre;
                });

                if (!cellule || cellule.estOccupee) return false;

                // [P0 - Règle métier appliquée] : vérifier N-1 et N+1 le même jour
                return verifierCreneauAdjacentLibre(
                    filiere.cellules,
                    candidat.dateAffichage,
                    candidat.creneauOrdre
                );
            });

            if (positionValidePourToutes) {
                positionChoisie = candidat;
                break;
            }
        }

        if (!positionChoisie) {
            console.error("❌ Impossible de placer la matière commune :", matiereCommune.matiereLibelle);
            return;
        }

        // Affecter à chaque filière concernée
        filieresConcernees.forEach(function (filiereCode) {
            const filiere = planning.filieres.find(function (f) { return f.filiereCode === filiereCode; });
            const cellule = filiere.cellules.find(function (c) {
                return c.dateAffichage === positionChoisie.dateAffichage &&
                       c.creneauOrdre === positionChoisie.creneauOrdre;
            });
            cellule.matiereLibelle = matiereCommune.matiereLibelle;
            cellule.estOccupee = true;
            cellule.estCommune = true;
        });

        console.log("✓ Commune placée :", matiereCommune.matiereLibelle, "au", positionChoisie.dateAffichage, "Créneau", positionChoisie.creneauOrdre);
    });

    return planning;
}

// =====================================================
// CHARGE DES CRÉNEAUX
// =====================================================

function calculerChargeDesCreneaux(planning) {
    const charges = {};
    const examensComptes = new Set();

    planning.filieres.forEach(function (filiere) {
        filiere.cellules.forEach(function (cellule) {
            if (charges[cellule.creneauOrdre] === undefined) {
                charges[cellule.creneauOrdre] = 0;
            }
            if (!cellule.estOccupee) return;

            const cleExamen = cellule.estCommune
                ? "COMMUNE|" + cellule.dateAffichage + "|" + cellule.creneauOrdre + "|" + cellule.matiereLibelle
                : "SPECIFIQUE|" + filiere.filiereCode + "|" + cellule.dateAffichage + "|" + cellule.creneauOrdre + "|" + cellule.matiereLibelle;

            if (!examensComptes.has(cleExamen)) {
                examensComptes.add(cleExamen);
                charges[cellule.creneauOrdre]++;
            }
        });
    });

    return charges;
}

// =====================================================
// HEURISTIQUE PLACEMENT SPÉCIFIQUE
// =====================================================

function trouverPositionPourMatiereSpecifique(planning, filiereCode) {
    const filiere = planning.filieres.find(function (f) { return f.filiereCode === filiereCode; });
    if (!filiere) return null;

    const chargesCreneaux = calculerChargeDesCreneaux(planning);

    // [P0 - Métier] Vérifier disponibilité et non-adjacence
    const positionsPossibles = filiere.cellules.filter(function (cellule) {
        if (cellule.estOccupee) return false;
        return verifierCreneauAdjacentLibre(filiere.cellules, cellule.dateAffichage, cellule.creneauOrdre);
    });

    if (positionsPossibles.length === 0) return null;

    let positionChoisie = null;
    let meilleurEcart = Infinity;
    let meilleureDispersion = Infinity;
    let meilleureChargeAvant = Infinity;

    positionsPossibles.forEach(function (position) {
        const chargesSimulees = { ...chargesCreneaux };
        const creneau = position.creneauOrdre;
        chargesSimulees[creneau] = (chargesSimulees[creneau] || 0) + 1;

        const valeursCharges = Object.values(chargesSimulees);
        const ecart = Math.max(...valeursCharges) - Math.min(...valeursCharges);

        const moyenne = valeursCharges.reduce(function (a, b) { return a + b; }, 0) / valeursCharges.length;
        const dispersion = valeursCharges.reduce(function (somme, c) { return somme + Math.pow(c - moyenne, 2); }, 0);
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

    return positionChoisie;
}

// =====================================================
// [P2 - Algorithme] BACKTRACKING LÉGER (LOCAL REPAIR)
// =====================================================

/**
 * Tente de libérer une cellule occupée par une autre matière spécifique
 * de la même filière pour débloquer une matière orpheline.
 */
function tenterBacktrackingPourMatiere(planning, filiereCode, matiereEchouee) {
    const filiere = planning.filieres.find(function (f) { return f.filiereCode === filiereCode; });
    if (!filiere) return false;

    // Obtenir toutes les matières spécifiques déjà placées dans cette filière
    const cellulesOccupees = filiere.cellules.filter(function (c) {
        return c.estOccupee && !c.estCommune;
    });

    for (const celluleConflit of cellulesOccupees) {
        // Sauvegarde de l'état
        const backup = {
            matiereLibelle: celluleConflit.matiereLibelle,
            regimeCode: celluleConflit.regimeCode,
            semestreCode: celluleConflit.semestreCode
        };

        // 1. Libérer temporairement la cellule
        celluleConflit.estOccupee = false;
        celluleConflit.matiereLibelle = "";

        // 2. Tester si la matière échouée peut prendre une place (soit celle-ci, soit une autre)
        const posPourEchouee = trouverPositionPourMatiereSpecifique(planning, filiereCode);

        if (posPourEchouee) {
            posPourEchouee.estOccupee = true;
            posPourEchouee.matiereLibelle = matiereEchouee.matiereLibelle;
            posPourEchouee.regimeCode = matiereEchouee.regimeCode;
            posPourEchouee.semestreCode = matiereEchouee.semestreCode;

            // 3. Tester si l'ancienne matière déplacée retrouve une place valide
            const posPourDeplacee = trouverPositionPourMatiereSpecifique(planning, filiereCode);

            if (posPourDeplacee) {
                posPourDeplacee.estOccupee = true;
                posPourDeplacee.matiereLibelle = backup.matiereLibelle;
                posPourDeplacee.regimeCode = backup.regimeCode;
                posPourDeplacee.semestreCode = backup.semestreCode;

                console.log(`🔁 [Backtracking réussi] : Réarrangement pour ${matiereEchouee.matiereLibelle}`);
                return true;
            }

            // Annuler le placement temporaire
            posPourEchouee.estOccupee = false;
            posPourEchouee.matiereLibelle = "";
        }

        // Restaurer la cellule originale
        celluleConflit.estOccupee = true;
        celluleConflit.matiereLibelle = backup.matiereLibelle;
        celluleConflit.regimeCode = backup.regimeCode;
        celluleConflit.semestreCode = backup.semestreCode;
    }

    return false;
}

// =====================================================
// PLACEMENT DES MATIÈRES SPÉCIFIQUES
// =====================================================

function placerMatieresSpecifiques(planning) {
    if (!planning || !planning.matieresSpecifiques) return planning;

    planning.matieresSpecifiques.forEach(function (matiere) {
        const filiereCode = matiere.filiereCode;
        let position = trouverPositionPourMatiereSpecifique(planning, filiereCode);

        if (!position) {
            console.warn("⚠️ Impasse gloutonne pour :", matiere.matiereLibelle, "→ Tentative de backtracking...");
            const backtrackingReussi = tenterBacktrackingPourMatiere(planning, filiereCode, matiere);

            if (!backtrackingReussi) {
                console.error("❌ Échec définitif de placement pour :", matiere.matiereLibelle);
                return;
            }
            return;
        }

        position.estOccupee = true;
        position.matiereLibelle = matiere.matiereLibelle;
        position.regimeCode = matiere.regimeCode;
        position.semestreCode = matiere.semestreCode;
    });

    return planning;
}

// =====================================================
// CONTRÔLE D'ÉQUILIBRE
// =====================================================

function verifierEquilibreGlobalCreneaux(planning) {
    const charges = calculerChargeDesCreneaux(planning);
    const valeurs = Object.values(charges);
    if (!valeurs.length) return null;

    const ecart = Math.max(...valeurs) - Math.min(...valeurs);
    const equilibreAtteint = ecart <= 1;

    console.log("Équilibre global des créneaux :", charges, "| Écart :", ecart);
    return { equilibreAtteint, ecart, charges };
}

// =====================================================
// PERSISTANCE FIRESTORE (CHARGEMENT, ENREGISTREMENT, PUBLICATION)
// =====================================================

async function chargerCalendrier(niveauCode, semestreCode, regimeCode, sessionCode) {
    const session = obtenirSession(sessionCode);
    if (!session) return null;

    const idCalendrier = `calendrier_${session.anneeUniversitaire}_${niveauCode}_${semestreCode}_${regimeCode}_${sessionCode}`;
    const ref = doc(db, "calendriers", idCalendrier);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;
    const donnees = snap.data();

    return {
        ...donnees.planning,
        anneeUniversitaire: donnees.anneeUniversitaire || session.anneeUniversitaire
    };
}

/**
 * [P0 - Propreté] Suppression du bloc de code mort dupliqué
 */
async function enregistrerCalendrier(planning) {
    if (!planning || !planning.niveauCode || !planning.sessionCode) {
        console.error("❌ Données de planning insuffisantes.");
        return null;
    }

    const session = obtenirSession(planning.sessionCode);
    if (!session) return null;

    const idCalendrier = `calendrier_${session.anneeUniversitaire}_${planning.niveauCode}_${session.semestreCode}_${session.regimeCode}_${planning.sessionCode}`;
    const referenceCalendrier = doc(db, "calendriers", idCalendrier);
    const docExistant = await getDoc(referenceCalendrier);

    const documentCalendrier = {
        anneeUniversitaire: session.anneeUniversitaire,
        niveauCode: planning.niveauCode,
        semestreCode: session.semestreCode,
        regimeCode: session.regimeCode,
        sessionCode: planning.sessionCode,
        sessionLibelle: session.sessionLibelle || "",
        statut: "brouillon",
        creeLe: docExistant.exists() ? docExistant.data().creeLe : serverTimestamp(),
        modifieLe: serverTimestamp(),
        planning: planning,
        controle: {
            valide: false,
            dateControle: null
        }
    };

    try {
        if (docExistant.exists()) {
            await updateDoc(referenceCalendrier, documentCalendrier);
            console.log("✓ Calendrier mis à jour :", idCalendrier);
        } else {
            await setDoc(referenceCalendrier, documentCalendrier);
            console.log("✓ Nouveau calendrier créé :", idCalendrier);
        }

        return {
            id: idCalendrier,
            ...documentCalendrier
        };
    } catch (erreur) {
        console.error("❌ Erreur lors de l'enregistrement :", erreur);
        return null;
    }
}

async function publierCalendrier(idCalendrier) {
    if (!idCalendrier) return false;

    try {
        const reference = doc(db, "calendriers", idCalendrier);
        const document = await getDoc(reference);

        if (!document.exists() || document.data().statut !== "brouillon") {
            console.warn("⚠️ Document inexistant ou déjà publié.");
            return false;
        }

        await updateDoc(reference, {
            statut: "publie",
            modifieLe: serverTimestamp()
        });

        console.log("✅ Calendrier publié :", idCalendrier);
        return true;
    } catch (e) {
        console.error("❌ Erreur publication :", e);
        return false;
    }
}

// =====================================================
// EXPOSITION API (POUR MODULES ET WINDOW)
// =====================================================

function definirDernierCalendrierEnregistre(id) {
    dernierCalendrierEnregistre = id;
}

const apiGeneration = {
    chargerDonnees: chargerDonneesGeneration,
    verifierDonnees: verifierDonneesGeneration,
    obtenirDonnees: () => donneesGeneration,
    obtenirNiveaux,
    obtenirFilieres: obtenirFilieresDuNiveau,
    obtenirMatieres: obtenirMatieresDeFiliere,
    obtenirSession,
    obtenirCreneauxDeSession,
    genererListeDates,
    construireGrilleSession,
    construireMatricePlanning,
    placerMatieresCommunes,
    placerMatieresSpecifiques,
    calculerChargeDesCreneaux,
    verifierEquilibreGlobalCreneaux,
    chargerCalendrier,
    enregistrerCalendrier,
    publierCalendrier,
    definirDernierCalendrierEnregistre
};

window.generationExamens = apiGeneration;

// =====================================================
// INITIALISATION & GESTION DES ÉVÉNEMENTS UI
// =====================================================

document.addEventListener("DOMContentLoaded", async function () {
    console.log("✓ generation.js initialisé.");
    await chargerDonneesGeneration();

    const boutonGenerer = document.getElementById("btnGenererCalendrier");
    const boutonPublier = document.getElementById("btnPublierCalendrierAdmin");

    if (boutonGenerer) {
        boutonGenerer.addEventListener("click", async function () {
            // [P1 - UI/UX Dynamique] Récupération dynamique depuis l'interface avec repli de sécurité
            const selectNiveau = document.getElementById("selectNiveau") || document.getElementById("filtreNiveau");
            const selectSession = document.getElementById("selectSession") || document.getElementById("filtreSession");

            const niveauCode = selectNiveau ? selectNiveau.value : "L1";
            const sessionCode = selectSession ? selectSession.value : "PRINCIPALE_S1";

            if (!niveauCode || !sessionCode) {
                alert("⚠️ Veuillez sélectionner un niveau et une session valides.");
                return;
            }

            console.log(`🚀 Lancement : Niveau=${niveauCode}, Session=${sessionCode}`);

            const planning = construireMatricePlanning(niveauCode, sessionCode);
            if (!planning) return;

            placerMatieresCommunes(planning);
            placerMatieresSpecifiques(planning);
            verifierEquilibreGlobalCreneaux(planning);

            // [P1 - Architecture] Contrôle qualité via import ou fallback
            const serviceControle = moduleControleExamens || window.controleExamens;
            if (serviceControle && typeof serviceControle.verifierPlanningGlobal === "function") {
                const resultat = serviceControle.verifierPlanningGlobal(planning);
                if (!resultat || !resultat.valide) {
                    console.warn("⚠️ Planning non validé par les contrôles qualité.");
                    return;
                }
            }

            const enregistrement = await enregistrerCalendrier(planning);
            if (enregistrement) {
                dernierCalendrierEnregistre = enregistrement.id;
                if (boutonPublier) boutonPublier.disabled = false;
                alert("✓ Planning généré et enregistré en brouillon avec succès !");
            }
        });
    }

    if (boutonPublier) {
        boutonPublier.addEventListener("click", async function () {
            if (!dernierCalendrierEnregistre) return;
            const reussite = await publierCalendrier(dernierCalendrierEnregistre);
            if (reussite) {
                boutonPublier.disabled = true;
                alert("🎉 Le calendrier a été officiellement publié !");
            }
        });
    }
});
