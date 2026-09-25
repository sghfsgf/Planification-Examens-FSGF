// =====================================================
// GENERATION.JS
// Planification des examens - FSGF
// =====================================================
// Rôle de cette première version :
// 1. Lire les données depuis Firestore
// 2. Vérifier les données nécessaires
// 3. Regrouper les matières par niveau
// 4. Regrouper ensuite par filière
// 5. Afficher la structure préparée dans la console
//
// IMPORTANT :
// Cette version ne génère pas encore les examens.
// Les règles de planification seront ajoutées
// progressivement dans les prochaines étapes.
// =====================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";


// =====================================================
// FIRESTORE
// =====================================================

const db = getFirestore(app);


// =====================================================
// DONNÉES DU MOTEUR DE GÉNÉRATION
// =====================================================

let donneesGeneration = {
    matieres: [],
    sessions: [],
    creneaux: [],
    sallesAmphis: []
};


// =====================================================
// ÉTAT DU MOTEUR
// =====================================================

let generationChargee = false;


// =====================================================
// CHARGER UNE COLLECTION FIRESTORE
// =====================================================

async function chargerCollection(nomCollection) {

    const snapshot = await getDocs(
        collection(db, nomCollection)
    );

    const donnees = [];

    snapshot.forEach(function (document) {

        donnees.push({
            id: document.id,
            ...document.data()
        });

    });

    return donnees;
}


// =====================================================
// CHARGER TOUTES LES DONNÉES
// =====================================================

async function chargerDonneesGeneration() {

    console.log("==========================================");
    console.log("GÉNÉRATION - CHARGEMENT DES DONNÉES");
    console.log("==========================================");

    try {

        console.log("→ Chargement des matières...");

        donneesGeneration.matieres =
            await chargerCollection("matieres");

        console.log(
            "✓ Matières :",
            donneesGeneration.matieres.length
        );


        console.log("→ Chargement des sessions...");

        donneesGeneration.sessions =
            await chargerCollection("sessions");

        console.log(
            "✓ Sessions :",
            donneesGeneration.sessions.length
        );


        console.log("→ Chargement des créneaux...");

        donneesGeneration.creneaux =
            await chargerCollection("creneaux");

        console.log(
            "✓ Créneaux :",
            donneesGeneration.creneaux.length
        );


        console.log("→ Chargement des salles / amphis...");

        donneesGeneration.sallesAmphis =
            await chargerCollection("salles_amphis");

        console.log(
            "✓ Salles / amphis :",
            donneesGeneration.sallesAmphis.length
        );


        generationChargee = true;


        console.log("------------------------------------------");
        console.log("✓ DONNÉES DE GÉNÉRATION CHARGÉES");
        console.log("------------------------------------------");


        return true;

    } catch (erreur) {

        console.error(
            "❌ Erreur lors du chargement des données :",
            erreur
        );

        generationChargee = false;

        return false;
    }
}


// =====================================================
// VÉRIFIER LES DONNÉES
// =====================================================

function verifierDonneesGeneration() {

    console.log("==========================================");
    console.log("VÉRIFICATION DES DONNÉES");
    console.log("==========================================");


    if (donneesGeneration.matieres.length === 0) {

        console.error(
            "❌ Aucune matière disponible."
        );

        return false;
    }


    if (donneesGeneration.sessions.length === 0) {

        console.error(
            "❌ Aucune session disponible."
        );

        return false;
    }


    if (donneesGeneration.creneaux.length === 0) {

        console.error(
            "❌ Aucun créneau disponible."
        );

        return false;
    }


    if (donneesGeneration.sallesAmphis.length === 0) {

        console.error(
            "❌ Aucune salle / amphi disponible."
        );

        return false;
    }


    console.log("✓ Matières disponibles");
    console.log("✓ Sessions disponibles");
    console.log("✓ Créneaux disponibles");
    console.log("✓ Salles / amphis disponibles");

    console.log("------------------------------------------");
    console.log("✓ VÉRIFICATION TERMINÉE");
    console.log("------------------------------------------");


    return true;
}


// =====================================================
// OBTENIR LES NIVEAUX
// =====================================================

function obtenirNiveaux() {

    const niveaux = [];


    donneesGeneration.matieres.forEach(function (matiere) {

        const niveau = matiere.niveauCode;

        if (!niveau) {
            return;
        }


        if (!niveaux.includes(niveau)) {

            niveaux.push(niveau);
        }

    });


    niveaux.sort();


    return niveaux;
}


// =====================================================
// OBTENIR LES FILIÈRES D'UN NIVEAU
// =====================================================

function obtenirFilieresDuNiveau(niveauCode) {

    const filieres = [];


    donneesGeneration.matieres.forEach(function (matiere) {

        if (matiere.niveauCode !== niveauCode) {
            return;
        }


        const filiere = matiere.filiereCode;

        if (!filiere) {
            return;
        }


        if (!filieres.includes(filiere)) {

            filieres.push(filiere);
        }

    });


    filieres.sort();


    return filieres;
}


// =====================================================
// OBTENIR LES MATIÈRES D'UNE FILIÈRE
// =====================================================

function obtenirMatieresDeFiliere(
    niveauCode,
    filiereCode
) {

    return donneesGeneration.matieres.filter(
        function (matiere) {

            return (
                matiere.niveauCode === niveauCode &&
                matiere.filiereCode === filiereCode
            );

        }
    );
}


// =====================================================
// CONSTRUIRE LA STRUCTURE DU NIVEAU
// =====================================================

function construireStructureNiveau(niveauCode) {

    const structure = {

        niveauCode: niveauCode,

        filieres: []

    };


    const filieres =
        obtenirFilieresDuNiveau(niveauCode);


    filieres.forEach(function (filiereCode) {

        const matieres =
            obtenirMatieresDeFiliere(
                niveauCode,
                filiereCode
            );


        structure.filieres.push({

            filiereCode: filiereCode,

            matieres: matieres

        });

    });


    return structure;
}


// =====================================================
// CONSTRUIRE TOUTE LA STRUCTURE
// =====================================================

function construireStructureGeneration() {

    console.log("==========================================");
    console.log("STRUCTURE DE PLANIFICATION");
    console.log("==========================================");


    const niveaux = obtenirNiveaux();


    console.log(
        "Niveaux détectés :",
        niveaux
    );


    const structure = [];


    niveaux.forEach(function (niveauCode) {

        const niveau =
            construireStructureNiveau(
                niveauCode
            );


        structure.push(niveau);


        console.log("------------------------------------------");

        console.log(
            "Niveau :",
            niveauCode
        );

        console.log(
            "Filières :",
            niveau.filieres.map(
                function (filiere) {
                    return filiere.filiereCode;
                }
            )
        );


        niveau.filieres.forEach(
            function (filiere) {

                console.log(
                    "  Filière :",
                    filiere.filiereCode
                );

                console.log(
                    "  Matières :",
                    filiere.matieres.map(
                        function (matiere) {
                            return matiere.matiereLibelle;
                        }
                    )
                );

            }
        );

    });


    console.log("------------------------------------------");
    console.log("✓ STRUCTURE CONSTRUITE");
    console.log("------------------------------------------");


    return structure;
}


// =====================================================
// PRÉPARER LE MOTEUR
// =====================================================

async function preparerGeneration() {

    console.log("");
    console.log("==========================================");
    console.log("MOTEUR DE GÉNÉRATION DES EXAMENS");
    console.log("==========================================");


    const chargement =
        await chargerDonneesGeneration();


    if (!chargement) {

        console.error(
            "❌ Impossible de préparer la génération."
        );

        return null;
    }


    const verification =
        verifierDonneesGeneration();


    if (!verification) {

        console.error(
            "❌ Les données ne sont pas suffisantes."
        );

        return null;
    }


    const structure =
        construireStructureGeneration();


    console.log("");
    console.log("✓ MOTEUR PRÊT");
    console.log("==========================================");


    return structure;
}


// =====================================================
// EXPOSER LES FONCTIONS POUR LES AUTRES MODULES
// =====================================================

window.generationExamens = {

    chargerDonnees:
        chargerDonneesGeneration,

    verifierDonnees:
        verifierDonneesGeneration,

    obtenirNiveaux:
        obtenirNiveaux,

    obtenirFilieres:
        obtenirFilieresDuNiveau,

    obtenirMatieres:
        obtenirMatieresDeFiliere,

    construireStructure:
        construireStructureGeneration,

    preparer:
        preparerGeneration

};


// =====================================================
// INITIALISATION
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "✓ generation.js chargé."
        );

        await preparerGeneration();

    }
);
