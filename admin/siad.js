
import { app } from "../firebase-config.js";

import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const db = getFirestore(app);

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

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function afficherDateSIAD(cle) {
    const [annee, mois, jour] = cle.split("-");
    return `${jour}/${mois}/${annee}`;
}

function estOccupeeSIAD(cellule) {
    return cellule?.estOccupee === true &&
        String(cellule.matiereLibelle ?? "").trim() !== "";
}

function obtenirCellulesSIAD(filiere) {
    return Array.isArray(filiere?.cellules)
        ? filiere.cellules
        : [];
}

// -----------------------------------------
// EXTRACTION DES LOCAUX
// -----------------------------------------

function creerEnsembleLocauxSIAD() {
    return {
        salles: new Set(),
        amphis: new Set()
    };
}

function ajouterLocalSIAD(valeur, resultat, typeForce = null) {
    if (valeur == null) return;

    if (Array.isArray(valeur)) {
        valeur.forEach(element =>
            ajouterLocalSIAD(element, resultat, typeForce)
        );
        return;
    }

    if (typeof valeur === "object") {
        const code =
            valeur.code ??
            valeur.salleCode ??
            valeur.amphiCode ??
            valeur.localCode ??
            valeur.nom ??
            valeur.libelle ??
            valeur.id;

        if (code != null) {
            ajouterLocalSIAD(code, resultat, typeForce);
        }
        return;
    }

    // Certains anciens formats utilisent || ou +.
    String(valeur)
        .split(/\s*(?:\|\||\+|,|;)\s*/)
        .map(code => code.trim())
        .filter(Boolean)
        .forEach(code => {
            const type = typeForce ||
                (/^A/i.test(code) ? "amphis" : "salles");

            resultat[type].add(code);
        });
}

function extraireLocauxSIAD(objet) {
    const resultat = creerEnsembleLocauxSIAD();

    if (!objet || typeof objet !== "object") {
        return resultat;
    }

    const amphis = objet.amphis ??
        objet.amphi ??
        objet.amphitheatres;

    const salles = objet.salles ??
        objet.salle ??
        objet.locaux;

    if (amphis != null) {
        ajouterLocalSIAD(amphis, resultat, "amphis");
    }

    if (salles != null) {
        ajouterLocalSIAD(salles, resultat, "salles");
    }

    // Format courant : filiere.amphis = ["A01", "A02"].
    if (objet.amphis == null && Array.isArray(objet.amphis)) {
        ajouterLocalSIAD(objet.amphis, resultat, "amphis");
    }

    // Recherche des codes dans les champs de locaux connus.
    for (const [cle, valeur] of Object.entries(objet)) {
        const nom = cle.toLowerCase();

        if (
            nom.includes("amphi") &&
            valeur != null
        ) {
            ajouterLocalSIAD(valeur, resultat, "amphis");
        } else if (
            nom.includes("salle") ||
            nom === "local" ||
            nom === "localcode" ||
            nom === "locauxaffectes"
        ) {
            ajouterLocalSIAD(valeur, resultat);
        }
    }

    // Les codes A... sont toujours classés comme amphithéâtres.
    for (const code of [...resultat.salles]) {
        if (/^A/i.test(code)) {
            resultat.salles.delete(code);
            resultat.amphis.add(code);
        }
    }

    return resultat;
}

// -----------------------------------------
// INITIALISATION
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
                <p>Statistiques des examens et utilisation des locaux</p>
            </div>
            <button id="actualiserSIAD" type="button">↻ Actualiser</button>
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
                    ${[0,1,2,3,4,5].map(n =>
                        `<option value="${n}" ${n === 1 ? "selected" : ""}>${n}</option>`
                    ).join("")}
                </select>
            </label>

            <label>
                PoidsAmphi
                <select id="poidsAmphiSIAD">
                    ${[0,1,2,3,4,5].map(n =>
                        `<option value="${n}" ${n === 1 ? "selected" : ""}>${n}</option>`
                    ).join("")}
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
            display:flex; align-items:center;
            justify-content:space-between; gap:16px;
            flex-wrap:wrap; margin-bottom:20px;
        }
        .siad-entete h3 { margin:0 0 6px; }
        .siad-entete p { margin:0; color:#64748b; }
        .siad-filtres {
            display:flex; flex-wrap:wrap;
            gap:16px; margin-bottom:16px;
        }
        .siad-filtres label {
            display:flex; flex-direction:column;
            gap:6px; font-weight:600;
        }
        .siad-filtres select, #actualiserSIAD {
            padding:9px 12px; border:1px solid #cbd5e1;
            border-radius:6px; background:white; color:#1e293b;
        }
        #actualiserSIAD { cursor:pointer; font-weight:600; }
        .siad-table-wrapper {
            overflow-x:auto; margin:18px 0 28px;
            border:1px solid #dbe2ea; border-radius:8px;
        }
        .siad-table {
            width:100%; min-width:650px;
            border-collapse:collapse; background:white;
        }
        .siad-table th, .siad-table td {
            border:1px solid #dbe2ea; padding:9px 12px;
            text-align:center; white-space:nowrap;
        }
        .siad-table thead th { background:#eaf1f8; color:#1e293b; }
        .siad-table th:first-child { text-align:left; }
        .siad-table tbody th { text-align:left; background:#f8fafc; }
        .siad-table .siad-ligne-total th,
        .siad-table .siad-ligne-total td {
            font-weight:700; background:#e8eef7;
        }
        .siad-section-titre { margin:24px 0 10px; }
        .siad-message {
            padding:12px; border-radius:6px; background:#f1f5f9;
        }
    `;

    document.head.appendChild(style);

    document.getElementById("actualiserSIAD")
        .addEventListener("click", chargerSIAD);

    ["anneeSIAD", "sessionSIAD", "poidsSalleSIAD", "poidsAmphiSIAD"]
        .forEach(id => {
            document.getElementById(id)
                .addEventListener("change", afficherSIAD);
        });
}

// -----------------------------------------
// CHARGER LES CALENDRIERS PUBLIÉS
// -----------------------------------------

async function chargerSIAD() {
    if (chargementSIAD) return;

    chargementSIAD = true;

    const etat = document.getElementById("etatSIAD");
    const bouton = document.getElementById("actualiserSIAD");

    if (etat) etat.textContent = "Actualisation des calendriers publiés...";
    if (bouton) bouton.disabled = true;

    try {
        const resultat = await getDocs(collection(db, "calendriers"));
        // DIAGNOSTIC TEMPORAIRE SIAD
console.log(
    "Premier document calendrier :",
    resultat.docs[0]?.id
);

console.log(
    "Données du calendrier :",
    resultat.docs[0]?.data()
);

console.log(
    "Champs disponibles :",
    Object.keys(resultat.docs[0]?.data() ?? {})
);

        calendriersPubliesSIAD = resultat.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(c =>
                c.statut === "publie" &&
                c.anneeUniversitaire &&
                c.sessionCode
            );

        remplirFiltresSIAD();
        afficherSIAD();

        if (etat) {
            etat.textContent =
                `${calendriersPubliesSIAD.length} calendrier(s) publié(s) chargé(s).`;
        }
    } catch (erreur) {
        console.error("Erreur de chargement SIAD :", erreur);
        if (etat) {
            etat.textContent =
                "Impossible de lire les calendriers publiés. Vérifiez Firestore.";
        }
    } finally {
        chargementSIAD = false;
        if (bouton) bouton.disabled = false;
    }
}

// -----------------------------------------
// FILTRES
// -----------------------------------------

function remplirFiltresSIAD() {
    const selectAnnee = document.getElementById("anneeSIAD");
    const selectSession = document.getElementById("sessionSIAD");

    if (!selectAnnee || !selectSession) return;

    const ancienneAnnee = selectAnnee.value;
    const ancienneSession = selectSession.value;

    const annees = [...new Set(
        calendriersPubliesSIAD.map(c => c.anneeUniversitaire)
    )].sort().reverse();

    selectAnnee.innerHTML = annees.map(annee =>
        `<option value="${echapperSIAD(annee)}">${echapperSIAD(annee)}</option>`
    ).join("");

    if (annees.includes(ancienneAnnee)) {
        selectAnnee.value = ancienneAnnee;
    }

    const anneeChoisie = selectAnnee.value;

    const sessions = [...new Map(
        calendriersPubliesSIAD
            .filter(c => c.anneeUniversitaire === anneeChoisie)
            .map(c => [
                c.sessionCode,
                { code: c.sessionCode, libelle: c.sessionLibelle || c.sessionCode }
            ])
    ).values()];

    selectSession.innerHTML = sessions.map(s =>
        `<option value="${echapperSIAD(s.code)}">${echapperSIAD(s.libelle)}</option>`
    ).join("");

    if (sessions.some(s => s.code === ancienneSession)) {
        selectSession.value = ancienneSession;
    }
}

// -----------------------------------------
// CONSTRUIRE LES DONNÉES PAR CRÉNEAU
// -----------------------------------------

function construireDonneesSIAD(calendriers) {
    const creneaux = new Map();

    calendriers.forEach(calendrier => {
        const filieres = Array.isArray(calendrier.filieres)
            ? calendrier.filieres
            : [];

        filieres.forEach(filiere => {
            const cellules = obtenirCellulesSIAD(filiere);

            cellules.forEach((cellule, index) => {
                if (!estOccupeeSIAD(cellule)) return;

                const date = cleDateSIAD(
                    cellule.date ?? cellule.dateExamen
                );

                const ordre = cellule.ordreCreneau ??
                    cellule.creneauOrdre ??
                    cellule.creneauCode ??
                    cellule.creneau ??
                    cellule.heureDebut ??
                    index;

                if (!date) return;

                const cle = `${date}|${ordre}`;

                if (!creneaux.has(cle)) {
                    creneaux.set(cle, {
                        cle,
                        date,
                        ordre: String(ordre),
                        matieres: new Set(),
                        salles: new Set(),
                        amphis: new Set()
                    });
                }

                const ligne = creneaux.get(cle);
                ligne.matieres.add(
                    String(cellule.matiereLibelle).trim()
                );

                const locaux = extraireLocauxSIAD({
                    ...cellule,
                    ...filiere
                });

                locaux.salles.forEach(code => ligne.salles.add(code));
                locaux.amphis.forEach(code => ligne.amphis.add(code));
            });
        });
    });

    return [...creneaux.values()].sort((a, b) =>
        a.date.localeCompare(b.date) ||
        a.ordre.localeCompare(b.ordre, undefined, { numeric: true })
    );
}

// -----------------------------------------
// AFFICHER LE SIAD
// -----------------------------------------

function afficherSIAD() {
    const resultat = document.getElementById("resultatsSIAD");
    if (!resultat) return;

    const annee = document.getElementById("anneeSIAD")?.value;
    const session = document.getElementById("sessionSIAD")?.value;

    const poidsSalle = Number(
        document.getElementById("poidsSalleSIAD")?.value ?? 1
    );

    const poidsAmphi = Number(
        document.getElementById("poidsAmphiSIAD")?.value ?? 1
    );

    const calendriers = calendriersPubliesSIAD.filter(c =>
        c.anneeUniversitaire === annee &&
        c.sessionCode === session
    );

    if (!calendriers.length) {
        resultat.innerHTML =
            `<p class="siad-message">Aucun calendrier publié pour ces filtres.</p>`;
        return;
    }

    const lignes = construireDonneesSIAD(calendriers);

    if (!lignes.length) {
        resultat.innerHTML =
            `<p class="siad-message">Aucun examen occupé trouvé dans ces calendriers.</p>`;
        return;
    }

    let totalSalles = 0;
    let totalAmphis = 0;
    let totalGeneral = 0;

    const corps = lignes.map(ligne => {
        const sallesPonderees = ligne.salles.size * poidsSalle;
        const amphisPonderes = ligne.amphis.size * poidsAmphi;
        const total = sallesPonderees + amphisPonderes;

        totalSalles += sallesPonderees;
        totalAmphis += amphisPonderes;
        totalGeneral += total;

        return `
            <tr>
                <th>${echapperSIAD(
                    `${afficherDateSIAD(ligne.date)} — ${ligne.ordre}`
                )}</th>
                <td>${sallesPonderees}</td>
                <td>${amphisPonderes}</td>
                <td>${total}</td>
                <td>${ligne.matieres.size}</td>
            </tr>
        `;
    }).join("");

    resultat.innerHTML = `
        <h4 class="siad-section-titre">Total par créneau</h4>

        <p class="siad-message">
            Les valeurs des locaux sont pondérées selon les poids sélectionnés.
            Les nombres affichés ne sont pas les nombres réels de locaux.
        </p>

        <div class="siad-table-wrapper">
            <table class="siad-table">
                <thead>
                    <tr>
                        <th>Date / créneau</th>
                        <th>Salles utilisées</th>
                        <th>Amphis utilisés</th>
                        <th>Total pondéré</th>
                        <th>Matières</th>
                    </tr>
                </thead>
                <tbody>
                    ${corps}
                    <tr class="siad-ligne-total">
                        <th>Total de la session</th>
                        <td>${totalSalles}</td>
                        <td>${totalAmphis}</td>
                        <td>${totalGeneral}</td>
                        <td>—</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

// -----------------------------------------
// DÉMARRAGE
// -----------------------------------------

initialiserInterfaceSIAD();
chargerSIAD();
