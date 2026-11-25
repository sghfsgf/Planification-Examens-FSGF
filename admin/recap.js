// =====================================================
// RÉCAPITULATIF
// - Lecture des calendriers publiés (Firestore, collection "calendriers")
// - Lecture des matières (Firestore, collection "matieres")
// - Filtres : Année universitaire | Semestre | Régime | Session
// - Statistiques : nombre de matières de la session par niveau et filière
//   (uniquement à partir de la collection "matieres")
// - Récapitulatif des locaux, export Excel, impression / PDF
// =====================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Initialisation de Firestore
const db = getFirestore(app);

// Références aux collections
const calendriersRef = collection(db, "calendriers");
const matieresRef = collection(db, "matieres");

// =====================================================
// OUTILS COMMUNS
// =====================================================

const echapperHTML = valeur =>
    String(valeur ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);

// Texte normalisé pour comparer des libellés (sans accents, casse ni espaces multiples)
function normaliser(valeur) {
    return String(valeur ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}

// Date Firestore (Timestamp, Date ou texte ISO) -> secondes, pour le tri
function horodatageDate(valeur) {
    if (!valeur) return 0;
    if (typeof valeur.seconds === "number") return valeur.seconds;
    if (typeof valeur.toDate === "function") return valeur.toDate().getTime() / 1000;
    if (valeur instanceof Date) return valeur.getTime() / 1000;
    const t = Date.parse(valeur);
    return Number.isFinite(t) ? t / 1000 : 0;
}

// =====================================================
// ÉTAPE 1 — LECTURE DES CALENDRIERS EXISTANTS DANS FIRESTORE
// =====================================================

async function chargerCalendriersRecap() {
    try {
        console.log("📋 Début du chargement des calendriers du récapitulatif.");

        const resultat = await getDocs(calendriersRef);

        const calendriers = resultat.docs
            .map(document => ({
                id: document.id,
                ...document.data()
            }))
            .filter(calendrier => calendrier.statut === "publie");

        console.log(
            "✅ Nombre de calendriers publiés récupérés :",
            calendriers.length
        );
        console.table(
            calendriers.map(calendrier => ({
                id: calendrier.id,
                anneeUniversitaire: calendrier.anneeUniversitaire ?? "(absente)",
                semestreCode: calendrier.semestreCode ?? "(absent)",
                regimeCode: calendrier.regimeCode ?? "(absent)",
                sessionCode: calendrier.sessionCode ?? "(absente)",
                nombreFilieres: calendrier.planning?.filieres?.length ?? 0,
                statut: calendrier.statut ?? "(absent)"
            }))
        );

        return calendriers;

    } catch (erreur) {
        console.error(
            "❌ Erreur lors du chargement des calendriers du récapitulatif :",
            erreur
        );

        return [];
    }
}

// =====================================================
// ÉTAPE 1 bis — LECTURE DES MATIÈRES DANS FIRESTORE
// Retourne null en cas d'erreur (pour afficher un message clair)
// =====================================================

async function chargerMatieresRecap() {
    try {
        const resultat = await getDocs(matieresRef);

        const matieres = resultat.docs.map(document => ({
            id: document.id,
            ...document.data()
        }));

        console.log("✅ Nombre de matières récupérées :", matieres.length);

        if (matieres.length > 0) {
            console.log("Champs d'un document « matieres » :", Object.keys(matieres[0]));
            console.table(matieres.slice(0, 5));
        }

        return matieres;

    } catch (erreur) {
        console.error(
            "❌ Erreur lors du chargement de la collection « matieres » :",
            erreur
        );

        return null;
    }
}

// =====================================================
// ÉTAPE 2 — FILTRE ANNÉE UNIVERSITAIRE
// =====================================================

const selectAnneeRecap = document.getElementById("anneeRecap");

function initialiserFiltreAnneeRecap(calendriers) {
    if (!selectAnneeRecap) {
        console.error("❌ Élément HTML #anneeRecap introuvable.");
        return;
    }

    // Réinitialiser le menu
    selectAnneeRecap.innerHTML =
        '<option value="">Choisir une année universitaire</option>';

    // Récupérer les années présentes dans les calendriers publiés
    const annees = [
        ...new Set(
            calendriers
                .map(calendrier => calendrier.anneeUniversitaire)
                .filter(Boolean)
        )
    ].sort();

    // Ajouter les années au menu
    annees.forEach(annee => {
        const option = document.createElement("option");
        option.value = annee;
        option.textContent = annee;
        selectAnneeRecap.appendChild(option);
    });

    console.log("✅ Années universitaires disponibles :", annees);
}

// =====================================================
// ÉTAPE 3 — FILTRE SEMESTRE
// =====================================================

const selectSemestreRecap = document.getElementById("semestreRecap");

function initialiserFiltreSemestreRecap(calendriers, anneeSelectionnee) {
    if (!selectSemestreRecap) {
        console.error("❌ Élément HTML #semestreRecap introuvable.");
        return;
    }

    selectSemestreRecap.innerHTML =
        '<option value="">Choisir un semestre</option>';

    selectSemestreRecap.disabled = true;

    if (!anneeSelectionnee) {
        return;
    }

    const semestres = [
        ...new Set(
            calendriers
                .filter(
                    calendrier =>
                        calendrier.anneeUniversitaire === anneeSelectionnee
                )
                .map(calendrier => calendrier.semestreCode)
                .filter(Boolean)
        )
    ].sort();

    semestres.forEach(semestre => {
        const option = document.createElement("option");
        option.value = semestre;
        option.textContent = semestre;
        selectSemestreRecap.appendChild(option);
    });

    selectSemestreRecap.disabled = semestres.length === 0;

    console.log(
        "✅ Semestres disponibles pour",
        anneeSelectionnee,
        ":",
        semestres
    );
}

// =====================================================
// ÉTAPE 4 — FILTRE RÉGIME
// =====================================================

const selectRegimeRecap = document.getElementById("regimeRecap");

function initialiserFiltreRegimeRecap(
    calendriers,
    anneeSelectionnee,
    semestreSelectionne
) {
    if (!selectRegimeRecap) {
        console.error("❌ Élément HTML #regimeRecap introuvable.");
        return;
    }

    selectRegimeRecap.innerHTML =
        '<option value="">Choisir un régime</option>';

    selectRegimeRecap.disabled = true;

    if (!anneeSelectionnee || !semestreSelectionne) {
        return;
    }

    const regimes = [
        ...new Set(
            calendriers
                .filter(
                    calendrier =>
                        calendrier.anneeUniversitaire === anneeSelectionnee &&
                        calendrier.semestreCode === semestreSelectionne
                )
                .map(calendrier => calendrier.regimeCode)
                .filter(Boolean)
        )
    ].sort();

    regimes.forEach(regime => {
        const option = document.createElement("option");
        option.value = regime;
        option.textContent = regime;
        selectRegimeRecap.appendChild(option);
    });

    selectRegimeRecap.disabled = regimes.length === 0;

    console.log(
        "✅ Régimes disponibles pour",
        anneeSelectionnee,
        semestreSelectionne,
        ":",
        regimes
    );
}

// =====================================================
// ÉTAPE 5 — FILTRE SESSION
// =====================================================

const selectSessionRecap = document.getElementById("sessionRecap");

function initialiserFiltreSessionRecap(
    calendriers,
    anneeSelectionnee,
    semestreSelectionne,
    regimeSelectionne
) {
    if (!selectSessionRecap) {
        console.error("❌ Élément HTML #sessionRecap introuvable.");
        return;
    }

    selectSessionRecap.innerHTML =
        '<option value="">Choisir une session</option>';

    selectSessionRecap.disabled = true;

    if (
        !anneeSelectionnee ||
        !semestreSelectionne ||
        !regimeSelectionne
    ) {
        return;
    }

    const sessions = [
        ...new Set(
            calendriers
                .filter(
                    calendrier =>
                        calendrier.anneeUniversitaire === anneeSelectionnee &&
                        calendrier.semestreCode === semestreSelectionne &&
                        calendrier.regimeCode === regimeSelectionne
                )
                .map(calendrier => calendrier.sessionCode)
                .filter(Boolean)
        )
    ].sort();

    sessions.forEach(session => {
        const option = document.createElement("option");
        option.value = session;
        option.textContent = session;
        selectSessionRecap.appendChild(option);
    });

    selectSessionRecap.disabled = sessions.length === 0;

    console.log(
        "✅ Sessions disponibles pour",
        anneeSelectionnee,
        semestreSelectionne,
        regimeSelectionne,
        ":",
        sessions
    );
}

function actualiserBoutonsRecap(actifs) {
    document.getElementById("btnExporterRecapExcel").disabled = !actifs;
    document.getElementById("btnExporterRecapPDF").disabled = !actifs;
    document.getElementById("btnImprimerRecap").disabled = !actifs;
}

// =====================================================
// STATISTIQUES — NOMBRE DE MATIÈRES DE LA SESSION PAR NIVEAU ET FILIÈRE
//
// Les noms de champs de la collection "matieres" sont regroupés ici.
// Si vos champs ont d'autres noms, ajoutez-les simplement dans les listes.
// Un critère (année, semestre, régime, session) n'est appliqué que si
// les documents « matieres » possèdent ce champ ; sinon il est ignoré
// (le texte sous le tableau indique ce qui a été appliqué).
// =====================================================

const CHAMPS_MATIERES = {
    annee: ["anneeUniversitaire", "annee"],
    semestre: ["semestreCode", "semestre"],
    regime: ["regimeCode", "regime", "regimes", "regimesCodes"],
    session: ["sessionCode", "session", "sessions", "sessionsCodes"],
    niveau: ["niveauCode", "niveau"],
    filiere: ["filiereCode", "filiere", "filieres", "filieresCodes"],
    code: ["matiereCode", "code"],
    libelle: ["matiereLibelle", "libelle", "intitule", "nom"]
};

const ORDRE_NIVEAUX = ["L1", "L2", "L3", "MP", "MR"];

function lireChamp(objet, noms) {
    for (const nom of noms) {
        const valeur = objet?.[nom];

        if (valeur !== undefined && valeur !== null && String(valeur).trim() !== "") {
            return valeur;
        }
    }

    return null;
}

function valeursTexte(valeur) {
    if (valeur === null || valeur === undefined) return [];

    return (Array.isArray(valeur) ? valeur : [valeur])
        .map(element => String(element).trim())
        .filter(Boolean);
}

// Vrai si le champ est absent (critère non restrictif) ou s'il contient la valeur choisie
function correspondCritere(matiere, noms, valeurChoisie) {
    const valeurs = valeursTexte(lireChamp(matiere, noms));

    if (valeurs.length === 0) return true;

    return valeurs.includes(valeurChoisie);
}

function calculerStatistiquesMatieres(matieres, criteres) {
    // Matières de la collection correspondant aux critères
    const retenues = matieres.filter(matiere =>
        correspondCritere(matiere, CHAMPS_MATIERES.annee, criteres.annee) &&
        correspondCritere(matiere, CHAMPS_MATIERES.semestre, criteres.semestre) &&
        correspondCritere(matiere, CHAMPS_MATIERES.regime, criteres.regime) &&
        correspondCritere(matiere, CHAMPS_MATIERES.session, criteres.session)
    );

    // Matières distinctes par (niveau, filière)
    const groupes = new Map();

    for (const matiere of retenues) {
        const niveau = String(
            lireChamp(matiere, CHAMPS_MATIERES.niveau) ?? "Non renseigné"
        ).trim();

        const filieres = valeursTexte(lireChamp(matiere, CHAMPS_MATIERES.filiere));
        const listeFilieres = filieres.length > 0 ? filieres : ["Non renseignée"];

        const code = normaliser(lireChamp(matiere, CHAMPS_MATIERES.code));
        const libelle = normaliser(lireChamp(matiere, CHAMPS_MATIERES.libelle));
        const cle = code || libelle || matiere.id;

        // Une matière commune à plusieurs filières compte pour chacune d'elles
        for (const filiere of listeFilieres) {
            const cleGroupe = niveau + "||" + filiere;

            if (!groupes.has(cleGroupe)) {
                groupes.set(cleGroupe, { niveau, filiere, cles: new Set() });
            }

            groupes.get(cleGroupe).cles.add(cle);
        }
    }

    const rangNiveau = niveau => {
        const i = ORDRE_NIVEAUX.indexOf(niveau);
        return i === -1 ? ORDRE_NIVEAUX.length : i;
    };

    const lignes = [...groupes.values()]
        .map(groupe => ({
            niveau: groupe.niveau,
            filiere: groupe.filiere,
            matieres: groupe.cles.size
        }))
        .sort((a, b) =>
            rangNiveau(a.niveau) - rangNiveau(b.niveau) ||
            a.niveau.localeCompare(b.niveau, "fr") ||
            a.filiere.localeCompare(b.filiere, "fr", { numeric: true })
        );

    const total = lignes.reduce((somme, ligne) => somme + ligne.matieres, 0);

    // Critères réellement appliqués (pour la transparence)
    const criteresAppliques = [
        ["Année", CHAMPS_MATIERES.annee],
        ["Semestre", CHAMPS_MATIERES.semestre],
        ["Régime", CHAMPS_MATIERES.regime],
        ["Session", CHAMPS_MATIERES.session]
    ].map(([nom, champs]) => ({
        nom,
        applique: matieres.some(matiere => lireChamp(matiere, champs) !== null)
    }));

    return { lignes, total, criteresAppliques };
}

function obtenirZoneStatistiquesRecap() {
    let zone = document.getElementById("statistiquesRecap");

    if (!zone) {
        zone = document.createElement("div");
        zone.id = "statistiquesRecap";
        zone.className = "statistiques-recap";

        const conteneur = document.getElementById("tableauRecapLocaux");

        if (conteneur && conteneur.parentNode) {
            conteneur.parentNode.insertBefore(zone, conteneur);
        } else {
            document.body.appendChild(zone);
        }
    }

    return zone;
}

function afficherStatistiquesRecap(matieres) {
    const zone = obtenirZoneStatistiquesRecap();

    const annee = selectAnneeRecap.value;
    const semestre = selectSemestreRecap.value;
    const regime = selectRegimeRecap.value;
    const session = selectSessionRecap.value;

    if (!annee || !semestre || !regime || !session) {
        zone.innerHTML = "";
        return;
    }

    if (matieres === null) {
        zone.innerHTML =
            "<p>Impossible de charger la collection « matieres » (voir la console).</p>";
        return;
    }

    const stats = calculerStatistiquesMatieres(
        matieres,
        { annee, semestre, regime, session }
    );

    const notes = stats.criteresAppliques
        .map(critere =>
            `${echapperHTML(critere.nom)} : ${critere.applique ? "filtré" : "champ absent, ignoré"}`
        )
        .join(" · ");

    if (stats.lignes.length === 0) {
        zone.innerHTML = `
            <h4>📊 Matières de la session</h4>
            <p>Aucune matière trouvée dans la collection « matieres » pour ces critères.</p>
            <p><small>Critères appliqués — ${notes}</small></p>
        `;
        return;
    }

    const lignesHTML = stats.lignes.map(ligne => `
        <tr>
            <td>${echapperHTML(ligne.niveau)}</td>
            <td>${echapperHTML(ligne.filiere)}</td>
            <td>${ligne.matieres}</td>
        </tr>
    `).join("");

    zone.innerHTML = `
        <h4>📊 Matières de la session</h4>
        <table>
            <thead>
                <tr>
                    <th>Niveau</th>
                    <th>Filière</th>
                    <th>Effectif des matières</th>
                </tr>
            </thead>
            <tbody>
                ${lignesHTML}
                <tr>
                    <th colspan="2">Total</th>
                    <th>${stats.total}</th>
                </tr>
            </tbody>
        </table>
        <p><small>
            Source : collection « matieres » (matières distinctes par niveau et filière).<br>
            Critères appliqués — ${notes}
        </small></p>
    `;

    console.log("📊 Matières de la session :", stats);
}

// =====================================================
// RÉCAPITULATIF DES LOCAUX
// =====================================================

function afficherRecapitulatifLocaux(calendriers) {
    const conteneur = document.getElementById("tableauRecapLocaux");

    if (!conteneur) {
        console.error("❌ Élément tableauRecapLocaux introuvable.");
        return;
    }

    const annee = selectAnneeRecap.value;
    const semestre = selectSemestreRecap.value;
    const regime = selectRegimeRecap.value;
    const session = selectSessionRecap.value;

    if (!annee || !semestre || !regime || !session) {
        conteneur.innerHTML =
            "<p>Veuillez sélectionner l'année, le semestre, le régime et la session.</p>";

        actualiserBoutonsRecap(false);
        return;
    }

    const calendriersFiltres = calendriers.filter(calendrier =>
        calendrier.anneeUniversitaire === annee &&
        calendrier.semestreCode === semestre &&
        calendrier.regimeCode === regime &&
        calendrier.sessionCode === session &&
        calendrier.statut === "publie"
    );

    const lignes = [];

    for (const calendrier of calendriersFiltres) {
        const filieres = calendrier.planning?.filieres ?? [];

        for (const filiere of filieres) {
            const locaux = filiere.amphis ?? [];

            for (const cellule of filiere.cellules ?? []) {
                if (cellule.estOccupee !== true) {
                    continue;
                }

                lignes.push({
                    dateTri: horodatageDate(cellule.date),
                    date: cellule.dateAffichage ?? "",
                    debut: cellule.heureDebutAffichage ?? "",
                    fin: cellule.heureFinAffichage ?? "",
                    filiere: cellule.filiereCode ?? filiere.filiereCode ?? "",
                    matiere: cellule.matiereLibelle ?? "",
                    locaux: locaux.join(", ")
                });
            }
        }
    }

    lignes.sort((a, b) =>
        a.dateTri - b.dateTri ||
        a.debut.localeCompare(b.debut) ||
        a.filiere.localeCompare(b.filiere)
    );

    if (lignes.length === 0) {
        conteneur.innerHTML =
            "<p>Aucun examen occupé trouvé pour ces critères.</p>";

        actualiserBoutonsRecap(false);
        return;
    }

    const dates = [...new Map(
        lignes.map(ligne => [ligne.date, ligne.dateTri])
    ).entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([date]) => date);

    const creneaux = [...new Set(
        lignes.map(ligne => `${ligne.debut}–${ligne.fin}`)
    )].sort((a, b) => a.localeCompare(b));

    const tableau = {};

    for (const creneau of creneaux) {
        tableau[creneau] = {};

        for (const date of dates) {
            tableau[creneau][date] = [];
        }
    }

    for (const ligne of lignes) {
        const creneau = `${ligne.debut}–${ligne.fin}`;
        const date = ligne.date;
        const locaux = ligne.locaux
            .split(", ")
            .filter(local => local !== "");

        tableau[creneau][date].push(...locaux);
    }

    conteneur.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Créneau</th>
                    ${dates.map(date =>
                        `<th>${echapperHTML(date)}</th>`
                    ).join("")}
                </tr>
            </thead>
            <tbody>
                ${creneaux.map(creneau => `
                    <tr>
                        <td>${echapperHTML(creneau)}</td>
                        ${dates.map(date => {
                            const locaux = [
                                ...new Set(tableau[creneau][date])
                            ];

                            return `<td>${echapperHTML(locaux.join(", "))}</td>`;
                        }).join("")}
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;

    actualiserBoutonsRecap(true);
}

// =====================================================
// EXPORT / IMPRESSION
// =====================================================

function obtenirTableauRecapPourExport() {
    const conteneur = document.getElementById("tableauRecapLocaux");
    const tableau = conteneur?.querySelector("table");

    if (!tableau || !tableau.querySelector("tbody tr")) {
        alert("Aucun récapitulatif à exporter. Vérifiez les filtres sélectionnés.");
        return null;
    }

    return tableau;
}

async function exporterRecapExcel() {
    const tableauHTML = obtenirTableauRecapPourExport();
    if (!tableauHTML) return;

    const classeur = new ExcelJS.Workbook();
    const feuille = classeur.addWorksheet("Récapitulatif");

    // Reprendre les données et les styles du tableau HTML
    const lignesHTML = [...tableauHTML.querySelectorAll("tr")];

    lignesHTML.forEach((ligneHTML, indexLigne) => {
        const cellulesHTML = [...ligneHTML.querySelectorAll("th, td")];

        const ligneExcel = feuille.getRow(indexLigne + 1);

        cellulesHTML.forEach((celluleHTML, indexColonne) => {
            const celluleExcel = ligneExcel.getCell(indexColonne + 1);
            const style = getComputedStyle(celluleHTML);

            celluleExcel.value = celluleHTML.innerText.trim();

            celluleExcel.font = {
                name: "Arial",
                size: parseFloat(style.fontSize) * 0.75 || 10,
                bold: style.fontWeight === "bold" ||
                      Number(style.fontWeight) >= 600,
                color: {
                    argb: "FF" + style.color.match(/\d+/g)
                        .slice(0, 3)
                        .map(v => Number(v).toString(16).padStart(2, "0"))
                        .join("")
                        .toUpperCase()
                }
            };

            celluleExcel.alignment = {
                horizontal: style.textAlign === "start"
                    ? "left"
                    : style.textAlign,
                vertical: "middle",
                wrapText: true
            };

            celluleExcel.border = {
                top: { style: "thin", color: { argb: "FFCBD5E1" } },
                left: { style: "thin", color: { argb: "FFCBD5E1" } },
                bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
                right: { style: "thin", color: { argb: "FFCBD5E1" } }
            };

            if (style.backgroundColor !== "rgba(0, 0, 0, 0)") {
                const couleurs = style.backgroundColor.match(/\d+/g);

                if (couleurs && couleurs.length >= 3) {
                    const couleurHex = couleurs.slice(0, 3)
                        .map(v => Number(v).toString(16).padStart(2, "0"))
                        .join("")
                        .toUpperCase();

                    celluleExcel.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FF" + couleurHex }
                    };
                }
            }
        });

        ligneExcel.commit();
    });

    // Ajuster les colonnes à leur contenu
    feuille.columns.forEach(colonne => {
        let largeurMax = 10;

        colonne.eachCell({ includeEmpty: true }, cellule => {
            largeurMax = Math.max(
                largeurMax,
                String(cellule.value ?? "").length + 2
            );
        });

        colonne.width = Math.min(largeurMax, 35);
    });

    // Ajuster la hauteur des lignes
    feuille.eachRow(ligne => {
        ligne.height = 24;
    });

    // Figer la première colonne et répéter l'en-tête
    feuille.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
    feuille.autoFilter = {
        from: { row: 1, column: 1 },
        to: {
            row: 1,
            column: feuille.columnCount
        }
    };

    // Deuxième feuille : statistiques par niveau (si affichées)
    const tableauStatistiques = document.querySelector("#statistiquesRecap table");

    if (tableauStatistiques) {
        const feuilleStats = classeur.addWorksheet("Statistiques");

        [...tableauStatistiques.querySelectorAll("tr")].forEach((ligneHTML, indexLigne) => {
            const ligneExcel = feuilleStats.getRow(indexLigne + 1);

            [...ligneHTML.querySelectorAll("th, td")].forEach((celluleHTML, indexColonne) => {
                const celluleExcel = ligneExcel.getCell(indexColonne + 1);
                const texte = celluleHTML.innerText.trim();

                celluleExcel.value = /^\d+$/.test(texte) ? Number(texte) : texte;
                celluleExcel.font = { name: "Arial", size: 10, bold: celluleHTML.tagName === "TH" };
                celluleExcel.alignment = {
                    horizontal: indexColonne < 2 ? "left" : "center",
                    vertical: "middle"
                };
                celluleExcel.border = {
                    top: { style: "thin", color: { argb: "FFCBD5E1" } },
                    left: { style: "thin", color: { argb: "FFCBD5E1" } },
                    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
                    right: { style: "thin", color: { argb: "FFCBD5E1" } }
                };
            });

            ligneExcel.commit();
        });

        feuilleStats.columns.forEach(colonne => {
            colonne.width = 20;
        });
    }

    const nomFichier =
        `Recap_Locaux_${selectAnneeRecap.value}_${selectSemestreRecap.value}_${selectRegimeRecap.value}_${selectSessionRecap.value}.xlsx`;

    const contenu = await classeur.xlsx.writeBuffer();
    const fichier = new Blob(
        [contenu],
        {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
    );

    const url = URL.createObjectURL(fichier);
    const lien = document.createElement("a");

    lien.href = url;
    lien.download = nomFichier;
    lien.click();

    URL.revokeObjectURL(url);
}

function ajouterDateEditionRecap() {
    let dateEdition = document.getElementById("dateEditionRecap");

    if (!dateEdition) {
        dateEdition = document.createElement("p");
        dateEdition.id = "dateEditionRecap";
        dateEdition.className = "date-edition-recap";

        const conteneur = document.getElementById("tableauRecapLocaux");
        conteneur?.prepend(dateEdition);
    }

    const maintenant = new Date();

    dateEdition.textContent =
        "Date d'édition : " +
        maintenant.toLocaleDateString("fr-FR") +
        " à " +
        maintenant.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit"
        });
}

function imprimerRecap() {
    const tableau = obtenirTableauRecapPourExport();
    if (!tableau) return;

    ajouterDateEditionRecap();
    window.print();
}

function exporterRecapPDF() {
    imprimerRecap();
}

// =====================================================
// EXÉCUTION DU CHARGEMENT
// =====================================================

Promise.all([chargerCalendriersRecap(), chargerMatieresRecap()])
    .then(([calendriers, matieres]) => {
        initialiserFiltreAnneeRecap(calendriers);

        function actualiserRecapitulatif() {
            afficherStatistiquesRecap(matieres);
            afficherRecapitulatifLocaux(calendriers);
        }

        selectAnneeRecap.addEventListener("change", () => {
            initialiserFiltreSemestreRecap(
                calendriers,
                selectAnneeRecap.value
            );

            initialiserFiltreRegimeRecap(
                calendriers,
                selectAnneeRecap.value,
                selectSemestreRecap.value
            );

            initialiserFiltreSessionRecap(
                calendriers,
                selectAnneeRecap.value,
                selectSemestreRecap.value,
                selectRegimeRecap.value
            );

            actualiserRecapitulatif();
        });

        selectSemestreRecap.addEventListener("change", () => {
            initialiserFiltreRegimeRecap(
                calendriers,
                selectAnneeRecap.value,
                selectSemestreRecap.value
            );

            initialiserFiltreSessionRecap(
                calendriers,
                selectAnneeRecap.value,
                selectSemestreRecap.value,
                selectRegimeRecap.value
            );

            actualiserRecapitulatif();
        });

        selectRegimeRecap.addEventListener("change", () => {
            initialiserFiltreSessionRecap(
                calendriers,
                selectAnneeRecap.value,
                selectSemestreRecap.value,
                selectRegimeRecap.value
            );

            actualiserRecapitulatif();
        });

        selectSessionRecap.addEventListener("change", actualiserRecapitulatif);

        actualiserRecapitulatif();
    });

document.getElementById("btnExporterRecapExcel")
    ?.addEventListener("click", exporterRecapExcel);

document.getElementById("btnExporterRecapPDF")
    ?.addEventListener("click", exporterRecapPDF);

document.getElementById("btnImprimerRecap")
    ?.addEventListener("click", imprimerRecap);
