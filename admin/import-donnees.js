
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
        // Récupération des données Excel
        // -------------------------------------------------

        const matieres =
            obtenirMatieres();


        const sessions =
            obtenirSessions();


        const creneaux =
            obtenirCreneaux();


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
