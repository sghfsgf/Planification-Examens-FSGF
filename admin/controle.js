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

    // -------------------------------------------------
    // Parcourir les matières communes prévues
    // -------------------------------------------------

    (planning.matieresCommunes || []).forEach(function (matiereCommune) {

        const matiereLibelle =
            matiereCommune.matiereLibelle;

        const filieres =
            matiereCommune.filieres || [];

        const placements = [];

        // -------------------------------------------------
        // Chercher le placement de cette matière
        // dans chaque filière concernée
        // -------------------------------------------------

        filieres.forEach(function (filiereCode) {

            const filiere =
                planning.filieres.find(function (f) {

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

            const cellule =
                filiere.cellules.find(function (cellule) {

                    return (
                        cellule.estOccupee === true &&
                        cellule.matiereLibelle === matiereLibelle
                    );

                });

            if (!cellule) {

                erreurs.push({
                    matiereLibelle: matiereLibelle,
                    filiereCode: filiereCode,
                    erreur: "Matière commune non placée"
                });

                return;
            }

            placements.push({

                filiereCode: filiereCode,

                date: cellule.date,

                dateAffichage:
                    cellule.dateAffichage,

                creneauOrdre:
                    cellule.creneauOrdre

            });

        });

        // -------------------------------------------------
        // Vérifier que toutes les filières ont été trouvées
        // -------------------------------------------------

        if (placements.length !== filieres.length) {

            return;

        }

        // -------------------------------------------------
        // Vérifier que tous les placements sont identiques
        // -------------------------------------------------

        const premierPlacement =
            placements[0];

        placements.forEach(function (placement) {

            if (
                placement.date !== premierPlacement.date ||
                placement.creneauOrdre !==
                    premierPlacement.creneauOrdre
            ) {

                erreurs.push({

                    matiereLibelle:
                        matiereLibelle,

                    filiereCode:
                        placement.filiereCode,

                    erreur:
                        "La matière commune n'est pas placée au même date/créneau",

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

    // -------------------------------------------------
    // Résultat
    // -------------------------------------------------

    const resultat = {

        valide: erreurs.length === 0,

        erreurs: erreurs

    };

    console.log(
        "Erreurs détectées :",
        erreurs.length
    );

    if (resultat.valide) {

        console.log(
            "✓ Toutes les matières communes sont placées au même date/créneau."
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

    planning.filieres.forEach(function (filiere) {

        // -------------------------------------------------
        // Regrouper les cellules par date
        // -------------------------------------------------

        const cellulesParDate = {};

        filiere.cellules.forEach(function (cellule) {

            if (!cellule.estOccupee) {
                return;
            }

            if (!cellule.matiereLibelle) {
                return;
            }

            const date = cellule.date;

            if (!cellulesParDate[date]) {
                cellulesParDate[date] = [];
            }

            cellulesParDate[date].push(cellule);

        });

        // -------------------------------------------------
        // Vérifier les créneaux successifs
        // -------------------------------------------------

        Object.keys(cellulesParDate).forEach(function (date) {

            const cellules =
                cellulesParDate[date];

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

                        filiereCode:
                            filiere.filiereCode,

                        date:
                            cellule.dateAffichage,

                        matiere1:
                            cellule.matiereLibelle,

                        creneau1:
                            cellule.creneauOrdre,

                        matiere2:
                            creneauSuivant.matiereLibelle,

                        creneau2:
                            creneauSuivant.creneauOrdre,

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

        valide:
            erreurs.length === 0,

        erreurs:
            erreurs

    };

    console.log(
        "Erreurs détectées :",
        erreurs.length
    );

    if (resultat.valide) {

        console.log(
            "✓ Aucune filière n'a deux examens dans des créneaux successifs le même jour."
        );

    } else {

        console.warn(
            "⚠️ Créneaux successifs détectés :",
            erreurs
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
            ecart: 0
        };
    }

    const charges =
    generationExamens.calculerChargeDesCreneaux(planning);

    const valeurs =
        Object.values(charges).map(function (charge) {
            return Number(charge);
        });

    if (valeurs.length === 0) {

        console.warn(
            "⚠️ Aucun créneau trouvé."
        );

        return {
            valide: false,
            charges: charges,
            minimum: 0,
            maximum: 0,
            ecart: 0
        };
    }

    const minimum =
        Math.min(...valeurs);

    const maximum =
        Math.max(...valeurs);

    const ecart =
        maximum - minimum;

    const seuil = 2;

    const resultat = {

        valide: ecart <= seuil,

        charges: charges,

        minimum: minimum,

        maximum: maximum,

        ecart: ecart,

        seuil: seuil
    };

    console.log(
        "Charge minimale :",
        minimum
    );

    console.log(
        "Charge maximale :",
        maximum
    );

    console.log(
        "Écart MAX - MIN :",
        ecart
    );

    console.log(
        "Seuil autorisé :",
        seuil
    );

    if (resultat.valide) {

        console.log(
            "✓ L'équilibrage des créneaux respecte la règle MAX - MIN ≤ 2."
        );

    } else {

        console.warn(
            "⚠️ L'équilibrage des créneaux ne respecte pas la règle MAX - MIN ≤ 2."
        );
    }

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
            valide: false
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
    // Résultat global
    // -------------------------------------------------

    const valide =
        controleMatieres.valide &&
        controleDoublons.valide &&
        controleCommunes.valide &&
        controleSuccessifs.valide &&
        controleEquilibrage.valide;

    const resultat = {

        valide: valide,

        matieresPlacees:
            controleMatieres.valide,

        doublons:
            controleDoublons.valide,

        matieresCommunes:
            controleCommunes.valide,

        creneauxSuccessifs:
            controleSuccessifs.valide,

        equilibrage:
            controleEquilibrage.valide
    };

    console.log("");
    console.log("------------------------------------------");
    console.log("RÉSULTAT DU CONTRÔLE GLOBAL");
    console.log("------------------------------------------");

    console.log(
        "Matières placées :",
        resultat.matieresPlacees ? "✅" : "❌"
    );

    console.log(
        "Doublons :",
        resultat.doublons ? "✅" : "❌"
    );

    console.log(
        "Matières communes :",
        resultat.matieresCommunes ? "✅" : "❌"
    );

    console.log(
        "Créneaux successifs :",
        resultat.creneauxSuccessifs ? "✅" : "❌"
    );

    console.log(
        "Équilibrage :",
        resultat.equilibrage ? "✅" : "❌"
    );

    console.log("------------------------------------------");

    if (resultat.valide) {

        console.log(
            "✅ PLANNING VALIDE"
        );

    } else {

        console.warn(
            "⚠️ PLANNING NON VALIDE"
        );
    }

    console.log("------------------------------------------");

    return resultat;
}
