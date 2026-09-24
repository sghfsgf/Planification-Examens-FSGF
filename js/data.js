// =====================================================
// PLANIFICATION DES EXAMENS FSGF
// DATA.JS
// Chargement et préparation des fichiers Excel
// =====================================================

let donneesExamens = {
    matieres: [],
    sessions: [],
    creneaux: []
};

let donneesRessources = {
    sallesAmphis: []
};


// =====================================================
// 1. LECTURE D'UN FICHIER EXCEL
// =====================================================

async function lireFichierExcel(url) {

    const reponse = await fetch(url);

    if (!reponse.ok) {
        throw new Error(
            `Impossible de charger le fichier Excel : ${url}`
        );
    }

    const tableau = await reponse.arrayBuffer();

    const classeur = XLSX.read(tableau, {
        type: "array"
    });

    return classeur;
}


// =====================================================
// 2. CONVERSION D'UNE FEUILLE EXCEL EN TABLEAU JS
// =====================================================

function lireFeuille(classeur, nomFeuille) {

    if (!classeur.Sheets[nomFeuille]) {
        throw new Error(
            `La feuille "${nomFeuille}" est introuvable.`
        );
    }

    return XLSX.utils.sheet_to_json(
        classeur.Sheets[nomFeuille],
        {
            defval: ""
        }
    );
}


// =====================================================
// 3. CHARGEMENT DU FICHIER PARAMETRAGE
// =====================================================

async function chargerParametrageExamens() {

    const classeur = await lireFichierExcel(
        "data/parametrage_examens.xlsx"
    );

    donneesExamens.matieres =
        lireFeuille(classeur, "matieres");

    donneesExamens.sessions =
        lireFeuille(classeur, "sessions");

    donneesExamens.creneaux =
        lireFeuille(classeur, "creneaux");

    console.log(
        "✓ parametrage_examens.xlsx chargé"
    );

    console.log(
        "Matières :",
        donneesExamens.matieres.length
    );

    console.log(
        "Sessions :",
        donneesExamens.sessions.length
    );

    console.log(
        "Créneaux :",
        donneesExamens.creneaux.length
    );
}


// =====================================================
// 4. CHARGEMENT DES SALLES ET AMPHIS
// =====================================================

async function chargerSallesAmphis() {

    const classeur = await lireFichierExcel(
        "data/salles_amphis.xlsx"
    );

    donneesRessources.sallesAmphis =
        lireFeuille(
            classeur,
            "salles_amphis"
        );

    console.log(
        "✓ salles_amphis.xlsx chargé"
    );

    console.log(
        "Salles / amphis :",
        donneesRessources.sallesAmphis.length
    );
}


// =====================================================
// 5. CHARGEMENT GLOBAL
// =====================================================

async function chargerToutesLesDonnees() {

    try {

        await chargerParametrageExamens();

        await chargerSallesAmphis();

        console.log(
            "===================================="
        );

        console.log(
            "✓ TOUTES LES DONNÉES SONT CHARGÉES"
        );

        console.log(
            "===================================="
        );

        return true;

    } catch (erreur) {

        console.error(
            "❌ Erreur de chargement des données :",
            erreur
        );

        return false;
    }
}


// =====================================================
// 6. ACCÈS AUX DONNÉES
// =====================================================

function obtenirMatieres() {
    return donneesExamens.matieres;
}

function obtenirSessions() {
    return donneesExamens.sessions;
}

function obtenirCreneaux() {
    return donneesExamens.creneaux;
}

function obtenirSallesAmphis() {
    return donneesRessources.sallesAmphis;
}


// =====================================================
// 7. INITIALISATION
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        await chargerToutesLesDonnees();

    }
);
