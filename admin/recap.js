
// =====================================================
// RÉCAPITULATIF — ÉTAPE 1
// Lecture des calendriers existants dans Firestore
// =====================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Initialisation de Firestore
const db = getFirestore(app);

// Référence à la collection des calendriers
const calendriersRef = collection(db, "calendriers");

// Chargement des calendriers existants
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
                    dateTri: cellule.date?.seconds ?? 0,
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

    const echapperHTML = valeur =>
        String(valeur).replace(/[&<>"']/g, caractere => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caractere]);

   
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


function obtenirTableauRecapPourExport() {
    const conteneur = document.getElementById("tableauRecapLocaux");
    const tableau = conteneur?.querySelector("table");

    if (!tableau || !tableau.querySelector("tbody tr")) {
        alert("Aucun récapitulatif à exporter. Vérifiez les filtres sélectionnés.");
        return null;
    }

    return tableau;
}

function exporterRecapExcel() {
    const tableau = obtenirTableauRecapPourExport();
    if (!tableau) return;

    const classeur = XLSX.utils.table_to_book(tableau, {
        sheet: "Récapitulatif"
    });

    const annee = selectAnneeRecap.value;
    const semestre = selectSemestreRecap.value;
    const regime = selectRegimeRecap.value;
    const session = selectSessionRecap.value;

    const nomFichier =
        `Recap_Locaux_${annee}_${semestre}_${regime}_${session}.xlsx`;

    XLSX.writeFile(classeur, nomFichier);
}

function imprimerRecap() {
    const tableau = obtenirTableauRecapPourExport();
    if (!tableau) return;

    window.print();
}

function exporterRecapPDF() {
    imprimerRecap();
}

// =====================================================
// EXÉCUTION DU CHARGEMENT
// =====================================================


chargerCalendriersRecap().then(calendriers => {
    initialiserFiltreAnneeRecap(calendriers);

    function actualiserRecapitulatif() {
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
