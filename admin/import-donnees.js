
// =====================================================
// PLANIFICATION DES EXAMENS FSGF
// IMPORT-DONNEES.JS
// Import des données Excel vers Firestore
// =====================================================


// =====================================================
// 1. IMPORT EXCEL — MODE LOCAL
// =====================================================

// Aucune connexion Firestore nécessaire dans ce fichier.


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
        // 1. RÉCUPÉRATION DU FICHIER EXCEL
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

        console.log(
            "Fichier sélectionné :",
            fichier.name
        );


        // -------------------------------------------------
        // 2. LECTURE DU FICHIER EXCEL
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
        // 3. LECTURE DES TROIS FEUILLES
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
        // 4. PRÉPARATION DES SESSIONS
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
        // 5. PRÉPARATION DES CRÉNEAUX
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


        // -------------------------------------------------
        // 6. VÉRIFICATION DES DONNÉES
        // -------------------------------------------------

        if (
            matieres.length === 0 ||
            sessions.length === 0 ||
            creneaux.length === 0
        ) {

            throw new Error(
                "Une ou plusieurs feuilles Excel sont vides."
            );

        }


        // -------------------------------------------------
        // 7. TRANSMISSION AU MOTEUR LOCAL
        // -------------------------------------------------

        if (
            !window.generationExamens ||
            typeof window.generationExamens.definirDonneesLocales !== "function"
        ) {

            throw new Error(
                "Le moteur de génération locale n'est pas disponible."
            );

        }

        window.generationExamens.definirDonneesLocales({

            matieres: matieres,

            sessions: sessions,

            creneaux: creneaux

        });


        // -------------------------------------------------
        // 8. CONFIRMATION
        // -------------------------------------------------

        console.log(
            "✓ Matières chargées localement :",
            matieres.length
        );

        console.log(
            "✓ Sessions chargées localement :",
            sessions.length
        );

        console.log(
            "✓ Créneaux chargés localement :",
            creneaux.length
        );

        if (statut) {

            statut.textContent =
                "✓ Chargement local terminé : " +
                matieres.length +
                " matières, " +
                sessions.length +
                " sessions et " +
                creneaux.length +
                " créneaux.";

        }

        console.log(
            "✓ PARAMÉTRAGE CHARGÉ EN MÉMOIRE — AUCUNE ÉCRITURE FIRESTORE"
        );

    }

    catch (erreur) {

        console.error(
            "❌ Erreur lors du chargement du paramétrage :",
            erreur
        );

        if (statut) {

            statut.textContent =
                "❌ Erreur lors du chargement local. Consultez la console F12.";

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
        // 1. RÉCUPÉRATION DU FICHIER EXCEL
        // -------------------------------------------------

        const fichier =
            document.getElementById(
                "fichierSallesAmphis"
            ).files[0];

        if (!fichier) {

            throw new Error(
                "Veuillez sélectionner le fichier salles_amphis.xlsx."
            );

        }

        console.log(
            "Fichier salles / amphis sélectionné :",
            fichier.name
        );


        // -------------------------------------------------
        // 2. LECTURE DU FICHIER EXCEL
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
        // 3. LECTURE DES DEUX FEUILLES
        // -------------------------------------------------

        const sallesAmphis =
            lireFeuille(
                classeur,
                "salles_amphis"
            );

        const effectifs =
            lireFeuille(
                classeur,
                "effectifs"
            );


        // -------------------------------------------------
        // 4. VÉRIFICATION DES DONNÉES
        // -------------------------------------------------

        if (
            sallesAmphis.length === 0 ||
            effectifs.length === 0
        ) {

            throw new Error(
                "La feuille salles_amphis ou effectifs est vide."
            );

        }


        // -------------------------------------------------
        // 5. TRANSMISSION AU MOTEUR LOCAL
        // -------------------------------------------------

        if (
            !window.generationExamens ||
            typeof window.generationExamens.definirDonneesLocales !== "function"
        ) {

            throw new Error(
                "Le moteur de génération locale n'est pas disponible."
            );

        }

        window.generationExamens.definirDonneesLocales({

            sallesAmphis: sallesAmphis,

            effectifs: effectifs

        });


        // -------------------------------------------------
        // 6. CONFIRMATION
        // -------------------------------------------------

        console.log(
            "✓ Salles / amphis chargés localement :",
            sallesAmphis.length
        );

        console.log(
            "✓ Effectifs chargés localement :",
            effectifs.length
        );

        if (statut) {

            statut.textContent =
                "✓ Chargement local terminé : " +
                sallesAmphis.length +
                " salles / amphis et " +
                effectifs.length +
                " effectifs.";

        }

        console.log(
            "✓ SALLES / AMPHIS CHARGÉS EN MÉMOIRE — AUCUNE ÉCRITURE FIRESTORE"
        );

    }

    catch (erreur) {

        console.error(
            "❌ Erreur lors du chargement local des salles / amphis :",
            erreur
        );

        if (statut) {

            statut.textContent =
                "❌ Erreur lors du chargement local. Consultez la console F12.";

        }

    }

}
