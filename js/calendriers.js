
// =====================================================
// PLANIFICATION DES EXAMENS - FSGF
// CALENDRIERS.JS
// Construction et affichage du calendrier
// =====================================================


// =====================================================
// 1. ATTENDRE LE CHARGEMENT DE LA PAGE
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    console.log("Calendriers : initialisation.");


    // -------------------------------------------------
    // Tableau principal
    // -------------------------------------------------

    const tableau =
        document.getElementById("tableauCalendrier");


    if (!tableau) {

        console.warn(
            "Calendriers : tableau #tableauCalendrier introuvable."
        );

        return;

    }


    // -------------------------------------------------
    // Niveau affiché
    // -------------------------------------------------

    const niveauElement =
        document.getElementById("niveauCalendrier");


    // =================================================
    // 2. CONSTRUIRE LE CALENDRIER
    // =================================================

    function construireCalendrier() {

        // Vérifier que les données sont disponibles
        if (
            typeof obtenirMatieres !== "function" ||
            typeof obtenirSessions !== "function" ||
            typeof obtenirCreneaux !== "function" ||
            typeof obtenirSallesAmphis !== "function"
        ) {

            console.error(
                "Calendriers : fonctions de données indisponibles."
            );

            return;

        }


        const matieres =
            obtenirMatieres();

        const sessions =
            obtenirSessions();

        const creneaux =
            obtenirCreneaux();

        const sallesAmphis =
            obtenirSallesAmphis();


        console.log(
            "Calendriers : données reçues.",
            {
                matieres: matieres.length,
                sessions: sessions.length,
                creneaux: creneaux.length,
                sallesAmphis: sallesAmphis.length
            }
        );


        // =================================================
        // 3. PRÉPARER LE TABLEAU
        // =================================================

        const thead =
            tableau.querySelector("thead");

        const tbody =
            tableau.querySelector("tbody");


        if (!thead || !tbody) {

            console.error(
                "Calendriers : thead ou tbody introuvable."
            );

            return;

        }


        // Vider le tableau
        thead.innerHTML = "";
        tbody.innerHTML = "";


        // =================================================
        // 4. DÉTERMINER LES DATES
        // =================================================

        /*
         * Les dates sont recherchées dans les créneaux.
         *
         * Exemple attendu :
         *
         * date : 12/06
         * debut : 08h30
         * fin : 10h30
         *
         * Le code reste volontairement souple
         * pour accepter plusieurs noms de colonnes.
         */

        const dates = [];


        creneaux.forEach(function (creneau) {

            const date =
                creneau.date ||
                creneau.Date ||
                creneau.DATE ||
                creneau.jour ||
                creneau.Jour ||
                creneau.JOUR ||
                "";


            if (
                date !== "" &&
                !dates.includes(date)
            ) {

                dates.push(date);

            }

        });


        // =================================================
        // 5. SI AUCUNE DATE N'EST TROUVÉE
        // =================================================

        if (dates.length === 0) {

            console.warn(
                "Calendriers : aucune date trouvée dans les créneaux."
            );


            const ligne =
                document.createElement("tr");


            const cellule =
                document.createElement("td");


            cellule.colSpan = 2;

            cellule.textContent =
                "Aucun créneau disponible.";


            ligne.appendChild(cellule);

            tbody.appendChild(ligne);

            return;

        }


        // =================================================
        // 6. PREMIÈRE LIGNE : DATES
        // =================================================

        const ligneDates =
            document.createElement("tr");


        // FILIÈRE
        const thFiliere =
            document.createElement("th");

        thFiliere.rowSpan = 2;

        thFiliere.textContent =
            "FILIÈRE";

        ligneDates.appendChild(thFiliere);


        // SALLES / AMPHIS
        const thSalle =
            document.createElement("th");

        thSalle.rowSpan = 2;

        thSalle.textContent =
            "SALLES / AMPHIS";

        ligneDates.appendChild(thSalle);


        // Une colonne par date
        dates.forEach(function (date) {

            const creneauxDate =
                creneaux.filter(function (creneau) {

                    const valeurDate =
                        creneau.date ||
                        creneau.Date ||
                        creneau.DATE ||
                        creneau.jour ||
                        creneau.Jour ||
                        creneau.JOUR ||
                        "";

                    return valeurDate === date;

                });


            const th =
                document.createElement("th");


            th.colSpan =
                Math.max(creneauxDate.length, 1);


            th.textContent =
                date;


            ligneDates.appendChild(th);

        });


        thead.appendChild(ligneDates);


        // =================================================
        // 7. DEUXIÈME LIGNE : CRÉNEAUX
        // =================================================

        const ligneCreneaux =
            document.createElement("tr");


        dates.forEach(function (date) {

            const creneauxDate =
                creneaux.filter(function (creneau) {

                    const valeurDate =
                        creneau.date ||
                        creneau.Date ||
                        creneau.DATE ||
                        creneau.jour ||
                        creneau.Jour ||
                        creneau.JOUR ||
                        "";

                    return valeurDate === date;

                });


            creneauxDate.forEach(function (creneau) {

                const th =
                    document.createElement("th");


                const debut =
                    creneau.heureDebut ||
                    creneau.heure_debut ||
                    creneau.debut ||
                    creneau.Debut ||
                    "";


                const fin =
                    creneau.heureFin ||
                    creneau.heure_fin ||
                    creneau.fin ||
                    creneau.Fin ||
                    "";


                if (debut && fin) {

                    th.textContent =
                        `${debut} - ${fin}`;

                }

                else {

                    th.textContent =
                        debut || fin || "Créneau";

                }


                ligneCreneaux.appendChild(th);

            });

        });


        thead.appendChild(ligneCreneaux);


        // =================================================
        // 8. DÉTERMINER LES FILIÈRES
        // =================================================

        const filieres = [];


        matieres.forEach(function (matiere) {

            const filiere =
                matiere.filiere ||
                matiere.Filiere ||
                matiere.FILIERE ||
                "";


            if (
                filiere !== "" &&
                !filieres.includes(filiere)
            ) {

                filieres.push(filiere);

            }

        });


        // =================================================
        // 9. SI AUCUNE FILIÈRE N'EST TROUVÉE
        // =================================================

        if (filieres.length === 0) {

            console.warn(
                "Calendriers : aucune filière trouvée dans les matières."
            );


            const ligne =
                document.createElement("tr");


            const cellule =
                document.createElement("td");


            cellule.colSpan =
                2 + creneaux.length;


            cellule.textContent =
                "Aucune filière disponible.";


            ligne.appendChild(cellule);

            tbody.appendChild(ligne);

            return;

        }


        // =================================================
        // 10. CONSTRUIRE LES LIGNES DES FILIÈRES
        // =================================================

        filieres.forEach(function (filiere) {

            const ligne =
                document.createElement("tr");


            // ---------------------------------------------
            // Filière
            // ---------------------------------------------

            const tdFiliere =
                document.createElement("td");


            tdFiliere.textContent =
                filiere;


            ligne.appendChild(tdFiliere);


            // ---------------------------------------------
            // Salle / Amphi
            // ---------------------------------------------

            const tdSalle =
                document.createElement("td");


            tdSalle.textContent =
                "";


            ligne.appendChild(tdSalle);


            // ---------------------------------------------
            // Cellules des créneaux
            // ---------------------------------------------

            creneaux.forEach(function () {

                const td =
                    document.createElement("td");


                td.textContent =
                    "";


                ligne.appendChild(td);

            });


            tbody.appendChild(ligne);

        });


        console.log(
            "✓ Calendrier construit."
        );

    }


    // =====================================================
    // 11. CONSTRUCTION INITIALE
    // =====================================================

    /*
     * data.js charge les fichiers Excel de manière
     * asynchrone.
     *
     * On attend donc légèrement avant de construire
     * le tableau.
     */

    setTimeout(function () {

        construireCalendrier();

    }, 300);


    // =====================================================
    // 12. EXPOSER LA FONCTION
    // =====================================================

    window.construireCalendrier =
        construireCalendrier;


});

