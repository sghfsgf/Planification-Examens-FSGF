// =====================================================
// CALENDRIERS.JS
// Construction et affichage des calendriers
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    const tableau =
        document.getElementById("tableauCalendrier");

    const niveauCalendrier =
        document.getElementById("niveauCalendrier");


    // =================================================
    // CONSTRUIRE LE CALENDRIER
    // =================================================

    function construireCalendrier() {

        console.log("====================================");
        console.log("CONSTRUCTION DU CALENDRIER");
        console.log("====================================");


        // -------------------------------------------------
        // Vérification des éléments HTML
        // -------------------------------------------------

        if (!tableau) {
            console.error(
                "Calendrier : tableauCalendrier introuvable."
            );
            return;
        }


        if (!niveauCalendrier) {
            console.error(
                "Calendrier : niveauCalendrier introuvable."
            );
            return;
        }


        // -------------------------------------------------
        // Vérification des données
        // -------------------------------------------------

       // -------------------------------------------------
// Récupération des données chargées par data.js
// -------------------------------------------------

if (
    typeof donneesExamens === "undefined" ||
    !donneesExamens
) {

    console.error(
        "Calendrier : donneesExamens introuvable."
    );

    return;
}


const matieres =
    donneesExamens.matieres || [];

const sessions =
    donneesExamens.sessions || [];

const creneaux =
    donneesExamens.creneaux || [];

const sallesAmphis =
    donneesExamens.sallesAmphis || [];


console.log("Matières :", matieres);
console.log("Sessions :", sessions);
console.log("Créneaux :", creneaux);
console.log("Salles / amphis :", sallesAmphis);


        console.log("Matières :", matieres);
        console.log("Sessions :", sessions);
        console.log("Créneaux :", creneaux);
        console.log("Salles / Amphis :", sallesAmphis);


        // -------------------------------------------------
        // Nettoyage du tableau
        // -------------------------------------------------

        const thead =
            tableau.querySelector("thead");

        const tbody =
            tableau.querySelector("tbody");


        thead.innerHTML = "";
        tbody.innerHTML = "";


        // -------------------------------------------------
        // Niveau actuellement affiché
        // -------------------------------------------------

        const niveau =
            niveauCalendrier.textContent.trim();


        console.log(
            "Niveau du calendrier :",
            niveau
        );


        // -------------------------------------------------
        // Vérification des créneaux
        // -------------------------------------------------

        if (!creneaux || creneaux.length === 0) {

            console.warn(
                "Calendrier : aucun créneau disponible."
            );

            return;
        }


        // -------------------------------------------------
        // EN-TÊTE DU CALENDRIER
        // -------------------------------------------------

        const ligneEntete =
            document.createElement("tr");


        // Colonne FILIÈRE

        const thFiliere =
            document.createElement("th");

        thFiliere.textContent =
            "FILIÈRE";

        ligneEntete.appendChild(thFiliere);


        // Colonne AMPHIS

        const thAmphis =
            document.createElement("th");

        thAmphis.textContent =
            "AMPHIS";

        ligneEntete.appendChild(thAmphis);


        // -------------------------------------------------
        // Pour le moment :
        // affichage des créneaux disponibles
        // -------------------------------------------------

        creneaux.forEach(function (creneau) {

            const th =
                document.createElement("th");


            const heureDebut =
                creneau.heureDebutAffichage ||
                convertirHeureExcel(
                    creneau.heureDebut
                );


            const heureFin =
                creneau.heureFinAffichage ||
                convertirHeureExcel(
                    creneau.heureFin
                );


            th.innerHTML =
                "Créneau " +
                creneau.creneauOrdre +
                "<br>" +
                heureDebut +
                " – " +
                heureFin;


            ligneEntete.appendChild(th);

        });


        thead.appendChild(ligneEntete);


        // -------------------------------------------------
        // FILIÈRES DU NIVEAU
        // -------------------------------------------------

        const filieres =
            [
                ...new Set(
                    matieres
                        .filter(function (matiere) {

                            return (
                                matiere.niveauCode === niveau
                            );

                        })
                        .map(function (matiere) {

                            return matiere.filiereCode;

                        })
                        .filter(Boolean)
                )
            ];


        console.log(
            "Filières du niveau",
            niveau,
            ":",
            filieres
        );


        // -------------------------------------------------
        // LIGNES DU CALENDRIER
        // -------------------------------------------------

        filieres.forEach(function (filiere) {

            const ligne =
                document.createElement("tr");


            // Filière

            const celluleFiliere =
                document.createElement("td");

            celluleFiliere.textContent =
                filiere;

            ligne.appendChild(celluleFiliere);


            // Amphis

            const celluleAmphis =
                document.createElement("td");

            celluleAmphis.textContent =
                "";

            ligne.appendChild(celluleAmphis);


            // Cellules des créneaux

            creneaux.forEach(function () {

                const cellule =
                    document.createElement("td");

                cellule.textContent =
                    "";

                ligne.appendChild(cellule);

            });


            tbody.appendChild(ligne);

        });


        console.log(
            "✓ Calendrier construit."
        );

    }


    // =====================================================
    // ATTENDRE LE CHARGEMENT DES DONNÉES
    // =====================================================

    if (
        typeof donneesChargees !== "undefined" &&
        donneesChargees
    ) {

        donneesChargees.then(function () {

            console.log(
                "Calendriers : données reçues."
            );

            construireCalendrier();

        });

    } else {

        console.warn(
            "Calendriers : donneesChargees introuvable."
        );

    }


    // =====================================================
    // EXPOSITION POUR LES AUTRES FICHIERS
    // =====================================================

    window.construireCalendrier =
        construireCalendrier;

});
