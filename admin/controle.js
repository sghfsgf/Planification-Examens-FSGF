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
            matieresManquantes: [],
            matieresNonPrevues: []
        };
    }

    // -------------------------------------------------
    // 1. Construire la liste des matières prévues
    // -------------------------------------------------

    const matieresPrevues = [];

    // Matières communes
    (planning.matieresCommunes || []).forEach(function (matiere) {

        (matiere.filieres || []).forEach(function (filiereCode) {

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
    // 2. Construire la liste des matières placées
    // -------------------------------------------------

    const matieresPlacees = [];

    (planning.filieres || []).forEach(function (filiere) {

        (filiere.cellules || []).forEach(function (cellule) {

            if (
                cellule.estOccupee !== true ||
                !cellule.matiereLibelle
            ) {
                return;
            }

            matieresPlacees.push({
                filiereCode: filiere.filiereCode,
                matiereLibelle: cellule.matiereLibelle
            });

        });

    });

    // -------------------------------------------------
    // 3. Rechercher les matières manquantes
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
    // 4. Rechercher les matières non prévues
    // -------------------------------------------------

    const matieresNonPrevues = [];

    matieresPlacees.forEach(function (matierePlacee) {

        const trouvee = matieresPrevues.some(function (matierePrevue) {

            return (
                matierePrevue.filiereCode === matierePlacee.filiereCode &&
                matierePrevue.matiereLibelle === matierePlacee.matiereLibelle
            );

        });

        if (!trouvee) {
            matieresNonPrevues.push(matierePlacee);
        }

    });

    // -------------------------------------------------
    // 5. Résultat
    // -------------------------------------------------

    const resultat = {

        valide:
            matieresManquantes.length === 0 &&
            matieresNonPrevues.length === 0,

        totalPrevu: matieresPrevues.length,

        totalPlace: matieresPlacees.length,

        matieresManquantes: matieresManquantes,

        matieresNonPrevues: matieresNonPrevues

    };

    console.log("Matières prévues :", resultat.totalPrevu);
    console.log("Matières placées :", resultat.totalPlace);
    console.log("Matières manquantes :", matieresManquantes.length);
    console.log("Matières non prévues :", matieresNonPrevues.length);

    if (resultat.valide) {

        console.log("✓ Correspondance entre matières prévues et placées.");

    } else {

        console.warn("⚠️ Matières manquantes :", matieresManquantes);
        console.warn("⚠️ Matières non prévues :", matieresNonPrevues);

    }

    return resultat;
}

// =====================================================
// 2. Vérifier les doublons de matières par filière
// =====================================================

function verifierDoublonsMatieres(planning) {

    console.log("------------------------------------------");
    console.log("CONTRÔLE DES DOUBLONS DE MATIÈRES");
    console.log("------------------------------------------");

    if (!planning) {

        console.error("❌ Planning introuvable.");

        return {
            valide: false,
            doublons: []
        };
    }

    const occurrences = {};
    const doublons = [];

    // -------------------------------------------------
    // Parcourir toutes les filières et toutes les cellules
    // -------------------------------------------------

    planning.filieres.forEach(function (filiere) {

        filiere.cellules.forEach(function (cellule) {

            if (!cellule.estOccupee) {
                return;
            }

            if (!cellule.matiereLibelle) {
                return;
            }

            const cle =
                filiere.filiereCode +
                "|" +
                cellule.matiereLibelle;

            if (!occurrences[cle]) {

                occurrences[cle] = {
                    filiereCode: filiere.filiereCode,
                    matiereLibelle: cellule.matiereLibelle,
                    nombre: 0
                };
            }

            occurrences[cle].nombre++;

        });

    });

    // -------------------------------------------------
    // Rechercher les matières présentes plusieurs fois
    // dans une même filière
    // -------------------------------------------------

    Object.keys(occurrences).forEach(function (cle) {

        const occurrence = occurrences[cle];

        if (occurrence.nombre > 1) {

            doublons.push(occurrence);

        }

    });

    // -------------------------------------------------
    // Résultat
    // -------------------------------------------------

    const resultat = {

        valide: doublons.length === 0,

        doublons: doublons

    };

    console.log(
        "Doublons détectés :",
        doublons.length
    );

    if (resultat.valide) {

        console.log(
            "✓ Aucun doublon de matière dans une même filière."
        );

    } else {

        console.warn(
            "⚠️ Doublons détectés :",
            doublons
        );

    }

    return resultat;
}
// =====================================================
// 3. Vérifier le placement des matières communes
// =====================================================

// =====================================================
// CONVERSION DES DATES POUR LE CONTRÔLE
// =====================================================


function convertirDateControle(date) {

    let dateConvertie;

    // Timestamp Firestore
    if (
        date &&
        typeof date.toDate === "function"
    ) {
        dateConvertie = date.toDate();
    }

    // Date JavaScript
    else if (date instanceof Date) {
        dateConvertie = date;
    }

    // Chaîne ou autre format accepté par JavaScript
    else {
        dateConvertie = new Date(date);
    }

    // Vérifier la validité
    if (
        !(dateConvertie instanceof Date) ||
        Number.isNaN(dateConvertie.getTime())
    ) {
        return null;
    }

    // Retourner uniquement le jour civil
    return (
        dateConvertie.getFullYear() + "-" +
        String(dateConvertie.getMonth() + 1).padStart(2, "0") + "-" +
        String(dateConvertie.getDate()).padStart(2, "0")
    );
}



function verifierMatieresCommunes(planning) {

    console.log("------------------------------------------");
    console.log("CONTRÔLE DES MATIÈRES COMMUNES");
    console.log("------------------------------------------");

    if (!planning) {

        console.error("❌ Planning introuvable.");

        return {
            valide: false,
            erreurs: []
        };
    }

    const erreurs = [];

    (planning.matieresCommunes || []).forEach(function (matiereCommune) {

        const matiereLibelle =
            matiereCommune.matiereLibelle;

        const filieres =
            matiereCommune.filieres || [];

        const placements = [];

        // Vérifier chaque filière concernée
        filieres.forEach(function (filiereCode) {

            const filiere =
                (planning.filieres || []).find(function (f) {

                    return f.filiereCode === filiereCode;

                });

            if (!filiere) {

                erreurs.push({
                    matiereLibelle: matiereLibelle,
                    filiereCode: filiereCode,
                    erreur: "Filière introuvable dans le planning"
                });

                return;
            }

            const cellules =
                (filiere.cellules || []).filter(function (cellule) {

                    return (
                        cellule.estOccupee === true &&
                        cellule.matiereLibelle === matiereLibelle
                    );

                });

            if (cellules.length === 0) {

                erreurs.push({
                    matiereLibelle: matiereLibelle,
                    filiereCode: filiereCode,
                    erreur: "Matière commune non placée"
                });

                return;
            }

            if (cellules.length > 1) {

                erreurs.push({
                    matiereLibelle: matiereLibelle,
                    filiereCode: filiereCode,
                    erreur: "Matière commune présente plusieurs fois"
                });

                return;
            }

            const cellule = cellules[0];

            const dateNormalisee =
                convertirDateControle(cellule.date);

            const creneau =
                Number(cellule.creneauOrdre);

            if (
                dateNormalisee === null ||
                !Number.isInteger(creneau)
            ) {

                erreurs.push({
                    matiereLibelle: matiereLibelle,
                    filiereCode: filiereCode,
                    erreur: "Date ou créneau invalide"
                });

                return;
            }

            placements.push({

                filiereCode: filiereCode,

                date: dateNormalisee,

                creneauOrdre: creneau,

                dateAffichage: cellule.dateAffichage

            });

        });

        // Ne comparer que si tous les placements sont disponibles
        if (placements.length !== filieres.length) {
            return;
        }

        const premierPlacement = placements[0];

        placements.forEach(function (placement) {

            if (
                placement.date !== premierPlacement.date ||
                placement.creneauOrdre !== premierPlacement.creneauOrdre
            ) {

                erreurs.push({

                    matiereLibelle: matiereLibelle,

                    filiereCode: placement.filiereCode,

                    erreur:
                        "La matière commune n'est pas placée au même jour/créneau",

                    dateAttendue:
                        premierPlacement.dateAffichage,

                    creneauAttendu:
                        premierPlacement.creneauOrdre,

                    dateTrouvee:
                        placement.dateAffichage,

                    creneauTrouve:
                        placement.creneauOrdre

                });

            }

        });

    });

    const resultat = {

        valide: erreurs.length === 0,

        erreurs: erreurs

    };

    console.log("Erreurs détectées :", erreurs.length);

    if (resultat.valide) {

        console.log(
            "✓ Toutes les matières communes sont placées au même jour/créneau."
        );

    } else {

        console.warn(
            "⚠️ Problèmes détectés dans les matières communes :",
            erreurs
        );

    }

    return resultat;
}


// =====================================================
// 4. Vérifier les créneaux successifs pour une filière
// =====================================================


function verifierCreneauxSuccessifs(planning) {

    console.log("------------------------------------------");
    console.log("CONTRÔLE DES CRÉNEAUX SUCCESSIFS");
    console.log("------------------------------------------");

    if (!planning) {

        console.error("❌ Planning introuvable.");

        return {
            valide: false,
            erreurs: []
        };
    }

    const erreurs = [];

    // -------------------------------------------------
    // Parcourir toutes les filières
    // -------------------------------------------------

    (planning.filieres || []).forEach(function (filiere) {

        const cellulesParDate = {};

        // -------------------------------------------------
        // Regrouper les examens par jour civil
        // -------------------------------------------------

        (filiere.cellules || []).forEach(function (cellule) {

            if (
                cellule.estOccupee !== true ||
                !cellule.matiereLibelle
            ) {
                return;
            }

            const date =
                convertirDateControle(cellule.date);

            const creneau =
                Number(cellule.creneauOrdre);

            if (
                date === null ||
                !Number.isInteger(creneau)
            ) {

                erreurs.push({

                    filiereCode: filiere.filiereCode,

                    matiereLibelle: cellule.matiereLibelle,

                    erreur: "Date ou créneau invalide"

                });

                return;
            }

            if (!cellulesParDate[date]) {
                cellulesParDate[date] = [];
            }

            cellulesParDate[date].push({

                matiereLibelle: cellule.matiereLibelle,

                creneauOrdre: creneau,

                dateAffichage: cellule.dateAffichage

            });

        });

        // -------------------------------------------------
        // Vérifier les créneaux successifs
        // -------------------------------------------------

        Object.keys(cellulesParDate).forEach(function (date) {

            const cellules = cellulesParDate[date];

            cellules.forEach(function (cellule) {

                const creneauSuivant =
                    cellules.find(function (autre) {

                        return (
                            autre.creneauOrdre ===
                            cellule.creneauOrdre + 1
                        );

                    });

                if (creneauSuivant) {

                    erreurs.push({

                        filiereCode: filiere.filiereCode,

                        date: cellule.dateAffichage,

                        matiere1: cellule.matiereLibelle,

                        creneau1: cellule.creneauOrdre,

                        matiere2: creneauSuivant.matiereLibelle,

                        creneau2: creneauSuivant.creneauOrdre,

                        erreur:
                            "Deux examens sont placés dans des créneaux successifs le même jour."

                    });

                }

            });

        });

    });

    // -------------------------------------------------
    // Résultat
    // -------------------------------------------------

    const resultat = {

        valide: erreurs.length === 0,

        erreurs: erreurs

    };

    console.log("Erreurs détectées :", erreurs.length);

    if (resultat.valide) {

        console.log(
            "✓ Aucune filière n'a deux examens dans des créneaux successifs le même jour."
        );

    } else {

        console.warn(
            "⚠️ Créneaux successifs détectés :", erreurs
        );

    }

    return resultat;
}

// =====================================================
// 5. Vérifier l'équilibrage des charges des créneaux
// =====================================================


function verifierEquilibrageCreneaux(planning) {

    console.log("------------------------------------------");
    console.log("CONTRÔLE DE L'ÉQUILIBRAGE DES CRÉNEAUX");
    console.log("------------------------------------------");

    if (!planning) {

        console.error("❌ Planning introuvable.");

        return {
            valide: false,
            charges: {},
            minimum: 0,
            maximum: 0,
            ecart: 0,
            equilibre: "Indéterminé"
        };
    }

    const charges =
        generationExamens.calculerChargeDesCreneaux(planning);

    const valeurs =
        Object.values(charges).map(function (charge) {
            return Number(charge);
        });

    if (
        valeurs.length === 0 ||
        valeurs.some(function (charge) {
            return !Number.isFinite(charge);
        })
    ) {

        console.warn("⚠️ Charges inexistantes ou invalides.");

        return {
            valide: false,
            charges: charges,
            minimum: 0,
            maximum: 0,
            ecart: 0,
            equilibre: "Indéterminé"
        };
    }

    const minimum = Math.min(...valeurs);

    const maximum = Math.max(...valeurs);

    const ecart = maximum - minimum;

    let equilibre;

    if (ecart <= 1) {
        equilibre = "Excellent";
    } else if (ecart <= 2) {
        equilibre = "Acceptable";
    } else {
        equilibre = "Dégradé";
    }

    const resultat = {

        valide: true,

        charges: charges,

        minimum: minimum,

        maximum: maximum,

        ecart: ecart,

        seuilIdeal: 1,

        seuilAcceptable: 2,

        equilibre: equilibre

    };

    console.log("Charge minimale :", minimum);
    console.log("Charge maximale :", maximum);
    console.log("Écart MAX - MIN :", ecart);
    console.log("Équilibrage :", equilibre);

    return resultat;
}

// =====================================================
// 6. Contrôle global du planning
// =====================================================


function verifierPlanningGlobal(planning) {

    console.log("");
    console.log("==========================================");
    console.log("CONTRÔLE GLOBAL DU PLANNING");
    console.log("==========================================");

    if (!planning) {

        console.error("❌ Planning introuvable.");

        return {
            valide: false,
            anomaliesBloquantes: [],
            avertissements: []
        };
    }

    // -------------------------------------------------
    // 1. Matières placées
    // -------------------------------------------------

    const controleMatieres =
        verifierMatieresPlacees(planning);

    // -------------------------------------------------
    // 2. Doublons
    // -------------------------------------------------

    const controleDoublons =
        verifierDoublonsMatieres(planning);

    // -------------------------------------------------
    // 3. Matières communes
    // -------------------------------------------------

    const controleCommunes =
        verifierMatieresCommunes(planning);

    // -------------------------------------------------
    // 4. Créneaux successifs
    // -------------------------------------------------

    const controleSuccessifs =
        verifierCreneauxSuccessifs(planning);

    // -------------------------------------------------
    // 5. Équilibrage
    // -------------------------------------------------

    const controleEquilibrage =
        verifierEquilibrageCreneaux(planning);

    // -------------------------------------------------
    // 6. Anomalies bloquantes
    // -------------------------------------------------

    const anomaliesBloquantes = [];

    if (!controleDoublons.valide) {
        anomaliesBloquantes.push("Doublons de matières");
    }

    if (!controleCommunes.valide) {
        anomaliesBloquantes.push("Matières communes");
    }

    if (!controleSuccessifs.valide) {
        anomaliesBloquantes.push("Créneaux successifs");
    }

    // -------------------------------------------------
    // 7. Avertissements
    // -------------------------------------------------

    const avertissements = [];

    if (!controleMatieres.valide) {
        avertissements.push("Matières non placées");
    }

    if (!controleEquilibrage.valide) {
        avertissements.push("Équilibrage des créneaux");
    }

    // -------------------------------------------------
    // 8. Résultat global
    // -------------------------------------------------

    const resultat = {

        valide: anomaliesBloquantes.length === 0,

        anomaliesBloquantes: anomaliesBloquantes,

        avertissements: avertissements,

        matieresPlacees: controleMatieres,

        doublons: controleDoublons,

        matieresCommunes: controleCommunes,

        creneauxSuccessifs: controleSuccessifs,

        equilibrage: controleEquilibrage

    };

    console.log("");
    console.log("------------------------------------------");
    console.log("RÉSULTAT DU CONTRÔLE GLOBAL");
    console.log("------------------------------------------");

    console.log(
        "Anomalies bloquantes :",
        anomaliesBloquantes
    );

    console.log(
        "Avertissements :",
        avertissements
    );

    console.log(
        resultat.valide
            ? "✅ PLANNING AUTORISÉ"
            : "❌ PLANNING BLOQUÉ"
    );

    console.log("Détail complet :", resultat);

    console.log("------------------------------------------");

    return resultat;
}



// =====================================================
// API PUBLIQUE DU CONTRÔLE
// =====================================================

window.controleExamens = {

    verifierPlanningGlobal:
        verifierPlanningGlobal

};
