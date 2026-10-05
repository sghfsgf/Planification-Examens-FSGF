// =====================================================
// CALENDRIERS ADMIN
// Affichage du planning généré
// =====================================================

function afficherPlanning(planning) {

    console.log("------------------------------------------");
    console.log("AFFICHAGE DU PLANNING");
    console.log("------------------------------------------");

    if (!planning) {

        console.error("❌ Aucun planning à afficher.");

        return;
    }

    // -------------------------------------------------
    // Construire le tableau
    // -------------------------------------------------

    const tableau =
        construireTableauCalendrier(planning);

    if (!tableau) {

        console.error(
            "❌ Impossible de construire le tableau."
        );

        return;
    }

    // -------------------------------------------------
    // Récupérer la zone d'affichage
    // -------------------------------------------------

    const zoneCalendrier =
        document.querySelector(".bloc-calendrier");

    if (!zoneCalendrier) {

        console.error(
            "❌ Zone .bloc-calendrier introuvable."
        );

        return;
    }

    // -------------------------------------------------
    // Vider le contenu précédent
    // -------------------------------------------------

    zoneCalendrier.innerHTML = "";

    // -------------------------------------------------
    // Ajouter le tableau
    // -------------------------------------------------

    zoneCalendrier.appendChild(tableau);

    console.log(
        "✓ Calendrier inséré dans la page."
    );
}

function formaterDateLongue(date) {

    // -------------------------------------------------
    // Normaliser la date
    // -------------------------------------------------

    if (
        date &&
        typeof date.toDate === "function"
    ) {

        date = date.toDate();

    } else if (
        !(date instanceof Date)
    ) {

        date = new Date(date);

    }


    // -------------------------------------------------
    // Vérification
    // -------------------------------------------------

    if (
        !(date instanceof Date) ||
        isNaN(date.getTime())
    ) {

        console.error(
            "❌ Date invalide :",
            date
        );

        return "Date invalide";
    }


    // -------------------------------------------------
    // Jours
    // -------------------------------------------------

    const jours = [
        "Dimanche",
        "Lundi",
        "Mardi",
        "Mercredi",
        "Jeudi",
        "Vendredi",
        "Samedi"
    ];


    // -------------------------------------------------
    // Mois
    // -------------------------------------------------

    const mois = [
        "janvier",
        "février",
        "mars",
        "avril",
        "mai",
        "juin",
        "juillet",
        "août",
        "septembre",
        "octobre",
        "novembre",
        "décembre"
    ];


    return (
        jours[date.getDay()] +
        " " +
        date.getDate() +
        " " +
        mois[date.getMonth()] +
        " " +
        date.getFullYear()
    );
}

// =====================================================
// Construire le tableau HTML du calendrier
// ===================================================

function construireTableauCalendrier(planning) {

    console.log("------------------------------------------");
    console.log("CONSTRUCTION DU TABLEAU DU CALENDRIER");
    console.log("------------------------------------------");

    if (!planning) {
        console.error("❌ Aucun planning fourni.");
        return null;
    }

    // -------------------------------------------------
    // Récupérer toutes les cellules de référence
    // -------------------------------------------------

    const premiereFiliere = planning.filieres[0];

    if (!premiereFiliere || premiereFiliere.cellules.length === 0) {
        console.error("❌ Aucune cellule disponible.");
        return null;
    }

    const cellules = premiereFiliere.cellules;

    // -------------------------------------------------
    // Regrouper les cellules par date
    // -------------------------------------------------

    const groupesDates = [];

    cellules.forEach(function (cellule) {

        let dateCellule = cellule.date;

        // Timestamp Firestore → Date JavaScript
        if (
            dateCellule &&
            typeof dateCellule.toDate === "function"
        ) {
            dateCellule = dateCellule.toDate();
        }

        // Autre format → Date JavaScript
        else if (
            !(dateCellule instanceof Date)
        ) {
            dateCellule = new Date(dateCellule);
        }

        if (isNaN(dateCellule.getTime())) {
            console.warn(
                "⚠️ Date invalide :",
                cellule.date
            );
            return;
        }

        const cleDate =
            dateCellule.getFullYear() +
            "-" +
            String(
                dateCellule.getMonth() + 1
            ).padStart(2, "0") +
            "-" +
            String(
                dateCellule.getDate()
            ).padStart(2, "0");

        let groupe =
            groupesDates.find(function (element) {
                return element.cle === cleDate;
            });

        if (!groupe) {

            groupe = {
                cle: cleDate,
                date: dateCellule,
                cellules: []
            };

            groupesDates.push(groupe);
        }

        groupe.cellules.push(cellule);

    });

    // -------------------------------------------------
    // Créer le tableau
    // -------------------------------------------------

    const tableau =
        document.createElement("table");

    tableau.className =
        "tableau-calendrier";

    // -------------------------------------------------
    // THEAD
    // -------------------------------------------------

    const thead =
        document.createElement("thead");

    // -------------------------------------------------
    // Première ligne : dates
    // -------------------------------------------------

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

    groupesDates.forEach(function (groupe) {

        const thDate =
            document.createElement("th");

        thDate.textContent =
            formaterDateLongue(
                groupe.date
            );

        // IMPORTANT :
        // Une date occupe exactement le nombre
        // de créneaux réellement présents ce jour-là.
        thDate.colSpan =
            groupe.cellules.length;

        ligneDates.appendChild(
            thDate
        );

    });

    thead.appendChild(
        ligneDates
    );

    // -------------------------------------------------
    // Deuxième ligne : créneaux
    // -------------------------------------------------

    const ligneCreneaux =
        document.createElement("tr");

    groupesDates.forEach(function (groupe) {

        groupe.cellules.forEach(function (cellule) {

            const thCreneau =
                document.createElement("th");

            thCreneau.textContent =
                cellule.heureDebutAffichage +
                " - " +
                cellule.heureFinAffichage;

            ligneCreneaux.appendChild(
                thCreneau
            );

        });

    });

    thead.appendChild(
        ligneCreneaux
    );

    tableau.appendChild(
        thead
    );

    // -------------------------------------------------
    // TBODY
    // -------------------------------------------------

    const tbody =
        document.createElement("tbody");

    planning.filieres.forEach(function (filiere) {

        const ligne =
            document.createElement("tr");

        // -------------------------------------------------
        // Filière
        // -------------------------------------------------

        const celluleFiliere =
            document.createElement("td");

        celluleFiliere.textContent =
            filiere.filiereCode;

        ligne.appendChild(
            celluleFiliere
        );

        // -------------------------------------------------
        // Amphis
        // -------------------------------------------------

        const celluleAmphis =
            document.createElement("td");

        celluleAmphis.textContent = "";

        ligne.appendChild(
            celluleAmphis
        );

        // -------------------------------------------------
        // Matières
        // -------------------------------------------------

        filiere.cellules.forEach(function (cellule, index) {

            const td =
                document.createElement("td");

            if (cellule.estOccupee) {

                td.textContent =
                    cellule.matiereLibelle;

            } else {

                td.textContent =
                    "—";
            }

            // -------------------------------------------------
            // Préparer la cellule pour la modification à la souris
            // -------------------------------------------------

            td.dataset.filiere =
                filiere.filiereCode;

            td.dataset.index =
                index;

            td.classList.add(
                "cellule-calendrier-modifiable"
            );

            td.style.cursor =
                "pointer";

            ligne.appendChild(
                td
            );

        });

        tbody.appendChild(
            ligne
        );

    });

    tableau.appendChild(
        tbody
    );

    console.log(
        "✓ Tableau du calendrier construit."
    );

    console.log(
        "Nombre de dates :",
        groupesDates.length
    );

    console.log(
        "Nombre de filières :",
        planning.filieres.length
    );

    console.log(
        "Créneaux par date :",
        groupesDates.map(function (groupe) {
            return {
                date: groupe.cle,
                nombreCreneaux:
                    groupe.cellules.length
            };
        })
    );

    return tableau;
}

// =====================================================
// FILTRES DU CALENDRIER ADMIN
// =====================================================

function initialiserFiltresCalendrierAdmin() {

    const selectNiveau =
        document.getElementById("niveauCalendrierAdmin");

    const selectSemestre =
        document.getElementById("semestreCalendrierAdmin");

    const selectRegime =
        document.getElementById("regimeCalendrierAdmin");

    const selectSession =
        document.getElementById("sessionCalendrierAdmin");

    const bouton =
        document.getElementById("btnAfficherCalendrierAdmin");
    const boutonEnregistrer =
    document.getElementById("btnEnregistrerCalendrierAdmin");
    const boutonRegenerer =
    document.getElementById("btnRegenererCalendrierAdmin");

    if (
        !selectNiveau ||
        !selectSemestre ||
        !selectRegime ||
        !selectSession ||
        !bouton ||
        !boutonEnregistrer
    ) {
        console.error(
            "❌ Éléments des filtres du calendrier introuvables."
        );
        return;
    }


    // =================================================
    // METTRE À JOUR LES SESSIONS
    // =================================================

    function mettreAJourSessions() {

        const semestre =
            selectSemestre.value;

        const regime =
            selectRegime.value;


        selectSession.innerHTML = "";


      // =================================================
// RÉCUPÉRER LES SESSIONS DEPUIS FIRESTORE
// =================================================

const donneesGeneration =
    generationExamens.obtenirDonnees();

if (
    !donneesGeneration ||
    !Array.isArray(donneesGeneration.sessions)
) {

    console.error(
        "❌ Sessions Firestore indisponibles."
    );

    return;
}

const sessionsDisponibles =
    donneesGeneration.sessions.filter(
        function (session) {

            return (
                session.semestreCode === semestre &&
                session.regimeCode === regime
            );

        }
    );

console.log(
    "✓ Sessions Firestore disponibles :",
    sessionsDisponibles.length
);

        sessionsDisponibles.forEach(
            function (session) {

                const option =
                    document.createElement("option");

                option.value =
                    session.sessionCode;

                option.textContent =
                    session.sessionLibelle;

                selectSession.appendChild(option);

            }
        );


        if (sessionsDisponibles.length === 0) {

            const option =
                document.createElement("option");

            option.value = "";

            option.textContent =
                "Aucune session disponible";

            selectSession.appendChild(option);

        }

    }


    // =================================================
    // CHANGEMENT SEMESTRE
    // =================================================

    selectSemestre.addEventListener(
        "change",
        function () {

            mettreAJourSessions();

        }
    );


    // =================================================
    // CHANGEMENT RÉGIME
    // =================================================

    selectRegime.addEventListener(
        "change",
        function () {

            mettreAJourSessions();

        }
    );


    // =================================================
    // AFFICHER LE CALENDRIER
    // =================================================

    bouton.addEventListener(
    "click",
    async function () {

            const niveau =
                selectNiveau.value;

            const sessionCode =
                selectSession.value;


            if (!niveau || !sessionCode) {

                console.error(
                    "❌ Niveau ou session invalide."
                );

                return;
            }


            console.log("------------------------------------------");
            console.log("AFFICHAGE CALENDRIER ADMIN");
            console.log("------------------------------------------");

            console.log("Niveau :", niveau);
            console.log(
                "Semestre :",
                selectSemestre.value
            );
            console.log(
                "Régime :",
                selectRegime.value
            );
            console.log(
                "Session :",
                sessionCode
            );


                      // =========================================
            // CHARGER OU CONSTRUIRE LE PLANNING
            // =========================================

            let planning = null;

            try {

                // -----------------------------------------
                // 1. Chercher un calendrier déjà enregistré
                // -----------------------------------------

                planning =
                    await generationExamens.chargerCalendrier(
                        niveau,
                        selectSemestre.value,
                        selectRegime.value,
                        sessionCode
                    );

                // -----------------------------------------
                // 2. Aucun calendrier enregistré
                // -----------------------------------------

                if (!planning) {

                    console.log(
                        "ℹ️ Aucun calendrier enregistré."
                    );

                    console.log(
                        "🚀 Construction d'un nouveau planning."
                    );

                    planning =
                        generationExamens.construireMatricePlanning(
                            niveau,
                            sessionCode
                        );

                    if (!planning) {

                        console.error(
                            "❌ Impossible de construire le planning."
                        );

                        return;
                    }

                    generationExamens.placerMatieresCommunes(
                        planning
                    );

                    generationExamens.placerMatieresSpecifiques(
                        planning
                    );

                    console.log(
                        "✓ Nouveau planning construit."
                    );

                } else {

                    console.log(
                        "✓ Planning chargé depuis Firestore."
                    );
                }

            } catch (erreur) {

                console.error(
                    "❌ Erreur lors du chargement du calendrier :",
                    erreur
                );

                return;
            }

// =========================================
// AFFICHAGE
// =========================================

window.planningCalendrierAdmin = planning;            
afficherPlanning(planning);
boutonEnregistrer.disabled = false;        

console.log(
    "✓ Calendrier affiché."
);

        }
    );
// =================================================
// RÉGÉNÉRER LE CALENDRIER
// =================================================

boutonRegenerer.addEventListener(
    "click",
    async function () {

        const niveau =
            selectNiveau.value;

        const sessionCode =
            selectSession.value;

        if (!niveau || !sessionCode) {

            console.error(
                "❌ Niveau ou session invalide."
            );

            return;
        }

        console.log("------------------------------------------");
        console.log("RÉGÉNÉRATION DU CALENDRIER ADMIN");
        console.log("------------------------------------------");

        console.log("Niveau :", niveau);
        console.log(
            "Semestre :",
            selectSemestre.value
        );
        console.log(
            "Régime :",
            selectRegime.value
        );
        console.log(
            "Session :",
            sessionCode
        );

        try {

            // -----------------------------------------
            // CONSTRUIRE UN NOUVEAU PLANNING
            // -----------------------------------------

            let planning =
                generationExamens.construireMatricePlanning(
                    niveau,
                    sessionCode
                );

            if (!planning) {

                console.error(
                    "❌ Impossible de construire le planning."
                );

                return;
            }

            // -----------------------------------------
            // PLACER LES MATIÈRES COMMUNES
            // -----------------------------------------

            generationExamens.placerMatieresCommunes(
                planning
            );

            // -----------------------------------------
            // PLACER LES MATIÈRES SPÉCIFIQUES
            // -----------------------------------------

            generationExamens.placerMatieresSpecifiques(
                planning
            );

            console.log(
                "✓ Nouveau planning construit."
            );

            // -----------------------------------------
            // REMPLACER LE PLANNING ACTUEL
            // -----------------------------------------

            window.planningCalendrierAdmin =
                planning;

            afficherPlanning(planning);

            boutonEnregistrer.disabled = false;

            console.log(
                "✓ Nouveau calendrier affiché."
            );

        } catch (erreur) {

            console.error(
                "❌ Erreur lors de la régénération :",
                erreur
            );

        }

    }
);
    
     // =================================================
    // ENREGISTRER LE CALENDRIER
    // =================================================

    boutonEnregistrer.addEventListener(
        "click",
        async function () {

            console.log("------------------------------------------");
            console.log("💾 ENREGISTREMENT DU CALENDRIER");
            console.log("------------------------------------------");

            const planning =
                window.planningCalendrierAdmin;

            // -----------------------------------------
            // Vérifier qu'un planning existe
            // -----------------------------------------

            if (!planning) {

                console.error(
                    "❌ Aucun planning à enregistrer."
                );

                return;
            }

            // -----------------------------------------
            // Contrôle global avant enregistrement
            // -----------------------------------------

            const resultatControle =
                controleExamens.verifierPlanningGlobal(
                    planning
                );

            console.log(
                "Résultat du contrôle avant enregistrement :",
                resultatControle
            );

            // -----------------------------------------
            // Refuser si le planning n'est pas valide
            // -----------------------------------------

            if (
                !resultatControle ||
                !resultatControle.valide
            ) {

                console.warn(
                    "⚠️ Planning non valide : enregistrement refusé."
                );

                return;
            }

            // -----------------------------------------
            // Enregistrement Firestore
            // -----------------------------------------

            try {

                const resultat =
                    await generationExamens.enregistrerCalendrier(
                        planning
                    );

                if (resultat) {

                    console.log(
                        "✓ Calendrier enregistré dans Firestore."
                    );

                } else {

                    console.error(
                        "❌ Échec de l'enregistrement du calendrier."
                    );

                }

            } catch (erreur) {

                console.error(
                    "❌ Erreur lors de l'enregistrement :",
                    erreur
                );

            }

        }
    );   
    // =================================================
    // INITIALISATION
    // =================================================

    mettreAJourSessions();

}


// =====================================================
// ATTENDRE LE CHARGEMENT DES DONNÉES
// =====================================================

// =====================================================
// ATTENDRE LE CHARGEMENT DES DONNÉES FIRESTORE
// =====================================================

// =====================================================
// ATTENDRE LE CHARGEMENT DU MOTEUR DE GÉNÉRATION
// =====================================================

async function initialiserCalendriersApresFirestore() {

    console.log(
        "⏳ Attente du moteur de génération..."
    );

    const maximumTentatives = 150;

    for (
        let tentative = 0;
        tentative < maximumTentatives;
        tentative++
    ) {

        // -------------------------------------------------
        // Vérifier que generationExamens existe
        // -------------------------------------------------

        if (
            typeof window.generationExamens ===
            "undefined"
        ) {

            await new Promise(
                function (resolve) {
                    setTimeout(
                        resolve,
                        100
                    );
                }
            );

            continue;
        }

        // -------------------------------------------------
        // Récupérer les données du moteur
        // -------------------------------------------------

        const donneesGeneration =
            window.generationExamens.obtenirDonnees();

        // -------------------------------------------------
        // Vérifier les sessions
        // -------------------------------------------------

        if (
            donneesGeneration &&
            Array.isArray(
                donneesGeneration.sessions
            ) &&
            donneesGeneration.sessions.length > 0
        ) {

            console.log(
                "✓ Sessions du moteur disponibles :",
                donneesGeneration.sessions.length
            );

            // -------------------------------------------------
            // Initialiser les filtres
            // -------------------------------------------------

            initialiserFiltresCalendrierAdmin();

            console.log(
                "✓ Filtres du calendrier initialisés."
            );

            return;
        }

        await new Promise(
            function (resolve) {
                setTimeout(
                    resolve,
                    100
                );
            }
        );
    }

    console.error(
        "❌ Le moteur de génération n'est pas disponible."
    );

}
    
initialiserCalendriersApresFirestore();

// =====================================================
// MODIFICATION MANUELLE DU CALENDRIER
// Échange de deux cellules par clic
// =====================================================


// =====================================================
// MODIFICATION MANUELLE DU CALENDRIER
// Échange / déplacement de deux cellules par clic
// =====================================================

let premiereCelluleSelectionnee = null;

document.addEventListener(
    "click",
    function (evenement) {

        const cellule =
            evenement.target.closest(
                ".cellule-calendrier-modifiable"
            );

        // -------------------------------------------------
        // Clic en dehors d'une cellule du calendrier
        // -------------------------------------------------

        if (!cellule) {
            return;
        }

        // =================================================
        // PREMIER CLIC
        // =================================================

        if (!premiereCelluleSelectionnee) {

            premiereCelluleSelectionnee =
                cellule;

            cellule.style.outline =
                "3px solid orange";

            console.log(
                "🟠 Première cellule sélectionnée :",
                cellule.textContent
            );

            return;
        }

        // =================================================
        // DEUXIÈME CLIC
        // =================================================

        const deuxiemeCelluleSelectionnee =
            cellule;

        // -------------------------------------------------
        // Même cellule
        // -------------------------------------------------

        if (
            premiereCelluleSelectionnee ===
            deuxiemeCelluleSelectionnee
        ) {

            premiereCelluleSelectionnee.style.outline =
                "";

            premiereCelluleSelectionnee =
                null;

            console.log(
                "↩️ Sélection annulée."
            );

            return;
        }

        // =================================================
        // RÉCUPÉRER LE PLANNING
        // =================================================

        const planning =
            window.planningCalendrierAdmin;

        if (!planning) {

            console.error(
                "❌ Planning administratif introuvable."
            );

            premiereCelluleSelectionnee =
                null;

            return;
        }

        // =================================================
        // SAUVEGARDER L'ÉTAT AVANT MODIFICATION
        // =================================================

        const planningAvantModification =
            structuredClone(planning);

        // =================================================
        // IDENTIFIER LES DEUX FILIÈRES
        // =================================================

        const filiere1 =
            planning.filieres.find(
                function (filiere) {

                    return (
                        filiere.filiereCode ===
                        premiereCelluleSelectionnee.dataset.filiere
                    );

                }
            );

        const filiere2 =
            planning.filieres.find(
                function (filiere) {

                    return (
                        filiere.filiereCode ===
                        deuxiemeCelluleSelectionnee.dataset.filiere
                    );

                }
            );

        if (!filiere1 || !filiere2) {

            console.error(
                "❌ Filière introuvable."
            );

            premiereCelluleSelectionnee.style.outline =
                "";

            premiereCelluleSelectionnee =
                null;

            return;
        }

        // =================================================
        // IDENTIFIER LES INDEX
        // =================================================

        const index1 =
            Number(
                premiereCelluleSelectionnee.dataset.index
            );

        const index2 =
            Number(
                deuxiemeCelluleSelectionnee.dataset.index
            );

        const cellule1 =
            filiere1.cellules[index1];

        const cellule2 =
            filiere2.cellules[index2];

        if (!cellule1 || !cellule2) {

            console.error(
                "❌ Cellule de planning introuvable."
            );

            premiereCelluleSelectionnee.style.outline =
                "";

            premiereCelluleSelectionnee =
                null;

            return;
        }

        console.log(
            "Cellule 1 :",
            filiere1.filiereCode,
            index1,
            cellule1
        );

        console.log(
            "Cellule 2 :",
            filiere2.filiereCode,
            index2,
            cellule2
        );

        // =================================================
        // IDENTIFIER LA MATIÈRE SOURCE
        // =================================================

        const matiereSource =
            cellule1.matiereLibelle || "";

        const matiereCible =
            cellule2.matiereLibelle || "";

        // =================================================
        // RECHERCHER LES FILIÈRES DE LA MATIÈRE SOURCE
        // =================================================

        const filieresAvecMatiereSource =
            planning.filieres.filter(
                function (filiere) {

                    return filiere.cellules.some(
                        function (cellule) {

                            return (
                                cellule.estOccupee &&
                                cellule.matiereLibelle ===
                                matiereSource
                            );

                        }
                    );

                }
            );

        const estMatiereCommune =
            matiereSource !== "" &&
            filieresAvecMatiereSource.length >= 2;

        // =================================================
        // CAS 1 : MATIÈRE COMMUNE
        // =================================================

        if (estMatiereCommune) {

            console.log(
                "🔗 Matière commune détectée :",
                matiereSource
            );

            console.log(
                "Filières concernées :",
                filieresAvecMatiereSource.map(
                    function (filiere) {
                        return filiere.filiereCode;
                    }
                )
            );

            // -------------------------------------------------
            // Vérifier que le créneau cible est libre
            // dans toutes les filières concernées
            // -------------------------------------------------

            const cibleLibrePourToutes =
                filieresAvecMatiereSource.every(
                    function (filiere) {

                        const celluleCible =
                            filiere.cellules[index2];

                        return (
                            celluleCible &&
                            (
                                !celluleCible.estOccupee ||
                                celluleCible.matiereLibelle ===
                                matiereSource
                            )
                        );

                    }
                );

            if (!cibleLibrePourToutes) {

                console.warn(
                    "⚠️ Déplacement refusé : le créneau cible est occupé dans une filière concernée."
                );

                premiereCelluleSelectionnee.style.outline =
                    "";

                premiereCelluleSelectionnee =
                    null;

                alert(
                    "Déplacement impossible : le créneau cible est déjà occupé dans une filière concernée."
                );

                return;
            }

            // -------------------------------------------------
            // Déplacer la matière commune
            // dans toutes les filières concernées
            // -------------------------------------------------

            filieresAvecMatiereSource.forEach(
                function (filiere) {

                    const celluleSource =
                        filiere.cellules.find(
                            function (cellule) {

                                return (
                                    cellule.estOccupee &&
                                    cellule.matiereLibelle ===
                                    matiereSource
                                );

                            }
                        );

                    const celluleCible =
                        filiere.cellules[index2];

                    if (
                        celluleSource &&
                        celluleCible
                    ) {

                        celluleSource.matiereLibelle =
                            "";

                        celluleSource.estOccupee =
                            false;

                        celluleCible.matiereLibelle =
                            matiereSource;

                        celluleCible.estOccupee =
                            true;
                    }

                }
            );

            console.log(
                "🔗 Matière commune déplacée simultanément."
            );

        }

        // =================================================
        // CAS 2 : MATIÈRE SPÉCIFIQUE
        // =================================================

        else {

            console.log(
                "📘 Matière spécifique : échange des cellules."
            );

            const matiereLibelle1 =
                cellule1.matiereLibelle;

            const estOccupee1 =
                cellule1.estOccupee;

            cellule1.matiereLibelle =
                cellule2.matiereLibelle;

            cellule1.estOccupee =
                cellule2.estOccupee;

            cellule2.matiereLibelle =
                matiereLibelle1;

            cellule2.estOccupee =
                estOccupee1;

            console.log(
                "🔄 Matière spécifique échangée."
            );
        }

        // =================================================
        // CONTRÔLE DU PLANNING MODIFIÉ
        // =================================================

        console.log(
            "🔎 Contrôle du planning après modification..."
        );

        const resultat =
            controleExamens.verifierPlanningGlobal(
                planning
            );

        console.log(
            "Résultat du contrôle :",
            resultat
        );

        // =================================================
        // MODIFICATION REFUSÉE
        // =================================================

        if (
            !resultat ||
            !resultat.valide
        ) {

            console.warn(
                "⚠️ Modification annulée : planning non valide."
            );

            // -------------------------------------------------
            // Restaurer exactement l'ancien planning
            // -------------------------------------------------

            window.planningCalendrierAdmin =
                structuredClone(
                    planningAvantModification
                );

            // -------------------------------------------------
            // Réafficher l'ancien calendrier
            // -------------------------------------------------

            afficherPlanning(
                window.planningCalendrierAdmin
            );

            // -------------------------------------------------
            // Réinitialiser la sélection
            // -------------------------------------------------

            premiereCelluleSelectionnee =
                null;

            alert(
                "Vous ne pouvez pas faire ce déplacement : le planning deviendrait non valide."
            );

            return;
        }

        // =================================================
        // MODIFICATION ACCEPTÉE
        // =================================================

        window.planningCalendrierAdmin =
            planning;

        console.log(
            "✅ Modification acceptée : planning valide."
        );

        // =================================================
        // RÉAFFICHER LE CALENDRIER
        // =================================================

        afficherPlanning(
            window.planningCalendrierAdmin
        );

        // =================================================
        // RÉINITIALISER LA SÉLECTION
        // =================================================

        premiereCelluleSelectionnee =
            null;

        console.log(
            "✓ Calendrier mis à jour après modification."
        );
    }
);


