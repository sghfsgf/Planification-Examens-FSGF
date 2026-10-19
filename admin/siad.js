import { app } from "../firebase-config.js";

import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const db = getFirestore(app);

const NIVEAUX_SIAD = ["L1", "L2", "L3", "MP", "MR"];

let calendriersPubliesSIAD = [];
let chargementSIAD = false;

// -----------------------------------------
// OUTILS
// -----------------------------------------

function echapperSIAD(valeur) {
    return String(valeur ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

function obtenirDateSIAD(valeur) {
    if (!valeur) return null;

    if (typeof valeur.toDate === "function") {
        return valeur.toDate();
    }

    if (valeur instanceof Date) {
        return isNaN(valeur.getTime()) ? null : valeur;
    }

    const date = new Date(valeur);

    return isNaN(date.getTime()) ? null : date;
}

function cleDateSIAD(valeur) {
    const date = obtenirDateSIAD(valeur);

    if (!date) return null;

    const annee = date.getFullYear();
    const mois = String(date.getMonth() + 1).padStart(2, "0");
    const jour = String(date.getDate()).padStart(2, "0");

    return `${annee}-${mois}-${jour}`;
}

function afficherDateSIAD(cle) {
    const [annee, mois, jour] = cle.split("-");

    return `${jour}/${mois}/${annee}`;
}

function afficherDateLongueSIAD(cle) {
    const [annee, mois, jour] = cle.split("-");

    const date = new Date(
        Number(annee),
        Number(mois) - 1,
        Number(jour)
    );

    return date.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function estOccupeeSIAD(cellule) {
    return cellule.estOccupee === true &&
        String(cellule.matiereLibelle ?? "").trim() !== "";
}

function obtenirCellulesSIAD(filiere) {
    return Array.isArray(filiere?.cellules)
        ? filiere.cellules
        : [];
}

// -----------------------------------------
// LOCAUX : EXTRACTION DES AFFECTATIONS
// -----------------------------------------

function extraireLocauxSIAD(objet, resultat, profondeur = 0) {
    if (!objet || profondeur > 5) return;

    if (Array.isArray(objet)) {
        objet.forEach(element =>
            extraireLocauxSIAD(element, resultat, profondeur + 1)
        );
        return;
    }

    if (typeof objet !== "object") return;

    for (const [cle, valeur] of Object.entries(objet)) {
        const nom = cle.toLowerCase();

        const estAmphi =
            nom.includes("amphi");

        const estSalle =
            nom.includes("salle") ||
            nom === "local" ||
            nom === "localcode" ||
            nom === "locaux" ||
            nom.includes("locauxaffect");

        if (estAmphi || estSalle) {
            const type = estAmphi ? "amphis" : "salles";

            const ajouter = element => {
                if (element == null) return;

                if (typeof element === "string" ||
                    typeof element === "number") {
                    const code = String(element).trim();

                    if (code) resultat[type].add(code);

                    return;
                }

                if (typeof element === "object") {
                    const code =
                        element.code ??
                        element.salleCode ??
                        element.amphiCode ??
                        element.localCode ??
                        element.nom ??
                        element.libelle ??
                        element.id;

                    if (code != null && String(code).trim()) {
                        resultat[type].add(String(code).trim());
                    }
                }
            };

            if (Array.isArray(valeur)) {
                valeur.forEach(ajouter);
            } else {
                ajouter(valeur);
            }
        }

        if (valeur && typeof valeur === "object") {
            extraireLocauxSIAD(
                valeur,
                resultat,
                profondeur + 1
            );
        }
    }
}

function creerEnsembleLocauxSIAD() {
    return {
        salles: new Set(),
        amphis: new Set()
    };
}

// -----------------------------------------
// INITIALISATION DU SIAD
// -----------------------------------------

function initialiserInterfaceSIAD() {
    const zone = document.getElementById("zoneSIAD");

    if (!zone) {
        console.error("Zone SIAD introuvable.");
        return;
    }

    if (document.getElementById("anneeSIAD")) return;

    zone.innerHTML = `
        <div class="siad-entete">
            <div>
                <h3>📊 Tableau de bord SIAD</h3>
                <p>
                    Statistiques des examens et utilisation des locaux
                </p>
            </div>

            <div class="siad-actions">
    <button id="actualiserSIAD" type="button">
        ↻ Actualiser
    </button>

    <button id="imprimerSIAD" type="button">
        🖨️ Imprimer
    </button>

    <button id="exportPDFSIAD" type="button">
        📄 Export PDF
    </button>
</div>
        </div>

       
<div class="siad-filtres">
    <label>
        Année universitaire
        <select id="anneeSIAD"></select>
    </label>

    <label>
        Session
        <select id="sessionSIAD"></select>
    </label>

    
<label>
    PoidsSalle
    <select id="poidsSalleSIAD">
        <option value="0">0</option>
        <option value="1" selected>1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
    </select>
</label>

<label>
    PoidsAmphi
    <select id="poidsAmphiSIAD">
        <option value="0">0</option>
        <option value="1" selected>1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
    </select>
</label>

    </label>
</div>


        <p id="etatSIAD" role="status">
            Chargement des calendriers publiés...
        </p>

        <div id="resultatsSIAD"></div>
    `;

    const style = document.createElement("style");

    style.textContent = `
        .siad-entete {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
            margin-bottom: 20px;
        }

        .siad-entete h3 {
            margin: 0 0 6px;
        }

        .siad-entete p {
            margin: 0;
            color: #64748b;
        }

        .siad-filtres {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 16px;
        }

        .siad-filtres label {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-weight: 600;
        }

     .siad-filtres select,
.siad-filtres input,
#actualiserSIAD {
       
            padding: 9px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            background: white;
            color: #1e293b;
        }

        #actualiserSIAD {
            cursor: pointer;
            font-weight: 600;
        }

        .siad-table-wrapper {
            overflow-x: auto;
            margin: 18px 0 28px;
            border: 1px solid #dbe2ea;
            border-radius: 8px;
        }

        .siad-table {
            width: 100%;
            min-width: 800px;
            border-collapse: collapse;
            background: white;
        }

        .siad-table th,
        .siad-table td {
            border: 1px solid #dbe2ea;
            padding: 9px 12px;
            text-align: center;
            white-space: nowrap;
        }

        .siad-table thead th {
            background: #eaf1f8;
            color: #1e293b;
        }

        .siad-table th:first-child {
            text-align: left;
        }

        .siad-table tbody th {
            text-align: left;
            background: #f8fafc;
        }

        .siad-table .siad-total {
            font-weight: 700;
            background: #edf5ed;
        }

        .siad-table .siad-ligne-total th,
        .siad-table .siad-ligne-total td {
            font-weight: 700;
            background: #e8eef7;
        }

        .siad-section-titre {
            margin: 24px 0 10px;
        }

        .siad-message {
            padding: 12px;
            border-radius: 6px;
            background: #f1f5f9;          
        }


        .siad-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.siad-actions button {
    padding: 9px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: white;
    color: #1e293b;
    cursor: pointer;
    font-weight: 600;
}



@page {
    size: A3 landscape;
    margin: 8mm;
}

    html,
    body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        color: black !important;
        font-size: 8px !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

  /* Masquer uniquement les boutons */
#actualiserSIAD,
#imprimerSIAD,
#exportPDFSIAD {
    display: none !important;
}

/* Conserver les filtres pour afficher l'année et la session */
.siad-filtres {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
    margin: 4px 0 !important;
}

/* Masquer les listes déroulantes, mais conserver leurs valeurs */
.siad-filtres select,
.siad-filtres input {
    appearance: none !important;
    -webkit-appearance: none !important;
    border: none !important;
    background: transparent !important;
    color: black !important;
    font-size: 8px !important;
    padding: 0 !important;
}

/* Conserver le titre et le sous-titre */
.siad-entete h3 {
    display: block !important;
}

.siad-entete p {
    display: block !important;
}

    .siad-entete {
        margin-bottom: 5px !important;
    }

    .siad-entete h3 {
        font-size: 13px !important;
        margin-bottom: 3px !important;
    }

    .siad-entete p,
    #etatSIAD {
        font-size: 8px !important;
    }

    .siad-section-titre {
        font-size: 10px !important;
        margin: 8px 0 4px !important;
        page-break-after: avoid;
        break-after: avoid;
    }

    .siad-table-wrapper {
        width: 100% !important;
        max-width: none !important;
        overflow: visible !important;
        margin: 0 0 8px !important;
        border: none !important;
        border-radius: 0 !important;
    }

  .siad-table {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: auto !important;
    border-collapse: collapse !important;
    font-size: 9px !important;
}

.siad-table th,
.siad-table td {
    font-size: 9px !important;
    padding: 4px 5px !important;
    white-space: normal !important;
    overflow-wrap: normal !important;
    word-break: normal !important;
    border: 1px solid #999 !important;
}

    .siad-table thead th {
        background: #eaf1f8 !important;
        color: black !important;
    }

    .siad-table tbody th {
        background: #f8fafc !important;
    }

    .siad-table .siad-total,
    .siad-table .siad-ligne-total th,
    .siad-table .siad-ligne-total td {
        background: #e8eef7 !important;
    }

    .siad-table small {
    font-size: 8px !important;
}
    .siad-table tr {
        break-inside: avoid;
        page-break-inside: avoid;
    }
}


    `;

    document.head.appendChild(style);

    document.getElementById("actualiserSIAD")
        .addEventListener("click", chargerSIAD);

    document.getElementById("imprimerSIAD")
    .addEventListener("click", () => {
        window.print();
    });

    document.getElementById("exportPDFSIAD")
    .addEventListener("click", () => {
        window.print();
    });

    document.getElementById("anneeSIAD")
        .addEventListener("change", afficherSIAD);

    document.getElementById("sessionSIAD")
        .addEventListener("change", afficherSIAD);

    document.getElementById("poidsSalleSIAD")
    .addEventListener("change", afficherSIAD);

   document.getElementById("poidsAmphiSIAD")
    .addEventListener("change", afficherSIAD);
}

// -----------------------------------------
// LIRE LES CALENDRIERS PUBLIÉS
// -----------------------------------------

async function chargerSIAD() {
    if (chargementSIAD) return;

    chargementSIAD = true;

    const etat = document.getElementById("etatSIAD");

    if (etat) {
        etat.textContent =
            "Actualisation des calendriers publiés...";
    }

    const bouton = document.getElementById("actualiserSIAD");

    if (bouton) bouton.disabled = true;

    try {
        const resultat = await getDocs(
            collection(db, "calendriers")
        );

        calendriersPubliesSIAD = resultat.docs
            .map(document => ({
                id: document.id,
                ...document.data()
            }))
            .filter(calendrier =>
                calendrier.statut === "publie" &&
                calendrier.anneeUniversitaire &&
                calendrier.sessionCode
            );

        remplirFiltresSIAD();
        afficherSIAD();

        console.log(
            "SIAD : calendriers publiés chargés :",
            calendriersPubliesSIAD.length
        );

    } catch (erreur) {
        console.error("Erreur de chargement SIAD :", erreur);

        if (etat) {
            etat.textContent =
                "Impossible de lire les calendriers publiés. " +
                "Vérifiez les autorisations Firestore et la connexion.";
        }

    } finally {
        chargementSIAD = false;

        if (bouton) bouton.disabled = false;
    }
}

// -----------------------------------------
// FILTRES ANNÉE ET SESSION
// -----------------------------------------

function remplirFiltresSIAD() {
    const selectAnnee = document.getElementById("anneeSIAD");
    const selectSession = document.getElementById("sessionSIAD");

    if (!selectAnnee || !selectSession) return;

    const ancienneAnnee = selectAnnee.value;
    const ancienneSession = selectSession.value;

    const annees = [
        ...new Set(
            calendriersPubliesSIAD.map(c => c.anneeUniversitaire)
        )
    ].sort().reverse();

    selectAnnee.innerHTML = annees.map(annee => `
        <option value="${echapperSIAD(annee)}">
            ${echapperSIAD(annee)}
        </option>
    `).join("");

    if (annees.includes(ancienneAnnee)) {
        selectAnnee.value = ancienneAnnee;
    }

    const anneeChoisie = selectAnnee.value;

    const calendriersAnnee = calendriersPubliesSIAD.filter(
        c => c.anneeUniversitaire === anneeChoisie
    );

    const sessions = [
        ...new Map(
            calendriersAnnee.map(c => [
                c.sessionCode,
                {
                    code: c.sessionCode,
                    libelle: c.sessionLibelle || c.sessionCode
                }
            ])
        ).values()
    ];

    selectSession.innerHTML = sessions.map(session => `
        <option value="${echapperSIAD(session.code)}">
            ${echapperSIAD(session.libelle)}
        </option>
    `).join("");

    if (sessions.some(s => s.code === ancienneSession)) {
        selectSession.value = ancienneSession;
    }
}

// -----------------------------------------
// CONSTRUIRE LES DONNÉES D'UNE SESSION
// -----------------------------------------

function construireDonneesSIAD(calendriers) {

    const examens = new Map();
    const locaux = new Map();
    const creneaux = new Map();

    // -----------------------------------------
    // CONSTRUIRE LA CLÉ D'UN CRÉNEAU
    // -----------------------------------------

    function obtenirCle(date, ordre) {
        return `${date}|${ordre}`;
    }

    // -----------------------------------------
    // INITIALISER LE CRÉNEAU SI NÉCESSAIRE
    // -----------------------------------------

    function assurerCreneau(date, ordre, cellule) {

        const cle = obtenirCle(date, ordre);

        if (!creneaux.has(cle)) {

            creneaux.set(cle, {
                cle,
                date,
                ordre,
                debut: cellule.heureDebutAffichage || "",
                fin: cellule.heureFinAffichage || ""
            });

        }

        return cle;
    }

    // -----------------------------------------
    // PARCOURIR LES CALENDRIERS PUBLIÉS
    // -----------------------------------------

    for (const calendrier of calendriers) {

        const niveau = calendrier.niveauCode;

        // Ignorer les niveaux non gérés par le SIAD
        if (!NIVEAUX_SIAD.includes(niveau)) {
            continue;
        }

        const filieres = calendrier.planning?.filieres;

        if (!Array.isArray(filieres)) {
            continue;
        }

        // -----------------------------------------
        // PARCOURIR LES FILIÈRES
        // -----------------------------------------

        for (const filiere of filieres) {

            const cellules = obtenirCellulesSIAD(filiere);

            // -----------------------------------------
            // PARCOURIR LES CELLULES DE LA FILIÈRE
            // -----------------------------------------

            for (const cellule of cellules) {

                const date = cleDateSIAD(cellule.date);

                if (
                    !date ||
                    cellule.creneauOrdre == null
                ) {
                    continue;
                }

                const cle = assurerCreneau(
                    date,
                    cellule.creneauOrdre,
                    cellule
                );

                // -----------------------------------------
                // INITIALISER LES COMPTEURS DU CRÉNEAU
                // -----------------------------------------

                if (!examens.has(cle)) {

                    examens.set(cle, {
                        total: 0,
                        niveaux: Object.fromEntries(
                            NIVEAUX_SIAD.map(n => [n, 0])
                        )
                    });

                }

                if (!locaux.has(cle)) {

                    locaux.set(
                        cle,
                        creerEnsembleLocauxSIAD()
                    );

                }

                // -----------------------------------------
                // TRAITER UNIQUEMENT LES EXAMENS OCCUPÉS
                // -----------------------------------------

                if (!estOccupeeSIAD(cellule)) {
                    continue;
                }

                // Un examen est compté pour chaque filière.
                // Une matière commune à deux filières est donc
                // comptée une fois dans chacune de ces filières.

                examens.get(cle).total++;

                examens.get(cle).niveaux[niveau]++;

                // -----------------------------------------
                // 1. RECHERCHER LES LOCAUX DANS LA CELLULE
                // -----------------------------------------

                extraireLocauxSIAD(
                    cellule,
                    locaux.get(cle)
                );

                // -----------------------------------------
                // 2. LIRE LES LOCAUX DE LA FILIÈRE
                // -----------------------------------------
                // Firestore peut contenir, par exemple :
                // filiere.amphis = ["A01", "S01"]
                //
                // A... : amphithéâtre
                // S... : salle
                //
                // Les Set empêchent de compter deux fois
                // un même local pour un même créneau.

                if (Array.isArray(filiere.amphis)) {

                    const ensemble = locaux.get(cle);

                    for (const valeur of filiere.amphis) {

                        if (valeur == null) {
                            continue;
                        }

                        const code = String(valeur).trim();

                        if (!code) {
                            continue;
                        }

                        // Amphithéâtres : A01, A02, etc.
                        if (/^A/i.test(code)) {

                            ensemble.amphis.add(code);

                        }

                        // Salles : S01, S02, etc.
                        else if (/^S/i.test(code)) {

                            ensemble.salles.add(code);

                        }

                        // Signaler les codes non reconnus
                        else {

                            console.warn(
                                "SIAD : code de local non reconnu :",
                                code,
                                "| Filière :",
                                filiere.filiereCode
                            );

                        }

                    }

                }

            }

        }

    }

    // -----------------------------------------
    // RETOURNER LES DONNÉES AGRÉGÉES
    // -----------------------------------------

    return {

        creneaux: [...creneaux.values()].sort(
            (a, b) =>
                a.date.localeCompare(b.date) ||
                Number(a.ordre) - Number(b.ordre)
        ),

        examens,

        locaux

    };

}

// -----------------------------------------
// GÉNÉRER UN TABLEAU SIAD
// -----------------------------------------

function construireTableauSIAD(
    titre,
    creneaux,
    obtenirValeur,
    totalParLigne,
    lignesPersonnalisees = null,
    libelleTotal = "Total par créneau"
) {
    if (!creneaux.length) {
        return `
            <h3 class="siad-section-titre">
                ${echapperSIAD(titre)}
            </h3>
            <p class="siad-message">
                Aucun créneau trouvé pour cette session.
            </p>
        `;
    }

    const groupesDates = [];

    for (const creneau of creneaux) {
        let groupe = groupesDates.find(
            g => g.date === creneau.date
        );

        if (!groupe) {
            groupe = {
                date: creneau.date,
                creneaux: []
            };

            groupesDates.push(groupe);
        }

        groupe.creneaux.push(creneau);
    }

    let html = `
        <h3 class="siad-section-titre">
            ${echapperSIAD(titre)}
        </h3>

        <div class="siad-table-wrapper">
            <table class="siad-table">
                <thead>
                    <tr>
                        <th rowspan="2">Indicateurs</th>
    `;

    for (const groupe of groupesDates) {
        html += `
            <th colspan="${groupe.creneaux.length}">
                ${echapperSIAD(
                    afficherDateLongueSIAD(groupe.date)
                )}
            </th>
        `;
    }

    html += `<th rowspan="2">Total</th></tr><tr>`;

    for (const creneau of creneaux) {
        const numero = Number(creneau.ordre);

        const horaires = creneau.debut && creneau.fin
            ? `<small>${echapperSIAD(creneau.debut)}–${echapperSIAD(creneau.fin)}</small>`
            : "";

        html += `
            <th>
                C${echapperSIAD(numero)}
                ${horaires}
            </th>
        `;
    }

    html += `</tr></thead><tbody>`;

         const lignes = lignesPersonnalisees ??
    NIVEAUX_SIAD.map(niveau => ({
        nom: niveau,
        valeur: cle => obtenirValeur(cle, niveau)
    }));

    for (const ligne of lignes) {
        let totalLigne = 0;

        html += `<tr><th>${echapperSIAD(ligne.nom)}</th>`;

        for (const creneau of creneaux) {
            const valeur = Number(ligne.valeur(creneau.cle)) || 0;

            totalLigne += valeur;

            html += `<td>${valeur}</td>`;
        }

        html += `<td class="siad-total">${totalLigne}</td></tr>`;
    }

    html += `
        <tr class="siad-ligne-total">
           <th>${echapperSIAD(libelleTotal)}</th>
    `;

    let totalGeneral = 0;

    for (const creneau of creneaux) {
        const valeur = Number(totalParLigne(creneau.cle)) || 0;

        totalGeneral += valeur;

        html += `<td>${valeur}</td>`;
    }

    html += `
            <td>${totalGeneral}</td>
        </tr>
        </tbody>
        </table>
        </div>
    `;

    return html;
}

// -----------------------------------------
// AFFICHER LES DEUX TABLEAUX
// -----------------------------------------

function afficherSIAD() {
    const resultat = document.getElementById("resultatsSIAD");
    const etat = document.getElementById("etatSIAD");

    if (!resultat) return;

    const annee = document.getElementById("anneeSIAD")?.value;
    const session = document.getElementById("sessionSIAD")?.value;

    const calendriers = calendriersPubliesSIAD.filter(c =>
        c.anneeUniversitaire === annee &&
        c.sessionCode === session &&
        c.statut === "publie"
    );

    if (!calendriers.length) {
        resultat.innerHTML = `
            <p class="siad-message">
                Aucun calendrier publié pour cette année et cette session.
            </p>
        `;

        if (etat) {
            etat.textContent = "Aucun calendrier disponible.";
        }

        return;
    }

    const donnees = construireDonneesSIAD(calendriers);

    // Le tableau Examens compte les matières programmées,
    // par niveau et par créneau, sans compter les étudiants.
    const tableauExamens = construireTableauSIAD(
        "📅 Examens",
        donnees.creneaux,
        (cle, niveau) => {
            const ligne = donnees.examens.get(cle);

            if (!ligne) return 0;

            return niveau === "total"
                ? ligne.total
                : ligne.niveaux[niveau] || 0;
        },
        cle => donnees.examens.get(cle)?.total || 0
    );

    // Le tableau des locaux compte les locaux distincts
    // dont l'affectation a été retrouvée pour chaque créneau.
   
    // -----------------------------------------
    // TABLEAU DES LOCAUX : VALEURS PONDÉRÉES
    // -----------------------------------------

    const poidsSalle = Math.min(5, Math.max(
        0,
        Number(document.getElementById("poidsSalleSIAD")?.value) || 0
    ));

    const poidsAmphi = Math.min(5, Math.max(
        0,
        Number(document.getElementById("poidsAmphiSIAD")?.value) || 0
    ));

    const tableauLocaux = construireTableauSIAD(
        "🏫 Utilisation pondérée des salles et amphithéâtres",
        donnees.creneaux,

        (cle, indicateur) => {
            const ensemble = donnees.locaux.get(cle);

            if (!ensemble) return 0;

            if (indicateur === "Salles") {
                return ensemble.salles.size * poidsSalle;
            }

            if (indicateur === "Amphis") {
                return ensemble.amphis.size * poidsAmphi;
            }

            return 0;
        },

        cle => {
            const ensemble = donnees.locaux.get(cle);

            if (!ensemble) return 0;

            return (
                ensemble.salles.size * poidsSalle +
                ensemble.amphis.size * poidsAmphi
            );
        },

        [
            {
                nom: "Salles",
                valeur: cle => {
                    const ensemble = donnees.locaux.get(cle);
                    return ensemble
                        ? ensemble.salles.size * poidsSalle
                        : 0;
                }
            },
            {
                nom: "Amphis",
                valeur: cle => {
                    const ensemble = donnees.locaux.get(cle);
                    return ensemble
                        ? ensemble.amphis.size * poidsAmphi
                        : 0;
                }
            }
        ],

        "Total pondéré par créneau"
    );

    resultat.innerHTML = tableauExamens + tableauLocaux;


    if (etat) {
        etat.textContent =
            `${calendriers.length} calendrier(s) publié(s) analysé(s).`;
    }

    console.log(
        "SIAD calculé :",
        {
            annee,
            session,
            calendriers: calendriers.length,
            creneaux: donnees.creneaux.length
        }
    );
}

// -----------------------------------------
// RAFRAÎCHIR À L'OUVERTURE DE SIAD
// -----------------------------------------

initialiserInterfaceSIAD();

// Chargement initial
chargerSIAD();

// Le menu d'administration peut afficher/masquer
// la section SIAD sans recharger toute la page.
let siadEtaitVisible = false;

function verifierOuvertureSIAD() {
    const section = document.getElementById("siad");
    if (!section) return;

    const visible =
        section.getClientRects().length > 0 &&
        getComputedStyle(section).display !== "none" &&
        getComputedStyle(section).visibility !== "hidden";

    if (visible && !siadEtaitVisible) {
        chargerSIAD();
    }

    siadEtaitVisible = visible;
}

const observateurSIAD = new MutationObserver(
    verifierOuvertureSIAD
);

observateurSIAD.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true
});
