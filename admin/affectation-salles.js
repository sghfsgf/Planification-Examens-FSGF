// =================================================
// AFFECTATION DES SALLES / AMPHIS
// =================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    getDocs,
    collection
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";


// =================================================
// FIRESTORE
// =================================================

const db =
    getFirestore(app);


// =================================================
// PARAMÈTRE D'AFFECTATION
// =================================================

// Taux minimum d'occupation pour un local unique
const TAUX_OCCUPATION_MINIMUM = 0.66;


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

 affectations.push({
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
         resultat.message,

     // Identifier le groupe d'affectation
     groupe:
         resultat.groupe || filiere.filiereCode
 });

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
// RECHERCHER LA MEILLEURE COMBINAISON DE LOCAUX
// =================================================


// =================================================
// RECHERCHER LA MEILLEURE COMBINAISON DE LOCAUX
// =================================================

function rechercherMeilleureCombinaisonLocaux(
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
            capaciteTotale: 0,
            tauxOccupation: 0,
            message:
                "Données insuffisantes."
        };

    }

    const effectifNumerique =
        Number(effectif);

    // -------------------------------------------------
    // Locaux disponibles
    // -------------------------------------------------

    const locauxDisponibles =
        sallesAmphis
            .filter(
                function (salle) {

                    return (
                        salle.disponible === "Oui" &&
                        Number(salle.capacite) > 0
                    );

                }
            );

    // -------------------------------------------------
    // 1. Chercher un seul local respectant les 66 %
    // -------------------------------------------------

    const locauxUniques =
        locauxDisponibles
            .filter(
                function (salle) {

                    const capacite =
                        Number(salle.capacite);

                    return (
                        capacite >= effectifNumerique &&

                        effectifNumerique /
                            capacite >=
                        TAUX_OCCUPATION_MINIMUM
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
            );

    if (
        locauxUniques.length > 0
    ) {

        const local =
            locauxUniques[0];

        return {

            succes: true,

            locaux: [
                local.code
            ],

            capaciteTotale:
                Number(local.capacite),

            tauxOccupation:
                effectifNumerique /
                Number(local.capacite),

            message:
                "Un seul local suffit."

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

        // -------------------------------------------------
        // Capacité suffisante
        // -------------------------------------------------

        if (
            capaciteTotale >=
            effectifNumerique
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

        // -------------------------------------------------
        // Construire les combinaisons
        // -------------------------------------------------

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

    // -------------------------------------------------
    // Garder uniquement les combinaisons valides
    // -------------------------------------------------

    const combinaisonsValides =
        combinaisons.filter(
            function (combinaison) {

                // Un seul local :
                // il doit respecter les 66 %

                if (
                    combinaison.locaux.length === 1
                ) {

                    return (
                        effectifNumerique /
                        combinaison.capaciteTotale >=
                        TAUX_OCCUPATION_MINIMUM
                    );

                }

                // Plusieurs locaux :
                // la capacité totale doit simplement
                // être suffisante

                return (
                    combinaison.capaciteTotale >=
                    effectifNumerique
                );

            }
        );

    if (
        combinaisonsValides.length === 0
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

    combinaisonsValides.sort(
        function (a, b) {

            // Priorité 1 :
            // nombre minimal de locaux

            if (
                a.locaux.length !==
                b.locaux.length
            ) {

                return (
                    a.locaux.length -
                    b.locaux.length
                );

            }

            // Priorité 2 :
            // capacité totale la plus proche
            // de l'effectif

            return (
                a.capaciteTotale -
                b.capaciteTotale
            );

        }
    );

    const meilleure =
        combinaisonsValides[0];

    return {

        succes: true,

        locaux:
            meilleure.locaux,

        capaciteTotale:
            meilleure.capaciteTotale,

        tauxOccupation:
            effectifNumerique /
            meilleure.capaciteTotale,

        message:
            meilleure.locaux.length === 1
                ? "Un seul local suffit."
                : "Plusieurs locaux sont nécessaires."

    };

}


// =================================================
// EXPOSER POUR LES TESTS F12
// =================================================

window.rechercherMeilleureCombinaisonLocaux =
    rechercherMeilleureCombinaisonLocaux;


// =================================================
// CONSTRUIRE LES GROUPES DE FILIÈRES
// =================================================


function construireGroupesFilieres(planning, effectifs) {

    const groupesParDateCreneau = {};

    if (
        !planning ||
        !Array.isArray(planning.filieres) ||
        !Array.isArray(effectifs)
    ) {
        return [];
    }

    // -------------------------------------------------
    // Parcourir chaque filière du calendrier global
    // -------------------------------------------------

    planning.filieres.forEach(function (filiere) {

      const niveauCode =
      filiere.niveauCode || planning.niveauCode;
        
        console.log("🔎 Exemple de document effectif :", effectifs[0]);
        console.log("🔎 Année du planning :", planning.anneeUniversitaire);
        console.log("🔎 Filière du calendrier :", filiere);

        console.log(
    "🔎 Année affichée dans Admin :",
    document.getElementById("anneeUniversitaireAdmin")?.textContent.trim()
      );

    console.log(
    "🔎 Années présentes dans les effectifs :",
    [...new Set(effectifs.map(ligne => ligne.anneeUniversitaire))]
    );
        const ligneEffectif = effectifs.find(function (ligne) {
            return (
                ligne.niveauCode === niveauCode &&
                ligne.filiereCode === filiere.filiereCode &&
                ligne.anneeUniversitaire ===
                    planning.anneeUniversitaire
            );
        });

        if (
            !ligneEffectif ||
            !Number.isFinite(Number(ligneEffectif.effectif)) ||
            Number(ligneEffectif.effectif) <= 0
        ) {
            console.warn(
                "Effectif absent ou invalide :",
                niveauCode,
                filiere.filiereCode
            );
            return;
        }

        // Une filière ne doit apparaître qu'une fois
        // par date et créneau, même si plusieurs cellules
        // occupées sont présentes.

        const creneauxFiliere = new Set();

        (filiere.cellules || []).forEach(function (cellule) {

            if (!cellule.estOccupee || !cellule.date) {
                return;
            }

            const dateCle =
                cellule.dateAffichage ||
                (
                    typeof cellule.date.seconds === "number"
                        ? new Date(
                            cellule.date.seconds * 1000
                        ).toLocaleDateString("fr-FR", {
                            timeZone: "Africa/Tunis"
                        })
                        : String(cellule.date)
                );

            const creneauCle =
                String(cellule.creneauOrdre);

            const cle =
                niveauCode + "|" +
                dateCle + "|" +
                creneauCle;

            if (creneauxFiliere.has(cle)) {
                return;
            }

            creneauxFiliere.add(cle);

            if (!groupesParDateCreneau[cle]) {
                groupesParDateCreneau[cle] = {
                    niveauCode: niveauCode,
                    date: dateCle,
                    creneauOrdre: cellule.creneauOrdre,
                    filieres: []
                };
            }

            groupesParDateCreneau[cle].filieres.push({
                filiereCode: filiere.filiereCode,
                effectif: Number(ligneEffectif.effectif)
            });

        });

    });

    // -------------------------------------------------
    // Conserver les créneaux avec au moins deux filières
    // -------------------------------------------------

    return Object.values(groupesParDateCreneau)
        .filter(function (groupe) {
            return groupe.filieres.length >= 2;
        })
        .map(function (groupe) {

            const effectifTotal =
                groupe.filieres.reduce(function (total, filiere) {
                    return total + filiere.effectif;
                }, 0);

            const dateCreneau =
                groupe.date + "|" + groupe.creneauOrdre;

            return {
                niveauCode: groupe.niveauCode,
                filieres: groupe.filieres.map(
                    filiere => filiere.filiereCode
                ),
                effectifs: groupe.filieres.map(
                    filiere => filiere.effectif
                ),
                effectifTotal: effectifTotal,
                datesCreneaux: [dateCreneau]
            };
        });
}

window.construireGroupesFilieres =
    construireGroupesFilieres;


// =================================================
// AFFECTER UN LOCAL FIXE À CHAQUE FILIÈRE
// EN TENANT COMPTE DES REGROUPEMENTS
// =================================================

function affecterLocauxFixes(
    planning,
    sallesAmphis,
    effectifs
) {

    const resultats = [];

    if (
        !planning ||
        !planning.filieres ||
        !sallesAmphis ||
        !effectifs
    ) {

        return resultats;

    }

    // -------------------------------------------------
    // Construire les groupes de filières
    // -------------------------------------------------

    const groupes =
        construireGroupesFilieres(
            planning,
            effectifs
        );

    console.log(
        "🔎 Groupes de filières détectés :",
        groupes
    );

    // -------------------------------------------------
    // Mémoriser les filières déjà affectées
    // -------------------------------------------------

    const filieresDejaAffectees =
        new Set();

    // -------------------------------------------------
    // 1. AFFECTATION DES GROUPES
    // -------------------------------------------------

    groupes.forEach(
        function (groupe) {

            console.log(
                "🔄 Affectation du groupe :",
                groupe.filieres.join(" + "),
                "| Effectif total :",
                groupe.effectifTotal
            );

            const resultat =
                rechercherMeilleureCombinaisonLocaux(
                    "GROUPE",
                    groupe.effectifTotal,
                    sallesAmphis
                );

            // -------------------------------------------------
            // Si aucune combinaison n'est possible
            // -------------------------------------------------

            if (!resultat.succes) {

                groupe.filieres.forEach(
                    function (filiereCode) {

                        resultats.push({

                            filiereCode:
                                filiereCode,

                            succes:
                                false,

                            locaux: [],

                            capaciteTotale: 0,

                            tauxOccupation: 0,

                            effectif:
                                groupe.effectifs[
                                    groupe.filieres.indexOf(
                                        filiereCode
                                    )
                                ],

                            groupe:
                                groupe.filieres,

                            message:
                                "Aucune combinaison de locaux ne permet d'accueillir le groupe de " +
                                groupe.effectifTotal +
                                " étudiants."

                        });

                        filieresDejaAffectees.add(
                            filiereCode
                        );

                    }
                );

                return;

            }

            // -------------------------------------------------
            // Affecter les mêmes locaux à toutes les filières
            // du groupe
            // -------------------------------------------------

            groupe.filieres.forEach(
                function (filiereCode, index) {

                    resultats.push({

                        filiereCode:
                            filiereCode,

                        succes:
                            true,

                        locaux:
                            resultat.locaux.slice(),

                        capaciteTotale:
                            resultat.capaciteTotale,

                        tauxOccupation:
                            resultat.tauxOccupation,

                        effectif:
                            groupe.effectifs[index],

                        groupe:
                            groupe.filieres.slice(),

                        effectifGroupe:
                            groupe.effectifTotal,

                        datesCreneaux:
                            groupe.datesCreneaux.slice(),

                        message:
                            "Filière affectée avec le groupe : " +
                            groupe.filieres.join(" + ")

                    });

                    filieresDejaAffectees.add(
                        filiereCode
                    );

                }
            );

        }
    );

    // -------------------------------------------------
    // 2. AFFECTATION DES FILIÈRES NON REGROUPÉES
    // -------------------------------------------------

    planning.filieres.forEach(
        function (filiere) {

            if (
                filieresDejaAffectees.has(
                    filiere.filiereCode
                )
            ) {

                return;

            }

           
const niveauFiliere =
    filiere.niveauCode || planning.niveauCode;

const ligneEffectif =
    effectifs.find(
        function (ligne) {
            return (
                ligne.niveauCode === niveauFiliere &&
                ligne.filiereCode === filiere.filiereCode &&
                ligne.anneeUniversitaire ===
                      (
                      planning.anneeUniversitaire ||
                     document.getElementById("anneeUniversitaireAdmin")?.textContent.trim()
                      )
            );
        }
    );

            // -------------------------------------------------
            // Effectif introuvable
            // -------------------------------------------------

            if (!ligneEffectif) {

                resultats.push({

                    filiereCode:
                        filiere.filiereCode,

                    succes:
                        false,

                    locaux: [],

                    capaciteTotale: 0,

                    tauxOccupation: 0,

                    effectif: 0,

                    groupe: null,

                    message:
                        "Effectif introuvable pour cette filière."

                });

                return;

            }

            const effectif =
                Number(
                    ligneEffectif.effectif
                );

            // -------------------------------------------------
            // Recherche du meilleur local / combinaison
            // -------------------------------------------------

            const resultat =
                rechercherMeilleureCombinaisonLocaux(
                    filiere.filiereCode,
                    effectif,
                    sallesAmphis
                );

            resultats.push({

                filiereCode:
                    filiere.filiereCode,

                succes:
                    resultat.succes,

                locaux:
                    resultat.locaux,

                capaciteTotale:
                    resultat.capaciteTotale,

                tauxOccupation:
                    resultat.tauxOccupation,

                effectif:
                    effectif,

                groupe: null,

                message:
                    resultat.message

            });

        }
    );

    // -------------------------------------------------
    // Affichage console
    // -------------------------------------------------

    console.log(
        "=========================================="
    );

    console.log(
        "RÉSULTAT DES AFFECTATIONS"
    );

    console.table(
        resultats.map(
            function (resultat) {

                return {

                    Filiere:
                        resultat.filiereCode,

                    Effectif:
                        resultat.effectif,

                    Groupe:
                        resultat.groupe
                            ? resultat.groupe.join(" + ")
                            : "",

                    Locaux:
                        resultat.locaux.join(" || "),

                    Capacite:
                        resultat.capaciteTotale,

                    Occupation:
                        (
                            resultat.tauxOccupation *
                            100
                        ).toFixed(2) + " %",

                    Succes:
                        resultat.succes

                };

            }
        )
    );

    console.log(
        "=========================================="
    );

const succes =
    resultats.length > 0 &&
    resultats.every(function (resultat) {
        return resultat.succes === true;
    });

return {
    succes: succes,
    affectations: resultats,
    message: succes
        ? "Toutes les filières ont une affectation possible."
        : "Une ou plusieurs filières n'ont pas d'affectation valide."
};
}

window.affecterLocauxFixes =
    affecterLocauxFixes;

window.affecterLocauxFixes =
    affecterLocauxFixes;

// =================================================
// INTERFACE ADMIN — GÉNÉRER LES AFFECTATIONS
// =================================================
let affectationCourante = null;
let planningAffectationCourant = null;


document.addEventListener(
    "DOMContentLoaded",
    function () {

        const boutonGenerer =
            document.getElementById(
                "btnGenererAffectations"
            );

        const statut =
            document.getElementById(
                "statutAffectationSalles"
            );

        const tableau =
            document.getElementById(
                "tableauAffectationSalles"
            );

        if (!boutonGenerer) {

            console.warn(
                "⚠️ Bouton btnGenererAffectations introuvable."
            );

            return;
        }

        boutonGenerer.addEventListener(
            "click",
            function () {

                console.log(
                    "🔄 Génération des affectations..."
                );

                if (statut) {

                    statut.textContent =
                        "⏳ Génération des affectations en cours...";

                }

                try {

                    // =========================================
                    // RÉCUPÉRER LE CALENDRIER ACTUELLEMENT AFFICHÉ
                    // =========================================

                    const planning =
                        window.planningCalendrierAdmin;

                    if (!planning) {

                        throw new Error(
                            "Aucun calendrier n'est actuellement affiché. Veuillez d'abord afficher un calendrier dans le volet 📊 Calendriers."
                        );

                    }

                    console.log(
                        "✓ Calendrier récupéré :",
                        planning
                    );

                    console.log(
                        "Niveau :",
                        planning.niveauCode
                    );

                  console.log(
    "Semestre :",
    document.getElementById(
        "semestreCalendrierAdmin"
    ).value
);
// AJOUTER JUSTE APRÈS
console.log(
    "Année universitaire du planning :",
    planning.anneeUniversitaire
);

console.log(
    "Année universitaire du calendrier affiché :",
    document.getElementById(
        "anneeUniversitaireAdmin"
    )?.textContent.trim()
);
console.log(
    "Régime :",
    document.getElementById(
        "regimeCalendrierAdmin"
    ).value
);

                    console.log(
                        "Session :",
                        planning.sessionCode
                    );

                    // =========================================
                    // RÉCUPÉRER LES DONNÉES FIRESTORE
                    // =========================================

                    if (
                        !window.generationExamens ||
                        !window.generationExamens.obtenirDonnees
                    ) {

                        throw new Error(
                            "Le moteur de génération n'est pas disponible."
                        );

                    }

                    const donnees =
                        window.generationExamens.obtenirDonnees();

                    if (
                        !donnees ||
                        !donnees.sallesAmphis ||
                        !donnees.effectifs
                    ) {

                        throw new Error(
                            "Les données des salles et des effectifs sont indisponibles."
                        );

                    }

                    console.log(
                        "Salles / amphis :",
                        donnees.sallesAmphis.length
                    );

                    console.log(
                        "Effectifs :",
                        donnees.effectifs.length
                    );

                    // =========================================
                    // EFFECTUER L'AFFECTATION
                    // =========================================

                    const resultat =
                        affecterLocauxFixes(
                            planning,
                            donnees.sallesAmphis,
                            donnees.effectifs
                        );
                     affectationCourante = resultat;
                           planningAffectationCourant = planning;

                    
                    console.log(
                        "Résultat affectation :",
                        resultat
                    );

                    if (!resultat.succes) {

                        throw new Error(
                            resultat.message
                        );

                    }

                    // =========================================
                    // AFFICHER LE RÉSUMÉ
                    // =========================================

                    const resume =
                        document.getElementById(
                            "resumeAffectationSalles"
                        );

                    if (resume) {

                        resume.innerHTML = `
                            <p>
                                <strong>Niveau :</strong>
                                ${planning.niveauCode || ""}
                            </p>

                            <p>
                              <strong>Semestre :</strong>
                              ${document.getElementById(
                              "semestreCalendrierAdmin"
                               ).value} 
                            </p>

                            <p>
                               <strong>Régime :</strong>
                                ${document.getElementById(
                                "regimeCalendrierAdmin"
                                ).value}
                            </p>

                            <p>
                                <strong>Session :</strong>
                                ${planning.sessionCode || ""}
                            </p>

                            <p>
                                <strong>Filières affectées :</strong>
                                ${resultat.affectations.length}
                            </p>
                        `;

                    }

                    // =========================================
                    // AFFICHER LE TABLEAU
                    // =========================================

                    if (tableau) {

                        tableau.innerHTML = "";

                        const table =
                            document.createElement(
                                "table"
                            );

                        table.className =
                            "tableau-donnees";

                        const thead =
                            document.createElement(
                                "thead"
                            );

                        thead.innerHTML = `
                            <tr>
                                <th>Filière</th>
                                <th>Effectif</th>
                                <th>Local(s)</th>
                                <th>Capacité</th>
                                <th>Occupation</th>
                            </tr>
                        `;

                        table.appendChild(
                            thead
                        );

                        const tbody =
                            document.createElement(
                                "tbody"
                            );

                        resultat.affectations.forEach(
                            function (affectation) {

                                const ligne =
                                    document.createElement(
                                        "tr"
                                    );

                                ligne.innerHTML = `
                                    <td>${affectation.filiereCode}</td>
                                    <td>${affectation.effectif}</td>
                                    <td>${affectation.locaux.join(" || ")}</td>
                                    <td>${affectation.capaciteTotale}</td>
                                    <td>${(
                                        affectation.tauxOccupation *
                                        100
                                    ).toFixed(2)} %</td>
                                `;

                                tbody.appendChild(
                                    ligne
                                );

                            }
                        );

                        table.appendChild(
                            tbody
                        );

                        tableau.appendChild(
                            table
                        );

                    }

                    // =========================================
                    // STATUT
                    // =========================================

                    if (statut) {

                        statut.textContent =
                            "✅ Affectations générées avec succès.";

                    }

                    console.log(
                        "✓ Affectations générées avec succès."
                    );

                } catch (erreur) {

                    console.error(
                        "❌ Erreur génération affectations :",
                        erreur
                    );

                    if (statut) {

                        statut.textContent =
                            "❌ " + erreur.message;

                    }

                }

            }
        );

    }
);

// =================================================
// INTERFACE ADMIN — CONTRÔLER LES AFFECTATIONS
// =================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const boutonControler =
            document.getElementById(
                "btnControlerAffectations"
            );

        const statut =
            document.getElementById(
                "statutAffectationSalles"
            );

        if (!boutonControler) {

            console.warn(
                "⚠️ Bouton btnControlerAffectations introuvable."
            );

            return;
        }

        boutonControler.addEventListener(
            "click",
            function () {

                console.log(
                    "🔍 Contrôle des affectations..."
                );

                if (statut) {

                    statut.textContent =
                        "⏳ Contrôle des affectations en cours...";

                }

                try {

                    // =========================================
                    // VÉRIFIER QU'UNE AFFECTATION EXISTE
                    // =========================================

                    if (
                        !affectationCourante ||
                        !planningAffectationCourant
                    ) {

                        throw new Error(
                            "Aucune affectation à contrôler. Veuillez d'abord générer les affectations."
                        );

                    }

                    const affectations =
                        affectationCourante.affectations;

                    if (
                        !Array.isArray(affectations) ||
                        affectations.length === 0
                    ) {

                        throw new Error(
                            "Aucune affectation disponible."
                        );

                    }

                    const erreurs = [];

                    // =========================================
                    // CONTRÔLE DE CHAQUE FILIÈRE
                    // =========================================

                    affectations.forEach(
                        function (affectation) {

                            // ---------------------------------
                            // 1. Vérifier les locaux
                            // ---------------------------------

                            if (
                                !Array.isArray(
                                    affectation.locaux
                                ) ||
                                affectation.locaux.length === 0
                            ) {

                                erreurs.push(
                                    affectation.filiereCode +
                                    " : aucun local affecté."
                                );

                                return;
                            }

                            // ---------------------------------
                          // 2. Vérifier que les locaux sont disponibles
                           // ---------------------------------

                   affectation.locaux.forEach(
                         function (codeLocal) {

                            const local =
                            window.generationExamens
                              .obtenirDonnees()
                                 .sallesAmphis
                              .find(
                                   function (salle) {

                           return salle.code === codeLocal;

                    }
                );

        if (!local) {

            erreurs.push(
                affectation.filiereCode +
                " : local " +
                codeLocal +
                " introuvable dans les ressources."
            );

            return;
        }

        if (local.disponible !== "Oui") {

            erreurs.push(
                affectation.filiereCode +
                " : local " +
                codeLocal +
                " non disponible."
            );

        }

    }
);

                  // ---------------------------------
                  // 3. Vérifier la capacité
                  // ---------------------------------

                       if (
                       affectation.capaciteTotale <
                       affectation.effectif
                          ) {

                                erreurs.push(
                                    affectation.filiereCode +
                                    " : capacité insuffisante (" +
                                    affectation.capaciteTotale +
                                    " pour " +
                                    affectation.effectif +
                                    " étudiants)."
                                );

                            }

                            // ---------------------------------
                            // 3. Vérifier le taux de 66 %
                            // ---------------------------------

                            if (
                                affectation.locaux.length === 1 &&
                                affectation.tauxOccupation <
                                0.66
                            ) {

                                erreurs.push(
                                    affectation.filiereCode +
                                    " : occupation inférieure à 66 % avec un seul local."
                                );

                            }

                        }
                    );
                   
 // =========================================
 // CONTRÔLE DES CONFLITS DE SALLES
 // =========================================

 const conflits =
     construireConflitsFilieres(
         planningAffectationCourant
     );

 const carteConflits =
     construireCarteConflits(
         conflits
     );

 for (let i = 0; i < affectations.length; i++) {

     const affectationA = affectations[i];

     const conflitsA =
         carteConflits[affectationA.filiereCode] || [];

     for (let j = i + 1; j < affectations.length; j++) {

         const affectationB = affectations[j];

         // Ignorer une filière comparée avec elle-même.
         if (
             affectationA.filiereCode ===
             affectationB.filiereCode
         ) {
             continue;
         }

         // Les filières d'un même groupe partagent
         // volontairement les mêmes locaux.
         const memeGroupe =
             Array.isArray(affectationA.groupe) &&
             Array.isArray(affectationB.groupe) &&
             affectationA.groupe.length > 0 &&
             affectationA.groupe.length ===
                 affectationB.groupe.length &&
             affectationA.groupe.every(function (code) {
                 return affectationB.groupe.includes(code);
             });

         if (memeGroupe) {
             continue;
         }

         if (
             conflitsA.includes(
                 affectationB.filiereCode
             )
         ) {

             const locauxCommuns =
                 (affectationA.locaux || []).filter(
                     function (local) {
                         return (
                             (affectationB.locaux || [])
                                 .includes(local)
                         );
                     }
                 );

             if (locauxCommuns.length > 0) {

                 erreurs.push(
                     "Conflit de salle entre " +
                     affectationA.filiereCode +
                     " et " +
                     affectationB.filiereCode +
                     " : " +
                     locauxCommuns.join(" || ")
                 );

             }
         }
     }
 }


                    
                    // =========================================
                    // AFFICHER LE RÉSULTAT
                    // =========================================

                    if (erreurs.length > 0) {

                        console.error(
                            "❌ Contrôle échoué :",
                            erreurs
                        );

                        if (statut) {

                            statut.textContent =
                                "❌ Contrôle échoué : " +
                                erreurs.length +
                                " problème(s).";

                        }

                        console.table(
                            erreurs.map(
                                function (erreur) {

                                    return {
                                        Erreur: erreur
                                    };

                                }
                            )
                        );

                        return;
                    }

                    console.log(
                        "✓ Contrôle des affectations réussi."
                    );

                    console.log(
                        "✓ Nombre de filières contrôlées :",
                        affectations.length
                    );

                    if (statut) {

                        statut.textContent =
                            "✅ Affectations contrôlées avec succès : aucune anomalie détectée.";

                    }

                } catch (erreur) {

                    console.error(
                        "❌ Erreur lors du contrôle :",
                        erreur
                    );

                    if (statut) {

                        statut.textContent =
                            "❌ " + erreur.message;

                    }

                }

            }
        );

    }
);

// =================================================
// INTERFACE ADMIN — ENREGISTRER LES AFFECTATIONS
// =================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const boutonEnregistrer =
            document.getElementById(
                "btnEnregistrerAffectations"
            );

        const statut =
            document.getElementById(
                "statutAffectationSalles"
            );

        if (!boutonEnregistrer) {

            console.warn(
                "⚠️ Bouton btnEnregistrerAffectations introuvable."
            );

            return;
        }

        boutonEnregistrer.addEventListener(
            "click",
            async function () {

                console.log(
                    "💾 Enregistrement des affectations..."
                );

                if (statut) {

                    statut.textContent =
                        "⏳ Enregistrement des affectations en cours...";

                }

                try {

                    // =========================================
                    // VÉRIFIER QU'UNE AFFECTATION EXISTE
                    // =========================================

                    if (
                        !affectationCourante ||
                        !planningAffectationCourant
                    ) {

                        throw new Error(
                            "Aucune affectation à enregistrer. Veuillez d'abord générer les affectations."
                        );

                    }

                    const affectations =
                        affectationCourante.affectations;

                    if (
                        !Array.isArray(affectations) ||
                        affectations.length === 0
                    ) {

                        throw new Error(
                            "Aucune affectation disponible."
                        );

                    }

                    // =========================================
                    // AJOUTER LES LOCAUX AU PLANNING
                    // =========================================

                    planningAffectationCourant.filieres.forEach(
                        function (filiere) {

                            const affectation =
                                affectations.find(
                                    function (item) {

                                        return (
                                            item.filiereCode ===
                                            filiere.filiereCode
                                        );

                                    }
                                );

                            if (affectation) {

                                filiere.amphis =
                                    [...affectation.locaux];

                                console.log(
                                    "✓ " +
                                    filiere.filiereCode +
                                    " → " +
                                    filiere.amphis.join(
                                        " || "
                                    )
                                );

                            }

                        }
                    );

                    // =========================================
                    // VÉRIFIER LE PLANNING AVANT ENREGISTREMENT
                    // =========================================

                    console.log(
                        "Planning à enregistrer :",
                        planningAffectationCourant
                    );

                    planningAffectationCourant.filieres.forEach(
                        function (filiere) {

                            console.log(
                                "Filière :",
                                filiere.filiereCode,
                                "| Amphis :",
                                filiere.amphis
                            );

                        }
                    );

                    // =========================================
                    // ENREGISTRER DANS FIRESTORE
                    // =========================================

                    if (
                        !window.generationExamens ||
                        typeof window.generationExamens.enregistrerCalendrier !==
                        "function"
                    ) {

                        throw new Error(
                            "La fonction enregistrerCalendrier() est introuvable."
                        );

                    }

                    const resultat =
                        await window.generationExamens.enregistrerCalendrier(
                            planningAffectationCourant
                        );

                    console.log(
                        "✓ Résultat de l'enregistrement :",
                        resultat
                    );

                    if (
                        resultat &&
                        resultat.id
                    ) {

                        console.log(
                            "✓ Calendrier enregistré dans Firestore :",
                            resultat.id
                        );

                    }

                    if (statut) {

                        statut.textContent =
                            "✅ Affectations enregistrées avec succès dans Firestore.";

                    }

                } catch (erreur) {

                    console.error(
                        "❌ Erreur lors de l'enregistrement des affectations :",
                        erreur
                    );

                    if (statut) {

                        statut.textContent =
                            "❌ " + erreur.message;

                    }

                }

            }
        );

    }
);
