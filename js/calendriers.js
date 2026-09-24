// =====================================================
// CALENDRIERS.JS
// Construction et affichage des calendriers
// =====================================================

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

    function construireCalendrier() {

        console.log("====================================");
        console.log("CONSTRUCTION DU CALENDRIER");
        console.log("====================================");


        // -------------------------------------------------
        // Vérification des éléments HTML
        // -------------------------------------------------

        if (!tableau) {

            console.error(
                "Calendrier : tableauCalendrier introuvable."
            );

            return;
        }


        if (!niveauCalendrier) {

            console.error(
                "Calendrier : niveauCalendrier introuvable."
            );

            return;
        }


        // -------------------------------------------------
        // Récupération des données chargées par data.js
        // -------------------------------------------------

        if (
            typeof donneesExamens === "undefined" ||
            !donneesExamens
        ) {

            console.error(
                "Calendrier : donneesExamens introuvable."
            );

            return;
        }


        const matieres =
            donneesExamens.matieres || [];

        const sessions =
            donneesExamens.sessions || [];

        const creneaux =
            donneesExamens.creneaux || [];

        const sallesAmphis =
            donneesExamens.sallesAmphis || [];


        console.log(
            "Matières :",
            matieres
        );

        console.log(
            "Sessions :",
            sessions
        );

        console.log(
            "Créneaux :",
            creneaux
        );

        console.log(
            "Salles / amphis :",
            sallesAmphis
        );


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
        // Niveau actuellement affiché
        // -------------------------------------------------

        const niveau =
            niveauCalendrier.textContent.trim();


        // -------------------------------------------------
        // Paramètres sélectionnés
        // -------------------------------------------------

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


        console.log(
            "Niveau :",
            niveau
        );

        console.log(
            "Semestre :",
            semestre
        );

        console.log(
            "Régime :",
            regime
        );

        console.log(
            "Session sélectionnée :",
            sessionCode
        );


        // -------------------------------------------------
        // Vérification des données
        // -------------------------------------------------

        if (matieres.length === 0) {

            console.warn(
                "Calendrier : aucune matière disponible."
            );

        }


        if (sessions.length === 0) {

            console.warn(
                "Calendrier : aucune session disponible."
            );

            return;
        }


        if (creneaux.length === 0) {

            console.warn(
                "Calendrier : aucun créneau disponible."
            );

            return;
        }


        // =================================================
        // SESSION SÉLECTIONNÉE
        // =================================================

        const sessionSelectionnee =
            sessions.find(function (session) {

                return (
                    session.sessionCode ===
                    sessionCode
                );

            });


        if (!sessionSelectionnee) {

            console.warn(
                "Calendrier : session introuvable :",
                sessionCode
            );

            return;
        }


        // -------------------------------------------------
        // Vérification semestre / régime
        // -------------------------------------------------

        if (
            sessionSelectionnee.semestreCode !==
            semestre
        ) {

            console.warn(
                "Calendrier : la session ne correspond pas au semestre sélectionné."
            );

            return;
        }


        if (
            sessionSelectionnee.regimeCode !==
            regime
        ) {

            console.warn(
                "Calendrier : la session ne correspond pas au régime sélectionné."
            );

            return;
        }


        console.log(
            "Session trouvée :",
            sessionSelectionnee
        );


        // =================================================
        // CRÉNEAUX DE LA SESSION
        // =================================================

        const creneauxSession =
            creneaux
                .filter(function (creneau) {

                    return (
                        creneau.sessionCode ===
                        sessionCode
                    );

                })
                .sort(function (a, b) {

                    return (
                        Number(a.creneauOrdre) -
                        Number(b.creneauOrdre)
                    );

                });


        console.log(
            "Créneaux de la session",
            sessionCode,
            ":",
            creneauxSession
        );


        if (creneauxSession.length === 0) {

            console.warn(
                "Calendrier : aucun créneau pour la session sélectionnée."
            );

            return;
        }


        // =================================================
        // MATIÈRES DU NIVEAU
        // =================================================

        const matieresNiveau =
            matieres.filter(function (matiere) {

                return (
                    matiere.niveauCode ===
                    niveau
                );

            });


        console.log(
            "Matières du niveau",
            niveau,
            ":",
            matieresNiveau
        );


        // =================================================
        // FILIÈRES DU NIVEAU
        // =================================================

        const filieres =
            [
                ...new Set(

                    matieresNiveau
                        .filter(function (matiere) {

                            return (
                                matiere.semestreCode ===
                                semestre
                            );

                        })
                        .filter(function (matiere) {

                            return (
                                matiere.regimeCode ===
                                regime
                            );

                        })
                        .map(function (matiere) {

                            return matiere.filiereCode;

                        })
                        .filter(Boolean)

                )
            ];


        console.log(
            "Filières du niveau",
            niveau,
            ":",
            filieres
        );


        // =================================================
        // EN-TÊTE DU CALENDRIER
        // =================================================

        const ligneEntete =
            document.createElement("tr");


        // -------------------------------------------------
        // Colonne FILIÈRE
        // -------------------------------------------------

        const thFiliere =
            document.createElement("th");

        thFiliere.textContent =
            "FILIÈRE";

        ligneEntete.appendChild(
            thFiliere
        );


        // -------------------------------------------------
        // Colonne AMPHIS
        // -------------------------------------------------

        const thAmphis =
            document.createElement("th");

        thAmphis.textContent =
            "AMPHIS";

        ligneEntete.appendChild(
            thAmphis
        );


        // -------------------------------------------------
        // Colonnes des créneaux
        // -------------------------------------------------

        creneauxSession.forEach(
            function (creneau) {

                const th =
                    document.createElement("th");


                const heureDebut =
                    creneau.heureDebutAffichage ||
                    convertirHeureExcel(
                        creneau.heureDebut
                    );


                const heureFin =
                    creneau.heureFinAffichage ||
                    convertirHeureExcel(
                        creneau.heureFin
                    );


                th.innerHTML =
                    "Créneau " +
                    creneau.creneauOrdre +
                    "<br>" +
                    heureDebut +
                    " – " +
                    heureFin;


                ligneEntete.appendChild(th);

            }
        );


        thead.appendChild(
            ligneEntete
        );


        // =================================================
        // LIGNES DES FILIÈRES
        // =================================================

        filieres.forEach(
            function (filiere) {

                const ligne =
                    document.createElement("tr");


                // -------------------------------------------------
                // FILIÈRE
                // -------------------------------------------------

                const celluleFiliere =
                    document.createElement("td");

                celluleFiliere.textContent =
                    filiere;

                ligne.appendChild(
                    celluleFiliere
                );


                // -------------------------------------------------
                // AMPHIS
                // -------------------------------------------------

                const celluleAmphis =
                    document.createElement("td");

                celluleAmphis.textContent =
                    "";

                ligne.appendChild(
                    celluleAmphis
                );


                // -------------------------------------------------
                // CELLULES DES CRÉNEAUX
                // -------------------------------------------------

                creneauxSession.forEach(
                    function () {

                        const cellule =
                            document.createElement("td");

                        cellule.textContent =
                            "";

                        ligne.appendChild(
                            cellule
                        );

                    }
                );


                tbody.appendChild(
                    ligne
                );

            }
        );


        console.log(
            "✓ Calendrier construit."
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
