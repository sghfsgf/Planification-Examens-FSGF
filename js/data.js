// =====================================================
// PLANIFICATION DES EXAMENS FSGF
// DATA.JS
// Chargement et préparation des fichiers Excel
// Compatible SITE PUBLIC + ADMIN
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
// 1. DÉTERMINER LE CHEMIN DU DOSSIER DATA
// =====================================================

function obtenirCheminData() {

    /*
       SITE PUBLIC
       /Planification-Examens-FSGF/
       → data/

       ADMIN
       /Planification-Examens-FSGF/admin/
       → ../data/
    */

    const cheminActuel =
        window.location.pathname;


    if (
        cheminActuel.includes("/admin/")
    ) {

        return "../data/";

    }


    return "data/";

}


// =====================================================
// 2. LECTURE D'UN FICHIER EXCEL
// =====================================================

async function lireFichierExcel(url) {

    const reponse =
        await fetch(url);


    if (!reponse.ok) {

        throw new Error(
            `Impossible de charger le fichier Excel : ${url}`
        );

    }


    const tableau =
        await reponse.arrayBuffer();


    const classeur =
        XLSX.read(
            tableau,
            {
                type: "array"
            }
        );


    return classeur;

}


// =====================================================
// 3. CONVERSION D'UNE FEUILLE EXCEL EN TABLEAU JS
// =====================================================

function lireFeuille(
    classeur,
    nomFeuille
) {

    if (
        !classeur.Sheets[nomFeuille]
    ) {

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
// 4. CHARGEMENT DU FICHIER PARAMÉTRAGE
// =====================================================

async function chargerParametrageExamens() {

    const cheminData =
        obtenirCheminData();


    const classeur =
        await lireFichierExcel(

            cheminData +
            "parametrage_examens.xlsx"

        );


    donneesExamens.matieres =
        lireFeuille(
            classeur,
            "matieres"
        );


    donneesExamens.sessions =
        lireFeuille(
            classeur,
            "sessions"
        );


    donneesExamens.creneaux =
        lireFeuille(
            classeur,
            "creneaux"
        );


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
// 5. CHARGEMENT DES SALLES ET AMPHIS
// =====================================================

async function chargerSallesAmphis() {

    const cheminData =
        obtenirCheminData();


    const classeur =
        await lireFichierExcel(

            cheminData +
            "salles_amphis.xlsx"

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
// 6. CHARGEMENT GLOBAL
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

    }


    catch (erreur) {

        console.error(
            "❌ Erreur de chargement des données :",
            erreur
        );


        return false;

    }

}


// =====================================================
// 7. ACCÈS AUX DONNÉES
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
// 8. INITIALISATION
// =====================================================

document.addEventListener(

    "DOMContentLoaded",

    async function () {

        await chargerToutesLesDonnees();

    }

);
