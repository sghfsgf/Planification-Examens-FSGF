// =====================================================
// PLANIFICATION DES EXAMENS FSGF
// IMPORT-DONNEES.JS  (version améliorée)
// Import Excel → mémoire locale → localStorage → Firestore
// =====================================================
//
// Prérequis côté page HTML :
//   - SheetJS (XLSX) chargé
//   - window.generationExamens.definirDonneesLocales(...) disponible
//   - Firestore initialisé et exposé dans window.db
//        • SDK "compat"  : window.db = firebase.firestore();
//        • SDK modulaire : window.db = getFirestore(app);
//                          window.firestoreFns = { doc, writeBatch };
//
// Éléments HTML utilisés (inchangés + 2 optionnels) :
//   btnImporterParametrage, fichierParametrage, statutImportParametrage
//   btnImporterSallesAmphis, fichierSallesAmphis, statutImportSallesAmphis
//   chkSauvegardeFirestore  (optionnel : case à cocher, cochée par défaut)
// =====================================================


"use strict";

// =====================================================
// 1. CONFIGURATION
// =====================================================

const IMPORT_CONFIG = {

    // Taille max d'un lot Firestore (limite officielle : 500)
    tailleLot: 400,

    // Préfixe des clés localStorage
    prefixeLocal: "fsgf_examens_",

    // Collections Firestore
    collections: {
        matieres: "matieres",
        sessions: "sessions",
        creneaux: "creneaux",
        sallesAmphis: "sallesAmphis",
        effectifs: "effectifs"
    },

    // Champs utilisés (dans l'ordre) pour fabriquer l'identifiant
    // d'un document. Un ré-import met ainsi à jour au lieu de dupliquer.
    champsIdentifiant: {
        matieres: ["id", "code", "codeMatiere"],
        sessions: ["id", "code", "session"],
        creneaux: ["id", "code", "creneau"],
        sallesAmphis: ["id", "code", "salle", "nom"],
        effectifs: ["id", "code", "codeMatiere", "matiere"]
    }

};


// =====================================================
// 2. OUTILS GÉNÉRAUX
// =====================================================

function afficherStatut(element, message, type) {

    if (!element) return;

    element.textContent = message;

    element.style.color =
        type === "erreur" ? "#b00020" :
        type === "succes" ? "#1b7f3b" :
        "";

}


function basculerBouton(bouton, actif) {

    if (!bouton) return;

    bouton.disabled = !actif;

}


// Utilise les fonctions déjà présentes dans vos autres fichiers
// si elles existent, sinon une version de secours.

function lireFeuilleSecurisee(classeur, nomFeuille) {

    if (!classeur.Sheets[nomFeuille]) {

        throw new Error(
            "Feuille « " + nomFeuille + " » introuvable. " +
            "Feuilles présentes : " + classeur.SheetNames.join(", ") + "."
        );

    }

    if (typeof window.lireFeuille === "function") {

        return window.lireFeuille(classeur, nomFeuille);

    }

    return XLSX.utils.sheet_to_json(
        classeur.Sheets[nomFeuille],
        { defval: "" }
    );

}


function formaterDateSecurisee(valeur) {

    if (typeof window.formaterDate === "function") {

        return window.formaterDate(valeur);

    }

    // Numéro de série Excel → jj/mm/aaaa
    if (typeof valeur === "number") {

        const d = new Date(Math.round((valeur - 25569) * 86400 * 1000));

        return (
            String(d.getUTCDate()).padStart(2, "0") + "/" +
            String(d.getUTCMonth() + 1).padStart(2, "0") + "/" +
            d.getUTCFullYear()
        );

    }

    return valeur;

}


function convertirHeureSecurisee(valeur) {

    if (typeof window.convertirHeureExcel === "function") {

        return window.convertirHeureExcel(valeur);

    }

    // Fraction de jour Excel → hh:mm
    if (typeof valeur === "number") {

        const minutes = Math.round(valeur * 24 * 60);

        return (
            String(Math.floor(minutes / 60) % 24).padStart(2, "0") + ":" +
            String(minutes % 60).padStart(2, "0")
        );

    }

    return valeur;

}


// Vérifie qu'une feuille contient bien les colonnes attendues
function verifierColonnes(lignes, colonnes, nomFeuille) {

    if (lignes.length === 0) {

        throw new Error("La feuille « " + nomFeuille + " » est vide.");

    }

    const presentes = Object.keys(lignes[0]);

    const manquantes = colonnes.filter(function (c) {
        return !presentes.includes(c);
    });

    if (manquantes.length > 0) {

        throw new Error(
            "Feuille « " + nomFeuille + " » : colonne(s) manquante(s) → " +
            manquantes.join(", ") + "."
        );

    }

}


// Supprime les lignes totalement vides et nettoie les textes
function nettoyerLignes(lignes) {

    return lignes
        .filter(function (ligne) {

            return Object.values(ligne).some(function (v) {
                return v !== "" && v !== null && v !== undefined;
            });

        })
        .map(function (ligne) {

            const propre = {};

            Object.keys(ligne).forEach(function (cle) {

                const valeur = ligne[cle];

                propre[String(cle).trim()] =
                    typeof valeur === "string" ? valeur.trim() : valeur;

            });

            return propre;

        });

}


function moteurDisponible() {

    return (
        window.generationExamens &&
        typeof window.generationExamens.definirDonneesLocales === "function"
    );

}


// =====================================================
// 3. SAUVEGARDE LOCALE (mémoire + localStorage)
// =====================================================

function sauvegarderLocalement(donnees) {

    // 3.1 Transmission au moteur de génération (mémoire)
    if (!moteurDisponible()) {

        throw new Error("Le moteur de génération locale n'est pas disponible.");

    }

    window.generationExamens.definirDonneesLocales(donnees);

    // 3.2 Copie de secours dans le navigateur
    //     (survit à l'actualisation de la page)
    Object.keys(donnees).forEach(function (nom) {

        try {

            localStorage.setItem(
                IMPORT_CONFIG.prefixeLocal + nom,
                JSON.stringify({
                    importeLe: new Date().toISOString(),
                    donnees: donnees[nom]
                })
            );

        }
        catch (erreur) {

            // Quota dépassé ou navigation privée : non bloquant
            console.warn(
                "⚠ Copie localStorage impossible pour « " + nom + " » :",
                erreur.message
            );

        }

    });

}


// Recharge au démarrage les données sauvegardées localement
function restaurerDepuisLocalStorage() {

    const restaure = {};

    Object.keys(IMPORT_CONFIG.collections).forEach(function (nom) {

        try {

            const brut = localStorage.getItem(IMPORT_CONFIG.prefixeLocal + nom);

            if (brut) {

                restaure[nom] = JSON.parse(brut).donnees;

            }

        }
        catch (erreur) {

            console.warn("⚠ Lecture localStorage impossible :", nom, erreur);

        }

    });

    if (Object.keys(restaure).length > 0 && moteurDisponible()) {

        window.generationExamens.definirDonneesLocales(restaure);

        console.log(
            "✓ Données restaurées depuis le navigateur :",
            Object.keys(restaure).join(", ")
        );

    }

}


// =====================================================
// 4. SAUVEGARDE FIRESTORE
// =====================================================

function firestoreDisponible() {

    return !!window.db;

}


function sauvegardeFirestoreDemandee() {

    const case_ = document.getElementById("chkSauvegardeFirestore");

    // Si la case n'existe pas, on sauvegarde par défaut
    return case_ ? case_.checked : true;

}


// Enlève les valeurs non acceptées par Firestore (undefined, NaN)
function nettoyerPourFirestore(objet) {

    const propre = {};

    Object.keys(objet).forEach(function (cle) {

        const valeur = objet[cle];

        if (valeur === undefined) return;
        if (typeof valeur === "number" && Number.isNaN(valeur)) return;

        propre[cle] = valeur;

    });

    return propre;

}


function fabriquerIdentifiant(nomCollection, ligne, index) {

    const champs = IMPORT_CONFIG.champsIdentifiant[nomCollection] || [];

    for (const champ of champs) {

        if (ligne[champ] !== undefined && ligne[champ] !== "") {

            // "/" interdit dans un identifiant Firestore
            return String(ligne[champ]).trim().replace(/\//g, "-");

        }

    }

    return nomCollection + "_" + String(index + 1).padStart(4, "0");

}


// Écrit une collection complète par lots, avec compatibilité
// des deux versions du SDK Firestore.
async function ecrireCollectionFirestore(nomCollection, lignes, surProgression) {

    const db = window.db;

    const modeCompat = typeof db.collection === "function";

    const fns = window.firestoreFns;

    if (!modeCompat && (!fns || !fns.doc || !fns.writeBatch)) {

        throw new Error(
            "Firestore modulaire détecté : exposez window.firestoreFns = { doc, writeBatch }."
        );

    }

    const horodatage = new Date().toISOString();

    let ecrits = 0;

    for (let i = 0; i < lignes.length; i += IMPORT_CONFIG.tailleLot) {

        const lot = modeCompat ? db.batch() : fns.writeBatch(db);

        lignes
            .slice(i, i + IMPORT_CONFIG.tailleLot)
            .forEach(function (ligne, decalage) {

                const id = fabriquerIdentifiant(
                    nomCollection,
                    ligne,
                    i + decalage
                );

                const donnees = nettoyerPourFirestore({
                    ...ligne,
                    importeLe: horodatage
                });

                const reference = modeCompat
                    ? db.collection(nomCollection).doc(id)
                    : fns.doc(db, nomCollection, id);

                // merge : met à jour sans effacer les autres champs
                lot.set(reference, donnees, { merge: true });

            });

        await lot.commit();

        ecrits += Math.min(IMPORT_CONFIG.tailleLot, lignes.length - i);

        if (surProgression) {

            surProgression(nomCollection, ecrits, lignes.length);

        }

    }

    return ecrits;

}


async function sauvegarderFirestore(donnees, statut) {

    const resume = [];

    for (const nom of Object.keys(donnees)) {

        const collection = IMPORT_CONFIG.collections[nom];

        await ecrireCollectionFirestore(
            collection,
            donnees[nom],
            function (coll, fait, total) {

                afficherStatut(
                    statut,
                    "⏳ Firestore — " + coll + " : " + fait + " / " + total
                );

            }
        );

        resume.push(donnees[nom].length + " " + nom);

        console.log(
            "✓ Firestore — collection « " + collection + " » : " +
            donnees[nom].length + " document(s)."
        );

    }

    return resume;

}


// =====================================================
// 5. TRAITEMENT COMMUN : LOCAL PUIS FIRESTORE
// =====================================================

async function enregistrerDonnees(donnees, statut) {

    // ÉTAPE 1 — Local (toujours exécuté en premier)
    sauvegarderLocalement(donnees);

    const resumeLocal = Object.keys(donnees)
        .map(function (n) { return donnees[n].length + " " + n; })
        .join(", ");

    console.log("✓ Sauvegarde locale terminée :", resumeLocal);

    // ÉTAPE 2 — Firestore (facultatif)
    if (!sauvegardeFirestoreDemandee()) {

        afficherStatut(
            statut,
            "✓ Sauvegarde locale terminée (" + resumeLocal + "). Firestore ignoré.",
            "succes"
        );

        return;

    }

    if (!firestoreDisponible()) {

        afficherStatut(
            statut,
            "⚠ Local OK (" + resumeLocal + "), mais Firestore n'est pas initialisé (window.db).",
            "erreur"
        );

        return;

    }

    try {

        await sauvegarderFirestore(donnees, statut);

        afficherStatut(
            statut,
            "✓ Sauvegarde terminée en local et dans Firestore (" + resumeLocal + ").",
            "succes"
        );

    }
    catch (erreur) {

        // Les données locales restent valides et utilisables
        console.error("❌ Erreur Firestore :", erreur);

        afficherStatut(
            statut,
            "⚠ Local OK, mais échec Firestore : " + erreur.message,
            "erreur"
        );

    }

}


// =====================================================
// 6. BOUTONS IMPORT
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    // Restaure les données de la dernière session
    restaurerDepuisLocalStorage();

    const liaisons = [
        ["btnImporterParametrage", importerParametrage, "paramétrage"],
        ["btnImporterSallesAmphis", importerSallesAmphis, "salles / amphis"]
    ];

    liaisons.forEach(function (liaison) {

        const bouton = document.getElementById(liaison[0]);

        if (bouton) {

            bouton.addEventListener("click", liaison[1]);

            console.log("✓ Import " + liaison[2] + " : bouton connecté.");

        }
        else {

            console.error("❌ Bouton " + liaison[0] + " introuvable.");

        }

    });

});


// =====================================================
// 7. IMPORT DU PARAMÉTRAGE
// =====================================================

async function importerParametrage() {

    const statut = document.getElementById("statutImportParametrage");

    const bouton = document.getElementById("btnImporterParametrage");

    basculerBouton(bouton, false);

    try {

        // 1. Fichier
        const fichier = document.getElementById("fichierParametrage").files[0];

        if (!fichier) {

            throw new Error(
                "Veuillez sélectionner le fichier parametrage_examens.xlsx."
            );

        }

        afficherStatut(statut, "⏳ Lecture du fichier Excel…");

        // 2. Lecture
        const classeur = XLSX.read(
            await fichier.arrayBuffer(),
            { type: "array" }
        );

        const matieres = nettoyerLignes(
            lireFeuilleSecurisee(classeur, "matieres")
        );

        const sessionsBrutes = nettoyerLignes(
            lireFeuilleSecurisee(classeur, "sessions")
        );

        const creneauxBruts = nettoyerLignes(
            lireFeuilleSecurisee(classeur, "creneaux")
        );

        // 3. Vérification des colonnes
        verifierColonnes(matieres, [], "matieres");
        verifierColonnes(sessionsBrutes, ["dateDebut", "dateFin"], "sessions");
        verifierColonnes(creneauxBruts, ["heureDebut", "heureFin"], "creneaux");

        // 4. Préparation
        const sessions = sessionsBrutes.map(function (s) {

            return {
                ...s,
                dateDebutAffichage: formaterDateSecurisee(s.dateDebut),
                dateFinAffichage: formaterDateSecurisee(s.dateFin)
            };

        });

        const creneaux = creneauxBruts.map(function (c) {

            return {
                ...c,
                heureDebutAffichage: convertirHeureSecurisee(c.heureDebut),
                heureFinAffichage: convertirHeureSecurisee(c.heureFin)
            };

        });

        // 5. Sauvegarde locale puis Firestore
        await enregistrerDonnees(
            { matieres: matieres, sessions: sessions, creneaux: creneaux },
            statut
        );

    }
    catch (erreur) {

        console.error("❌ Erreur import paramétrage :", erreur);

        afficherStatut(statut, "❌ " + erreur.message, "erreur");

    }
    finally {

        basculerBouton(bouton, true);

    }

}


// =====================================================
// 8. IMPORT DES SALLES / AMPHIS
// =====================================================

async function importerSallesAmphis() {

    const statut = document.getElementById("statutImportSallesAmphis");

    const bouton = document.getElementById("btnImporterSallesAmphis");

    basculerBouton(bouton, false);

    try {

        // 1. Fichier
        const fichier = document.getElementById("fichierSallesAmphis").files[0];

        if (!fichier) {

            throw new Error(
                "Veuillez sélectionner le fichier salles_amphis.xlsx."
            );

        }

        afficherStatut(statut, "⏳ Lecture du fichier Excel…");

        // 2. Lecture
        const classeur = XLSX.read(
            await fichier.arrayBuffer(),
            { type: "array" }
        );

        const sallesAmphis = nettoyerLignes(
            lireFeuilleSecurisee(classeur, "salles_amphis")
        );

        const effectifs = nettoyerLignes(
            lireFeuilleSecurisee(classeur, "effectifs")
        );

        // 3. Vérification
        verifierColonnes(sallesAmphis, [], "salles_amphis");
        verifierColonnes(effectifs, [], "effectifs");

        // 4. Sauvegarde locale puis Firestore
        await enregistrerDonnees(
            { sallesAmphis: sallesAmphis, effectifs: effectifs },
            statut
        );

    }
    catch (erreur) {

        console.error("❌ Erreur import salles / amphis :", erreur);

        afficherStatut(statut, "❌ " + erreur.message, "erreur");

    }
    finally {

        basculerBouton(bouton, true);

    }

}
