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
// RECHERCHER LA MEILLEURE COMBINAISON DE LOCAUX
// =================================================

function rechercherMeilleureCombinaisonLocaux(
    filiereCode,
    effectif,
    sallesAmphis,
    carteConflits,
    affectationsFilieres
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

    // -------------------------------------------------
    // Locaux disponibles et compatibles
    // -------------------------------------------------

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

    const locauxUniques =
        locauxDisponibles
            .filter(
                function (salle) {

                    const capacite =
                        Number(
                            salle.capacite
                        );

                    return (
                        capacite >= effectif &&

                        effectif /
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
                effectif /
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
    // Supprimer les combinaisons constituées
    // d'un seul local qui ne respecte pas le seuil
    // -------------------------------------------------

    const combinaisonsValides =
        combinaisons.filter(
            function (combinaison) {

                if (
                    combinaison.locaux.length === 1
                ) {

                    return (
                        effectif /
                        combinaison.capaciteTotale >=
                        TAUX_OCCUPATION_MINIMUM
                    );

                }

                return true;

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

            // -------------------------------------------------
            // Priorité 1 :
            // moins de locaux
            // -------------------------------------------------

            if (
                a.locaux.length !==
                b.locaux.length
            ) {

                return (
                    a.locaux.length -
                    b.locaux.length
                );

            }

            // -------------------------------------------------
            // Priorité 2 :
            // capacité totale la plus proche
            // -------------------------------------------------

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
            effectif /
            meilleure.capaciteTotale,

        message:
            "Plusieurs locaux sont nécessaires."
    };

}


window.rechercherMeilleureCombinaisonLocaux =
    rechercherMeilleureCombinaisonLocaux;


// =================================================
// AFFECTER UN LOCAL FIXE À CHAQUE FILIÈRE
// =================================================

function affecterLocauxFixes(
    planning,
    sallesAmphis,
    effectifs
) {

    const resultats = [];

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
    // Construire les conflits entre filières
    // -------------------------------------------------

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

                resultats.push(
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

            const effectif =
                Number(
                    ligneEffectif.effectif
                );

            // -------------------------------------------------
            // Rechercher la meilleure affectation
            // -------------------------------------------------
            // Les locaux trouvés ici sont fixes
            // pour toute la session de cette filière.
            // -------------------------------------------------

            const resultat =
                rechercherMeilleureCombinaisonLocaux(
                    filiere.filiereCode,
                    effectif,
                    sallesAmphis,
                    carteConflits,
                    resultats
                );

            // -------------------------------------------------
            // Mémoriser l'affectation fixe
            // -------------------------------------------------

            resultats.push(
                {
                    filiereCode:
                        filiere.filiereCode,

                    effectif:
                        effectif,

                    succes:
                        resultat.succes,

                    locaux:
                        resultat.locaux,

                    capaciteTotale:
                        resultat.capaciteTotale,

                    tauxOccupation:
                        resultat.tauxOccupation,

                    message:
                        resultat.message
                }
            );

        }
    );

    // -------------------------------------------------
    // Vérifier si toutes les filières sont affectées
    // -------------------------------------------------

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

