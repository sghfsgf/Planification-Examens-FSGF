// =====================================================
// CALENDRIERS.JS
// Construction et affichage des calendriers
// =====================================================
import {
    getFirestore,
    collection,
    onSnapshot
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
        const { collection, getDocs } =
            await import(
                "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js"
            );

        const snapshot = await getDocs(
            collection(db, "calendriers")
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
// =====================================================
// RÉGIMES : SYNCHRONISATION AVEC FIRESTORE
// =====================================================
let regimesFirestoreCharges = false;
let sessionsLocalesChargees = false;
let sessionsFirestore = [];

onSnapshot(
    collection(db, "sessions"),

    function (snapshot) {
        sessionsFirestore = snapshot.docs.map(function (doc) {
            return doc.data();
        });

        const regimeSelectionne = selectRegime.value;

        const regimesDisponibles = [
            ...new Set(
                sessionsFirestore
                    .map(function (session) {
                        return session.regimeCode;
                    })
                    .filter(function (code) {
                        return typeof code === "string" &&
                               code.trim() !== "";
                    })
                    .map(function (code) {
                        return code.trim();
                    })
            )
        ].sort();

        selectRegime.innerHTML = "";

        regimesDisponibles.forEach(function (regimeCode) {
            const option = document.createElement("option");
            option.value = regimeCode;
            option.textContent = regimeCode;
            selectRegime.appendChild(option);
        });

        regimesFirestoreCharges = true;
        selectRegime.disabled = regimesDisponibles.length === 0;

        if (regimesDisponibles.includes(regimeSelectionne)) {
            selectRegime.value = regimeSelectionne;
        }

        if (regimesDisponibles.length === 0) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Aucun régime disponible";
            selectRegime.appendChild(option);
        }

        if (sessionsLocalesChargees) {
            mettreAJourSessions();
        }
    },

    function (erreur) {
        console.error(
            "Erreur de lecture des régimes Firestore :",
            erreur
        );
        selectRegime.disabled = true;
        selectRegime.innerHTML =
            '<option value="">Erreur de chargement</option>';
    }
);
    

    // =================================================
    // Récupère le code niveau pur (L1, L2, L3, MP, MR)
    // même si le titre a déjà été enrichi avec session/année
    // =================================================
    function getNiveauCode() {
        if (!niveauCalendrier) return "";
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

        // -------------------------------------------------
        // Nettoyage du tableau (création thead/tbody si absents)
        // -------------------------------------------------
        let thead = tableau.querySelector("thead");
        let tbody = tableau.querySelector("tbody");

        if (!thead) {
            thead = document.createElement("thead");
            tableau.appendChild(thead);
        }
        if (!tbody) {
            tbody = document.createElement("tbody");
            tableau.appendChild(tbody);
        }

        thead.innerHTML = "";
        tbody.innerHTML = "";

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
        const sessionCode =
            selectSession
                ? selectSession.value
                : "";

        // -------------------------------------------------
        // Récupération des informations de la session
        // -------------------------------------------------
        const sessions =
            (typeof donneesExamens !== "undefined" &&
             donneesExamens &&
             Array.isArray(donneesExamens.sessions))
                ? donneesExamens.sessions
                : [];

        const sessionSelectionnee =
            sessions.find(
                function (session) {
                    return (
                        session.sessionCode ===
                        sessionCode
                    );
                }
            );

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
            !sessionCode
        ) {
            console.warn(
                "⚠️ Tous les filtres ne sont pas sélectionnés."
            );
            return;
        }

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

    const sessions = sessionsFirestore;
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
    donneesChargees.then(function () {
        console.log("Calendriers : données reçues.");

        sessionsLocalesChargees = true;

        if (regimesFirestoreCharges) {
            mettreAJourSessions();
        }
    });
} else {
    console.warn("Calendriers : donneesChargees introuvable.");
}

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
                const session =
                    selectSession
                        ? selectSession.value
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
});
