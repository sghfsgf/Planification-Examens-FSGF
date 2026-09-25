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
