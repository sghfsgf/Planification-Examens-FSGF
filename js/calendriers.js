// =====================================================
// CALENDRIERS.JS
// Construction et affichage des calendriers
// =====================================================

// =====================================================
// CALENDRIERS.JS
// Construction et affichage des calendriers
// =====================================================

import { getFirestore } from
    "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import { app } from
    "../firebase-config.js";


const db = getFirestore(app);

// =====================================================
// LECTURE DU DERNIER CALENDRIER PUBLIÉ DANS FIRESTORE
// =====================================================

async function chargerCalendrierFirestore(
    anneeUniversitaire,
    niveauCode,
    semestreCode,
    regimeCode,
    sessionCode
) {
    try {
        const { collection, getDocs } =
            await import(
                "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js"
            );

        const snapshot = await getDocs(
            collection(db, "calendriers")
        );
console.log(
    "📦 Nombre total de calendriers Firestore :",
    snapshot.size
);

snapshot.forEach((doc) => {

    const data = doc.data();

    console.log(
        "📄 Calendrier :",
        doc.id,
        {
            anneeUniversitaire: data.anneeUniversitaire,
            niveauCode: data.niveauCode,
            semestreCode: data.semestreCode,
            regimeCode: data.regimeCode,
            sessionCode: data.sessionCode,
            statut: data.statut
        }
    );

});
        const calendriers = [];

        snapshot.forEach((doc) => {
            const data = doc.data();

            if (
                data.anneeUniversitaire === anneeUniversitaire &&
                data.niveauCode === niveauCode &&
                data.semestreCode === semestreCode &&
                data.regimeCode === regimeCode &&
                data.sessionCode === sessionCode &&
                data.statut === "publie"
            ) {
                calendriers.push({
                    id: doc.id,
                    ...data
                });
            }
        });

        if (calendriers.length === 0) {
            console.log(
                "ℹ️ Aucun calendrier publié trouvé dans Firestore."
            );
            return null;
        }

        // Dernière version selon modifieLe
        calendriers.sort((a, b) => {
            const dateA = a.modifieLe?.toMillis
                ? a.modifieLe.toMillis()
                : 0;

            const dateB = b.modifieLe?.toMillis
                ? b.modifieLe.toMillis()
                : 0;

            return dateB - dateA;
        });

        const calendrier = calendriers[0];

        console.log(
            "✓ Calendrier publié trouvé dans Firestore :",
            calendrier.id
        );

        console.log(
            "📅 Planning Firestore :",
            calendrier.planning
        );

        return calendrier;

    } catch (erreur) {
        console.error(
            "❌ Erreur lecture Firestore :",
            erreur
        );

        return null;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const tableau =
        document.getElementById("tableauCalendrier");

    const niveauCalendrier =
        document.getElementById("niveauCalendrier");

    const selectSemestre =
        document.getElementById("selectSemestre");

    const selectRegime =
        document.getElementById("selectRegime");

    const selectSession =
        document.getElementById("selectSession");

 
// =================================================
// CONSTRUIRE LE CALENDRIER
// =================================================

async function construireCalendrier() {

    console.log("====================================");
    console.log("AFFICHAGE DU CALENDRIER FIRESTORE");
    console.log("====================================");

    // -------------------------------------------------
    // Vérification du tableau
    // -------------------------------------------------

    if (!tableau) {

        console.error(
            "Calendrier : tableauCalendrier introuvable."
        );

        return;
    }

    // -------------------------------------------------
    // Nettoyage du tableau
    // -------------------------------------------------

    const thead =
        tableau.querySelector("thead");

    const tbody =
        tableau.querySelector("tbody");

    thead.innerHTML = "";
    tbody.innerHTML = "";

    // -------------------------------------------------
    // Récupération des paramètres sélectionnés
    // -------------------------------------------------

    const niveau =
        niveauCalendrier
            ? niveauCalendrier.textContent.trim()
            : "";

    const semestre =
        selectSemestre
            ? selectSemestre.value
            : "";

    const regime =
        selectRegime
            ? selectRegime.value
            : "";

    const sessionCode =
        selectSession
            ? selectSession.value
            : "";

    console.log("Niveau :", niveau);
    console.log("Semestre :", semestre);
    console.log("Régime :", regime);
    console.log("Session :", sessionCode);

    // -------------------------------------------------
    // Vérification des filtres
    // -------------------------------------------------

    if (
        !niveau ||
        !semestre ||
        !regime ||
        !sessionCode
    ) {

        console.warn(
            "⚠️ Tous les filtres ne sont pas sélectionnés."
        );

        return;
    }

    // -------------------------------------------------
    // Année universitaire
    // -------------------------------------------------

    const anneeUniversitaire =
        "2025-2026";

    // -------------------------------------------------
    // LECTURE DU CALENDRIER PUBLIÉ DANS FIRESTORE
    // -------------------------------------------------

    const calendrierFirestore =
        await chargerCalendrierFirestore(
            anneeUniversitaire,
            niveau,
            semestre,
            regime,
            sessionCode
        );

    console.log(
        "📦 Calendrier Firestore :",
        calendrierFirestore
    );

    // -------------------------------------------------
    // Aucun calendrier publié
    // -------------------------------------------------

    if (!calendrierFirestore) {

        const ligne =
            document.createElement("tr");

        const cellule =
            document.createElement("td");

        cellule.colSpan = 2;

        cellule.textContent =
            "Aucun calendrier publié pour cette sélection.";

        ligne.appendChild(cellule);

        tbody.appendChild(ligne);

        return;
    }

    // -------------------------------------------------
    // Récupération du planning déjà préparé
    // par l'Admin
    // -------------------------------------------------

    const planning =
        calendrierFirestore.planning;

    if (
        !planning ||
        !Array.isArray(planning.filieres)
    ) {

        console.error(
            "❌ Le calendrier Firestore ne contient pas de planning exploitable."
        );

        return;
    }

    console.log(
        "✓ Planning récupéré depuis Firestore."
    );

    console.log(
        "📊 Filières du planning :",
        planning.filieres
    );

    // =================================================
    // CONSTRUCTION DES COLONNES À PARTIR DES CELLULES
    // FIRESTORE
    // =================================================

    const colonnesMap =
        new Map();

    planning.filieres.forEach(
        function (filiere) {

            const cellules =
                Array.isArray(filiere.cellules)
                    ? filiere.cellules
                    : [];

            cellules.forEach(
                function (cellule) {

                    const creneauOrdre =
                        Number(
                            cellule.creneauOrdre
                        );

                    let dateCle = "";

                    if (
                        cellule.date &&
                        typeof cellule.date.toDate === "function"
                    ) {

                        const date =
                            cellule.date.toDate();

                        dateCle =
                            date.toISOString()
                                .substring(0, 10);

                    }
                    else if (
                        cellule.dateAffichage
                    ) {

                        dateCle =
                            cellule.dateAffichage;
                    }

                    const cle =
                        dateCle +
                        "_" +
                        creneauOrdre;

                    if (!colonnesMap.has(cle)) {

                        colonnesMap.set(
                            cle,
                            {
                                cle: cle,
                                date: cellule.date,
                                dateAffichage:
                                    cellule.dateAffichage || dateCle,
                                creneauOrdre:
                                    creneauOrdre,
                                heureDebutAffichage:
                                    cellule.heureDebutAffichage || "",
                                heureFinAffichage:
                                    cellule.heureFinAffichage || ""
                            }
                        );

                    }

                }
            );

        }
    );

    // -------------------------------------------------
    // Tri des colonnes
    // -------------------------------------------------

    const colonnes =
        Array.from(
            colonnesMap.values()
        );

    colonnes.sort(
        function (a, b) {

            if (
                a.date &&
                typeof a.date.toDate === "function" &&
                b.date &&
                typeof b.date.toDate === "function"
            ) {

                const dateA =
                    a.date.toDate().getTime();

                const dateB =
                    b.date.toDate().getTime();

                if (dateA !== dateB) {
                    return dateA - dateB;
                }

            }

            return (
                a.creneauOrdre -
                b.creneauOrdre
            );

        }
    );

    console.log(
        "📅 Colonnes du calendrier Firestore :",
        colonnes
    );

    // =================================================
    // EN-TÊTE : FILIÈRE + AMPHIS + DATES
    // =================================================

    const ligneDates =
        document.createElement("tr");

    const thFiliere =
        document.createElement("th");

    thFiliere.textContent =
        "FILIÈRE";

    thFiliere.rowSpan = 2;

    ligneDates.appendChild(
        thFiliere
    );

    const thAmphis =
        document.createElement("th");

    thAmphis.textContent =
        "AMPHIS";

    thAmphis.rowSpan = 2;

    ligneDates.appendChild(
        thAmphis
    );

    // -------------------------------------------------
    // Regroupement des colonnes par date
    // -------------------------------------------------

    let indexColonne = 0;

    while (
        indexColonne < colonnes.length
    ) {

        const colonne =
            colonnes[indexColonne];

        const dateCle =
            colonne.date &&
            typeof colonne.date.toDate === "function"
                ? colonne.date.toDate()
                    .toISOString()
                    .substring(0, 10)
                : colonne.dateAffichage;

        let nombreCreneaux = 1;

        let j =
            indexColonne + 1;

        while (
            j < colonnes.length
        ) {

            const autre =
                colonnes[j];

            const autreDateCle =
                autre.date &&
                typeof autre.date.toDate === "function"
                    ? autre.date.toDate()
                        .toISOString()
                        .substring(0, 10)
                    : autre.dateAffichage;

            if (
                autreDateCle !==
                dateCle
            ) {

                break;
            }

            nombreCreneaux++;
            j++;

        }

        const thDate =
            document.createElement("th");

        thDate.textContent =
            colonne.dateAffichage ||
            dateCle;

        thDate.colSpan =
            nombreCreneaux;

        ligneDates.appendChild(
            thDate
        );

        indexColonne = j;

    }

    thead.appendChild(
        ligneDates
    );

    // =================================================
    // LIGNE DES HORAIRES
    // =================================================

    const ligneCreneaux =
        document.createElement("tr");

    colonnes.forEach(
        function (colonne) {

            const th =
                document.createElement("th");

            const heureDebut =
                colonne.heureDebutAffichage;

            const heureFin =
                colonne.heureFinAffichage;

            if (
                heureDebut ||
                heureFin
            ) {

                th.textContent =
                    heureDebut +
                    "–" +
                    heureFin;

            }
            else {

                th.textContent =
                    "Créneau " +
                    colonne.creneauOrdre;

            }

            ligneCreneaux.appendChild(
                th
            );

        }
    );

    thead.appendChild(
        ligneCreneaux
    );

    // =================================================
    // LIGNES DES FILIÈRES
    // =================================================

    planning.filieres.forEach(
        function (filiere) {

            const ligne =
                document.createElement("tr");

            // -------------------------------------------------
            // FILIÈRE
            // -------------------------------------------------

            const celluleFiliere =
                document.createElement("td");

            celluleFiliere.textContent =
                filiere.filiereCode || "";

            ligne.appendChild(
                celluleFiliere
            );

            // -------------------------------------------------
            // AMPHIS
            // -------------------------------------------------

            const celluleAmphis =
                document.createElement("td");

            if (
                Array.isArray(filiere.amphis)
            ) {

                celluleAmphis.textContent =
                    filiere.amphis.join(", ");

            }
            else {

                celluleAmphis.textContent =
                    filiere.amphis || "";

            }

            ligne.appendChild(
                celluleAmphis
            );

            // -------------------------------------------------
            // CELLULES DU PLANNING
            // -------------------------------------------------

            const cellules =
                Array.isArray(filiere.cellules)
                    ? filiere.cellules
                    : [];

            colonnes.forEach(
                function (colonne) {

                    const celluleHTML =
                        document.createElement("td");

                    // Recherche de la cellule Firestore
                    const celluleFirestore =
                        cellules.find(
                            function (cellule) {

                                return (
                                    Number(
                                        cellule.creneauOrdre
                                    ) ===
                                    colonne.creneauOrdre
                                    &&
                                    (
                                        (
                                            cellule.date &&
                                            typeof cellule.date.toDate ===
                                            "function"
                                            &&
                                            cellule.date
                                                .toDate()
                                                .toISOString()
                                                .substring(0, 10)
                                                ===
                                            (
                                                colonne.date &&
                                                typeof colonne.date.toDate ===
                                                "function"
                                                    ? colonne.date
                                                        .toDate()
                                                        .toISOString()
                                                        .substring(0, 10)
                                                    : colonne.dateAffichage
                                            )
                                        )
                                        ||
                                        (
                                            !cellule.date &&
                                            cellule.dateAffichage ===
                                            colonne.dateAffichage
                                        )
                                    )
                                );

                            }
                        );

                    // -------------------------------------------------
                    // Affichage de la matière déjà enregistrée
                    // -------------------------------------------------

                    if (
                        celluleFirestore &&
                        celluleFirestore.matiereLibelle
                    ) {

                        celluleHTML.textContent =
                            celluleFirestore.matiereLibelle;

                    }
                    else {

                        celluleHTML.textContent =
                            "—";

                    }

                    ligne.appendChild(
                        celluleHTML
                    );

                }
            );

            tbody.appendChild(
                ligne
            );

        }
    );

    console.log(
        "✅ Calendrier publié affiché depuis Firestore."
    );

}



    // =====================================================
    // FORMATAGE D'UNE DATE JAVASCRIPT
    // =====================================================

    function formaterDateDepuisObjet(date) {

        const jour =
            String(
                date.getDate()
            ).padStart(2, "0");


        const mois =
            String(
                date.getMonth() + 1
            ).padStart(2, "0");


        const annee =
            date.getFullYear();


        return (
            jour +
            "/" +
            mois +
            "/" +
            annee
        );

    }


    // =====================================================
    // MISE À JOUR DES SESSIONS
    // =====================================================

    function mettreAJourSessions() {

        if (
            !selectSemestre ||
            !selectRegime ||
            !selectSession
        ) {

            return;
        }


        if (
            typeof donneesExamens === "undefined" ||
            !donneesExamens
        ) {

            return;
        }


        const semestre =
            selectSemestre.value;

        const regime =
            selectRegime.value;

        const sessions =
            donneesExamens.sessions || [];


        // -------------------------------------------------
        // Sessions correspondant au semestre + régime
        // -------------------------------------------------

        const sessionsDisponibles =
            sessions.filter(
                function (session) {

                    return (
                        session.semestreCode ===
                        semestre &&

                        session.regimeCode ===
                        regime
                    );

                }
            );


        console.log(
            "Sessions disponibles :",
            sessionsDisponibles
        );


        // -------------------------------------------------
        // Reconstruction de la liste
        // -------------------------------------------------

        selectSession.innerHTML = "";


        sessionsDisponibles.forEach(
            function (session) {

                const option =
                    document.createElement("option");


                option.value =
                    session.sessionCode;


                option.textContent =
                    session.sessionLibelle;


                selectSession.appendChild(
                    option
                );

            }
        );


        // -------------------------------------------------
        // Reconstruction du calendrier
        // -------------------------------------------------

        construireCalendrier();

    }


    // =====================================================
    // ÉVÉNEMENTS DES FILTRES
    // =====================================================

    if (selectSemestre) {

        selectSemestre.addEventListener(
            "change",
            function () {

                mettreAJourSessions();

            }
        );

    }


    if (selectRegime) {

        selectRegime.addEventListener(
            "change",
            function () {

                mettreAJourSessions();

            }
        );

    }


    if (selectSession) {

        selectSession.addEventListener(
            "change",
            function () {

                construireCalendrier();

            }
        );

    }


    // =====================================================
    // ATTENDRE LE CHARGEMENT DES DONNÉES
    // =====================================================

    if (
        typeof donneesChargees !== "undefined" &&
        donneesChargees
    ) {

        donneesChargees.then(
            function () {

                console.log(
                    "Calendriers : données reçues."
                );


                // Initialiser la liste des sessions

                mettreAJourSessions();

            }
        );

    } else {

        console.warn(
            "Calendriers : donneesChargees introuvable."
        );

    }


    // =====================================================
    // EXPOSITION POUR LES AUTRES FICHIERS
    // =====================================================

    window.construireCalendrier =
        construireCalendrier;

});
