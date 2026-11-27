// =====================================================
// PLANIFICATION DES EXAMENS FSGF
// IMPORT-DONNEES.JS
// Import Excel -> mémoire locale -> Firestore
// =====================================================
//
// Dépendances attendues (définies dans d'autres fichiers) :
//   - XLSX (SheetJS)
//   - lireFeuille(classeur, nomFeuille)
//   - formaterDate(valeur)
//   - convertirHeureExcel(valeur)
//   - window.generationExamens.definirDonneesLocales(donnees)
//   - ../firebase-config.js qui exporte { app }
//
// Si Firestore n'est pas disponible, l'import reste local.
// =====================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    collection,
    doc,
    getDocs,
    limit,
    query,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";


// =====================================================
// 1. CONFIGURATION
// =====================================================

const CONFIG_IMPORT = {

    // Firestore accepte 500 opérations max par lot
    tailleLot: 400,

    // Copie de secours dans le navigateur
    sauvegardeLocalStorage: true,
    prefixeLocalStorage: "fsgf_examens_",

    // Noms des collections Firestore
    collections: {
        matieres: "matieres",
        sessions: "sessions",
        creneaux: "creneaux",
        sallesAmphis: "salles_amphis",   // doit correspondre aux règles Firestore
        effectifs: "effectifs"
    },

    // Champs utilisés (dans l'ordre) pour fabriquer l'identifiant du document.
    // Adaptez-les aux colonnes de vos fichiers Excel.
    champsIdentifiant: {
        matieres: ["codeMatiere", "code", "id"],
        sessions: ["codeSession", "code", "id"],
        creneaux: ["codeCreneau", "code", "id"],
        sallesAmphis: ["codeSalle", "code", "id", "nom"],
        effectifs: ["id"]
    },

    // true : supprime d'abord les anciens documents de la collection
    remplacerCollections: false
};


// =====================================================
// 2. OUTILS GÉNÉRAUX
// =====================================================

// Retourne l'instance Firestore (ou null)
function obtenirFirestore() {

    try {
        return getFirestore(app);
    }
    catch (erreur) {
        console.error("❌ Initialisation Firestore impossible :", erreur);
        return null;
    }
}


// Affiche un message dans la zone de statut
function afficherStatut(element, message) {

    if (element) {
        element.textContent = message;
    }

    console.log(message);
}


// Active / désactive un bouton pendant l'import
function basculerBouton(idBouton, actif) {

    const bouton = document.getElementById(idBouton);

    if (bouton) {
        bouton.disabled = !actif;
    }
}


// Nettoie une ligne : espaces, valeurs undefined
// (Firestore refuse les valeurs undefined)
function nettoyerLigne(ligne) {

    const propre = {};

    Object.keys(ligne).forEach(function (cle) {

        let valeur = ligne[cle];

        if (valeur === undefined) {
            return;
        }

        if (typeof valeur === "string") {
            valeur = valeur.trim();
        }

        propre[String(cle).trim()] = valeur;

    });

    return propre;
}


// Fabrique un identifiant de document valide
function fabriquerIdentifiant(ligne, champs, nomCollection, index, dejaUtilises) {

    let base = "";

    for (const champ of champs) {

        if (
            ligne[champ] !== undefined &&
            ligne[champ] !== null &&
            String(ligne[champ]).trim() !== ""
        ) {
            base = String(ligne[champ]).trim();
            break;
        }

    }

    if (base === "") {
        base = nomCollection + "_" + (index + 1);
    }

    // "/" est interdit dans un identifiant Firestore
    base = base.replace(/\//g, "-");

    // Doublon : on ajoute le numéro de ligne
    let identifiant = base;

    if (dejaUtilises.has(identifiant)) {

        console.warn(
            "⚠ Identifiant en double dans " + nomCollection +
            " : " + base + " (ligne " + (index + 2) + " d'Excel)"
        );

        identifiant = base + "_" + (index + 1);
    }

    dejaUtilises.add(identifiant);

    return identifiant;
}


// Lit un fichier Excel et retourne le classeur
async function lireClasseur(idChampFichier, nomAttendu) {

    const champ = document.getElementById(idChampFichier);
    const fichier = champ ? champ.files[0] : null;

    if (!fichier) {
        throw new Error("Veuillez sélectionner le fichier " + nomAttendu + ".");
    }

    if (!/\.xlsx?$/i.test(fichier.name)) {
        throw new Error("Le fichier doit être au format Excel (.xlsx).");
    }

    console.log("Fichier sélectionné :", fichier.name);

    const tableau = await fichier.arrayBuffer();

    return XLSX.read(tableau, { type: "array" });
}


// Lit une feuille en vérifiant qu'elle existe
function lireFeuilleSecurisee(classeur, nomFeuille) {

    if (!classeur.SheetNames.includes(nomFeuille)) {

        throw new Error(
            "Feuille « " + nomFeuille + " » introuvable. Feuilles présentes : " +
            classeur.SheetNames.join(", ")
        );

    }

    return lireFeuille(classeur, nomFeuille).map(nettoyerLigne);
}


// Vérifie qu'aucune feuille n'est vide
function verifierNonVides(donnees) {

    const vides = Object.keys(donnees).filter(function (nom) {
        return donnees[nom].length === 0;
    });

    if (vides.length > 0) {
        throw new Error("Feuille(s) vide(s) : " + vides.join(", ") + ".");
    }
}


// =====================================================
// 3. SAUVEGARDE LOCALE
// =====================================================

function sauvegarderLocalement(donnees) {

    // 3.1 Transmission au moteur de génération (mémoire)
    if (
        !window.generationExamens ||
        typeof window.generationExamens.definirDonneesLocales !== "function"
    ) {
        throw new Error("Le moteur de génération locale n'est pas disponible.");
    }

    window.generationExamens.definirDonneesLocales(donnees);

    // 3.2 Copie de secours dans le navigateur
    if (CONFIG_IMPORT.sauvegardeLocalStorage) {

        Object.keys(donnees).forEach(function (nom) {

            try {

                localStorage.setItem(
                    CONFIG_IMPORT.prefixeLocalStorage + nom,
                    JSON.stringify(donnees[nom])
                );

            }
            catch (erreur) {

                // Quota dépassé ou stockage désactivé : non bloquant
                console.warn(
                    "⚠ Copie localStorage impossible pour " + nom + " :",
                    erreur.message
                );

            }

        });

    }

    Object.keys(donnees).forEach(function (nom) {
        console.log("✓ " + nom + " chargé localement :", donnees[nom].length);
    });
}


// =====================================================
// 4. ENREGISTREMENT FIRESTORE
// =====================================================

// Supprime tous les documents d'une collection (par lots)
async function viderCollection(db, nomCollection) {

    while (true) {

        const instantane = await getDocs(
            query(
                collection(db, nomCollection),
                limit(CONFIG_IMPORT.tailleLot)
            )
        );

        if (instantane.empty) {
            break;
        }

        const lot = writeBatch(db);

        instantane.docs.forEach(function (documentFirestore) {
            lot.delete(documentFirestore.ref);
        });

        await lot.commit();
    }
}


// Écrit une liste de lignes dans une collection (par lots)
async function ecrireCollection(db, cleDonnees, lignes, surProgression) {

    const nomCollection = CONFIG_IMPORT.collections[cleDonnees];
    const champs = CONFIG_IMPORT.champsIdentifiant[cleDonnees] || ["id"];
    const horodatage = new Date().toISOString();
    const dejaUtilises = new Set();

    if (CONFIG_IMPORT.remplacerCollections) {
        await viderCollection(db, nomCollection);
    }

    let ecrits = 0;

    for (let debut = 0; debut < lignes.length; debut += CONFIG_IMPORT.tailleLot) {

        const morceau = lignes.slice(debut, debut + CONFIG_IMPORT.tailleLot);
        const lot = writeBatch(db);

        morceau.forEach(function (ligne, i) {

            const identifiant = fabriquerIdentifiant(
                ligne, champs, nomCollection, debut + i, dejaUtilises
            );

            lot.set(
                doc(db, nomCollection, identifiant),
                { ...ligne, importeLe: horodatage }
            );

        });

        await lot.commit();

        ecrits += morceau.length;

        if (surProgression) {
            surProgression(nomCollection, ecrits, lignes.length);
        }
    }

    console.log("✓ Firestore — " + nomCollection + " :", ecrits, "document(s)");

    return ecrits;
}


// Envoie toutes les données dans Firestore
async function sauvegarderFirestore(donnees, surProgression) {

    const db = obtenirFirestore();

    if (!db) {
        return { effectue: false, raison: "Firestore non disponible" };
    }

    const resume = {};

    for (const cle of Object.keys(donnees)) {
        resume[cle] = await ecrireCollection(db, cle, donnees[cle], surProgression);
    }

    return { effectue: true, resume: resume };
}


// =====================================================
// 5. PROCÉDURE COMMUNE D'IMPORT
// =====================================================

async function executerImport(options) {

    const statut = document.getElementById(options.idStatut);

    basculerBouton(options.idBouton, false);

    let localOk = false;

    try {

        afficherStatut(statut, "⏳ Lecture du fichier Excel…");

        // 1. Lecture + préparation
        const classeur = await lireClasseur(options.idFichier, options.nomFichier);
        const donnees = options.preparer(classeur);

        verifierNonVides(donnees);

        // 2. Sauvegarde locale (toujours en premier)
        sauvegarderLocalement(donnees);
        localOk = true;

        afficherStatut(statut, "✓ Chargement local terminé. Envoi vers Firestore…");

        // 3. Sauvegarde Firestore
        const resultat = await sauvegarderFirestore(
            donnees,
            function (collection, ecrits, total) {
                afficherStatut(
                    statut,
                    "⏳ Firestore — " + collection + " : " + ecrits + " / " + total
                );
            }
        );

        // 4. Message final
        if (!resultat.effectue) {

            afficherStatut(
                statut,
                "✓ Données chargées en local uniquement (" +
                resultat.raison + ")."
            );

        }
        else {

            const detail = Object.keys(resultat.resume).map(function (cle) {
                return resultat.resume[cle] + " " + cle;
            }).join(", ");

            afficherStatut(
                statut,
                "✓ Import terminé (local + Firestore) : " + detail + "."
            );

        }

    }
    catch (erreur) {

        console.error("❌ Erreur lors de l'import :", erreur);

        if (localOk) {

            afficherStatut(
                statut,
                "⚠ Données chargées en local, mais échec Firestore : " +
                erreur.message
            );

        }
        else {

            afficherStatut(statut, "❌ " + erreur.message);

        }

    }
    finally {

        basculerBouton(options.idBouton, true);

    }
}


// =====================================================
// 6. IMPORT DU PARAMÉTRAGE
// =====================================================

function importerParametrage() {

    return executerImport({

        idFichier: "fichierParametrage",
        idStatut: "statutImportParametrage",
        idBouton: "btnImporterParametrage",
        nomFichier: "parametrage_examens.xlsx",

        preparer: function (classeur) {

            const matieres = lireFeuilleSecurisee(classeur, "matieres");

            const sessions = lireFeuilleSecurisee(classeur, "sessions")
                .map(function (session) {
                    return {
                        ...session,
                        dateDebutAffichage: formaterDate(session.dateDebut),
                        dateFinAffichage: formaterDate(session.dateFin)
                    };
                });

            const creneaux = lireFeuilleSecurisee(classeur, "creneaux")
                .map(function (creneau) {
                    return {
                        ...creneau,
                        heureDebutAffichage: convertirHeureExcel(creneau.heureDebut),
                        heureFinAffichage: convertirHeureExcel(creneau.heureFin)
                    };
                });

            return {
                matieres: matieres,
                sessions: sessions,
                creneaux: creneaux
            };
        }

    });
}


// =====================================================
// 7. IMPORT DES SALLES / AMPHIS
// =====================================================

function importerSallesAmphis() {

    return executerImport({

        idFichier: "fichierSallesAmphis",
        idStatut: "statutImportSallesAmphis",
        idBouton: "btnImporterSallesAmphis",
        nomFichier: "salles_amphis.xlsx",

        preparer: function (classeur) {

            return {
                sallesAmphis: lireFeuilleSecurisee(classeur, "salles_amphis"),
                effectifs: lireFeuilleSecurisee(classeur, "effectifs")
            };
        }

    });
}


// =====================================================
// 8. BOUTONS IMPORT
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    const liaisons = [
        { id: "btnImporterParametrage", action: importerParametrage },
        { id: "btnImporterSallesAmphis", action: importerSallesAmphis }
    ];

    liaisons.forEach(function (liaison) {

        const bouton = document.getElementById(liaison.id);

        if (bouton) {
            bouton.addEventListener("click", liaison.action);
            console.log("✓ Bouton connecté :", liaison.id);
        }
        else {
            console.error("❌ Bouton introuvable :", liaison.id);
        }

    });

    if (!obtenirFirestore()) {
        consol
