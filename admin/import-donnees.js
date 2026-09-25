
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
        // Vérification du chargement Excel
        // -------------------------------------------------

        if (
            !donneesSontDisponibles()
        ) {

            throw new Error(
                "Les données Excel ne sont pas encore disponibles."
            );

        }


        // -------------------------------------------------
        // Récupération des salles / amphis
        // -------------------------------------------------

        const sallesAmphis =
            obtenirSallesAmphis();


        console.log(
            "Début de la synchronisation des salles / amphis..."
        );


        console.log(
            "Salles / amphis à importer :",
            sallesAmphis.length
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
        // Vérification du chargement Excel
        // -------------------------------------------------

        if (
            !donneesSontDisponibles()
        ) {

            throw new Error(
                "Les données Excel ne sont pas encore disponibles."
            );

        }


        // -------------------------------------------------
        // Récupération des salles / amphis
        // -------------------------------------------------

        const sallesAmphis =
            obtenirSallesAmphis();


        console.log(
            "Début de l'import des salles / amphis..."
        );


        console.log(
            "Salles / amphis à importer :",
            sallesAmphis.length
        );


        // -------------------------------------------------
        // Import dans Firestore
        // -------------------------------------------------

        for (
            let i = 0;
            i < sallesAmphis.length;
            i++
        ) {

            const salleAmphi =
                sallesAmphis[i];


            // Le code métier devient
            // l'identifiant du document Firestore

            const identifiant =
                salleAmphi.code;


            await setDoc(

                doc(
                    db,
                    "salles_amphis",
                    identifiant
                ),

                salleAmphi

            );

        }


        // -------------------------------------------------
        // Confirmation
        // -------------------------------------------------

        console.log(
            "✓ Salles / amphis importées :",
            sallesAmphis.length
        );


        if (statut) {

            statut.textContent =
                "✓ Import terminé : " +
                sallesAmphis.length +
                " salles / amphis.";

        }


        console.log(
            "===================================="
        );


        console.log(
            "✓ IMPORT SALLES / AMPHIS TERMINÉ"
        );


        console.log(
            "===================================="
        );

    }


    catch (erreur) {

        console.error(
            "❌ Erreur lors de l'import des salles / amphis :",
            erreur
        );


        if (statut) {

            statut.textContent =
                "❌ Erreur lors de l'import. " +
                "Consultez la console F12.";

        }

    }

}
