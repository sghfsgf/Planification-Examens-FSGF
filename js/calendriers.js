
// =====================================================
// PLANIFICATION DES EXAMENS - FSGF
// CALENDRIERS.JS
// Construction et affichage du calendrier
// =====================================================


// =====================================================
// 1. ATTENDRE LE CHARGEMENT DE LA PAGE
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    console.log("Calendriers : initialisation.");


    // -------------------------------------------------
    // Tableau principal
    // -------------------------------------------------

    const tableau =
        document.getElementById("tableauCalendrier");


    if (!tableau) {

        console.warn(
            "Calendriers : tableau #tableauCalendrier introuvable."
        );

        return;

    }


    // -------------------------------------------------
    // Niveau affiché
    // -------------------------------------------------

    const niveauElement =
        document.getElementById("niveauCalendrier");


    // =================================================
    // 2. OUTILS DE DATE
    // =================================================

    function formaterDateCourte(date) {

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


    function ajouterUnJour(date) {

        const nouvelleDate =
            new Date(date);


        nouvelleDate.setDate(
            nouvelleDate.getDate() + 1
        );


        return nouvelleDate;

    }


    // =================================================
    // 3. CONSTRUIRE LE CALENDRIER
    // =================================================

    function construireCalendrier() {

        // -------------------------------------------------
        // Vérifier les fonctions de data.js
        // -------------------------------------------------

        if (
            typeof obtenirMatieres !== "function" ||
            typeof obtenirSessions !== "function" ||
            typeof obtenirCreneaux !== "function" ||
            typeof obtenirSallesAmphis !== "function"
        ) {

            console.error(
                "Calendriers : fonctions de données indisponibles."
            );

            return;

        }


        // -------------------------------------------------
        // Récupérer les données
        // -------------------------------------------------

        const matieres =
            obtenirMatieres();

        const sessions =
            obtenirSessions();

        const creneaux =
            obtenirCreneaux();

        const sallesAmphis =
            obtenirSallesAmphis();


        console.log(
            "Calendriers : données reçues.",
            {
                matieres: matieres.length,
                sessions: sessions.length,
                creneaux: creneaux.length,
                sallesAmphis: sallesAmphis.length
            }
        );


        // =================================================
        // 4. PRÉPARER LE TABLEAU
        // =================================================

        const thead =
            tableau.querySelector("thead");

        const tbody =
            tableau.querySelector("tbody");


        if (!thead || !tbody) {

            console.error(
                "Calendriers : thead ou tbody introuvable."
            );

            return;

        }


        thead.innerHTML = "";
        tbody.innerHTML = "";


        // =================================================
        // 5. DÉTERMINER LE NIVEAU
        // =================================================

        const niveau =
            niveauElement
                ? niveauElement.textContent.trim()
                : "";


        // =================================================
        // 6. VÉRIFIER LES SESSIONS
        // =================================================

        if (sessions.length === 0) {

            const ligne =
                document.createElement("tr");


            const cellule =
                document.createElement("td");


            cellule.colSpan = 3;

            cellule.textContent =
                "Aucune session disponible.";


            ligne.appendChild(cellule);

            tbody.appendChild(ligne);

            return;

        }


        // =================================================
        // 7. CONSTRUIRE LES COLONNES DATE + CRÉNEAU
        // =================================================

        const colonnesCalendrier = [];


        sessions.forEach(function (session) {

            // ---------------------------------------------
            // Vérifier les dates de la session
            // ---------------------------------------------

            const dateDebut =
                convertirDateExcel(
                    session.dateDebut
                );


            const dateFin =
                convertirDateExcel(
                    session.dateFin
                );


            if (!dateDebut || !dateFin) {

                console.warn(
                    "Session ignorée : dates invalides.",
                    session
                );

                return;

            }


            // ---------------------------------------------
            // Créneaux appartenant à cette session
            // ---------------------------------------------

            const creneauxSession =
                creneaux.filter(function (creneau) {

                    return (
                        creneau.sessionCode ===
                        session.sessionCode
                    );

                });


            if (creneauxSession.length === 0) {

                console.warn(
                    "Aucun créneau pour la session :",
                    session.sessionCode
                );

                return;

            }


            // ---------------------------------------------
            // Générer les dates de la session
            // ---------------------------------------------

            let dateCourante =
                new Date(dateDebut);


            while (
                dateCourante <= dateFin
            ) {

                creneauxSession.forEach(
                    function (creneau) {

                        colonnesCalendrier.push({

                            sessionCode:
                                session.sessionCode,

                            sessionLibelle:
                                session.sessionLibelle,

                            date:
                                new Date(dateCourante),

                            dateAffichage:
                                formaterDateCourte(
                                    dateCourante
                                ),

                            creneauOrdre:
                                creneau.creneauOrdre,

                            heureDebut:
                                creneau.heureDebut,

                            heureFin:
                                creneau.heureFin,

                            heureDebutAffichage:
                                creneau.heureDebutAffichage,

                            heureFinAffichage:
                                creneau.heureFinAffichage

                        });

                    }
                );


                dateCourante =
                    ajouterUnJour(
                        dateCourante
                    );

            }

        });


        // =================================================
        // 8. VÉRIFIER LES COLONNES
        // =================================================

        if (
            colonnesCalendrier.length === 0
        ) {

            const ligne =
                document.createElement("tr");


            const cellule =
                document.createElement("td");


            cellule.colSpan = 3;

            cellule.textContent =
                "Aucun créneau disponible pour les sessions configurées.";


            ligne.appendChild(cellule);

            tbody.appendChild(ligne);

            return;

        }


        // =================================================
        // 9. TRI CHRONOLOGIQUE
        // =================================================

        colonnesCalendrier.sort(
            function (a, b) {

                const dateA =
                    a.date.getTime();

                const dateB =
                    b.date.getTime();


                if (dateA !== dateB) {

                    return dateA - dateB;

                }


                return (
                    Number(a.creneauOrdre) -
                    Number(b.creneauOrdre)
                );

            }
        );


        // =================================================
        // 10. EN-TÊTE DU TABLEAU
        // =================================================

        const ligneEntete =
            document.createElement("tr");


        // -------------------------------------------------
        // Filière
        // -------------------------------------------------

        const thFiliere =
            document.createElement("th");


        thFiliere.textContent =
            "FILIÈRE";


        ligneEntete.appendChild(
            thFiliere
        );


        // -------------------------------------------------
        // Amphis
        // -------------------------------------------------

        const thAmphis =
            document.createElement("th");


        thAmphis.textContent =
            "AMPHIS";


        ligneEntete.appendChild(
            thAmphis
        );


        // -------------------------------------------------
        // Colonnes temporelles
        // -------------------------------------------------

        colonnesCalendrier.forEach(
            function (colonne) {

                const th =
                    document.createElement("th");


                th.innerHTML =
                    colonne.dateAffichage +
                    "<br>" +
                    colonne.heureDebutAffichage +
                    " – " +
                    colonne.heureFinAffichage;


                ligneEntete.appendChild(th);

            }
        );


        thead.appendChild(
            ligneEntete
        );


        // =================================================
        // 11. FILIÈRES DU NIVEAU
        // =================================================

        const filieres =
            [];


        matieres.forEach(
            function (matiere) {

                if (
                    niveau &&
                    matiere.niveauCode !== niveau
                ) {

                    return;

                }


                if (
                    !filieres.includes(
                        matiere.filiereCode
                    )
                ) {

                    filieres.push(
                        matiere.filiereCode
                    );

                }

            }
        );


        // -------------------------------------------------
        // Si aucune filière
        // -------------------------------------------------

        if (filieres.length === 0) {

            const ligne =
                document.createElement("tr");


            const cellule =
                document.createElement("td");


            cellule.colSpan =
                colonnesCalendrier.length + 2;


            cellule.textContent =
                "Aucune filière disponible pour ce niveau.";


            ligne.appendChild(cellule);

            tbody.appendChild(ligne);

            return;

        }


        // =================================================
        // 12. CRÉER LES LIGNES DES FILIÈRES
        // =================================================

        filieres.forEach(
            function (filiere) {

                const ligne =
                    document.createElement("tr");


                // -----------------------------------------
                // Filière
                // -----------------------------------------

                const tdFiliere =
                    document.createElement("td");


                tdFiliere.textContent =
                    filiere;


                ligne.appendChild(
                    tdFiliere
                );


                // -----------------------------------------
                // Amphis
                // -----------------------------------------

                const tdAmphis =
                    document.createElement("td");


                tdAmphis.textContent =
                    "";


                ligne.appendChild(
                    tdAmphis
                );


                // -----------------------------------------
                // Cellules des créneaux
                // -----------------------------------------

                colonnesCalendrier.forEach(
                    function () {

                        const td =
                            document.createElement("td");


                        td.textContent =
                            "";


                        ligne.appendChild(
                            td
                        );

                    }
                );


                tbody.appendChild(
                    ligne
                );

            }
        );


        // =================================================
        // 13. DIAGNOSTIC MINIMAL
        // =================================================

        console.log(
            "✓ Calendrier temporel construit."
        );


        console.log(
            "Colonnes calendrier :",
            colonnesCalendrier.length
        );


        console.log(
            "Filières affichées :",
            filieres
        );


        console.log(
            "Sessions utilisées :",
            sessions.map(
                function (session) {

                    return (
                        session.sessionCode +
                        " : " +
                        session.dateDebutAffichage +
                        " → " +
                        session.dateFinAffichage
                    );

                }
            )
        );


        console.log(
            "Créneaux utilisés :",
            creneaux.map(
                function (creneau) {

                    return (
                        creneau.sessionCode +
                        " / " +
                        creneau.creneauOrdre +
                        " : " +
                        creneau.heureDebutAffichage +
                        " → " +
                        creneau.heureFinAffichage
                    );

                }
            )
        );

    }


    // =====================================================
    // 14. ATTENDRE LE CHARGEMENT COMPLET DES DONNÉES
    // =====================================================

    if (
        typeof donneesChargees !== "undefined"
    ) {

        donneesChargees.then(
            function (succes) {

                if (succes) {

                    console.log(
                        "Calendriers : données Excel complètement chargées."
                    );

                    construireCalendrier();

                }

                else {

                    console.error(
                        "Calendriers : impossible de construire le calendrier."
                    );

                }

            }
        );

    }

    else {

        console.error(
            "Calendriers : la promesse donneesChargees est introuvable."
        );

    }


    // =====================================================
    // 15. EXPOSER LA FONCTION
    // =====================================================

    window.construireCalendrier =
        construireCalendrier;

});
