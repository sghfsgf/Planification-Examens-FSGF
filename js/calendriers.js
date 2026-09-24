
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

        // -------------------------------------------------
        // Vérifier les fonctions de data.js
        // -------------------------------------------------

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


        // -------------------------------------------------
        // Récupérer les données
        // -------------------------------------------------

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
        // 3. DIAGNOSTIC DE LA STRUCTURE EXCEL
        // =================================================

        console.log(
            "===================================="
        );

        console.log(
            "=== DIAGNOSTIC EXCEL ==="
        );


        // -------------------------------------------------
        // MATIERES
        // -------------------------------------------------

        console.log(
            "Colonnes MATIERES :",
            Object.keys(matieres[0] || {})
        );

        console.log(
            "Premier MATIERE :",
            matieres[0] || {}
        );


        // -------------------------------------------------
        // SESSIONS
        // -------------------------------------------------

        console.log(
            "Colonnes SESSIONS :",
            Object.keys(sessions[0] || {})
        );

        console.log(
            "Première SESSION :",
            sessions[0] || {}
        );


        // -------------------------------------------------
        // CRENEAUX
        // -------------------------------------------------

        console.log(
            "Colonnes CRENEAUX :",
            Object.keys(creneaux[0] || {})
        );

        console.log(
            "Premier CRENEAU :",
            creneaux[0] || {}
        );

        console.log(
            "TOUS LES CRENEAUX :"
        );

        console.table(creneaux);


        // -------------------------------------------------
        // SALLES / AMPHIS
        // -------------------------------------------------

        console.log(
            "Colonnes SALLES / AMPHIS :",
            Object.keys(sallesAmphis[0] || {})
        );

        console.log(
            "Première SALLE / AMPHI :",
            sallesAmphis[0] || {}
        );


        console.log(
            "=== FIN DIAGNOSTIC EXCEL ==="
        );

        console.log(
            "===================================="
        );


        // =================================================
        // 4. PRÉPARER LE TABLEAU
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
        // 5. DIAGNOSTIC TEMPORAIRE
        // =================================================

        if (creneaux.length === 0) {

            console.warn(
                "Calendriers : aucun créneau disponible."
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


        // -------------------------------------------------
        // Pour cette étape, on affiche simplement les
        // créneaux tels qu'ils sont réellement présents
        // dans Excel.
        // -------------------------------------------------

        const ligneEntete =
            document.createElement("tr");


        const thNumero =
            document.createElement("th");

        thNumero.textContent =
            "N°";

        ligneEntete.appendChild(thNumero);


        const colonnes =
            Object.keys(creneaux[0] || {});


        colonnes.forEach(function (colonne) {

            const th =
                document.createElement("th");

            th.textContent =
                colonne;

            ligneEntete.appendChild(th);

        });


        thead.appendChild(ligneEntete);


        // =================================================
        // 6. AFFICHER LES CRÉNEAUX
        // =================================================

        creneaux.forEach(function (creneau, index) {

            const ligne =
                document.createElement("tr");


            const tdNumero =
                document.createElement("td");

            tdNumero.textContent =
                index + 1;

            ligne.appendChild(tdNumero);


            colonnes.forEach(function (colonne) {

                const td =
                    document.createElement("td");


                const valeur =
                    creneau[colonne];


                td.textContent =
                    valeur === undefined ||
                    valeur === null
                        ? ""
                        : valeur;


                ligne.appendChild(td);

            });


            tbody.appendChild(ligne);

        });


        console.log(
            "✓ Diagnostic des créneaux affiché dans le calendrier."
        );

    }


    // =====================================================
    // 7. ATTENDRE LE CHARGEMENT COMPLET DES DONNÉES
    // =====================================================

    if (
        typeof donneesChargees !== "undefined"
    ) {

        donneesChargees.then(function (succes) {

            if (succes) {

                console.log(
                    "Calendriers : données Excel complètement chargées."
                );

                construireCalendrier();

            }

            else {

                console.error(
                    "Calendriers : impossible de construire le calendrier."
                );

            }

        });

    }

    else {

        console.error(
            "Calendriers : la promesse donneesChargees est introuvable."
        );

    }


    // =====================================================
    // 8. EXPOSER LA FONCTION
    // =====================================================

    window.construireCalendrier =
        construireCalendrier;


});

