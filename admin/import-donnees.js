
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
        // 4. AJOUT DES EFFECTIFS DU NOUVEL EXCEL
        // =================================================

        for (
            let i = 0;
            i < effectifs.length;
            i++
        ) {

            const effectif =
                effectifs[i];


            const identifiant =
                effectif.anneeUniversitaire
                + "_"
                + effectif.niveauCode
                + "_"
                + effectif.filiereCode
                    .replace(/\s+/g, "_");


            batch.set(

                doc(
                    db,
                    "effectifs",
                    identifiant
                ),

                effectif

            );

        }


        console.log(
            "Effectifs ajoutés au batch :",
            effectifs.length
        );


        // =================================================
        // 5. EXÉCUTION
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
