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

// Firebase est chargé dynamiquement (voir obtenirFirestore) pour qu'une
// erreur de chargement n'empêche jamais l'import local de fonctionner.

const URL_FIRESTORE =
    "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

let baseFirestore = null;      // instance Firestore
let moduleFirestore = null;    // fonctions du SDK (collection, doc, ...)
let erreurFirestore = null;    // dernière erreur d'initialisation

console.log("✓ import-donnees.js chargé.");


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
        // Identifiant composite : champs reliés par "+"
        // ex. : 2025-2026_S1_R1_PRINCIPALE
        sessions: [
            "anneeUniversitaire+semestreCode+regimeCode+sessionCode"
        ],
        creneaux: ["codeCreneau", "code", "id"],
        sallesAmphis: ["codeSalle", "code", "id", "nom"],
        effectifs: ["id"]
    },

    // Schéma des collections : champs obligatoires dans Excel ET seuls champs
    // enregistrés dans Firestore. Une collection absente d'ici garde
    // toutes ses colonnes.
    schemas: {
        sessions: [
            "anneeUniversitaire",
            "semestreCode",
            "regimeCode",
            "sessionCode",
            "sessionLibelle",
            "dateDebut",
            "dateFin"
        ]
    },

    // true : supprime d'abord les anciens documents de la collection
    remplacerCollections: false
};


// =====================================================
// 2. OUTILS GÉNÉRAUX
// =====================================================

// Retourne l'instance Firestore (ou null)
async function obtenirFirestore() {

    if (baseFirestore) {
        return baseFirestore;
    }

    try {

        const configuration = await import("../firebase-config.js");
        const sdk = await import(URL_FIRESTORE);

        if (!configuration.app) {
            throw new Error("firebase-config.js n'exporte pas « app ».");
        }

        moduleFirestore = sdk;
        baseFirestore = sdk.getFirestore(configuration.app);
        erreurFirestore = null;

        return baseFirestore;

    }
    catch (erreur) {

        erreurFirestore = erreur;
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

        const nomChamp = String(cle).trim();

        // Firestore refuse les noms de champ vides ou du type __xxx__
        if (nomChamp === "" || /^__.*__$/.test(nomChamp)) {
            return;
        }

        if (valeur === undefined) {
            return;
        }

        if (typeof valeur === "string") {
            valeur = valeur.trim();
        }

        // NaN / Infinity ne sont pas acceptés proprement
        if (typeof valeur === "number" && !Number.isFinite(valeur)) {
            valeur = null;
        }

        propre[nomChamp] = valeur;

    });

    return propre;
}


// Fabrique un identifiant de document valide
function fabriquerIdentifiant(ligne, champs, nomCollection, index, dejaUtilises) {

    let base = "";

    for (const champ of champs) {

        // Un champ "a+b+c" est un identifiant composite :
        // toutes les parties doivent être renseignées
        const parties = champ.split("+");

        const valeurs = parties.map(function (nom) {

            const valeur = ligne[nom];

            return (valeur === undefined || valeur === null)
                ? ""
                : String(valeur).trim();

        });

        if (valeurs.every(function (v) { return v !== ""; })) {
            base = valeurs.join("_");
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


// Vérifie que les colonnes obligatoires existent dans chaque feuille
function verifierColonnes(donnees) {

    Object.keys(CONFIG_IMPORT.schemas).forEach(function (cle) {

        if (!donnees[cle]) {
            return;
        }

        const presentes = new Set();

        donnees[cle].forEach(function (ligne) {
            Object.keys(ligne).forEach(function (champ) {
                presentes.add(champ);
            });
        });

        const manquantes = CONFIG_IMPORT.schemas[cle].filter(function (champ) {
            return !presentes.has(champ);
        });

        if (manquantes.length > 0) {

            throw new Error(
                "Feuille « " + cle + " » : colonne(s) manquante(s) : " +
                manquantes.join(", ") + ". Colonnes trouvées : " +
                Array.from(presentes).join(", ")
            );

        }

    });
}


// Ne garde que les champs du schéma (si la collection en a un)
function appliquerSchema(cleDonnees, lignes) {

    const schema = CONFIG_IMPORT.schemas[cleDonnees];

    if (!schema) {
        return lignes;
    }

    return lignes.map(function (ligne) {

        const filtree = {};

        schema.forEach(function (champ) {
            if (ligne[champ] !== undefined) {
                filtree[champ] = ligne[champ];
            }
        });

        return filtree;

    });
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

    const { collection, getDocs, limit, query, writeBatch } = moduleFirestore;

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

    const { doc, writeBatch } = moduleFirestore;

    const nomCollection = CONFIG_IMPORT.collections[cleDonnees];
    const champs = CONFIG_IMPORT.champsIdentifiant[cleDonnees] || ["id"];
    const horodatage = new Date().toISOString();
    const dejaUtilises = new Set();

    // Ne garder que les champs du schéma (ex. : les 7 champs de sessions)
    lignes = appliquerSchema(cleDonnees, lignes);

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

    const db = await obtenirFirestore();

    if (!db) {

        const cause = erreurFirestore
            ? " : " + erreurFirestore.message
            : "";

        return {
            effectue: false,
            raison: "Firestore non disponible" + cause
        };
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
        verifierColonnes(donnees);

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

    obtenirFirestore().then(function (db) {

        if (db) {
            console.log("✓ Firestore prêt pour l'import.");
        }
        else {
            console.warn("⚠ Firestore indisponible : les imports resteront locaux.");
        }

    });

});
