
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
    setDoc
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
        // Récupération des données
        // -------------------------------------------------

        const matieres =
            obtenirMatieres();


        const sessions =
            obtenirSessions();


        const creneaux =
            obtenirCreneaux();


        console.log(
            "Début de l'import Firestore..."
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


        // -------------------------------------------------
        // Import des matières
        // -------------------------------------------------

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


            await setDoc(

                doc(
                    db,
                    "matieres",
                    identifiant
                ),

                matiere

            );

        }


        console.log(
            "✓ Matières importées :",
            matieres.length
        );


        // -------------------------------------------------
        // Import des sessions
        // -------------------------------------------------

        for (
            let i = 0;
            i < sessions.length;
            i++
        ) {

            const session =
                sessions[i];


            const identifiant =
                session.sessionCode;


            await setDoc(

                doc(
                    db,
                    "sessions",
                    identifiant
                ),

                session

            );

        }


        console.log(
            "✓ Sessions importées :",
            sessions.length
        );


        // -------------------------------------------------
        // Import des créneaux
        // -------------------------------------------------

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


            await setDoc(

                doc(
                    db,
                    "creneaux",
                    identifiant
                ),

                creneau

            );

        }


        console.log(
            "✓ Créneaux importés :",
            creneaux.length
        );


        // -------------------------------------------------
        // Confirmation
        // -------------------------------------------------

        if (statut) {

            statut.textContent =
                "✓ Import terminé : " +
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
            "✓ IMPORT PARAMÉTRAGE TERMINÉ"
        );


        console.log(
            "===================================="
        );

    }


    catch (erreur) {

        console.error(
            "❌ Erreur lors de l'import :",
            erreur
        );


        if (statut) {

            statut.textContent =
                "❌ Erreur lors de l'import. " +
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
