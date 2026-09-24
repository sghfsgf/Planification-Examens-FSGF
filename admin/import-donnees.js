// =====================================================
// PLANIFICATION DES EXAMENS FSGF
// IMPORT-DONNEES.JS
// Import du paramétrage Excel vers Firestore
// =====================================================


// =====================================================
// 1. FIREBASE / FIRESTORE
// =====================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    collection,
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";


const db =
    getFirestore(app);


// =====================================================
// 2. BOUTON IMPORT PARAMÉTRAGE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const bouton =
            document.getElementById(
                "btnImporterParametrage"
            );


        if (!bouton) {

            console.error(
                "❌ Bouton btnImporterParametrage introuvable."
            );

            return;

        }


        bouton.addEventListener(
            "click",
            importerParametrage
        );


        console.log(
            "✓ Import du paramétrage : bouton connecté."
        );

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

