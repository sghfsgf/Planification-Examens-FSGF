// =================================================
// AFFECTATION DES SALLES / AMPHIS
// =================================================

import { app } from "../firebase-config.js";

import {
   getFirestore,
    getDocs,
    collection,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// =================================================
// FIRESTORE
// =================================================

const db =
    getFirestore(app);


console.log(
    "✓ affectation-salles.js chargé."
);

console.log(
    "✓ Firestore initialisé pour l'affectation des salles."
);
// =================================================
// LECTURE DES SALLES / AMPHIS DEPUIS FIRESTORE
// =================================================

async function chargerSallesAmphisFirestore() {

    const snapshot =
        await getDocs(
            collection(
                db,
                "salles_amphis"
            )
        );

    const sallesAmphis = [];

    snapshot.forEach(
        function (documentFirestore) {

            sallesAmphis.push(
                {
                    id: documentFirestore.id,
                    ...documentFirestore.data()
                }
            );

        }
    );

    console.log(
        "✓ Salles / amphis Firestore :",
        sallesAmphis.length
    );

    console.log(
        "Données salles / amphis :",
        sallesAmphis
    );

    return sallesAmphis;
}


// =================================================
// TEST DE CHARGEMENT
// =================================================

chargerSallesAmphisFirestore()
    .catch(
        function (erreur) {

            console.error(
                "❌ Erreur lecture salles / amphis Firestore :",
                erreur
            );

        }
    );
// =================================================
// TEST DES DONNÉES DU MOTEUR
// =================================================

function testerDonneesAffectation() {

    if (
        !window.generationExamens ||
        !window.generationExamens.obtenirDonnees
    ) {

        console.warn(
            "⏳ Moteur de génération pas encore disponible."
        );

        return;
    }

    const donnees =
        window.generationExamens.obtenirDonnees();

    console.log(
        "=========================================="
    );

    console.log(
        "TEST DES DONNÉES POUR AFFECTATION"
    );

    console.log(
        "=========================================="
    );

    console.log(
        "Salles / amphis :",
        donnees.sallesAmphis
    );

    console.log(
        "Effectifs :",
        donnees.effectifs
    );

    console.log(
        "Nombre de salles / amphis :",
        donnees.sallesAmphis.length
    );

    console.log(
        "Nombre d'effectifs :",
        donnees.effectifs.length
    );

    console.log(
    "=========================================="
);

console.log(
    "DÉTAIL DES SALLES / AMPHIS"
);

console.table(
    donnees.sallesAmphis
);

console.log(
    "=========================================="
);

console.log(
    "DÉTAIL DES EFFECTIFS"
);

console.table(
    donnees.effectifs
);

console.log(
    "Effectifs détaillés :"
);

donnees.effectifs.forEach(
    function (effectif) {

        console.log(
            effectif.anneeUniversitaire,
            "|",
            effectif.niveauCode,
            "|",
            effectif.filiereCode,
            "| Effectif =",
            effectif.effectif
        );

    }
);

console.log(
    "Salles / amphis détaillés :"
);

donnees.sallesAmphis.forEach(
    function (salle) {

        console.log(
            salle.code,
            "|",
            salle.type,
            "|",
            salle.libelle,
            "| Capacité =",
            salle.capacite,
            "| Disponible =",
            salle.disponible
        );

    }
);
    
console.log(
    "=========================================="
);
}


// =================================================
// ATTENDRE LE MOTEUR DE GÉNÉRATION
// =================================================

setTimeout(
    testerDonneesAffectation,
    1000
);
// =================================================
// RECHERCHER DES LOCAUX POUR UNE FILIÈRE
// =================================================

function trouverLocauxPourFiliere(
    filiereCode,
    effectif,
    sallesAmphis
) {

    // -------------------------------------------------
    // Vérifier les données
    // -------------------------------------------------

    if (
        !effectif ||
        !sallesAmphis ||
        sallesAmphis.length === 0
    ) {

        return {
            succes: false,
            locaux: [],
            message: "Aucun local disponible."
        };

    }

    // -------------------------------------------------
    // Garder uniquement les locaux disponibles
    // -------------------------------------------------

    const locauxDisponibles =
        sallesAmphis.filter(
            function (salle) {

                return (
                    salle.disponible === "Oui" &&
                    Number(salle.capacite) > 0
                );

            }
        );

    // -------------------------------------------------
    // 1. Chercher un seul local suffisamment grand
    // -------------------------------------------------

    const localUnique =
        locauxDisponibles
            .filter(
                function (salle) {

                    return (
                        Number(salle.capacite) >=
                        Number(effectif)
                    );

                }
            )
            .sort(
                function (a, b) {

                    return (
                        Number(a.capacite) -
                        Number(b.capacite)
                    );

                }
            )[0];

    if (localUnique) {

        return {
            succes: true,
            locaux: [
                localUnique.code
            ],
            capaciteTotale:
                Number(localUnique.capacite),
            effectif:
                Number(effectif),
            message:
                "Un seul local suffit."
        };

    }

    // -------------------------------------------------
    // 2. Chercher plusieurs locaux
    // -------------------------------------------------

    const locauxTries =
        locauxDisponibles
            .slice()
            .sort(
                function (a, b) {

                    return (
                        Number(b.capacite) -
                        Number(a.capacite)
                    );

                }
            );

    const locauxChoisis = [];

    let capaciteTotale = 0;

    for (
        let i = 0;
        i < locauxTries.length;
        i++
    ) {

        const salle =
            locauxTries[i];

        locauxChoisis.push(
            salle.code
        );

        capaciteTotale +=
            Number(salle.capacite);

        if (
            capaciteTotale >=
            Number(effectif)
        ) {

            return {
                succes: true,
                locaux:
                    locauxChoisis,
                capaciteTotale:
                    capaciteTotale,
                effectif:
                    Number(effectif),
                message:
                    "Plusieurs locaux sont nécessaires."
            };

        }

    }

    // -------------------------------------------------
    // 3. Aucun ensemble de locaux suffisant
    // -------------------------------------------------

    return {
        succes: false,
        locaux: [],
        capaciteTotale:
            capaciteTotale,
        effectif:
            Number(effectif),
        message:
            "Affectation impossible."
    };

}
// =================================================
// EXPOSER LA FONCTION POUR LES TESTS F12
// =================================================

window.trouverLocauxPourFiliere =
    trouverLocauxPourFiliere;
// =================================================
// VÉRIFIER SI UN LOCAL EST DÉJÀ UTILISÉ
// À UNE DATE ET UN CRÉNEAU
// =================================================

function localEstDisponiblePourCreneau(
    codeLocal,
    date,
    creneauOrdre,
    affectations
) {

    // -------------------------------------------------
    // Aucune affectation existante
    // -------------------------------------------------

    if (
        !affectations ||
        affectations.length === 0
    ) {

        return true;

    }

    // -------------------------------------------------
    // Rechercher un conflit
    // -------------------------------------------------

    const conflit =
        affectations.some(
            function (affectation) {

                return (
                    affectation.codeLocal === codeLocal &&
                    affectation.date === date &&
                    Number(affectation.creneauOrdre) ===
                    Number(creneauOrdre)
                );

            }
        );

    // -------------------------------------------------
    // Résultat
    // -------------------------------------------------

    return !conflit;
}


// =================================================
// EXPOSER LA FONCTION POUR LES TESTS F12
// =================================================

window.localEstDisponiblePourCreneau =
    localEstDisponiblePourCreneau;
// =================================================
// PRÉPARER LES AFFECTATIONS FIXES PAR FILIÈRE
// =================================================

function preparerAffectationsFilieres(
    planning,
    sallesAmphis,
    effectifs
) {

    const affectations = [];

    // -------------------------------------------------
    // Vérifier les données
    // -------------------------------------------------

    if (
        !planning ||
        !planning.filieres ||
        !sallesAmphis ||
        !effectifs
    ) {

        return {
            succes: false,
            affectations: [],
            message: "Données insuffisantes."
        };

    }

    // -------------------------------------------------
    // Parcourir toutes les filières du planning
    // -------------------------------------------------

    planning.filieres.forEach(
        function (filiere) {

            // -------------------------------------------------
            // Rechercher l'effectif de la filière
            // -------------------------------------------------

            const ligneEffectif =
                effectifs.find(
                    function (ligne) {

                        return (
                            ligne.niveauCode ===
                                planning.niveauCode &&
                            ligne.filiereCode ===
                                filiere.filiereCode
                        );

                    }
                );

            if (!ligneEffectif) {

                affectations.push(
                    {
                        filiereCode:
                            filiere.filiereCode,
                        succes: false,
                        locaux: [],
                        message:
                            "Effectif introuvable."
                    }
                );

                return;

            }

            // -------------------------------------------------
            // Rechercher les locaux possibles
            // -------------------------------------------------

            const resultat =
                trouverLocauxPourFiliere(
                    filiere.filiereCode,
                    Number(ligneEffectif.effectif),
                    sallesAmphis
                );

            // -------------------------------------------------
            // Mémoriser l'affectation
            // -------------------------------------------------

            affectations.push(
                {
                    filiereCode:
                        filiere.filiereCode,

                    effectif:
                        Number(ligneEffectif.effectif),

                    succes:
                        resultat.succes,

                    locaux:
                        resultat.locaux,

                    capaciteTotale:
                        resultat.capaciteTotale,

                    message:
                        resultat.message
                }
            );

        }
    );

    // -------------------------------------------------
    // Vérifier si toutes les filières sont affectables
    // -------------------------------------------------

    const impossible =
        affectations.some(
            function (affectation) {

                return !affectation.succes;

            }
        );

    return {
        succes: !impossible,
        affectations: affectations,
        message:
            impossible
                ? "Une ou plusieurs filières sont impossibles à affecter."
                : "Toutes les filières ont une affectation possible."
    };

}


// =================================================
// EXPOSER POUR LES TESTS F12
// =================================================

window.preparerAffectationsFilieres =
    preparerAffectationsFilieres;

// =================================================
// CONSTRUIRE LA MATRICE DES CONFLITS ENTRE FILIÈRES
// =================================================

function construireConflitsFilieres(planning) {

    const conflits = [];

    // -------------------------------------------------
    // Vérifier les données
    // -------------------------------------------------

    if (
        !planning ||
        !planning.filieres
    ) {

        return conflits;

    }

    // -------------------------------------------------
    // Parcourir toutes les paires de filières
    // -------------------------------------------------

    for (
        let i = 0;
        i < planning.filieres.length;
        i++
    ) {

        const filiereA =
            planning.filieres[i];

        for (
            let j = i + 1;
            j < planning.filieres.length;
            j++
        ) {

            const filiereB =
                planning.filieres[j];

            // -------------------------------------------------
            // Examens occupés de chaque filière
            // -------------------------------------------------

            const examensA =
                filiereA.cellules.filter(
                    function (cellule) {

                        return cellule.estOccupee;

                    }
                );

            const examensB =
                filiereB.cellules.filter(
                    function (cellule) {

                        return cellule.estOccupee;

                    }
                );

            let conflitTrouve = false;

            // -------------------------------------------------
            // Comparer les dates + créneaux
            // -------------------------------------------------

            for (
                let a = 0;
                a < examensA.length;
                a++
            ) {

                for (
                    let b = 0;
                    b < examensB.length;
                    b++
                ) {

                    if (
    examensA[a].date &&
    examensB[b].date &&

    examensA[a].date.seconds ===
        examensB[b].date.seconds &&

    Number(
        examensA[a].creneauOrdre
    ) ===
    Number(
        examensB[b].creneauOrdre
    )
) {
                        conflitTrouve = true;

                        break;

                    }

                }

                if (conflitTrouve) {

                    break;

                }

            }

            // -------------------------------------------------
            // Mémoriser uniquement les paires en conflit
            // -------------------------------------------------

            if (conflitTrouve) {

                conflits.push(
                    {
                        filiereA:
                            filiereA.filiereCode,

                        filiereB:
                            filiereB.filiereCode
                    }
                );

            }

        }

    }

    return conflits;

}


// =================================================
// EXPOSER POUR LES TESTS F12
// =================================================

window.construireConflitsFilieres =
    construireConflitsFilieres;

// =================================================
// CONSTRUIRE LA LISTE DES CONFLITS PAR FILIÈRE
// =================================================

function construireCarteConflits(
    conflits
) {

    const carteConflits = {};

    if (!conflits) {

        return carteConflits;

    }

    conflits.forEach(
        function (conflit) {

            const filiereA =
                conflit.filiereA;

            const filiereB =
                conflit.filiereB;

            if (!carteConflits[filiereA]) {

                carteConflits[filiereA] = [];

            }

            if (!carteConflits[filiereB]) {

                carteConflits[filiereB] = [];

            }

            carteConflits[filiereA].push(
                filiereB
            );

            carteConflits[filiereB].push(
                filiereA
            );

        }
    );

    return carteConflits;

}

window.construireCarteConflits =
    construireCarteConflits;

 // =================================================
// VÉRIFIER SI UN LOCAL EST COMPATIBLE
// AVEC LES CONFLITS D'UNE FILIÈRE
// =================================================

function localCompatibleAvecConflits(
    filiereCode,
    codeLocal,
    carteConflits,
    affectationsFilieres
) {

    if (
        !carteConflits ||
        !affectationsFilieres
    ) {

        return true;

    }

    const conflits =
        carteConflits[filiereCode] || [];

    for (
        let i = 0;
        i < conflits.length;
        i++
    ) {

        const filiereEnConflit =
            conflits[i];

        const affectation =
            affectationsFilieres.find(
                function (item) {

                    return (
                        item.filiereCode ===
                        filiereEnConflit
                    );

                }
            );

        if (
            affectation &&
            affectation.locaux &&
            affectation.locaux.includes(
                codeLocal
            )
        ) {

            return false;

        }

    }

    return true;

}

window.localCompatibleAvecConflits =
    localCompatibleAvecConflits;

// =================================================
// AFFECTER UN LOCAL FIXE À CHAQUE FILIÈRE
// =================================================


function affecterLocauxFixes(
    planning,
    sallesAmphis,
    effectifs
) {

    const resultats = [];

    if (
        !planning ||
        !Array.isArray(planning.filieres) ||
        !Array.isArray(sallesAmphis) ||
        !Array.isArray(effectifs)
    ) {

        return {
            succes: false,
            affectations: [],
            message: "Données insuffisantes."
        };

    }

    const conflits =
        construireConflitsFilieres(
            planning
        );

    const carteConflits =
        construireCarteConflits(
            conflits
        );

    // -------------------------------------------------
    // Parcourir les filières
    // -------------------------------------------------

    // -------------------------------------------------
// Trier les filières par nombre de matières programmées
// -------------------------------------------------

const filieresTriees =
    planning.filieres
        .slice()
        .sort(function (a, b) {
            return (
                compterMatieresProgrammeesParFiliere(b) -
                compterMatieresProgrammeesParFiliere(a)
            );
        });

filieresTriees.forEach(
    function (filiere) {

            const ligneEffectif =
                effectifs.find(
                    function (ligne) {

                        return (
                            ligne.niveauCode ===
                                planning.niveauCode &&
                            ligne.filiereCode ===
                                filiere.filiereCode
                        );

                    }
                );

            if (!ligneEffectif) {

                resultats.push({
                    filiereCode:
                        filiere.filiereCode,

                    succes: false,

                    locaux: [],

                    message:
                        "Effectif introuvable."
                });

                return;

            }

            const effectif =
                Number(
                    ligneEffectif.effectif
                );

            if (
                !Number.isFinite(effectif) ||
                effectif <= 0
            ) {

                resultats.push({
                    filiereCode:
                        filiere.filiereCode,

                    effectif: effectif,

                    succes: false,

                    locaux: [],

                    message:
                        "Effectif invalide."
                });

                return;

            }

            // -------------------------------------------------
            // Rechercher les locaux possibles
            // -------------------------------------------------

            const locauxPossibles =
                sallesAmphis
                    .filter(
                        function (salle) {

                            const capacite =
                                Number(salle.capacite);

                            return (
                                salle.disponible === "Oui" &&
                                Number.isFinite(capacite) &&
                                capacite > 0 &&
                                capacite >= effectif
                            );

                        }
                    )
                    .filter(
                        function (salle) {

                            return localCompatibleAvecConflits(
                                filiere.filiereCode,
                                salle.code,
                                carteConflits,
                                resultats
                            );

                        }
                    )
                    .sort(
                        function (a, b) {

                            const tauxA =
                                effectif /
                                Number(a.capacite);

                            const tauxB =
                                effectif /
                                Number(b.capacite);

                            const prioriteA =
                                tauxA >= 0.83 ? 0 :
                                tauxA >= 0.66 ? 1 : 2;

                            const prioriteB =
                                tauxB >= 0.83 ? 0 :
                                tauxB >= 0.66 ? 1 : 2;

                            if (
                                prioriteA !== prioriteB
                            ) {

                                return (
                                    prioriteA -
                                    prioriteB
                                );

                            }

                            return (
                                Number(a.capacite) -
                                Number(b.capacite)
                            );

                        }
                    );

            if (
                locauxPossibles.length === 0
            ) {

                resultats.push({
                    filiereCode:
                        filiere.filiereCode,

                    effectif: effectif,

                    succes: false,

                    locaux: [],

                    message:
                        "Affectation impossible."
                });

                return;

            }

            const local =
                locauxPossibles[0];

            resultats.push({
                filiereCode:
                    filiere.filiereCode,

                effectif: effectif,

                succes: true,

                locaux: [
                    local.code
                ],

                capaciteTotale:
                    Number(local.capacite),

                tauxOccupation:
                    effectif /
                    Number(local.capacite),

                message:
                    "Local fixe affecté."
            });

        }
    );

    const impossible =
        resultats.some(
            function (resultat) {

                return !resultat.succes;

            }
        );

    return {
        succes: !impossible,

        affectations:
            resultats,

        message:
            impossible
                ? "Une ou plusieurs filières sont impossibles à affecter."
                : "Toutes les filières sont affectées."
    };

}

window.affecterLocauxFixes =
    affecterLocauxFixes;
 // =================================================
// RECHERCHER LA MEILLEURE COMBINAISON DE LOCAUX
// =================================================

function rechercherMeilleureCombinaisonLocaux(
    filiereCode,
    effectif,
    sallesAmphis,
    carteConflits,
    affectationsFilieres
) {

    const locauxDisponibles =
        sallesAmphis
            .filter(
                function (salle) {

                    return (
                        salle.disponible === "Oui" &&
                        Number(salle.capacite) > 0 &&
                        localCompatibleAvecConflits(
                            filiereCode,
                            salle.code,
                            carteConflits,
                            affectationsFilieres
                        )
                    );

                }
            );

    // -------------------------------------------------
    // 1. Chercher d'abord un seul local >= 66 %
    // -------------------------------------------------

    
    // -------------------------------------------------
    // 1. Chercher d'abord un seul local
    // -------------------------------------------------

    const locauxUniques =
        locauxDisponibles
            .filter(
                function (salle) {
                    return (
                        Number(salle.capacite) >= effectif
                    );
                }
            )
            .sort(
                function (a, b) {
                    const tauxA =
                        effectif / Number(a.capacite);

                    const tauxB =
                        effectif / Number(b.capacite);

                    // Priorité 1 : occupation >= 83 %
                    const prioriteA = tauxA >= 0.83 ? 0 :
                        tauxA >= 0.66 ? 1 : 2;

                    const prioriteB = tauxB >= 0.83 ? 0 :
                        tauxB >= 0.66 ? 1 : 2;

                    if (prioriteA !== prioriteB) {
                        return prioriteA - prioriteB;
                    }

                    // À priorité égale, capacité la plus petite
                    return Number(a.capacite) -
                        Number(b.capacite);
                }
            );

    if (locauxUniques.length > 0) {
        const local = locauxUniques[0];

        const tauxOccupation =
            effectif / Number(local.capacite);

        return {
            succes: true,
            locaux: [local.code],
            capaciteTotale: Number(local.capacite),
            tauxOccupation: tauxOccupation,
            message:
                tauxOccupation >= 0.83
                    ? "Un seul local suffit : priorité 83 %."
                    : tauxOccupation >= 0.66
                        ? "Un seul local suffit : priorité 66 %."
                        : "Un seul local suffit : dernier recours sous 66 %."
        };
    }


    // -------------------------------------------------
    // 2. Rechercher plusieurs locaux
    // -------------------------------------------------

    const combinaisons = [];

    function rechercherCombinaisons(
        debut,
        combinaison,
        capaciteTotale
    ) {

        if (
            capaciteTotale >= effectif
        ) {

            combinaisons.push(
                {
                    locaux:
                        combinaison.slice(),

                    capaciteTotale:
                        capaciteTotale
                }
            );

            return;

        }

        for (
            let i = debut;
            i < locauxDisponibles.length;
            i++
        ) {

            const salle =
                locauxDisponibles[i];

            combinaison.push(
                salle.code
            );

            rechercherCombinaisons(
                i + 1,
                combinaison,
                capaciteTotale +
                    Number(salle.capacite)
            );

            combinaison.pop();

        }

    }

    rechercherCombinaisons(
    0,
    [],
    0
);


   if (
    combinaisons.length === 0
) {

        return {
            succes: false,

            locaux: [],

            capaciteTotale: 0,

            tauxOccupation: 0,

            message:
                "Aucune combinaison de locaux ne permet d'accueillir l'effectif."
        };

    }

    // -------------------------------------------------
    // 3. Choisir la meilleure combinaison
    // -------------------------------------------------

    combinaisons.sort(
        function (a, b) {

            const tauxA =
                effectif / a.capaciteTotale;

            const tauxB =
                effectif / b.capaciteTotale;

            // Priorité 1 :
            // occupation >= 83 %, puis >= 66 %,
            // puis moins de 66 % en dernier recours

            const prioriteA =
                tauxA >= 0.83 ? 0 :
                tauxA >= 0.66 ? 1 : 2;

            const prioriteB =
                tauxB >= 0.83 ? 0 :
                tauxB >= 0.66 ? 1 : 2;

            if (prioriteA !== prioriteB) {
                return prioriteA - prioriteB;
            }

            // Priorité 2 :
            // moins de locaux ouverts

            if (a.locaux.length !== b.locaux.length) {
                return a.locaux.length - b.locaux.length;
            }

            // Priorité 3 :
            // capacité totale la plus proche

            return a.capaciteTotale - b.capaciteTotale;
        }
    );

    const meilleure = combinaisons[0];

    return {
        succes: true,

        locaux:
            meilleure.locaux,

        capaciteTotale:
            meilleure.capaciteTotale,

        tauxOccupation:
            effectif /
            meilleure.capaciteTotale,

        message:
            "Plusieurs locaux sont nécessaires."
    };

}
 window.rechercherMeilleureCombinaisonLocaux =
    rechercherMeilleureCombinaisonLocaux;

 // =================================================
 // COMPTER LES MATIÈRES PROGRAMMÉES D'UNE FILIÈRE
 // =================================================

function compterMatieresProgrammeesParFiliere(filiere) {
    const matieres = new Set();

    (filiere.cellules || []).forEach(function (cellule) {
        if (
            cellule &&
            cellule.estOccupee &&
            cellule.matiereLibelle
        ) {
            matieres.add(
                String(cellule.matiereLibelle).trim()
            );
        }
    });

    return matieres.size;
}


// =================================================
// CONSTRUIRE LE VECTEUR DE PRIORITÉ D'UN NIVEAU
// =================================================

function construireVecteurPrioriteNiveau(planning) {
    if (!planning || !Array.isArray(planning.filieres)) {
        return [];
    }

    return planning.filieres
        .map(function (filiere) {
            return compterMatieresProgrammeesParFiliere(filiere);
        })
        .sort(function (a, b) {
            return b - a;
        });
}


// =================================================
// CLASSER LES CALENDRIERS AVANT LES AFFECTATIONS
// =================================================

function classerCalendriersPourAffectation(documents) {
    return documents
        .map(function (documentCalendrier) {
            const donnees = documentCalendrier.data();
            const planning = donnees.planning;

            const cleGroupe = [
                donnees.anneeUniversitaire || "",
                donnees.regimeCode || "",
                donnees.sessionCode || "",
                donnees.semestreCode || ""
            ].join("|");

            return {
                document: documentCalendrier,
                cleGroupe: cleGroupe,
                niveauCode:
                    (planning && planning.niveauCode) ||
                    donnees.niveauCode ||
                    "",
                vecteur: construireVecteurPrioriteNiveau(planning),
                planningValide:
                    !!planning &&
                    Array.isArray(planning.filieres)
            };
        })
        .sort(function (a, b) {
            // Priorité 1 : traiter chaque groupe séparément
            const comparaisonGroupe =
                a.cleGroupe.localeCompare(b.cleGroupe);

            if (comparaisonGroupe !== 0) {
                return comparaisonGroupe;
            }

            // Priorité 2 : plannings valides avant les invalides
            if (a.planningValide !== b.planningValide) {
                return a.planningValide ? -1 : 1;
            }

            // Priorité 3 : comparer les vecteurs décroissants
            const longueur =
                Math.min(a.vecteur.length, b.vecteur.length);

            for (let i = 0; i < longueur; i++) {
                if (a.vecteur[i] !== b.vecteur[i]) {
                    return b.vecteur[i] - a.vecteur[i];
                }
            }

            if (a.vecteur.length !== b.vecteur.length) {
                return b.vecteur.length - a.vecteur.length;
            }

            // Départager les égalités de manière déterministe
            const comparaisonNiveau =
                a.niveauCode.localeCompare(b.niveauCode);

            if (comparaisonNiveau !== 0) {
                return comparaisonNiveau;
            }

            return a.document.id.localeCompare(b.document.id);
        })
        .map(function (element) {
            return element.document;
        });
}

window.classerCalendriersPourAffectation =
    classerCalendriersPourAffectation;


/* =================================================
   GÉNÉRER LES AFFECTATIONS DE TOUS LES CALENDRIERS
   ================================================= */

const btnGenererAffectations =
    document.getElementById("btnGenererAffectations");

if (btnGenererAffectations) {

    btnGenererAffectations.addEventListener(
        "click",
        async function () {

            const statut =
                document.getElementById(
                    "statutAffectationSalles"
                );

            const resume =
                document.getElementById(
                    "resumeAffectationSalles"
                );

            btnGenererAffectations.disabled = true;

            if (statut) {
                statut.textContent =
                    "Chargement des calendriers enregistrés...";
            }

            try {

                // 1. Charger les données nécessaires
                const donnees =
                    await window.generationExamens.obtenirDonnees();

                const sallesAmphis =
                    donnees.sallesAmphis || [];

                const effectifs =
                    donnees.effectifs || [];

                if (
                    sallesAmphis.length === 0 ||
                    effectifs.length === 0
                ) {
                    throw new Error(
                        "Les salles/amphis ou les effectifs sont absents."
                    );
                }

                // 2. Lire tous les calendriers Firestore
                const snapshot =
                    await getDocs(
                        collection(db, "calendriers")
                    );

                if (snapshot.empty) {
                    throw new Error(
                        "Aucun calendrier enregistré dans Firestore."
                    );
                }

                let calendriersTraites = 0;
                let calendriersEnregistres = 0;
                let calendriersEnErreur = 0;

                const erreurs = [];

                // 3. Classer puis traiter chaque calendrier enregistré
const calendriersTries =
    classerCalendriersPourAffectation(snapshot.docs);

for (const documentCalendrier of calendriersTries) {

                    const donneesCalendrier =
                        documentCalendrier.data();

                    const planning =
                        donneesCalendrier.planning;

                    if (
                        !planning ||
                        !Array.isArray(planning.filieres)
                    ) {
                        calendriersEnErreur++;

                        erreurs.push(
                            documentCalendrier.id +
                            " : structure du planning invalide."
                        );

                        continue;
                    }

                    calendriersTraites++;

                    const resultat =
                        window.affecterLocauxFixes(
                            planning,
                            sallesAmphis,
                            effectifs
                        );

                    // Ne pas enregistrer un calendrier partiellement affecté
                   
if (
    !resultat ||
    !resultat.succes
) {
    calendriersEnErreur++;

    console.group(
        "Échec du calendrier : " +
        documentCalendrier.id
    );

    console.log(
        "Message général :",
        resultat?.message
    );

    console.table(
        (resultat?.affectations || [])
            .filter(function (affectation) {
                return !affectation.succes;
            })
            .map(function (affectation) {
                return {
                    filiereCode: affectation.filiereCode,
                    effectif: affectation.effectif,
                    message: affectation.message,
                    locaux: affectation.locaux
                };
            })
    );

    console.groupEnd();

    erreurs.push(
        documentCalendrier.id +
        " : " +
        (
            resultat?.message ||
            "Échec de l'affectation."
        )
    );

    continue;
}


                    // 4. Reporter les locaux dans les filières
                    const filieresMisesAJour =
                        planning.filieres.map(
                            function (filiere) {

                                const affectation =
                                    resultat.affectations.find(
                                        function (ligne) {
                                            return (
                                                ligne.filiereCode ===
                                                filiere.filiereCode
                                            );
                                        }
                                    );

                                if (!affectation) {
                                    throw new Error(
                                        "Affectation manquante pour " +
                                        filiere.filiereCode
                                    );
                                }

                                return {
                                    ...filiere,
                                    amphis: affectation.locaux
                                };
                            }
                        );

                    const planningMisAJour = {
                        ...planning,
                        filieres: filieresMisesAJour
                    };

                    // 5. Enregistrer uniquement le planning modifié
                    await updateDoc(
                        doc(
                            db,
                            "calendriers",
                            documentCalendrier.id
                        ),
                        {
                            planning: planningMisAJour
                        }
                    );

                    calendriersEnregistres++;
                }

                // 6. Afficher le bilan
                const bilan =
                    "Calendriers lus : " +
                    snapshot.size +
                    " | Traités : " +
                    calendriersTraites +
                    " | Enregistrés : " +
                    calendriersEnregistres +
                    " | En erreur : " +
                    calendriersEnErreur;

                if (statut) {
                    statut.textContent = bilan;
                }

                if (resume) {
                    resume.textContent =
                        erreurs.length > 0
                            ? bilan + "\n" + erreurs.join("\n")
                            : bilan;
                }

                console.log(
                    "Bilan des affectations :",
                    {
                        total: snapshot.size,
                        traites: calendriersTraites,
                        enregistres: calendriersEnregistres,
                        erreurs: erreurs
                    }
                );
console.table(erreurs);

               
            } catch (erreur) {

                console.error(
                    "Erreur lors de la génération des affectations :",
                    erreur
                );

                if (statut) {
                    statut.textContent =
                        "Échec : " + erreur.message;
                }

            } finally {

                btnGenererAffectations.disabled = false;

            }
        }
    );
}

