// =====================================================
// CALENDRIERS.JS
// Construction et affichage des calendriers
// =====================================================
import {
    getFirestore,
    collection,
    onSnapshot,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
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
        const snapshot = await getDocs(
            query(collection(db, "calendriers"),
                where("statut", "==", "publie"),
                where("anneeUniversitaire", "==", anneeUniversitaire),
                where("niveauCode", "==", niveauCode),
                where("semestreCode", "==", semestreCode),
                where("regimeCode", "==", regimeCode),
                where("sessionCode", "==", sessionCode))
        );

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
        throw erreur; // Une lecture refusée n'est pas un résultat vide.
    }
}

function initialiserCalendriersPublics() {
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
    const selectAnnee = document.getElementById("anneeUniversitaire");
    const selectNiveau = document.getElementById("selectNiveau");
    if (!tableau || !selectSemestre || !selectRegime || !selectSession) return;

    let sessionsFirestore = [];
    let sessionsPretes = false;
    let erreurSessions = false;
    let numeroRendu = 0;

    // Clé composite : un même code peut exister sur plusieurs années.
    function cleSession(session) {
        return JSON.stringify([session.anneeUniversitaire, session.semestreCode,
            session.regimeCode, session.sessionCode]);
    }
    function sessionsDuFiltre() {
        return sessionsFirestore.filter(session =>
            session.semestreCode === selectSemestre.value &&
            session.regimeCode === selectRegime.value &&
            (!selectAnnee || session.anneeUniversitaire === selectAnnee.value));
    }
    function afficherMessage(message) {
        tableau.innerHTML = "";
        const tbody = document.createElement("tbody");
        const ligne = document.createElement("tr");
        const cellule = document.createElement("td");
        cellule.colSpan = 2;
        cellule.textContent = message;
        ligne.appendChild(cellule);
        tbody.appendChild(ligne);
        tableau.appendChild(tbody);
    }
    function mettreAJourRegimes() {
        const ancienneValeur = selectRegime.value;
        const regimes = [...new Set(sessionsFirestore
            .filter(s => !selectAnnee || s.anneeUniversitaire === selectAnnee.value)
            .map(s => s.regimeCode))].sort();
        selectRegime.innerHTML = "";
        regimes.forEach(code => {
            const option = document.createElement("option");
            option.value = code;
            option.textContent = code;
            selectRegime.appendChild(option);
        });
        selectRegime.disabled = regimes.length === 0;
        if (regimes.includes(ancienneValeur)) selectRegime.value = ancienneValeur;
        mettreAJourSessions();
    }

    selectSession.disabled = true;
    afficherMessage("Chargement des sessions depuis Firestore…");
    onSnapshot(collection(db, "sessions"), snapshot => {
        // Refuser les métadonnées incomplètes, sans inventer ni normaliser des codes.
        sessionsFirestore = snapshot.docs.map(doc => doc.data()).filter(session =>
            ["anneeUniversitaire", "semestreCode", "regimeCode", "sessionCode"]
                .every(champ => typeof session[champ] === "string" && session[champ].trim() !== ""));
        sessionsPretes = true;
        erreurSessions = false;
        mettreAJourRegimes();
    }, erreur => {
        console.error("Erreur de lecture des sessions Firestore :", erreur);
        sessionsPretes = false;
        erreurSessions = true;
        sessionsFirestore = [];
        ++numeroRendu; // invalider toute lecture de calendrier en cours
        selectRegime.disabled = true;
        selectSession.disabled = true;
        selectRegime.innerHTML = '<option value="">Erreur de chargement</option>';
        selectSession.innerHTML = '<option value="">Erreur de chargement</option>';
        afficherMessage("Impossible de lire les sessions Firestore. Vérifiez la connexion et les autorisations.");
    });

    // =================================================
    // Récupère le code niveau pur (L1, L2, L3, MP, MR)
    // même si le titre a déjà été enrichi avec session/année
    // =================================================
    function getNiveauCode() {
        if (!niveauCalendrier) return "";
        if (selectNiveau) return selectNiveau.value;
        // On prend uniquement la partie avant le premier " — "
        return niveauCalendrier.textContent
            .trim()
            .split("—")[0]
            .trim();
    }

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

        const rendu = ++numeroRendu;
        if (!sessionsPretes) {
            afficherMessage(erreurSessions
                ? "Impossible de lire les sessions Firestore. Vérifiez la connexion et les autorisations."
                : "Chargement des sessions depuis Firestore…");
            return;
        }
        // Préparer hors DOM ; seule la dernière requête peut publier son rendu.
        const thead = document.createElement("thead");
        const tbody = document.createElement("tbody");

        // -------------------------------------------------
        // Récupération des paramètres sélectionnés
        // -------------------------------------------------
        const niveau = getNiveauCode();   // L1, L2, L3, MP, MR...
        const semestre =
            selectSemestre
                ? selectSemestre.value
                : "";
        const regime =
            selectRegime
                ? selectRegime.value
                : "";
        const sessionSelectionnee = sessionsDuFiltre().find(
            session => cleSession(session) === selectSession.value);
        const sessionCode = sessionSelectionnee?.sessionCode || "";

        const intituleSession =
            sessionSelectionnee
                ? sessionSelectionnee.sessionLibelle || ""
                : "";

        const anneeUniversitaire =
            sessionSelectionnee
                ? sessionSelectionnee.anneeUniversitaire || ""
                : "";

        // -------------------------------------------------
        // Mise à jour du titre du calendrier
        // -------------------------------------------------
        if (niveauCalendrier) {
            niveauCalendrier.textContent =
                niveau +
                (intituleSession
                    ? " — " + intituleSession
                    : "") +
                (anneeUniversitaire
                    ? " — " + anneeUniversitaire
                    : "");
        }

        console.log("Niveau :", niveau);
        console.log("Semestre :", semestre);
        console.log("Régime :", regime);
        console.log("Session :", sessionCode);
        console.log("Intitulé :", intituleSession);
        console.log("Année universitaire :", anneeUniversitaire);

        // -------------------------------------------------
        // Vérification des filtres
        // -------------------------------------------------
        if (
            !niveau ||
            !semestre ||
            !regime ||
            !sessionCode ||
            !anneeUniversitaire
        ) {
            console.warn(
                "⚠️ Tous les filtres ne sont pas sélectionnés."
            );
            afficherMessage("Aucune session disponible pour ces filtres, ou sélection incomplète.");
            return;
        }

        afficherMessage("Chargement du calendrier publié…");
        // -------------------------------------------------
        // LECTURE DU CALENDRIER PUBLIÉ DANS FIRESTORE
        // -------------------------------------------------
        let calendrierFirestore;
        try {
            calendrierFirestore = await chargerCalendrierFirestore(
                anneeUniversitaire, niveau, semestre, regime, sessionCode);
        } catch (erreur) {
            if (rendu !== numeroRendu) return;
            afficherMessage("Impossible de lire le calendrier Firestore. Vérifiez la connexion, les autorisations et les index.");
            return;
        }
        if (rendu !== numeroRendu) return;
        tableau.innerHTML = "";
        tableau.appendChild(thead);
        tableau.appendChild(tbody);

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

       console.log(
    "🔎 STRUCTURE RÉELLE DES CELLULES :",
    JSON.stringify(
        planning.filieres.slice(0, 2).map(f => ({
            filiereCode: f.filiereCode,
            cellules: f.cellules?.slice(0, 5)
        })),
        null,
        2
    )
);

        if (
            !planning ||
            !Array.isArray(planning.filieres)
        ) {
            console.error("Le calendrier publié contient un planning inexploitable.");
            afficherMessage("Le calendrier publié contient un planning inexploitable.");
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

        // Récupérer la date de la première colonne
        const dateA = a.date
            ? (
                typeof a.date.toDate === "function"
                    ? a.date.toDate()
                    : new Date(a.date)
            )
            : null;

        // Récupérer la date de la deuxième colonne
        const dateB = b.date
            ? (
                typeof b.date.toDate === "function"
                    ? b.date.toDate()
                    : new Date(b.date)
            )
            : null;

        // Comparer les dates
        if (dateA && dateB) {
            const differenceDate =
                dateA.getTime() - dateB.getTime();

            if (differenceDate !== 0) {
                return differenceDate;
            }
        }

        // Pour une même date, comparer les créneaux
        return (
            a.creneauOrdre - b.creneauOrdre
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

            if (
                colonne.date &&
                typeof colonne.date.toDate === "function"
            ) {
                thDate.textContent =
                    formaterDateDepuisObjet(
                        colonne.date.toDate()
                    );
            }
            else {
                thDate.textContent =
                    colonne.dateAffichage ||
                    dateCle;
            }

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

               const celluleFirestore = cellules.find(function (cellule) {

    const dateCellule = cellule.date
        ? (
            typeof cellule.date.toDate === "function"
                ? cellule.date.toDate().toISOString().substring(0, 10)
                : new Date(cellule.date).toISOString().substring(0, 10)
        )
        : null;

    const dateColonne = colonne.date
        ? (
            typeof colonne.date.toDate === "function"
                ? colonne.date.toDate().toISOString().substring(0, 10)
                : new Date(colonne.date).toISOString().substring(0, 10)
        )
        : null;

    return (
        Number(cellule.creneauOrdre) === colonne.creneauOrdre &&
        (
            dateCellule === dateColonne ||
            (
                !dateCellule &&
                cellule.dateAffichage === colonne.dateAffichage
            )
        )
    );

});

                        // -------------------------------------------------
                        // Affichage de la matière déjà enregistrée
                        // -------------------------------------------------
                        if (
                            celluleFirestore &&
                            celluleFirestore.matiereLibelle
                        ) {
                            celluleHTML.textContent =
                                celluleFirestore.matiereLibelle;
                            celluleHTML.className =
                                "cellule-examen";
                        }
                        else {
                            celluleHTML.textContent =
                                "";
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
        const texte =
            date.toLocaleDateString(
                "fr-FR",
                {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            );
        return (
            texte.charAt(0).toUpperCase() +
            texte.slice(1)
        );
    }

    // =====================================================
    // MISE À JOUR DES SESSIONS
    // =====================================================
    function mettreAJourSessions() {
        if (!sessionsPretes) return;
        const ancienneValeur = selectSession.value;
        const sessionsDisponibles = sessionsDuFiltre();
        const uniques = [...new Map(sessionsDisponibles.map(s => [cleSession(s), s])).values()];
        selectSession.innerHTML = "";
        uniques.forEach(session => {
            const option = document.createElement("option");
            option.value = cleSession(session);
            option.textContent = (session.sessionLibelle || session.sessionCode) +
                " — " + session.anneeUniversitaire;
            selectSession.appendChild(option);
        });
        selectSession.disabled = uniques.length === 0;
        if (uniques.some(s => cleSession(s) === ancienneValeur)) {
            selectSession.value = ancienneValeur;
        }
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

    if (selectAnnee) selectAnnee.addEventListener("change", mettreAJourRegimes);
    if (selectNiveau) selectNiveau.addEventListener("change", construireCalendrier);
    // Aucun prérequis Excel pour consulter un planning déjà publié.

    // =====================================================
    // EXPORT EXCEL DU CALENDRIER
    // =====================================================
    const btnExportExcel =
        document.getElementById("btnExportExcel");

    if (btnExportExcel) {
        btnExportExcel.addEventListener(
            "click",
            function () {
                const tableauExcel =
                    document.getElementById("tableauCalendrier");

                if (!tableauExcel) {
                    console.error(
                        "❌ Tableau du calendrier introuvable."
                    );
                    return;
                }

                // -------------------------------------------------
                // Création du classeur Excel
                // -------------------------------------------------
                const workbook =
                    XLSX.utils.book_new();

                const feuille =
                    XLSX.utils.table_to_sheet(
                        tableauExcel,
                        {
                            raw: true,
                            origin: "A4"
                        }
                    );

                // -------------------------------------------------
                // Titre du calendrier sur une seule ligne
                // -------------------------------------------------
                const titreCalendrier =
                    document.querySelector("#calendriers .carte h2");

                if (titreCalendrier) {
                    feuille.A1 = {
                        t: "s",
                        v: titreCalendrier.textContent
                            .replace(/\s+/g, " ")
                            .trim(),
                        s: {
                            font: {
                                name: "Times New Roman",
                                sz: 16,
                                bold: true
                            },
                            alignment: {
                                horizontal: "center",
                                vertical: "center",
                                wrapText: false,
                                shrinkToFit: true
                            },
                            border: {
                                top: {
                                    style: "thin",
                                    color: { rgb: "000000" }
                                },
                                bottom: {
                                    style: "thin",
                                    color: { rgb: "000000" }
                                },
                                left: {
                                    style: "thin",
                                    color: { rgb: "000000" }
                                },
                                right: {
                                    style: "thin",
                                    color: { rgb: "000000" }
                                }
                            }
                        }
                    };

                    // Fusionner le titre sur toute la largeur du calendrier
                    const plageCalendrier =
                        XLSX.utils.decode_range(feuille["!ref"]);

                    feuille["!merges"] = feuille["!merges"] || [];
                    feuille["!merges"].push({
                        s: { r: 0, c: 0 },
                        e: {
                            r: 0,
                            c: plageCalendrier.e.c
                        }
                    });

                    // Hauteur de la ligne du titre
                    feuille["!rows"] = feuille["!rows"] || [];
                    feuille["!rows"][0] = { hpt: 30 };
                }

                // -------------------------------------------------
                // Style des cellules pour reproduire l'impression
                // -------------------------------------------------
                if (feuille["!ref"]) {
                    const plage =
                        XLSX.utils.decode_range(
                            feuille["!ref"]
                        );

                    // Nombre de lignes avant et dans l'en-tête du tableau Excel
                    const nombreLignesEntete =
                        3 + (
                            tableauExcel.tHead
                                ? tableauExcel.tHead.rows.length
                                : 0
                        );

                    // Matières présentes dans le calendrier
                    const matieresCalendrier =
                        new Set(
                            Array.from(
                                tableauExcel.querySelectorAll(
                                    ".cellule-examen"
                                )
                            ).map(function (cellule) {
                                return cellule.textContent.trim();
                            })
                        );

                    for (
                        let ligne = plage.s.r;
                        ligne <= plage.e.r;
                        ligne++
                    ) {
                        for (
                            let colonne = plage.s.c;
                            colonne <= plage.e.c;
                            colonne++
                        ) {
                            const adresse =
                                XLSX.utils.encode_cell({
                                    r: ligne,
                                    c: colonne
                                });

                            // Préserver le style spécifique du titre en A1
                            if (adresse === "A1") {
                                continue;
                            }

                            // Ignorer les cellules absentes hors du corps du calendrier
                            if (!feuille[adresse]) {
                                if (
                                    ligne < nombreLignesEntete ||
                                    colonne < 2
                                ) {
                                    continue;
                                }
                                continue;
                            }

                            const valeurCellule =
                                feuille[adresse].v != null
                                    ? String(
                                        feuille[adresse].v
                                    ).trim()
                                    : "";

                            const estEntete =
                                ligne < nombreLignesEntete;
                            const estFiliere =
                                colonne === 0 &&
                                ligne >= nombreLignesEntete;
                            const estAmphi =
                                colonne === 1 &&
                                ligne >= nombreLignesEntete;
                            const estMatiere =
                                valeurCellule !== "" &&
                                matieresCalendrier.has(
                                    valeurCellule
                                );

                            // Taille de police selon le type de cellule
                            let taillePolice = 11;
                            if (estEntete || estFiliere) {
                                taillePolice = 7;
                            } else if (estAmphi) {
                                taillePolice = 9;
                            }

                            feuille[adresse].s = {
                                font: {
                                    name: "Arial",
                                    sz: taillePolice,
                                    bold:
                                        estEntete ||
                                        estFiliere ||
                                        estAmphi
                                },
                                alignment: {
                                    horizontal: "center",
                                    vertical: "center",
                                    wrapText: true
                                },
                                border: {
                                    top: {
                                        style: "thin",
                                        color: { rgb: "000000" }
                                    },
                                    bottom: {
                                        style: "thin",
                                        color: { rgb: "000000" }
                                    },
                                    left: {
                                        style: "thin",
                                        color: { rgb: "000000" }
                                    },
                                    right: {
                                        style: "thin",
                                        color: { rgb: "000000" }
                                    }
                                }
                            };

                            // Fond des en-têtes et des deux premières colonnes
                            if (
                                ligne === 0 ||
                                colonne === 0 ||
                                colonne === 1
                            ) {
                                feuille[adresse].s.fill = {
                                    fgColor: {
                                        rgb: "FCE4D6"
                                    }
                                };
                            }

                            // Matières : conserver 11 pt et le fond bleu
                            if (estMatiere) {
                                feuille[adresse].s.font = {
                                    name: "Arial",
                                    sz: 11,
                                    bold: false
                                };
                                feuille[adresse].s.fill = {
                                    fgColor: {
                                        rgb: "99CCFF"
                                    }
                                };
                                feuille[adresse].s.alignment = {
                                    horizontal: "center",
                                    vertical: "center",
                                    wrapText: false,
                                    textRotation: 90
                                };
                            }
                        }
                    }
                }

                // Mise en page : A3 paysage
                feuille["!pageSetup"] = {
                    paperSize: 8,
                    orientation: "landscape",
                    fitToWidth: 1,
                    fitToHeight: 0
                };
                feuille["!fitToPage"] = true;

                // -------------------------------------------------
                // Ajout de la feuille au classeur
                // -------------------------------------------------
                XLSX.utils.book_append_sheet(
                    workbook,
                    feuille,
                    "Calendrier"
                );

                // -------------------------------------------------
                // Nom du fichier
                // -------------------------------------------------
                const niveau =
                    niveauCalendrier
                        ? niveauCalendrier.textContent.trim()
                        : "Niveau";
                const semestre =
                    selectSemestre
                        ? selectSemestre.value
                        : "Semestre";
                const regime =
                    selectRegime
                        ? selectRegime.value
                        : "Regime";
                const sessionSelectionneeExport = sessionsDuFiltre().find(
                    session => cleSession(session) === selectSession.value);
                const session = sessionSelectionneeExport
                    ? sessionSelectionneeExport.sessionCode
                    : "Session";

                const nomFichier =
                    "Calendrier_" +
                    niveau + "_" +
                    semestre + "_" +
                    regime + "_" +
                    session +
                    ".xlsx";

                // -------------------------------------------------
                // Export
                // -------------------------------------------------
                console.log(
                    "STYLE A1 :",
                    JSON.stringify(feuille.A1?.s, null, 2)
                );
                console.log(
                    "FUSIONS :",
                    JSON.stringify(feuille["!merges"], null, 2)
                );

                XLSX.writeFile(
                    workbook,
                    nomFichier
                );

                console.log("Style du titre A1 :", feuille.A1?.s);
                console.log("Valeur du titre A1 :", feuille.A1?.v);
                console.log("Plage Excel :", feuille["!ref"]);
                console.log(
                    "✓ Calendrier exporté en Excel :",
                    nomFichier
                );
            }
        );
    }

    // =====================================================
    // IMPRESSION DU CALENDRIER
    // =====================================================
    const btnImprimerCalendrier =
        document.getElementById("btnImprimerCalendrier");

    if (btnImprimerCalendrier) {
        btnImprimerCalendrier.addEventListener(
            "click",
            function () {
                const tableauImpression =
                    document.getElementById(
                        "tableauCalendrier"
                    );

                if (!tableauImpression) {
                    console.error(
                        "❌ Tableau du calendrier introuvable."
                    );
                    return;
                }

                console.log(
                    "🖨️ Impression du calendrier..."
                );
                window.print();
            }
        );
    }

    
// =====================================================
// EXPORTER LE CALENDRIER EN PDF
// =====================================================
const btnExporterPDFCalendrier =
    document.getElementById("btnExporterPDFCalendrier");

if (btnExporterPDFCalendrier) {
    btnExporterPDFCalendrier.addEventListener("click", function () {
        const tableau =
            document.getElementById("tableauCalendrier");

        if (!tableau) {
            console.error("❌ Tableau du calendrier introuvable.");
            return;
        }

        console.log("📄 Préparation du calendrier pour export PDF...");
        window.print();
    });
}

   
    // =====================================================
    // EXPOSITION POUR LES AUTRES FICHIERS
    // =====================================================
    window.construireCalendrier =
        construireCalendrier;
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiserCalendriersPublics, { once: true });
} else {
    initialiserCalendriersPublics();
}
