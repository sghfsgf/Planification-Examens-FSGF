// Provenance : code fourni par l’utilisateur dans /mnt/attachments/large_prompt-1.txt
// (extraction de travail /root/calendriers-input.js). Source :
// https://sghfsgf.github.io/Planification-Examens-FSGF/admin/calendriers.js
// Adaptation locale aux API courantes ; aucun appel Firebase ajouté.
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
    actualiserActionsCalendrier();

    console.log(
       "✓ Calendrier inséré dans la page."
    );

    console.log(
    "CONTENU APRÈS INSERTION :",
    zoneCalendrier.innerHTML
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

        celluleAmphis.textContent =
            filiere.amphis &&
            filiere.amphis.length > 0
                ? filiere.amphis.join(" || ")
                : "";

        celluleAmphis.dataset.filiere =
            filiere.filiereCode;

        // Une cellule vide seulement peut recevoir un local
        if (
            celluleAmphis.textContent.trim() === ""
        ) {
            celluleAmphis.classList.add(
                "cellule-amphis-vide"
            );

            celluleAmphis.title =
                "Cliquer pour choisir un local";

            celluleAmphis.style.cursor =
                "pointer";
        }

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
                    "";
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

// État unique : toute modification invalide la preuve d'enregistrement.
const etatCalendrier = { busy: false, dirty: false, savedId: null, published: false, selection: null, revision: 0, fingerprint: null };
let calendrierUI = null;
// Date se copie ; Timestamp Firestore est immuable et garde son prototype/toDate.
function clonerPlanning(valeur) {
    if (valeur === null || typeof valeur !== 'object') return valeur;
    if (valeur instanceof Date) return new Date(valeur.getTime());
    if (typeof valeur.toDate === 'function') return valeur;
    if (Array.isArray(valeur)) return valeur.map(clonerPlanning);
    return Object.fromEntries(Object.entries(valeur).map(([cle, v]) => [cle, clonerPlanning(v)]));
}
function empreintePlanning() { return JSON.stringify(window.planningCalendrierAdmin || null); }
function retourCalendrier(message) {
    let zone = document.getElementById('etatCalendrierAdmin');
    if (!zone) {
        zone = document.createElement('p'); zone.id = 'etatCalendrierAdmin';
        zone.setAttribute('role', 'status'); zone.setAttribute('aria-live', 'polite');
        const parent = document.querySelector('.bloc-calendrier')?.parentNode || document.body;
        parent?.appendChild(zone);
    }
    zone.textContent = message;
}
function afficherEtatMatieresCalendrier(resultat) {
    const blocages = resultat?.anomaliesBloquantes || [];
    const avertissements = resultat?.avertissements || [];
    retourCalendrier((resultat?.valide === true ? 'Contrôle global réussi.' : 'Contrôle global refusé.') +
        (resultat?.matieresPlacees?.valide === true ? ' Toutes les matières sont placées.' : ' Matières manquantes ou contrôle incomplet.') +
        (blocages.length ? ' Blocages : ' + blocages.join(', ') + '.' : '') +
        (avertissements.length ? ' Avertissements : ' + avertissements.join(', ') + '.' : ''));
}
function invaliderCalendrier() {
    etatCalendrier.revision++; etatCalendrier.dirty = !!window.planningCalendrierAdmin;
    etatCalendrier.savedId = null; etatCalendrier.fingerprint = null; etatCalendrier.published = false;
    if (typeof premiereCelluleSelectionnee !== 'undefined' && premiereCelluleSelectionnee) {
        premiereCelluleSelectionnee.style.outline = ''; premiereCelluleSelectionnee = null;
    }
    actualiserActionsCalendrier();
}
function actualiserActionsCalendrier() {
    if (!calendrierUI) return;
    if (etatCalendrier.savedId && etatCalendrier.fingerprint !== empreintePlanning()) {
        etatCalendrier.savedId = null; etatCalendrier.dirty = true; etatCalendrier.published = false;
    }
    const selection = calendrierUI.selection();
    const valide = selection.every(Boolean) && calendrierUI.sessionValide(selection);
    const correspond = valide && etatCalendrier.selection === JSON.stringify(selection);
    calendrierUI.afficher.disabled = etatCalendrier.busy || !valide;
    calendrierUI.regenerer.disabled = etatCalendrier.busy || !valide;
    calendrierUI.enregistrer.disabled = etatCalendrier.busy || !correspond || !window.planningCalendrierAdmin || !etatCalendrier.dirty;
    calendrierUI.publier.disabled = etatCalendrier.busy || !correspond || !etatCalendrier.savedId || etatCalendrier.dirty || etatCalendrier.published;
    calendrierUI.selects.forEach(s => { s.disabled = etatCalendrier.busy || s.options.length <= 1; });
}
async function operationCalendrier(type) {
    actualiserActionsCalendrier();
    if (!calendrierUI || calendrierUI[type].disabled || etatCalendrier.busy) return;
    const api = window.generationExamens;
    const selection = calendrierUI.selection(); const cle = JSON.stringify(selection);
    const revision = etatCalendrier.revision;
    const courant = () => revision === etatCalendrier.revision && cle === JSON.stringify(calendrierUI.selection());
    etatCalendrier.busy = true; actualiserActionsCalendrier();
    try {
        if (type === 'afficher' || type === 'regenerer') {
            let planning = type === 'afficher' ? await api.chargerCalendrier(...selection) : null;
            if (!courant()) return;
            if (!planning) {
                planning = await api.construireMatricePlanning(selection[0], selection[3]);
                if (!planning) throw new Error('Construction du planning impossible.');
                await api.placerMatieresCommunes(planning); await api.placerMatieresSpecifiques(planning);
            }
            if (!courant()) return;
            if (!Array.isArray(planning.filieres) || !planning.filieres.length) throw new Error('Planning vide ou mal structuré.');
            window.planningCalendrierAdmin = planning; etatCalendrier.selection = cle;
            invaliderCalendrier(); afficherPlanning(planning); calendrierUI.titre(planning);
            retourCalendrier('Calendrier affiché. Contrôlez puis enregistrez avant de publier.');
        } else if (type === 'enregistrer') {
            const planning = window.planningCalendrierAdmin;
            if (String(planning.niveauCode).trim() !== selection[0] || String(planning.sessionCode).trim() !== selection[3]) throw new Error('Le planning ne correspond pas aux filtres.');
            const controle = window.controleExamens?.verifierPlanningGlobal;
            if (typeof controle !== 'function') throw new Error('Module de contrôle indisponible.');
            if (!Array.isArray(planning.matieresCommunes) || !Array.isArray(planning.matieresSpecifiques) || planning.matieresCommunes.length + planning.matieresSpecifiques.length === 0) throw new Error('Aucune matière prévue ou planning incomplet.');
            const resultat = controle(planning); afficherEtatMatieresCalendrier(resultat);
            if (resultat?.valide !== true || resultat?.matieresPlacees?.valide !== true) return;
            const fingerprint = empreintePlanning();
            const resultatSauvegarde = await api.enregistrerCalendrier(clonerPlanning(planning));
            if (!courant() || fingerprint !== empreintePlanning()) { invaliderCalendrier(); retourCalendrier('Le planning a changé pendant la sauvegarde : enregistrez à nouveau.'); return; }
            if (!resultatSauvegarde?.id) throw new Error('Enregistrement échoué : aucun identifiant retourné.');
            etatCalendrier.savedId = resultatSauvegarde.id; etatCalendrier.fingerprint = fingerprint;
            etatCalendrier.dirty = false; etatCalendrier.published = false;
            retourCalendrier('Calendrier enregistré en brouillon. Publication disponible.');
        } else {
            const id = etatCalendrier.savedId; const fingerprint = empreintePlanning();
            const publie = await api.publierCalendrier(id);
            if (!courant() || fingerprint !== empreintePlanning()) { invaliderCalendrier(); retourCalendrier('Le planning a changé pendant la publication. Vérifiez le statut distant avant de poursuivre.'); return; }
            if (publie !== true) throw new Error('Publication refusée ou échouée. Consultez aussi la console du moteur.');
            etatCalendrier.published = true; retourCalendrier('Calendrier publié.');
        }
    } catch (erreur) { retourCalendrier('Erreur : ' + (erreur?.message || String(erreur))); console.error(erreur); }
    finally { etatCalendrier.busy = false; actualiserActionsCalendrier(); }
}

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


function mettreAJourTitreCalendrier(planning = null) {

    const titre =
        document.getElementById("titreCalendrierAdmin");

    const sousTitre =
        document.getElementById("sousTitreCalendrierAdmin");

    if (!titre || !sousTitre) {
        return;
    }

    // Niveau sélectionné
    const niveau = selectNiveau.value;

    titre.textContent =
        "Calendrier des examens — " + niveau;

    // Semestre sélectionné
    const semestreTexte =
        selectSemestre.options[
            selectSemestre.selectedIndex
        ].textContent.trim();

    const semestre =
        semestreTexte === "S1"
            ? "Semestre 1"
            : semestreTexte === "S2"
                ? "Semestre 2"
                : semestreTexte;

    // Session sélectionnée
    const sessionOption =
        selectSession.options[
            selectSession.selectedIndex
        ];

    const sessionTexte = sessionOption
        ? sessionOption.textContent.trim()
        : "";

    let sousTitreTexte =
        semestre + " · " + sessionTexte;

    // Déterminer le mois et l'année depuis
    // les dates du planning réellement affiché
    if (planning && Array.isArray(planning.filieres)) {

        const dates = [];

        planning.filieres.forEach(function (filiere) {

            if (!Array.isArray(filiere.cellules)) {
                return;
            }

            filiere.cellules.forEach(function (cellule) {

                if (!cellule.estOccupee) {
                    return;
                }

                const valeurDate =
                    cellule.dateAffichage || cellule.date;

                if (!valeurDate) {
                    return;
                }

                let correspondance;

                // Format AAAA-MM-JJ
                if (
                    (correspondance =
                        valeurDate.match(
                            /^(\d{4})-(\d{2})-(\d{2})$/
                        ))
                ) {
                    dates.push(new Date(
                        Number(correspondance[1]),
                        Number(correspondance[2]) - 1,
                        Number(correspondance[3])
                    ));
                }

                // Formats JJ-MM-AAAA ou JJ/MM/AAAA
               else if (
    (correspondance =
        valeurDate.match(
    /^(\d{2})[-\/](\d{2})[-\/](\d{4})$/
))
) {
                    dates.push(new Date(
                        Number(correspondance[3]),
                        Number(correspondance[2]) - 1,
                        Number(correspondance[1])
                    ));
                }

            });

        });

        if (dates.length > 0) {

            const moisFrancais = [
                "Janvier", "Février", "Mars",
                "Avril", "Mai", "Juin",
                "Juillet", "Août", "Septembre",
                "Octobre", "Novembre", "Décembre"
            ];

            const clesMois = [
                ...new Set(
                    dates.map(function (date) {
                        return (
                            date.getFullYear() + "-" +
                            date.getMonth()
                        );
                    })
                )
            ].sort(function (a, b) {

                const [anneeA, moisA] = a.split("-").map(Number);
                const [anneeB, moisB] = b.split("-").map(Number);

                return anneeA - anneeB || moisA - moisB;
            });

            const libellesMois = clesMois.map(
                function (cle) {

                    const [annee, mois] =
                        cle.split("-").map(Number);

                    return moisFrancais[mois] + " " + annee;
                }
            );

            sousTitreTexte +=
                " · " + libellesMois.join(" – ");
        }
    }

    sousTitre.textContent = sousTitreTexte;
}

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

// =================================================
// OUTILS POUR LES FILTRES
// =================================================
function valeurTexte(valeur) {
    return valeur == null ? "" : String(valeur).trim();
}

function ajouterOption(select, valeur, libelle) {
    const option = document.createElement("option");
    option.value = valeur;
    option.textContent = libelle;
    select.appendChild(option);
}

function valeursDistinctes(tableau, champ) {
    return [
        ...new Set(
            tableau
                .map(function (item) {
                    return valeurTexte(item[champ]);
                })
                .filter(Boolean)
        )
    ].sort(function (a, b) {
        return a.localeCompare(b, "fr");
    });
}

function remplirSelect(select, valeurs, texteInitial) {
    const ancienneValeur = select.value;
    select.replaceChildren();
    ajouterOption(select, "", texteInitial);

    valeurs.forEach(function (valeur) {
        ajouterOption(select, valeur, valeur); // valeur brute Firestore
    });

    if (valeurs.includes(ancienneValeur)) {
        select.value = ancienneValeur;
    } else {
        select.value = "";
    }
    select.disabled = valeurs.length === 0;
}

// =================================================
// ACTUALISER LES FILTRES DEPUIS LES SESSIONS FIRESTORE
// =================================================
function actualiserFiltres() {
    const donnees = window.generationExamens?.obtenirDonnees();

    if (!donnees || !Array.isArray(donnees.sessions)) {
        console.error("❌ Sessions Firestore indisponibles.");
        return;
    }

    const sessions = donnees.sessions;

// 0. NIVEAUX depuis la collection matieres Firestore
const matieres = donnees.matieres || [];

const niveaux = valeursDistinctes(
    matieres,
    "niveauCode"
);

remplirSelect(
    selectNiveau,
    niveaux,
    niveaux.length
        ? "Choisir un niveau"
        : "Aucun niveau disponible"
);
    
    // 1. Semestres (valeurs brutes)
    const semestres = valeursDistinctes(sessions, "semestreCode");
    remplirSelect(
        selectSemestre,
        semestres,
        semestres.length ? "Choisir un semestre" : "Aucun semestre disponible"
    );

    const semestre = selectSemestre.value;

    // 2. Régimes (valeurs brutes filtrées par semestre)
    const sessionsSemestre = sessions.filter(function (s) {
        return semestre !== "" && valeurTexte(s.semestreCode) === semestre;
    });

    const regimes = valeursDistinctes(sessionsSemestre, "regimeCode");
    remplirSelect(
        selectRegime,
        regimes,
        semestre
            ? (regimes.length ? "Choisir un régime" : "Aucun régime disponible")
            : "Choisir d'abord un semestre"
    );

    const regime = selectRegime.value;

    // 3. Sessions (filtrées par semestre + régime)
    const sessionsFiltrees = sessionsSemestre.filter(function (s) {
        return regime !== "" && valeurTexte(s.regimeCode) === regime;
    });

    const sessionsMap = new Map();
    sessionsFiltrees.forEach(function (s) {
        const code = valeurTexte(s.sessionCode);
        if (!code) return;
        const libelle = valeurTexte(s.sessionLibelle) || code;
        if (!sessionsMap.has(code)) {
            sessionsMap.set(code, libelle);
        }
    });

    const codesSessions = Array.from(sessionsMap.keys()).sort(function (a, b) {
        return a.localeCompare(b, "fr");
    });

    const ancienneSession = selectSession.value;
    selectSession.replaceChildren();
    ajouterOption(
        selectSession,
        "",
        regime
            ? (codesSessions.length ? "Choisir une session" : "Aucune session disponible")
            : "Choisir d'abord un régime"
    );

    codesSessions.forEach(function (code) {
        ajouterOption(selectSession, code, sessionsMap.get(code));
    });

    if (codesSessions.includes(ancienneSession)) {
        selectSession.value = ancienneSession;
    } else {
        selectSession.value = "";
    }
    selectSession.disabled = codesSessions.length === 0;
}

    const boutonPublier = document.getElementById('btnPublierCalendrierAdmin');
    if (!boutonRegenerer || !boutonPublier || calendrierUI) return;
    calendrierUI = {
        selects: [selectNiveau, selectSemestre, selectRegime, selectSession],
        selection: () => [selectNiveau.value, selectSemestre.value, selectRegime.value, selectSession.value].map(valeurTexte),
        sessionValide: v => (window.generationExamens.obtenirDonnees()?.sessions || []).some(s => valeurTexte(s.sessionCode) === v[3] && valeurTexte(s.semestreCode) === v[1] && valeurTexte(s.regimeCode) === v[2]),
        afficher: bouton, regenerer: boutonRegenerer, enregistrer: boutonEnregistrer, publier: boutonPublier, titre: mettreAJourTitreCalendrier
    };
    actualiserFiltres(); mettreAJourTitreCalendrier(); actualiserActionsCalendrier();
    calendrierUI.selects.forEach(select => select.addEventListener('change', () => {
        actualiserFiltres(); etatCalendrier.selection = null; invaliderCalendrier(); mettreAJourTitreCalendrier();
        retourCalendrier('Filtres modifiés : affichez ou régénérez le calendrier.');
    }));
    ['afficher', 'regenerer', 'enregistrer', 'publier'].forEach(type => {
        // Capture sur Publier : neutralise le gestionnaire historique de generation.js
        // qui utilise son dernier identifiant privé, sans modifier ce module.
        calendrierUI[type].addEventListener('click', evenement => {
            if (type === 'publier') { evenement.preventDefault(); evenement.stopImmediatePropagation(); }
            void operationCalendrier(type);
        }, type === 'publier');
    });

}
// =====================================================
// MODIFICATION MANUELLE DU CALENDRIER
// Échange / déplacement de deux cellules par clic
// =====================================================
 let affectationAmphiManuelleEffectuee = false;
 let deplacementMatiereSpecifiqueEffectue = false;
 let premiereCelluleSelectionnee = null;

document.addEventListener("click", function (evenement) {

    // =================================================
    // AFFECTATION MANUELLE D'UN LOCAL
    // =================================================

    if (etatCalendrier.busy || !etatCalendrier.selection) return;
    const celluleAmphis = evenement.target.closest(
        "td.cellule-amphis-vide"
    );

    if (!celluleAmphis) {
        return;
    }

    // Une cellule déjà remplie ne doit pas être modifiée.
    if (celluleAmphis.textContent.trim() !== "") {
        return;
    }

    const planning = window.planningCalendrierAdmin;

    if (!planning || !window.generationExamens) {
        console.error("❌ Planning ou moteur introuvable.");
        return;
    }

    const donnees = window.generationExamens.obtenirDonnees();
    const salles = donnees && donnees.sallesAmphis;

    if (!Array.isArray(salles) || salles.length === 0) {
        alert("Aucun local disponible dans les données.");
        return;
    }

    // Créer la liste des locaux.
    const liste = document.createElement("select");
    liste.style.maxWidth = "180px";

    const optionInitiale = document.createElement("option");
    optionInitiale.value = "";
    optionInitiale.textContent = "Choisir un local...";
    liste.appendChild(optionInitiale);

    salles.forEach(function (salle) {

        if (
            salle.disponible &&
            salle.disponible !== "Oui"
        ) {
            return;
        }

        const option = document.createElement("option");
        option.value = salle.code;

        option.textContent =
            salle.code + " : " +
            salle.capacite + " places";

        liste.appendChild(option);
    });

    // Remplacer temporairement le contenu de la cellule.
    celluleAmphis.textContent = "";
    celluleAmphis.appendChild(liste);
    liste.focus();

    // Empêcher le clic dans la liste de déclencher
    // le gestionnaire de déplacement des matières.
    liste.addEventListener("click", function (e) {
        e.stopPropagation();
    });

    liste.addEventListener("change", function () {

        if (etatCalendrier.busy || planning !== window.planningCalendrierAdmin || !celluleAmphis.isConnected) return;
        const codeLocal = liste.value;

        if (!codeLocal) {
            return;
        }

        const filiere = planning.filieres.find(
            function (f) {
                return f.filiereCode ===
                    celluleAmphis.dataset.filiere;
            }
        );

        if (!filiere) {
            console.error("❌ Filière introuvable.");
            afficherPlanning(planning);
            return;
        }

        // Enregistrer le code du local dans le planning.
        filiere.amphis = [codeLocal];

        celluleAmphis.textContent = codeLocal;
        celluleAmphis.classList.remove("cellule-amphis-vide");
        celluleAmphis.title = "";
        celluleAmphis.style.cursor = "";

        window.planningCalendrierAdmin = planning;
        affectationAmphiManuelleEffectuee = true;
        invaliderCalendrier();

        console.log(
            "✅ Local affecté manuellement :",
            filiere.filiereCode,
            codeLocal
        );
    });

});


document.addEventListener(
    "click",
    function (evenement) {

        if (etatCalendrier.busy || !etatCalendrier.selection) return;
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
            clonerPlanning(planning);

        try {

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
                         premiereCelluleSelectionnee.style.outline = "";
                         premiereCelluleSelectionnee = null;
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

            if (filiere1 !== filiere2) {
                premiereCelluleSelectionnee.style.outline = '';
                premiereCelluleSelectionnee = null;
                retourCalendrier('Échange refusé : les matières spécifiques doivent rester dans leur filière.');
                return;
            }
            console.log("📘 Matière spécifique : échange des cellules.");

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
            deplacementMatiereSpecifiqueEffectue = true;
        }
        
        // =================================================
        // CONTRÔLE DU PLANNING MODIFIÉ
        // Uniquement pour les matières communes
        // =================================================

        if (estMatiereCommune) {

            console.log(
                "🔎 Contrôle du planning après déplacement d'une matière commune..."
            );

            const resultat =
                window.controleExamens.verifierPlanningGlobal(
                    planning
                );

            console.log(
                "Résultat du contrôle :",
                resultat
            );

            // =============================================
            // MODIFICATION REFUSÉE SI PLANNING INVALIDE
            // =============================================

            if (!resultat || !resultat.valide) {

                console.warn(
                    "⚠️ Modification annulée : planning non valide."
                );

                window.planningCalendrierAdmin =
                    clonerPlanning(
                        planningAvantModification
                    );

                afficherPlanning(
                    window.planningCalendrierAdmin
                );

                premiereCelluleSelectionnee = null;

                alert(
                    "Vous ne pouvez pas faire ce déplacement : le planning deviendrait non valide."
                );

                return;
            }

        } else {

            console.log(
                "📘 Matière spécifique : aucun contrôle global après déplacement."
            );

        }
        // =================================================
        // MODIFICATION ACCEPTÉE
        // =================================================

      window.planningCalendrierAdmin =
    planning;
invaliderCalendrier();

console.log(
    "✅ Modification acceptée : planning mis à jour."
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
        } catch (erreur) {
            window.planningCalendrierAdmin = planningAvantModification;
            if (premiereCelluleSelectionnee) {
                premiereCelluleSelectionnee.style.outline = "";
            }
            premiereCelluleSelectionnee = null;
            invaliderCalendrier();
            try { afficherPlanning(window.planningCalendrierAdmin); }
            catch (erreurAffichage) { console.error(erreurAffichage); }
            retourCalendrier("Modification annulée : " + (erreur?.message || String(erreur)));
            console.error(erreur);
        }
    }
);

async function initialiserCalendriersApresFirestore() {
    ['btnAfficherCalendrierAdmin', 'btnRegenererCalendrierAdmin', 'btnEnregistrerCalendrierAdmin', 'btnPublierCalendrierAdmin'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = true; });
    retourCalendrier('Chargement des données du calendrier…');
    for (let tentative = 0; tentative < 100; tentative++) {
        try {
            const api = window.generationExamens;
            const donnees = api?.obtenirDonnees?.();
            if (donnees && Array.isArray(donnees.sessions) && donnees.sessions.length && Array.isArray(donnees.matieres) && donnees.matieres.length) {
                initialiserFiltresCalendrierAdmin();
                retourCalendrier(calendrierUI ? 'Sélectionnez les filtres du calendrier.' : 'Interface du calendrier incomplète.'); return;
            }
        } catch (erreur) { retourCalendrier('Erreur de chargement : ' + erreur.message); return; }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    retourCalendrier('Données absentes, vides ou moteur indisponible après 10 secondes. Rechargez la page après correction.');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialiserCalendriersApresFirestore, { once: true });
else void initialiserCalendriersApresFirestore();
