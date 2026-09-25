// =====================================================
// CALENDRIERS ADMIN
// Affichage du planning généré
// =====================================================

function afficherPlanning(planning) {

    console.log("------------------------------------------");
    console.log("AFFICHAGE DU PLANNING");
    console.log("------------------------------------------");

    if (!planning) {

        console.error("❌ Aucun planning à afficher.");

        return;
    }

    // -------------------------------------------------
    // Construire le tableau
    // -------------------------------------------------

    const tableau =
        construireTableauCalendrier(planning);

    if (!tableau) {

        console.error(
            "❌ Impossible de construire le tableau."
        );

        return;
    }

    // -------------------------------------------------
    // Récupérer la zone d'affichage
    // -------------------------------------------------

    const zoneCalendrier =
        document.querySelector(".bloc-calendrier");

    if (!zoneCalendrier) {

        console.error(
            "❌ Zone .bloc-calendrier introuvable."
        );

        return;
    }

    // -------------------------------------------------
    // Vider le contenu précédent
    // -------------------------------------------------

    zoneCalendrier.innerHTML = "";

    // -------------------------------------------------
    // Ajouter le tableau
    // -------------------------------------------------

    zoneCalendrier.appendChild(tableau);

    console.log(
        "✓ Calendrier inséré dans la page."
    );
}

function formaterDateLongue(date) {

    const jours = [
        "Dimanche",
        "Lundi",
        "Mardi",
        "Mercredi",
        "Jeudi",
        "Vendredi",
        "Samedi"
    ];

    const mois = [
        "janvier",
        "février",
        "mars",
        "avril",
        "mai",
        "juin",
        "juillet",
        "août",
        "septembre",
        "octobre",
        "novembre",
        "décembre"
    ];

    return (
        jours[date.getDay()] +
        " " +
        date.getDate() +
        " " +
        mois[date.getMonth()] +
        " " +
        date.getFullYear()
    );
}

// =====================================================
// Construire le tableau HTML du calendrier
// =====================================================

function construireTableauCalendrier(planning) {

    console.log("------------------------------------------");
    console.log("CONSTRUCTION DU TABLEAU DU CALENDRIER");
    console.log("------------------------------------------");

    if (!planning) {
        console.error("❌ Aucun planning fourni.");
        return null;
    }

    // -------------------------------------------------
    // Récupérer toutes les cellules de référence
    // -------------------------------------------------

    const premiereFiliere = planning.filieres[0];

    if (!premiereFiliere || premiereFiliere.cellules.length === 0) {
        console.error("❌ Aucune cellule disponible.");
        return null;
    }

    const cellules = premiereFiliere.cellules;

    // -------------------------------------------------
    // Regrouper les cellules par date
    // -------------------------------------------------

    const dates = [];

    cellules.forEach(function (cellule) {

        const dateExiste = dates.some(function (date) {
            return date === cellule.date;
        });

        if (!dateExiste) {
            dates.push(cellule.date);
        }
    });

    // -------------------------------------------------
    // Créer le tableau
    // -------------------------------------------------

    const tableau = document.createElement("table");

    tableau.className = "tableau-calendrier";

    // -------------------------------------------------
    // THEAD
    // -------------------------------------------------

    const thead = document.createElement("thead");

    // Première ligne : dates
    const ligneDates = document.createElement("tr");

    const thFiliere = document.createElement("th");

    thFiliere.textContent = "FILIÈRE";
    thFiliere.rowSpan = 2;

    ligneDates.appendChild(thFiliere);

    const thAmphis = document.createElement("th");

    thAmphis.textContent = "AMPHIS";
    thAmphis.rowSpan = 2;

    ligneDates.appendChild(thAmphis);

    dates.forEach(function (date) {

        const cellulesDate = cellules.filter(function (cellule) {
            return cellule.date === date;
        });

        const thDate = document.createElement("th");

        thDate.textContent =
           formaterDateLongue(cellulesDate[0].date);
        
        thDate.colSpan =
            cellulesDate.length;

        ligneDates.appendChild(thDate);
    });

    thead.appendChild(ligneDates);

    // -------------------------------------------------
    // Deuxième ligne : créneaux
    // -------------------------------------------------

    const ligneCreneaux = document.createElement("tr");

    cellules.forEach(function (cellule) {

        const thCreneau =
            document.createElement("th");

        thCreneau.textContent =
            cellule.heureDebutAffichage +
            " - " +
            cellule.heureFinAffichage;

        ligneCreneaux.appendChild(thCreneau);
    });

    thead.appendChild(ligneCreneaux);

    tableau.appendChild(thead);

    // -------------------------------------------------
    // TBODY
    // -------------------------------------------------

    const tbody = document.createElement("tbody");

    planning.filieres.forEach(function (filiere) {

        const ligne = document.createElement("tr");

        // Filière
        const celluleFiliere =
            document.createElement("td");

        celluleFiliere.textContent =
            filiere.filiereCode;

        ligne.appendChild(celluleFiliere);

        // Amphis
        const celluleAmphis =
            document.createElement("td");

        celluleAmphis.textContent = "";

        ligne.appendChild(celluleAmphis);

        // Matières
        filiere.cellules.forEach(function (cellule) {

            const td = document.createElement("td");

            if (cellule.estOccupee) {

                td.textContent =
                    cellule.matiereLibelle;

            } else {

                td.textContent = "—";
            }

            ligne.appendChild(td);
        });

        tbody.appendChild(ligne);
    });

    tableau.appendChild(tbody);

    console.log("✓ Tableau du calendrier construit.");

    console.log(
        "Nombre de dates :",
        dates.length
    );

    console.log(
        "Nombre de filières :",
        planning.filieres.length
    );

    return tableau;
}
// =====================================================
// FILTRES DU CALENDRIER ADMIN
// =====================================================

function initialiserFiltresCalendrierAdmin() {

    const selectNiveau =
        document.getElementById("niveauCalendrierAdmin");

    const selectSemestre =
        document.getElementById("semestreCalendrierAdmin");

    const selectRegime =
        document.getElementById("regimeCalendrierAdmin");

    const selectSession =
        document.getElementById("sessionCalendrierAdmin");

    const bouton =
        document.getElementById("btnAfficherCalendrierAdmin");


    if (
        !selectNiveau ||
        !selectSemestre ||
        !selectRegime ||
        !selectSession ||
        !bouton
    ) {
        console.error(
            "❌ Éléments des filtres du calendrier introuvables."
        );
        return;
    }


    // =================================================
    // METTRE À JOUR LES SESSIONS
    // =================================================

    function mettreAJourSessions() {

        const semestre =
            selectSemestre.value;

        const regime =
            selectRegime.value;


        selectSession.innerHTML = "";


        if (
    !donneesExamens ||
    !Array.isArray(donneesExamens.sessions)
        ) {
    console.error(
        "❌ Données des sessions indisponibles."
          );
    return;
          }


       const sessionsDisponibles =
         donneesExamens.sessions.filter(
                function (session) {

                    return (
                        session.semestreCode === semestre &&
                        session.regimeCode === regime
                    );

                }
            );


        sessionsDisponibles.forEach(
            function (session) {

                const option =
                    document.createElement("option");

                option.value =
                    session.sessionCode;

                option.textContent =
                    session.sessionLibelle;

                selectSession.appendChild(option);

            }
        );


        if (sessionsDisponibles.length === 0) {

            const option =
                document.createElement("option");

            option.value = "";

            option.textContent =
                "Aucune session disponible";

            selectSession.appendChild(option);

        }

    }


    // =================================================
    // CHANGEMENT SEMESTRE
    // =================================================

    selectSemestre.addEventListener(
        "change",
        function () {

            mettreAJourSessions();

        }
    );


    // =================================================
    // CHANGEMENT RÉGIME
    // =================================================

    selectRegime.addEventListener(
        "change",
        function () {

            mettreAJourSessions();

        }
    );


    // =================================================
    // AFFICHER LE CALENDRIER
    // =================================================

    bouton.addEventListener(
        "click",
        function () {

            const niveau =
                selectNiveau.value;

            const sessionCode =
                selectSession.value;


            if (!niveau || !sessionCode) {

                console.error(
                    "❌ Niveau ou session invalide."
                );

                return;
            }


            console.log("------------------------------------------");
            console.log("AFFICHAGE CALENDRIER ADMIN");
            console.log("------------------------------------------");

            console.log("Niveau :", niveau);
            console.log(
                "Semestre :",
                selectSemestre.value
            );
            console.log(
                "Régime :",
                selectRegime.value
            );
            console.log(
                "Session :",
                sessionCode
            );


            // =========================================
            // CONSTRUCTION DU PLANNING
            // =========================================

            let planning =
                generationExamens.construireMatricePlanning(
                    niveau,
                    sessionCode
                );


            if (!planning) {

                console.error(
                    "❌ Impossible de construire le planning."
                );

                return;
            }


            // =========================================
            // PLACEMENT DES MATIÈRES COMMUNES
            // =========================================

            generationExamens.placerMatieresCommunes(
                planning
            );


            // =========================================
            // PLACEMENT DES MATIÈRES SPÉCIFIQUES
            // =========================================

            generationExamens.placerMatieresSpecifiques(
                planning
            );


            // =========================================
            // AFFICHAGE
            // =========================================

            afficherPlanning(planning);


            console.log(
                "✓ Calendrier affiché."
            );

        }
    );


    // =================================================
    // INITIALISATION
    // =================================================

    mettreAJourSessions();

}


// =====================================================
// ATTENDRE LE CHARGEMENT DES DONNÉES
// =====================================================

donneesChargees.then(function () {

    console.log(
        "✓ Données chargées — initialisation des filtres calendrier."
    );

    initialiserFiltresCalendrierAdmin();

});
