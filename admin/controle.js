// =====================================================
// CONTRÔLE DU PLANNING DES EXAMENS
// =====================================================


// =====================================================
// 1. Vérifier que toutes les matières prévues sont placées
// =====================================================

function verifierMatieresPlacees(planning) {

    console.log("------------------------------------------");
    console.log("CONTRÔLE DES MATIÈRES PLACÉES");
    console.log("------------------------------------------");

    if (!planning) {

        console.error("❌ Planning introuvable.");

        return {
            valide: false,
            totalPrevu: 0,
            totalPlace: 0,
            matieresManquantes: []
        };
    }

    // -------------------------------------------------
    // Construire la liste des matières prévues
    // -------------------------------------------------

    const matieresPrevues = [];

    // Matières communes
    (planning.matieresCommunes || []).forEach(function (matiere) {

        matiere.filieres.forEach(function (filiereCode) {

            matieresPrevues.push({
                filiereCode: filiereCode,
                matiereLibelle: matiere.matiereLibelle
            });

        });

    });

    // Matières spécifiques
    (planning.matieresSpecifiques || []).forEach(function (matiere) {

        matieresPrevues.push({
            filiereCode: matiere.filiereCode,
            matiereLibelle: matiere.matiereLibelle
        });

    });

    // -------------------------------------------------
    // Construire la liste des matières effectivement placées
    // -------------------------------------------------

    const matieresPlacees = [];

    planning.filieres.forEach(function (filiere) {

        filiere.cellules.forEach(function (cellule) {

            if (!cellule.estOccupee) {
                return;
            }

            if (!cellule.matiereLibelle) {
                return;
            }

            matieresPlacees.push({
                filiereCode: filiere.filiereCode,
                matiereLibelle: cellule.matiereLibelle
            });

        });

    });

    // -------------------------------------------------
    // Rechercher les matières manquantes
    // -------------------------------------------------

    const matieresManquantes = [];

    matieresPrevues.forEach(function (matierePrevue) {

        const trouvee = matieresPlacees.some(function (matierePlacee) {

            return (
                matierePlacee.filiereCode === matierePrevue.filiereCode &&
                matierePlacee.matiereLibelle === matierePrevue.matiereLibelle
            );

        });

        if (!trouvee) {

            matieresManquantes.push(matierePrevue);

        }

    });

    // -------------------------------------------------
    // Résultat
    // -------------------------------------------------

    const resultat = {
        valide: matieresManquantes.length === 0,
        totalPrevu: matieresPrevues.length,
        totalPlace: matieresPlacees.length,
        matieresManquantes: matieresManquantes
    };

    console.log("Matières prévues :", resultat.totalPrevu);
    console.log("Matières placées :", resultat.totalPlace);
    console.log("Matières manquantes :", resultat.matieresManquantes.length);

    if (resultat.valide) {

        console.log("✓ Toutes les matières sont placées.");

    } else {

        console.warn(
            "⚠️ Matières manquantes :",
            resultat.matieresManquantes
        );

    }

    return resultat;
}
