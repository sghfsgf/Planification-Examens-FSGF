
// =====================================================
// PLANIFICATION DES EXAMENS FSGF
// DATA.JS
// Chargement et préparation des fichiers Excel
// Compatible SITE PUBLIC + ADMIN
// =====================================================


// =====================================================
// 1. DONNÉES GLOBALES
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
// 2. ÉTAT DU CHARGEMENT
// =====================================================

let chargementTermine = false;

let chargementReussi = false;


// Promesse permettant aux autres fichiers JS
// d'attendre que les fichiers Excel soient chargés.

let resolveDonneesChargees;

const donneesChargees =
    new Promise(function (resolve) {

        resolveDonneesChargees = resolve;

    });


// =====================================================
// 3. DÉTERMINER LE CHEMIN DU DOSSIER DATA
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
// 4. LECTURE D'UN FICHIER EXCEL
// =====================================================

async function lireFichierExcel(url) {

    const reponse =
        await fetch(url);


    if (!reponse.ok) {

        throw new Error(
            `Impossible de charger le fichier Excel : ${url} ` +
            `(HTTP ${reponse.status})`
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
// 5. CONVERSION D'UNE FEUILLE EXCEL
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


    const donnees =
        XLSX.utils.sheet_to_json(

            classeur.Sheets[nomFeuille],

            {
                defval: ""
            }

        );


    // -------------------------------------------------
    // Diagnostic de la structure de la feuille
    // -------------------------------------------------

    console.log(
        `Feuille "${nomFeuille}" :`,
        donnees.length,
        "ligne(s)"
    );


    if (donnees.length > 0) {

        console.log(
            `Colonnes "${nomFeuille}" :`,
            Object.keys(donnees[0])
        );


        console.log(
            `Premier enregistrement "${nomFeuille}" :`,
            donnees[0]
        );

    }

    else {

        console.warn(
            `⚠ La feuille "${nomFeuille}" est vide.`
        );

    }


    return donnees;

}


// =====================================================
// 6. CHARGEMENT DU FICHIER PARAMÉTRAGE
// =====================================================

async function chargerParametrageExamens() {

    const cheminData =
        obtenirCheminData();


    const url =
        cheminData +
        "parametrage_examens.xlsx";


    console.log(
        "Chargement :",
        url
    );


    const classeur =
        await lireFichierExcel(url);


    // -------------------------------------------------
    // Matières
    // -------------------------------------------------

    donneesExamens.matieres =
        lireFeuille(

            classeur,

            "matieres"

        );


    // -------------------------------------------------
    // Sessions
    // -------------------------------------------------

    donneesExamens.sessions =
        lireFeuille(

            classeur,

            "sessions"

        );


    // -------------------------------------------------
    // Créneaux
    // -------------------------------------------------

    donneesExamens.creneaux =
        lireFeuille(

            classeur,

            "creneaux"

        );


    // -------------------------------------------------
    // Résumé
    // -------------------------------------------------

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
// 7. CHARGEMENT DES SALLES ET AMPHIS
// =====================================================

async function chargerSallesAmphis() {

    const cheminData =
        obtenirCheminData();


    const url =
        cheminData +
        "salles_amphis.xlsx";


    console.log(
        "Chargement :",
        url
    );


    const classeur =
        await lireFichierExcel(url);


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
// 8. CHARGEMENT GLOBAL
// =====================================================

async function chargerToutesLesDonnees() {

    try {

        chargementTermine = false;

        chargementReussi = false;


        // ---------------------------------------------
        // Paramétrage des examens
        // ---------------------------------------------

        await chargerParametrageExamens();


        // ---------------------------------------------
        // Salles / amphis
        // ---------------------------------------------

        await chargerSallesAmphis();


        // ---------------------------------------------
        // Confirmation
        // ---------------------------------------------

        chargementTermine = true;

        chargementReussi = true;


        console.log(
            "===================================="
        );


        console.log(
            "✓ TOUTES LES DONNÉES SONT CHARGÉES"
        );


        console.log(
            "===================================="
        );


        // Résoudre la promesse
        resolveDonneesChargees(true);


        return true;

    }


    catch (erreur) {

        chargementTermine = true;

        chargementReussi = false;


        console.error(
            "===================================="
        );


        console.error(
            "❌ ERREUR DE CHARGEMENT DES DONNÉES"
        );


        console.error(
            erreur
        );


        console.error(
            "===================================="
        );


        // Résoudre quand même la promesse
        // pour éviter qu'un autre script
        // reste bloqué indéfiniment.

        resolveDonneesChargees(false);


        return false;

    }

}


// =====================================================
// 9. ACCÈS AUX DONNÉES
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
// 10. ÉTAT DU CHARGEMENT
// =====================================================

function donneesSontChargees() {

    return chargementTermine;

}


function donneesSontDisponibles() {

    return (
        chargementTermine &&
        chargementReussi
    );

}


// =====================================================
// 11. INITIALISATION
// =====================================================

document.addEventListener(

    "DOMContentLoaded",

    async function () {

        await chargerToutesLesDonnees();

    }

);

