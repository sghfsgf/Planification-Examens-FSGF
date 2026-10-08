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
