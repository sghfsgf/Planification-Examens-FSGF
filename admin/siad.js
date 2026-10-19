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

            <button id="actualiserSIAD" type="button">
                ↻ Actualiser
            </button>
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
    `;

    document.head.appendChild(style);

    document.getElementById("actualiserSIAD")
        .addEventListener("click", chargerSIAD);

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
        return `${date}|${ordre
