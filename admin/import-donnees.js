
// =====================================================
// PLANIFICATION DES EXAMENS FSGF
// IMPORT-DONNEES.JS
// Import des données Excel vers Firestore
// =====================================================


// =====================================================
// 1. FIREBASE / FIRESTORE
// =====================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDocs,
    collection,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";


const db =
    getFirestore(app);


// =====================================================
// 2. BOUTONS IMPORT
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        // -------------------------------------------------
        // Bouton import paramétrage
        // -------------------------------------------------

        const boutonParametrage =
            document.getElementById(
                "btnImporterParametrage"
            );


        if (boutonParametrage) {

            boutonParametrage.addEventListener(
                "click",
                importerParametrage
            );


            console.log(
                "✓ Import du paramétrage : bouton connecté."
            );

        }
        else {

            console.error(
                "❌ Bouton btnImporterParametrage introuvable."
            );

        }


        // -------------------------------------------------
        // Bouton import salles / amphis
        // -------------------------------------------------

        const boutonSalles =
            document.getElementById(
                "btnImporterSallesAmphis"
            );


        if (boutonSalles) {

            boutonSalles.addEventListener(
                "click",
                importerSallesAmphis
            );


            console.log(
                "✓ Import salles / amphis : bouton connecté."
            );

        }
        else {

            console.error(
                "❌ Bouton btnImporterSallesAmphis introuvable."
            );

        }

    }
);


// =====================================================
// 3. IMPORT DU PARAMÉTRAGE
// =====================================================


async function importerParametrage() {

    const statut =
        document.getElementById(
            "statutImportParametrage"
        );


    try {

   // -------------------------------------------------
// Récupération du fichier choisi par l'Admin
// -------------------------------------------------

const fichier =
    document.getElementById(
        "fichierParametrage"
    ).files[0];


if (!fichier) {

    throw new Error(
        "Veuillez sélectionner le fichier parametrage_examens.xlsx."
    );

}


// -------------------------------------------------
// Vérification du nom du fichier
// -------------------------------------------------

console.log(
    "Fichier sélectionné :",
    fichier.name
);


// -------------------------------------------------
// Lecture du fichier Excel sélectionné
// -------------------------------------------------

const tableau =
    await fichier.arrayBuffer();


const classeur =
    XLSX.read(

        tableau,

        {
            type: "array"
        }

    );


// -------------------------------------------------
// Lecture des trois feuilles
// -------------------------------------------------

const matieres =
    lireFeuille(

        classeur,

        "matieres"

    );


const sessionsBrutes =
    lireFeuille(

        classeur,

        "sessions"

    );


const creneauxBruts =
    lireFeuille(

        classeur,

        "creneaux"

    );


// -------------------------------------------------
// Préparation des sessions
// -------------------------------------------------

const sessions =
    sessionsBrutes.map(function (session) {

        return {

            ...session,

            dateDebutAffichage:
                formaterDate(
                    session.dateDebut
                ),

            dateFinAffichage:
                formaterDate(
                    session.dateFin
                )

        };

    });


// -------------------------------------------------
// Préparation des créneaux
// -------------------------------------------------

const creneaux =
    creneauxBruts.map(function (creneau) {

        return {

            ...creneau,

            heureDebutAffichage:
                convertirHeureExcel(
                    creneau.heureDebut
                ),

            heureFinAffichage:
                convertirHeureExcel(
                    creneau.heureFin
                )

        };

    });     



        console.log(
            "Début de la synchronisation Firestore..."
        );


        console.log(
            "Matières à importer :",
            matieres.length
        );


        console.log(
            "Sessions à importer :",
            sessions.length
        );


        console.log(
            "Créneaux à importer :",
            creneaux.length
        );


        // =================================================
        // 1. PRÉPARATION DU BATCH
        // =================================================

        const batch =
            writeBatch(db);


        // =================================================
        // 2. SUPPRESSION DES ANCIENNES MATIÈRES
        // =================================================

        const anciensMatieres =
            await getDocs(
                collection(
                    db,
                    "matieres"
                )
            );


        anciensMatieres.forEach(
            function (documentFirestore) {

                batch.delete(
                    documentFirestore.ref
                );

            }
        );


        console.log(
            "Anciennes matières supprimées :",
            anciensMatieres.size
        );


        // =================================================
        // 3. SUPPRESSION DES ANCIENNES SESSIONS
        // =================================================

        const anciennesSessions =
            await getDocs(
                collection(
                    db,
                    "sessions"
                )
            );


        anciennesSessions.forEach(
            function (documentFirestore) {

                batch.delete(
                    documentFirestore.ref
                );

            }
        );


        console.log(
            "Anciennes sessions supprimées :",
            anciennesSessions.size
        );


        // =================================================
        // 4. SUPPRESSION DES ANCIENS CRÉNEAUX
        // =================================================

        const anciensCreneaux =
            await getDocs(
                collection(
                    db,
                    "creneaux"
                )
            );


        anciensCreneaux.forEach(
            function (documentFirestore) {

                batch.delete(
                    documentFirestore.ref
                );

            }
        );


        console.log(
            "Anciens créneaux supprimés :",
            anciensCreneaux.size
        );


        // =================================================
        // 5. AJOUT DES MATIÈRES DU NOUVEL EXCEL
        // =================================================

        for (
            let i = 0;
            i < matieres.length;
            i++
        ) {

            const matiere =
                matieres[i];


            const identifiant =
                "matiere_" +
                i;


            batch.set(

                doc(
                    db,
                    "matieres",
                    identifiant
                ),

                matiere

            );

        }


        // =================================================
        // 6. AJOUT DES SESSIONS DU NOUVEL EXCEL
        // =================================================

        for (
            let i = 0;
            i < sessions.length;
            i++
        ) {

            const session =
                sessions[i];


            const identifiant =
                session.sessionCode;


            batch.set(

                doc(
                    db,
                    "sessions",
                    identifiant
                ),

                session

            );

        }


        // =================================================
        // 7. AJOUT DES CRÉNEAUX DU NOUVEL EXCEL
        // =================================================

        for (
            let i = 0;
            i < creneaux.length;
            i++
        ) {

            const creneau =
                creneaux[i];


            const identifiant =
                creneau.sessionCode +
                "_" +
                creneau.creneauOrdre;


            batch.set(

                doc(
                    db,
                    "creneaux",
                    identifiant
                ),

                creneau

            );

        }


        // =================================================
        // 8. EXÉCUTION DE LA SYNCHRONISATION
        // =================================================

        await batch.commit();


        console.log(
            "✓ Matières synchronisées :",
            matieres.length
        );


        console.log(
            "✓ Sessions synchronisées :",
            sessions.length
        );


        console.log(
            "✓ Créneaux synchronisés :",
            creneaux.length
        );


        // -------------------------------------------------
        // Confirmation
        // -------------------------------------------------

        if (statut) {

            statut.textContent =
                "✓ Synchronisation terminée : " +
                matieres.length +
                " matières, " +
                sessions.length +
                " sessions et " +
                creneaux.length +
                " créneaux.";

        }


        console.log(
            "===================================="
        );


        console.log(
            "✓ SYNCHRONISATION PARAMÉTRAGE TERMINÉE"
        );


        console.log(
            "===================================="
        );

    }


    catch (erreur) {

        console.error(
            "❌ Erreur lors de la synchronisation :",
            erreur
        );


        if (statut) {

            statut.textContent =
                "❌ Erreur lors de la synchronisation. " +
                "Consultez la console F12.";

        }

    }

}

// =====================================================
// 4. IMPORT DES SALLES / AMPHIS
// =====================================================

async function importerSallesAmphis() {

    const statut =
        document.getElementById(
            "statutImportSallesAmphis"
        );


    try {

        // -------------------------------------------------
        // Récupération du fichier choisi par l'Admin
        // -------------------------------------------------

const fichier =
    document.getElementById(
        "fichierSallesAmphis"
    ).files[0];


// -------------------------------------------------
// Vérification du fichier
// -------------------------------------------------

if (!fichier) {

    throw new Error(
        "Veuillez sélectionner le fichier salles_amphis.xlsx."
    );

}


// -------------------------------------------------
// Affichage du fichier sélectionné
// -------------------------------------------------

console.log(
    "Fichier salles / amphis sélectionné :",
    fichier.name
);


// -------------------------------------------------
// Lecture du fichier Excel sélectionné
// -------------------------------------------------

const tableau =
    await fichier.arrayBuffer();


const classeur =
    XLSX.read(

        tableau,

        {
            type: "array"
        }

    );


// -------------------------------------------------
// Lecture de la feuille salles_amphis
// -------------------------------------------------

const sallesAmphis =
    lireFeuille(

        classeur,

        "salles_amphis"

    );
// -------------------------------------------------
// Lecture de la feuille effectifs
// -------------------------------------------------

const effectifs =
    lireFeuille(

        classeur,

        "effectifs"

    );

        console.log(
            "Début de la synchronisation des salles / amphis..."
        );


        console.log(
            "Salles / amphis à importer :",
            sallesAmphis.length
        );
console.log(
    "Effectifs à importer :",
    effectifs.length
);

        // =================================================
        // 1. PRÉPARATION DU BATCH
        // =================================================

        const batch =
            writeBatch(db);


        // =================================================
        // 2. SUPPRESSION DES ANCIENNES SALLES / AMPHIS
        // =================================================

        const anciennesSallesAmphis =
            await getDocs(
                collection(
                    db,
                    "salles_amphis"
                )
            );


        anciennesSallesAmphis.forEach(
            function (documentFirestore) {

                batch.delete(
                    documentFirestore.ref
                );

            }
        );


        console.log(
            "Anciennes salles / amphis supprimées :",
            anciennesSallesAmphis.size
        );


        // =================================================
        // 3. AJOUT DES SALLES / AMPHIS DU NOUVEL EXCEL
        // =================================================

        for (
            let i = 0;
            i < sallesAmphis.length;
            i++
        ) {

            const salleAmphi =
                sallesAmphis[i];


            const identifiant =
                salleAmphi.code;


            batch.set(

                doc(
                    db,
                    "salles_amphis",
                    identifiant
                ),

                salleAmphi

            );

        }
        // =================================================
        // 4. SUPPRESSION DES ANCIENS EFFECTIFS
        // =================================================

        const anciensEffectifs =
            await getDocs(
                collection(
                    db,
                    "effectifs"
                )
            );


        anciensEffectifs.forEach(
            function (documentFirestore) {

                batch.delete(
                    documentFirestore.ref
                );

            }
        );


        console.log(
            "Anciens effectifs supprimés :",
            anciensEffectifs.size
        );
        

        // =================================================
        // 4. EXÉCUTION
        // =================================================

        await batch.commit();


        console.log(
            "✓ Salles / amphis synchronisées :",
            sallesAmphis.length
        );


        // -------------------------------------------------
        // Confirmation
        // -------------------------------------------------

        if (statut) {

            statut.textContent =
                "✓ Synchronisation terminée : " +
                sallesAmphis.length +
                " salles / amphis.";

        }


        console.log(
            "===================================="
        );


        console.log(
            "✓ SYNCHRONISATION SALLES / AMPHIS TERMINÉE"
        );


        console.log(
            "===================================="
        );

    }


    catch (erreur) {

        console.error(
            "❌ Erreur lors de la synchronisation des salles / amphis :",
            erreur
        );


        if (statut) {

            statut.textContent =
                "❌ Erreur lors de la synchronisation. " +
                "Consultez la console F12.";

        }

    }

}
