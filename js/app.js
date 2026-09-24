// =========================================================
// PLANIFICATION DES EXAMENS - FSGF
// APP.JS
// Navigation et gestion générale de l'interface
// =========================================================


// =========================================================
// 1. ATTENDRE LE CHARGEMENT DE LA PAGE
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

    // -----------------------------------------------------
    // Éléments principaux
    // -----------------------------------------------------

    const boutonsMenu = document.querySelectorAll(
        ".menu-principal button[data-section]"
    );

    const sections = document.querySelectorAll(
        ".section-app"
    );

    const selectAnnee = document.getElementById(
        "anneeUniversitaire"
    );

    const anneeAffichee = document.getElementById(
        "anneeAffichee"
    );


    // =====================================================
    // 2. AFFICHER UNE SECTION
    // =====================================================

    function afficherSection(idSection) {

        // Masquer toutes les sections
        sections.forEach(section => {
            section.classList.remove("active");
        });


        // Afficher la section demandée
        const section = document.getElementById(idSection);

        if (section) {
            section.classList.add("active");
        }


        // Faire remonter la page en haut
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    // =====================================================
    // 3. GESTION DU MENU PRINCIPAL
    // =====================================================

    boutonsMenu.forEach(bouton => {

        bouton.addEventListener("click", () => {

            const idSection = bouton.dataset.section;

            if (!idSection) {
                return;
            }

            afficherSection(idSection);

        });

    });


    // =====================================================
    // 4. ANNÉE UNIVERSITAIRE
    // =====================================================

    function mettreAJourAnnee() {

        if (!selectAnnee || !anneeAffichee) {
            return;
        }

        const annee = selectAnnee.value;

        if (annee) {
            anneeAffichee.textContent = annee;
        }

    }


    // Mise à jour lorsque l'utilisateur change l'année
    if (selectAnnee) {

        selectAnnee.addEventListener(
            "change",
            mettreAJourAnnee
        );

    }


    // Affichage initial
    mettreAJourAnnee();


    // =====================================================
    // 5. NIVEAU DU CALENDRIER
    // =====================================================

    const selectNiveau = document.getElementById(
        "niveau"
    );

    const niveauCalendrier = document.getElementById(
        "niveauCalendrier"
    );

    const recapNiveau = document.getElementById(
        "recapNiveau"
    );


    function mettreAJourNiveau() {

        if (!selectNiveau) {
            return;
        }

        const niveau = selectNiveau.value;


        // Titre du calendrier
        if (niveauCalendrier) {
            niveauCalendrier.textContent = niveau;
        }


        // Niveau du récapitulatif
        if (recapNiveau) {
            recapNiveau.textContent = niveau;
        }

    }


    if (selectNiveau) {

        selectNiveau.addEventListener(
            "change",
            mettreAJourNiveau
        );

    }


    mettreAJourNiveau();


    // =====================================================
    // 6. GESTION DU SEMESTRE ET DU RÉGIME
    // =====================================================

    const selectSemestre = document.getElementById(
        "semestre"
    );

    const selectRegime = document.getElementById(
        "regime"
    );

    const selectSession = document.getElementById(
        "session"
    );


    // -----------------------------------------------------
    // Sessions disponibles selon semestre + régime
    //
    // CC  -> DS uniquement
    // MX  -> Principale + Rattrapage
    // -----------------------------------------------------

    function mettreAJourSessions() {

        if (!selectSemestre || !selectRegime || !selectSession) {
            return;
        }


        const semestre = selectSemestre.value;
        const regime = selectRegime.value;


        // Conserver la sélection actuelle si possible
        const ancienneValeur = selectSession.value;


        // Vider la liste
        selectSession.innerHTML = "";


        // -------------------------------------------------
        // Régime CC
        // -------------------------------------------------

        if (regime === "CC") {

            const optionDS = document.createElement(
                "option"
            );

            optionDS.value = `DS_${semestre}`;

            optionDS.textContent =
                `DS ${semestre.replace("S", "S")}`;

            selectSession.appendChild(optionDS);

        }


        // -------------------------------------------------
        // Régime MX
        // -------------------------------------------------

        else if (regime === "MX") {

            const optionPrincipale =
                document.createElement("option");

            optionPrincipale.value =
                `PRINCIPALE_${semestre}`;

            optionPrincipale.textContent =
                `Session principale ${semestre}`;

            selectSession.appendChild(
                optionPrincipale
            );


            const optionRattrapage =
                document.createElement("option");

            optionRattrapage.value =
                `RATTRAPAGE_${semestre}`;

            optionRattrapage.textContent =
                `Rattrapage ${semestre}`;

            selectSession.appendChild(
                optionRattrapage
            );

        }


        // -------------------------------------------------
        // Restaurer l'ancienne sélection si elle existe
        // -------------------------------------------------

        const optionExiste = Array.from(
            selectSession.options
        ).some(
            option => option.value === ancienneValeur
        );


        if (optionExiste) {
            selectSession.value = ancienneValeur;
        }

    }


    if (selectSemestre) {

        selectSemestre.addEventListener(
            "change",
            mettreAJourSessions
        );

    }


    if (selectRegime) {

        selectRegime.addEventListener(
            "change",
            mettreAJourSessions
        );

    }


    // Initialisation des sessions
    mettreAJourSessions();


    // =====================================================
    // 7. BOUTON GÉNÉRER
    // =====================================================

    const btnGenerer = document.getElementById(
        "btnGenerer"
    );


    if (btnGenerer) {

        btnGenerer.addEventListener(
            "click",
            () => {

                /*
                 * Pour le moment, le moteur de planification
                 * n'est pas encore installé.
                 *
                 * Il sera ajouté plus tard dans :
                 *
                 * js/planification.js
                 */

                alert(
                    "Le moteur de planification sera ajouté dans l'étape suivante."
                );

            }
        );

    }


    // =====================================================
    // 8. BOUTON CONSULTATION SMARTPHONE
    // =====================================================

    const btnConsultationMobile =
        document.getElementById(
            "btnConsultationMobile"
        );


    if (btnConsultationMobile) {

        btnConsultationMobile.addEventListener(
            "click",
            () => {

                afficherSection("calendriers");

            }
        );

    }


    // =====================================================
    // 9. INITIALISATION
    // =====================================================

    // Accueil affiché au démarrage
    afficherSection("accueil");


    console.log(
        "Planification des examens : application initialisée."
    );

});
