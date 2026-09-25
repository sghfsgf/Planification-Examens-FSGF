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

    console.log(
        "Niveau :",
        planning.niveauCode
    );

    console.log(
        "Session :",
        planning.sessionCode
    );

    console.log(
        "Filières :",
        planning.filieres.map(function (filiere) {
            return filiere.filiereCode;
        })
    );

    planning.filieres.forEach(function (filiere) {

        console.log(
            "Filière :",
            filiere.filiereCode
        );

        filiere.cellules.forEach(function (cellule) {

            if (!cellule.estOccupee) {
                return;
            }

            console.log(
                cellule.dateAffichage,
                "|",
                cellule.heureDebutAffichage,
                "-",
                cellule.heureFinAffichage,
                "|",
                cellule.matiereLibelle
            );
        });
    });
}
