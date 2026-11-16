// =================================================
// AFFECTATION DES SALLES / AMPHIS 
//
// Principes :
//  1. On ne sauvegarde QUE les affectations propres (succès complet d'une filière)
//  2. AUCUNE double réservation possible : index d'occupation unique,
//     alimenté par TOUT ce qui existe déjà en base
//  3. Lecture Firestore unique, écriture par lots de 450
// =================================================

import { app } from "../firebase-config.js";
import {
    getFirestore,
    getDocs,
    collection,
    query,
    where,
    doc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const db = getFirestore(app);

// -------------------------------------------------
// CONFIGURATION
// -------------------------------------------------
const CONFIG = {
    // ⚠️ CORRECTIF C4 : fuseau explicite. Ne JAMAIS dépendre du fuseau du navigateur.
    fuseau: "Africa/Tunis",
    // ⚠️ CORRECTIF C1 : Firestore limite un batch à 500 opérations
    tailleLot: 450,
    // Marge de sécurité : 0.95 = on ne remplit jamais à plus de 95 %
    tauxRemplissage: 1.0,
    // En dessous, on n'ouvre pas un local supplémentaire
    minimumParLocal: 5
};

console.log("✓ affectation-salles.js (version corrigée) chargé.");

// =================================================
// 1. OUTILS DE DATE  — CORRECTIF C4
// =================================================

const _formateurJour = new Intl.DateTimeFormat("fr-CA", {
    timeZone: CONFIG.fuseau,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});

function jourCivilDepuisDate(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
        throw new Error("Date invalide.");
    }
    const p = Object.fromEntries(
        _formateurJour.formatToParts(date).map(x => [x.type, x.value])
    );
    return `${p.year}-${p.month}-${p.day}`;
}

function jourCivilAffectation(valeur) {
    if (valeur == null) throw new Error("Date absente.");

    // Chaîne
    if (typeof valeur === "string") {
        const pure = valeur.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (pure) {
            const y = +pure[1], mo = +pure[2], d = +pure[3];
            const v = new Date(Date.UTC(y, mo - 1, d));
            if (v.getUTCFullYear() !== y || v.getUTCMonth() !== mo - 1 || v.getUTCDate() !== d) {
                throw new Error("Jour civil inexistant : " + valeur);
            }
            return valeur; // déjà normalisée, aucune conversion de fuseau
        }
        const dt = new Date(valeur);
        if (!Number.isFinite(dt.getTime())) throw new Error("Date non ISO : " + valeur);
        return jourCivilDepuisDate(dt); // ← conversion dans le fuseau configuré
    }

    // Date native
    if (valeur instanceof Date) return jourCivilDepuisDate(valeur);

    // Timestamp Firestore
    if (typeof valeur.toDate === "function") return jourCivilDepuisDate(valeur.toDate());

    // Timestamp sérialisé { seconds, nanoseconds }
    if (Number.isInteger(valeur.seconds)) {
        const ns = valeur.nanoseconds ?? 0;
        if (!Number.isInteger(ns) || ns < 0 || ns >= 1e9) {
            throw new Error("Timestamp invalide (nanoseconds).");
        }
        return jourCivilDepuisDate(new Date(valeur.seconds * 1000 + ns / 1e6));
    }

    throw new Error("Format de date non pris en charge.");
}

function cleCreneauAffectation(cellule) {
    const brut = cellule?.creneauOrdre;
    if (brut == null || brut === "" || typeof brut === "boolean") {
        throw new Error("Créneau absent ou invalide.");
    }
    const ordre = Number(brut);
    if (!Number.isInteger(ordre) || ordre <= 0) throw new Error("Ordre de créneau invalide.");
    return jourCivilAffectation(cellule.date) + "|" + ordre;
}

// =================================================
// 2. VALIDATIONS
// =================================================

function estDisponible(local) {                       // CORRECTIF L5
    const v = local?.disponible;
    if (v === true) return true;
    if (v === false || v == null) return false;
    return ["oui", "yes", "true", "1", "vrai", "disponible"]
        .includes(String(v).trim().toLowerCase());
}

function catalogueLocauxValide(salles) {
    if (!Array.isArray(salles) || salles.length === 0) {
        throw new Error("Catalogue des locaux vide ou invalide.");
    }
    const codes = new Set();
    for (const s of salles) {
        if (!s || typeof s.code !== "string" || !s.code.trim()) {
            throw new Error("Code local invalide.");
        }
        if (codes.has(s.code)) throw new Error("Code local dupliqué : " + s.code);
        codes.add(s.code);
        const cap = Number(s.capacite);
        if (!Number.isInteger(cap) || cap <= 0) {
            throw new Error("Capacité invalide pour " + s.code);
        }
    }
}

function codesLocauxStricts(amphis) {
    if (!Array.isArray(amphis)) throw new Error("Liste de locaux invalide.");
    const codes = amphis.map(l => (typeof l === "string" ? l : (l?.code ?? l?.localCode)));
    const vus = new Set();
    for (const c of codes) {
        if (typeof c !== "string" || !c.trim()) throw new Error("Code d'affectation invalide.");
        if (vus.has(c)) throw new Error("Local affecté en double : " + c);
        vus.add(c);
    }
    return codes;
}

function validerPlanning(planning) {
    if (!planning || !Array.isArray(planning.filieres) || planning.filieres.length === 0) {
        throw new Error("Planning sans filière.");
    }
    if (!planning.niveauCode) throw new Error("niveauCode manquant dans le planning.");
    const vus = new Set();
    for (const f of planning.filieres) {
        if (!f?.filiereCode) throw new Error("filiereCode manquant.");
        if (vus.has(f.filiereCode)) throw new Error("Filière dupliquée : " + f.filiereCode);
        vus.add(f.filiereCode);
        if (!Array.isArray(f.cellules)) throw new Error("Cellules manquantes : " + f.filiereCode);
    }
}

// CORRECTIF M2 : mémoïsation des clés de créneaux
const _cacheCles = new WeakMap();

function clesExamens(filiere) {
    if (typeof filiere === "object" && filiere !== null && _cacheCles.has(filiere)) {
        return _cacheCles.get(filiere);
    }
    const cles = [...new Set(
        (filiere.cellules || [])
            .filter(c => c?.estOccupee)
            .map(c => cleCreneauAffectation(c))
    )];
    if (typeof filiere === "object" && filiere !== null) _cacheCles.set(filiere, cles);
    return cles;
}

// CORRECTIF M4 : effectifs indexés une seule fois
function construireIndexEffectifs(effectifs) {
    const index = new Map();
    const doublons = new Set();
    for (const l of effectifs || []) {
        if (!l?.anneeUniversitaire || !l?.niveauCode || !l?.filiereCode) continue;
        const k = `${l.anneeUniversitaire}|${l.niveauCode}|${l.filiereCode}`;
        if (index.has(k)) doublons.add(k);
        index.set(k, Number(l.effectif));
    }
    return {
        lire(annee, niveau, filiere) {
            const k = `${annee}|${niveau}|${filiere}`;
            if (doublons.has(k)) throw new Error("Effectif ambigu (doublon) : " + k);
            if (!index.has(k)) throw new Error("Effectif absent : " + k);
            const v = index.get(k);
            if (!Number.isInteger(v) || v <= 0) throw new Error("Effectif invalide : " + k);
            return v;
        }
    };
}

// =================================================
// 3. INDEX D'OCCUPATION  — CORRECTIFS C2, C3, M2
//
// Clé : "CODELOCAL@AAAA-MM-JJ|ordre"
// Accès O(1) au lieu de O(n³)
// =================================================

class IndexOccupation {
    constructor(salles) {
        this.capacites = new Map(salles.map(s => [s.code, Number(s.capacite)]));
        this.occupation = new Map();
    }

    static _k(code, cle) { return code + "@" + cle; }

    /** Déclare qu'un local est occupé sur une liste de créneaux. */
    reserver(code, cles, effectif, niveauCode, origine) {
        for (const cle of cles) {
            const k = IndexOccupation._k(code, cle);
            let e = this.occupation.get(k);
            if (!e) {
                e = { effectif: 0, niveaux: new Set(), origines: [] };
                this.occupation.set(k, e);
            }
            e.effectif += Math.max(0, Number(effectif) || 0);
            e.niveaux.add(niveauCode);
            e.origines.push(origine);
        }
    }

    /** Annule une réservation (mode « recalcul total »). */
    liberer(code, cles, effectif, origine) {
        for (const cle of cles) {
            const k = IndexOccupation._k(code, cle);
            const e = this.occupation.get(k);
            if (!e) continue;
            e.effectif = Math.max(0, e.effectif - (Number(effectif) || 0));
            e.origines = e.origines.filter(o => o !== origine);
            if (e.origines.length === 0) this.occupation.delete(k);
        }
    }

    /**
     * Capacité réellement disponible pour une filière donnée.
     * Renvoie 0 si un niveau DIFFÉRENT occupe déjà le local sur un créneau commun.
     */
    capaciteRestante(code, cles, niveauCode) {
        const cap = this.capacites.get(code) ?? 0;
        if (cap <= 0 || cles.length === 0) return 0;

        const plafond = Math.floor(cap * CONFIG.tauxRemplissage);
        let minimum = plafond;

        for (const cle of cles) {
            const e = this.occupation.get(IndexOccupation._k(code, cle));
            if (!e) continue;
            for (const n of e.niveaux) {
                if (n !== niveauCode) return 0;   // règle stricte inter-niveaux
            }
            minimum = Math.min(minimum, plafond - e.effectif);
            if (minimum <= 0) return 0;
        }
        return Math.max(0, minimum);
    }
}

// =================================================
// 4. RECHERCHE DE COMBINAISON  — CORRECTIFS L1, L4, L6
// =================================================

function rechercherCombinaison(cles, effectif, niveauCode, salles, index) {
    if (cles.length === 0) {
        return { succes: false, locaux: [], repartitionLocaux: [], message: "Filière sans examen : aucune salle requise." };
    }

    const disponibles = salles
        .filter(estDisponible)
        .map(s => ({
            code: s.code,
            capacite: Number(s.capacite),
            restant: index.capaciteRestante(s.code, cles, niveauCode)
        }))
        .filter(s => s.restant > 0);

    if (disponibles.length === 0) {
        return { succes: false, locaux: [], repartitionLocaux: [], message: "Aucun local libre sur ces créneaux." };
    }

    // --- 1) BEST FIT : le PLUS PETIT local suffisant (correctif L1)
    const suffisants = disponibles
        .filter(s => s.restant >= effectif)
        .sort((a, b) => a.restant - b.restant || a.code.localeCompare(b.code));

    if (suffisants.length > 0) {
        const choisi = suffisants[0];
        return {
            succes: true,
            locaux: [choisi.code],
            repartitionLocaux: [{ codeLocal: choisi.code, effectif }],
            message: `1 local (${choisi.code}, ${effectif}/${choisi.capacite}).`
        };
    }

    // --- 2) Greedy décroissant : minimiser le NOMBRE de locaux
    const parTaille = [...disponibles]
        .sort((a, b) => b.restant - a.restant || a.code.localeCompare(b.code));

    const retenus = [];
    let cumul = 0;
    for (const s of parTaille) {
        if (cumul >= effectif) break;
        retenus.push(s);
        cumul += s.restant;
    }

    if (cumul < effectif) {
        return {
            succes: false, locaux: [], repartitionLocaux: [],
            message: `Capacité insuffisante : ${cumul} places pour ${effectif} étudiants.`
        };
    }

    // --- 3) Équilibrage proportionnel (correctif L4)
    const repartition = equilibrer(retenus, effectif);

    // On retire les locaux à qui il ne reste rien après équilibrage
    const utiles = repartition.filter(r => r.effectif >= Math.min(CONFIG.minimumParLocal, effectif));
    const reste = effectif - utiles.reduce((s, r) => s + r.effectif, 0);
    if (reste > 0 && utiles.length > 0) {
        utiles.sort((a, b) => b.capaciteRestante - a.capaciteRestante);
        let r = reste;
        for (const u of utiles) {
            const marge = u.capaciteRestante - u.effectif;
            const ajout = Math.min(marge, r);
            u.effectif += ajout;
            r -= ajout;
            if (r <= 0) break;
        }
        if (r > 0) return { succes: false, locaux: [], repartitionLocaux: [], message: "Échec de l'équilibrage." };
    }

    const finale = utiles.map(u => ({ codeLocal: u.codeLocal, effectif: u.effectif }));
    const controle = finale.reduce((s, r) => s + r.effectif, 0);
    if (controle !== effectif) {
        return { succes: false, locaux: [], repartitionLocaux: [], message: `Incohérence : ${controle} ≠ ${effectif}.` };
    }

    return {
        succes: true,
        locaux: finale.map(r => r.codeLocal),
        repartitionLocaux: finale,
        message: `${finale.length} locaux : ` + finale.map(r => `${r.codeLocal}(${r.effectif})`).join(", ")
    };
}

/** Répartit `effectif` proportionnellement aux capacités restantes, sans dépassement. */
function equilibrer(locaux, effectif) {
    const total = locaux.reduce((s, l) => s + l.restant, 0);
    const sortie = locaux.map(l => ({
        codeLocal: l.code,
        capaciteRestante: l.restant,
        effectif: Math.min(l.restant, Math.floor(effectif * l.restant / total))
    }));
    // Distribution du reste entier, place par place
    let reste = effectif - sortie.reduce((s, r) => s + r.effectif, 0);
    let i = 0, garde = 0;
    while (reste > 0 && garde++ < 10000) {
        const r = sortie[i % sortie.length];
        if (r.effectif < r.capaciteRestante) { r.effectif++; reste--; }
        i++;
    }
    return sortie;
}

// =================================================
// 5. AFFECTATION D'UN CALENDRIER  — CORRECTIF L2, L3
// =================================================

function affecterCalendrier({ calendrierId, planning, salles, indexEffectifs, index, annee, modeRecalcul }) {
    const niveauCode = planning.niveauCode;
    const rapport = [];
    let modifie = false;

    // CORRECTIF L2 : on place les plus gros effectifs d'abord
    const ordonnees = planning.filieres
        .map(f => {
            let effectif = null, erreur = null;
            try { effectif = indexEffectifs.lire(annee, niveauCode, f.filiereCode); }
            catch (e) { erreur = e.message; }
            return { filiere: f, effectif, erreur };
        })
        .sort((a, b) => (b.effectif ?? -1) - (a.effectif ?? -1));

    const nouvelles = new Map();

    for (const { filiere, effectif, erreur } of ordonnees) {
        const base = { calendrierId, filiereCode: filiere.filiereCode, niveauCode };

        if (erreur) {
            rapport.push({ ...base, statut: "erreur", message: erreur });
            continue;
        }

        let cles;
        try { cles = clesExamens(filiere); }
        catch (e) {
            rapport.push({ ...base, statut: "erreur", message: "Créneau illisible : " + e.message });
            continue;
        }

        // CORRECTIF L3 : pas d'examen → pas de salle
        if (cles.length === 0) {
            rapport.push({ ...base, statut: "ignore", message: "Aucun examen planifié." });
            continue;
        }

        // Déjà affectée et mode « compléter » → on n'y touche pas (déjà dans l'index)
        if (!modeRecalcul && Array.isArray(filiere.amphis) && filiere.amphis.length > 0) {
            rapport.push({ ...base, statut: "conserve", locaux: filiere.amphis, message: "Affectation existante conservée." });
            continue;
        }

        const res = rechercherCombinaison(cles, effectif, niveauCode, salles, index);

        if (!res.succes) {
            rapport.push({ ...base, statut: "echec", effectif, message: res.message });
            continue;
        }

        // ✅ On réserve IMMÉDIATEMENT (correctif C3)
        for (const r of res.repartitionLocaux) {
            index.reserver(r.codeLocal, cles, r.effectif, niveauCode, `${calendrierId}#${filiere.filiereCode}`);
        }

        const ancien = (filiere.amphis || []).slice().sort().join(",");
        const nouveau = res.locaux.slice().sort().join(",");
        if (ancien !== nouveau) modifie = true;

        nouvelles.set(filiere.filiereCode, {
            amphis: res.locaux,
            repartitionLocaux: res.repartitionLocaux
        });

        rapport.push({ ...base, statut: "affecte", effectif, locaux: res.locaux, message: res.message });
    }

    // Reconstruction du planning en préservant l'ordre d'origine
    const filieresMAJ = planning.filieres.map(f => {
        const n = nouvelles.get(f.filiereCode);
        return n ? { ...f, amphis: n.amphis, repartitionLocaux: n.repartitionLocaux } : f;
    });

    return { modifie, planning: { ...planning, filieres: filieresMAJ }, rapport };
}

// =================================================
// 6. ÉCRITURE PAR LOTS  — CORRECTIF C1
// =================================================

async function ecrireParLots(operations) {
    let total = 0;
    for (let i = 0; i < operations.length; i += CONFIG.tailleLot) {
        const tranche = operations.slice(i, i + CONFIG.tailleLot);
        const lot = writeBatch(db);
        for (const op of tranche) lot.update(op.ref, op.data);
        await lot.commit();
        total += tranche.length;
        console.log(`✓ Lot ${Math.floor(i / CONFIG.tailleLot) + 1} : ${tranche.length} écriture(s).`);
    }
    return total;
}

// =================================================
// 7. BOUTON GÉNÉRER  — CORRECTIFS C2, C5, M1, M3, L7
// =================================================

const btnGenererAffectations = document.getElementById("btnGenererAffectations");

if (btnGenererAffectations) {
    btnGenererAffectations.addEventListener("click", async () => {
        const statut = document.getElementById("statutAffectationSalles");
        const resume = document.getElementById("resumeAffectationSalles");
        const majStatut = t => { if (statut) statut.textContent = t; };

        btnGenererAffectations.disabled = true;
        majStatut("Initialisation…");

        try {
            // ---------- Données de référence ----------
            const donnees = await window.generationExamens.obtenirDonnees();
            const salles = donnees.sallesAmphis || [];
            const effectifs = donnees.effectifs || [];
            catalogueLocauxValide(salles);
            if (!effectifs.length) throw new Error("Aucun effectif chargé.");
            const indexEffectifs = construireIndexEffectifs(effectifs);

            const annee = document.getElementById("anneeAffectationSalles")?.value;
            const semestre = document.getElementById("semestreAffectationSalles")?.value;
            const regime = document.getElementById("regimeAffectationSalles")?.value;
            const session = document.getElementById("sessionAffectationSalles")?.value;
            const modeRecalcul = document.getElementById("modeRecalculTotal")?.checked === true;

            if (!annee || !semestre || !regime || !session) {
                throw new Error("Sélectionnez année, semestre, régime et session.");
            }

            // ---------- LECTURE UNIQUE (correctif M1) ----------
            majStatut("Lecture des calendriers…");
            const snapshot = await getDocs(query(
                collection(db, "calendriers"),
                where("anneeUniversitaire", "==", annee),
                where("semestreCode", "==", semestre)
            ));
            if (snapshot.empty) throw new Error("Aucun calendrier pour cette année/semestre.");

            const cibles = [];
            const contexte = [];
            for (const d of snapshot.docs) {
                const data = d.data();
                ((data.regimeCode === regime && data.sessionCode === session) ? cibles : contexte)
                    .push({ id: d.id, ref: d.ref, data });
            }
            console.log(`✓ ${snapshot.size} document(s) lu(s) — ${cibles.length} à traiter, ${contexte.length} en contexte.`);
            if (cibles.length === 0) throw new Error("Aucun calendrier pour ce régime/session.");

            // ---------- INDEX D'OCCUPATION ----------
            majStatut("Construction de l'index d'occupation…");
            const index = new IndexOccupation(salles);
            const avertissements = [];

            const enregistrerExistant = (src, estCible) => {
                const p = src.data.planning;
                if (!Array.isArray(p?.filieres)) return;
                for (const f of p.filieres) {
                    // ⚠️ CORRECTIF C2 : en mode « compléter », les affectations des
                    // calendriers CIBLES sont aussi déclarées. Sans ça → double réservation.
                    if (estCible && modeRecalcul) continue;
                    if (!Array.isArray(f.amphis) || f.amphis.length === 0) continue;

                    let codes, cles;
                    try {
                        codes = codesLocauxStricts(f.amphis);
                        cles = clesExamens(f);
                    } catch (e) {
                        // ⚠️ CORRECTIF C5 : on TRACE au lieu d'ignorer silencieusement
                        avertissements.push(`[${src.id}/${f.filiereCode}] réservation illisible (${e.message}) — risque de conflit non détecté.`);
                        continue;
                    }
                    if (cles.length === 0) continue;

                    const rep = Array.isArray(f.repartitionLocaux) && f.repartitionLocaux.length
                        ? f.repartitionLocaux
                        : codes.map(c => ({
                            codeLocal: c,
                            effectif: Number(salles.find(s => s.code === c)?.capacite || 0)
                          }));

                    for (const r of rep) {
                        index.reserver(r.codeLocal, cles, r.effectif, p.niveauCode, `${src.id}#${f.filiereCode}`);
                    }
                }
            };

            contexte.forEach(s => enregistrerExistant(s, false));
            cibles.forEach(s => enregistrerExistant(s, true));

            // ---------- TRAITEMENT ----------
            majStatut(`Affectation de ${cibles.length} calendrier(s)…`);
            const operations = [];
            const rapportGlobal = [];
            const erreurs = [];

            for (const cible of cibles) {
                const planning = cible.data.planning;
                try { validerPlanning(planning); }
                catch (e) { erreurs.push(`${cible.id} : ${e.message}`); continue; }

                const r = affecterCalendrier({
                    calendrierId: cible.id,
                    planning,
                    salles,
                    indexEffectifs,
                    index,
                    annee,
                    modeRecalcul
                });

                rapportGlobal.push(...r.rapport);
                if (r.modifie) operations.push({ ref: cible.ref, data: { planning: r.planning } });
            }

            // ---------- ÉCRITURE ----------
            let ecrites = 0;
            if (operations.length > 0) {
                majStatut(`Enregistrement de ${operations.length} calendrier(s)…`);
                ecrites = await ecrireParLots(operations);
            }

            // ---------- BILAN DÉTAILLÉ (correctif L7) ----------
            const compte = s => rapportGlobal.filter(r => r.statut === s).length;
            const bilan =
                `Calendriers traités : ${cibles.length}  |  écrits : ${ecrites}\n` +
                `Filières — affectées : ${compte("affecte")}  ·  conservées : ${compte("conserve")}  ` +
                `·  échecs : ${compte("echec")}  ·  erreurs : ${compte("erreur")}  ·  sans examen : ${compte("ignore")}`;

            majStatut(`Terminé — ${compte("affecte")} affectation(s), ${compte("echec")} échec(s).`);

            if (resume) {
                const bloc = (titre, liste) =>
                    liste.length ? `\n\n━━ ${titre} (${liste.length}) ━━\n` + liste.join("\n") : "";
                resume.textContent =
                    bilan +
                    bloc("ÉCHECS", rapportGlobal.filter(r => r.statut === "echec")
                        .map(r => `• ${r.filiereCode} (${r.niveauCode}, ${r.effectif} étu.) → ${r.message}`)) +
                    bloc("ERREURS DE DONNÉES", rapportGlobal.filter(r => r.statut === "erreur")
                        .map(r => `• ${r.filiereCode} → ${r.message}`)) +
                    bloc("CALENDRIERS INVALIDES", erreurs) +
                    bloc("⚠ AVERTISSEMENTS", avertissements) +
                    bloc("AFFECTATIONS", rapportGlobal.filter(r => r.statut === "affecte")
                        .map(r => `• ${r.filiereCode} → ${r.message}`));
            }

        } catch (erreur) {
            console.error(erreur);
            majStatut("Échec : " + erreur.message);
            if (resume) resume.textContent = (erreur.stack || erreur.message);
        } finally {
            btnGenererAffectations.disabled = false;
        }
    });
}
