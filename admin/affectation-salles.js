// =================================================
// AFFECTATION DES SALLES / AMPHIS
// =================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    getDocs,
    collection,
    onSnapshot,
    doc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// =================================================
// FIRESTORE
// =================================================

const db = getFirestore(app);

console.log("✓ affectation-salles.js chargé.");
console.log("✓ Firestore initialisé pour l'affectation des salles.");

// =================================================
// VALIDATION PARTAGÉE : génération, contrôle et réservations externes
// =================================================

function jourCivilAffectation(valeur) {
    let date;
    if (valeur instanceof Date) date = valeur;
    else if (valeur && typeof valeur.toDate === "function") date = valeur.toDate();
    else if (valeur && Number.isInteger(valeur.seconds)) {
        const ns = valeur.nanoseconds ?? 0;
        if (!Number.isInteger(ns) || ns < 0 || ns >= 1e9) throw new Error("Date Timestamp invalide.");
        date = new Date(valeur.seconds * 1000 + ns / 1e6);
    } else if (typeof valeur === "string") {
        // ISO uniquement : pas de parsing dépendant de la langue, ni dates corrigées silencieusement.
        const m = valeur.match(/^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/);
        if (!m) throw new Error("Date non ISO ou invalide.");
        const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
        const verif = new Date(0); verif.setUTCFullYear(y, mo - 1, d); verif.setUTCHours(0, 0, 0, 0);
        if (verif.getUTCFullYear() !== y || verif.getUTCMonth() !== mo - 1 || verif.getUTCDate() !== d) throw new Error("Jour civil invalide.");
        if (!m[4]) return m[1] + "-" + m[2] + "-" + m[3];
        date = new Date(valeur);
    } else throw new Error("Format de date non pris en charge.");
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error("Date invalide.");
    // Même convention que generation.js : jour civil dans le fuseau du navigateur.
    return String(date.getFullYear()).padStart(4, "0") + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function cleCreneauAffectation(cellule) {
    if (!cellule || cellule.creneauOrdre == null || cellule.creneauOrdre === "" || typeof cellule.creneauOrdre === "boolean") throw new Error("Créneau absent ou invalide.");
    const ordre = Number(cellule.creneauOrdre);
    if (!Number.isInteger(ordre) || ordre <= 0) throw new Error("Ordre de créneau invalide.");
    return jourCivilAffectation(cellule.date) + "|" + ordre;
}

function catalogueLocauxValide(salles) {
    if (!Array.isArray(salles)) throw new Error("Catalogue des locaux invalide.");
    const codes = new Set();
    salles.forEach(s => {
        if (!s || typeof s.code !== "string" || !s.code.trim() || s.code !== s.code.trim()) throw new Error("Code local vide ou non normalisé.");
        if (codes.has(s.code)) throw new Error("Code local dupliqué : " + s.code);
        codes.add(s.code);
        if (typeof s.capacite === "boolean" || s.capacite == null || String(s.capacite).trim() === "" || !Number.isInteger(Number(s.capacite)) || Number(s.capacite) <= 0) throw new Error("Capacité invalide : " + s.code);
    });
}

function codesLocauxStricts(amphis) {
    if (!Array.isArray(amphis)) throw new Error("Liste de locaux invalide.");
    const codes = amphis.map(l => typeof l === "string" ? l : (l && (l.code || l.localCode)));
    const vus = new Set();
    codes.forEach(c => {
        if (typeof c !== "string" || !c.trim() || c !== c.trim()) throw new Error("Code d'affectation invalide.");
        if (vus.has(c)) throw new Error("Local affecté en double : " + c);
        vus.add(c);
    });
    return codes;
}

function validerPlanningDates(planning) {
    if (!planning || !Array.isArray(planning.filieres) || !planning.filieres.length || !planning.niveauCode) throw new Error("Structure du planning invalide.");
    const vus = new Set();
    planning.filieres.forEach(f => {
        if (!f || !f.filiereCode || vus.has(f.filiereCode) || !Array.isArray(f.cellules)) throw new Error("Filière absente, dupliquée ou cellules invalides.");
        if (f.niveauCode != null && f.niveauCode !== planning.niveauCode) throw new Error("Niveau de filière contradictoire avec le planning : " + f.filiereCode);
        vus.add(f.filiereCode);
        f.cellules.forEach(c => {
            if (!c || typeof c.estOccupee !== "boolean") throw new Error("Cellule invalide.");
            if (c.estOccupee) cleCreneauAffectation(c);
        });
    });
}

// Copie en mémoire : le niveau parent fait autorité, sans mutation du document source.
function filiereAvecNiveau(filiere, niveauCode) {
    if (!filiere || !niveauCode || (filiere.niveauCode != null && filiere.niveauCode !== niveauCode)) throw new Error("Niveau de filière contradictoire ou absent du planning.");
    return { ...filiere, niveauCode };
}

// Code normalisé pour comparer (espaces, casse, accents) : " IMM 2 " == "imm 2"
function normaliserCode(valeur) {
    return String(valeur ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
}

function lireEffectifStrict(effectifs, annee, niveau, filiere) {
    if (typeof annee !== "string" || !annee.trim()) throw new Error("Année universitaire explicite requise.");

    const a = annee.trim(), n = normaliserCode(niveau), f = normaliserCode(filiere);

    const lignes = effectifs.filter(l =>
        l &&
        String(l.anneeUniversitaire ?? "").trim() === a &&
        normaliserCode(l.niveauCode) === n &&
        normaliserCode(l.filiereCode) === f
    );

    if (lignes.length === 0) {
        throw new Error("aucune ligne d'effectif pour " + a + " / " + niveau + " / [" + String(filiere).trim() + "] (vérifier le code de la filière dans les effectifs importés)");
    }

    const valeurs = lignes.map(l => l.effectif);

    valeurs.forEach(v => {
        if (typeof v === "boolean" || v == null || String(v).trim() === "" || !Number.isInteger(Number(v)) || Number(v) <= 0) {
            throw new Error("Effectif invalide : " + String(filiere).trim());
        }
    });

    // Plusieurs lignes identiques : acceptées ; lignes contradictoires : refusées
    const distincts = [...new Set(valeurs.map(Number))];

    if (distincts.length > 1) {
        throw new Error("effectif ambigu pour " + a + " / " + niveau + " / [" + String(filiere).trim() + "] : " + distincts.join(" ou "));
    }

    return distincts[0];
}

// Chaque répartition est fixe pour tous les examens de la filière.
function repartitionValidee(filiere, locaux, effectif, salles) {
    const r = filiere.repartitionLocaux;
    if (!Array.isArray(r) || r.length !== locaux.length) throw new Error("Répartition par local absente ou incomplète.");
    const vus = new Set(); let total = 0;
    r.forEach(a => {
        if (!a || !locaux.includes(a.codeLocal) || vus.has(a.codeLocal)) throw new Error("Code de répartition invalide ou dupliqué.");
        vus.add(a.codeLocal);
        if (typeof a.effectif === "boolean" || !Number.isInteger(a.effectif) || a.effectif <= 0) throw new Error("Effectif par local invalide.");
        const s = salles.find(s => s.code === a.codeLocal);
        if (!s || a.effectif > Number(s.capacite)) throw new Error("Répartition supérieure à la capacité du local.");
        total += a.effectif;
    });
    if (total !== effectif) throw new Error("Somme de la répartition différente de l'effectif annuel.");
    return r.map(a => ({ codeLocal: a.codeLocal, effectif: a.effectif }));
}

// -------------------------------------------------
// Cache des clés "date|créneau" par filière
// (évite de re-parser les dates des milliers de fois pendant la recherche)
// -------------------------------------------------

const _cacheExamens = new WeakMap();

function infosExamens(filiere) {
    let info = _cacheExamens.get(filiere);
    if (!info) {
        const liste = [...new Set(
            filiere.cellules.filter(c => c.estOccupee).map(c => cleCreneauAffectation(c))
        )];
        info = { liste, ensemble: new Set(liste) };
        _cacheExamens.set(filiere, info);
    }
    return info;
}

function clesExamens(filiere) {
    return infosExamens(filiere).liste;
}

function capaciteRestanteLocal(filiere, code, salles, affectations) {
    const capacite = Number(salles.find(s => s.code === code).capacite);
    let restant = capacite;
    for (const cle of clesExamens(filiere)) {
        let utilise = 0;
        for (const a of affectations) {
            if (!a.locaux.includes(code) || !infosExamens(a.filiere).ensemble.has(cle)) continue;
            if (!filiere.niveauCode || !a.filiere.niveauCode) throw new Error("Niveau canonique de réservation absent.");
            // Un local ne peut pas être partagé entre deux niveaux au même créneau.
            if (filiere.niveauCode !== a.filiere.niveauCode) return 0;
            const r = a.repartitionLocaux || a.filiere.repartitionLocaux;
            if (!Array.isArray(r)) throw new Error("Répartition de réservation absente.");
            utilise += r.find(x => x.codeLocal === code)?.effectif || 0;
        }
        restant = Math.min(restant, capacite - utilise);
    }
    return Math.max(0, restant);
}

function reservationsHorsSelection(documents, selection, salles, effectifs = []) {
    const ids = new Set(selection.map(d => d.id)), resultat = [];
    for (const docu of documents) {
        if (ids.has(docu.id)) continue;
        const donnees = docu.data(), p = donnees.planning;
        if (!p || !Array.isArray(p.filieres)) {
            if (p != null) throw new Error(docu.id + " : planning externe inexploitable.");
            continue;
        }
        for (const sourceFiliere of p.filieres) {
            const f = filiereAvecNiveau(sourceFiliere, p.niveauCode);
            if (!f) throw new Error(docu.id + " : filière externe invalide.");
            if (f.amphis == null || (Array.isArray(f.amphis) && f.amphis.length === 0)) continue;
            const locaux = codesLocauxStricts(f.amphis);
            validerPlanningDates({ niveauCode: p.niveauCode, filieres: [f] });
            locaux.forEach(code => { if (!salles.some(s => s.code === code)) throw new Error(docu.id + " : local réservé inconnu : " + code); });
            let repartitionLocaux, prudente = false;
            if (f.repartitionLocaux != null) {
                const effectif = lireEffectifStrict(effectifs, donnees.anneeUniversitaire, p.niveauCode, f.filiereCode);
                repartitionLocaux = repartitionValidee(f, locaux, effectif, salles);
            } else {
                // Monolocal historique : reconstruction exacte seulement si cohorte identifiable.
                let effectif = null;
                if (locaux.length === 1) {
                    try { effectif = lireEffectifStrict(effectifs, donnees.anneeUniversitaire, p.niveauCode, f.filiereCode); } catch (_) { /* Réserver le local entier, sans deviner l'année ni l'effectif. */ }
                    if (effectif != null && effectif > Number(salles.find(s => s.code === locaux[0]).capacite)) throw new Error(docu.id + " : capacité de réservation insuffisante.");
                }
                prudente = effectif == null;
                repartitionLocaux = locaux.map(code => ({ codeLocal: code, effectif: effectif ?? Number(salles.find(s => s.code === code).capacite) }));
            }
            resultat.push({ calendrierId: docu.id, filiere: f, locaux, repartitionLocaux, reservationPrudente: prudente });
        }
    }
    return resultat;
}

function verifierAffectationsPartagees(elements, salles, effectifs, reservations = []) {
    catalogueLocauxValide(salles);
    const anomalies = [], affectations = [];
    elements.forEach(e => {
        try { validerPlanningDates(e.planning); } catch (err) { anomalies.push(e.id + " : " + err.message); return; }
        e.planning.filieres.forEach(sourceFiliere => {
            const f = filiereAvecNiveau(sourceFiliere, e.planning.niveauCode);
            try {
                const locaux = codesLocauxStricts(f.amphis);
                if (!locaux.length) throw new Error("Aucun local affecté.");
                const effectif = lireEffectifStrict(effectifs, e.anneeUniversitaire, e.planning.niveauCode, f.filiereCode);
                locaux.forEach(code => {
                    const s = salles.find(s => s.code === code);
                    if (!s) throw new Error("Local inconnu : " + code);
                    if (s.disponible !== "Oui") throw new Error("Local indisponible : " + code);
                });
                // Compatibilité historique monolocal ; multilocaux doivent être régénérés.
                let repartitionLocaux, reservationPrudente = false;
                if (f.repartitionLocaux != null) repartitionLocaux = repartitionValidee(f, locaux, effectif, salles);
                else if (locaux.length === 1) repartitionLocaux = [{ codeLocal: locaux[0], effectif }];
                else {
                    const capacite = locaux.reduce((s, c) => s + Number(salles.find(x => x.code === c).capacite), 0);
                    if (capacite < effectif) throw new Error("Capacité insuffisante.");
                    repartitionLocaux = locaux.map(c => ({ codeLocal: c, effectif: Number(salles.find(x => x.code === c).capacite) }));
                    reservationPrudente = true;
                }
                repartitionLocaux.forEach(r => { if (r.effectif > Number(salles.find(s => s.code === r.codeLocal).capacite)) throw new Error("Capacité insuffisante."); });
                affectations.push({ calendrierId: e.id, filiere: f, locaux, repartitionLocaux, reservationPrudente });
            } catch (err) { anomalies.push(e.id + " / " + f.filiereCode + " : " + err.message); }
        });
    });
    const charges = new Map();
    [...reservations, ...affectations].forEach(a => {
        clesExamens(a.filiere).forEach(cle => {
            a.repartitionLocaux.forEach(r => {
                const k = r.codeLocal + "|" + cle;
                if (!charges.has(k)) charges.set(k, { code: r.codeLocal, cle, total: 0, selection: false, filieres: [], niveaux: new Set() });
                const charge = charges.get(k);
                charge.niveaux.add(a.filiere.niveauCode);
                charge.total += r.effectif;
                charge.selection ||= affectations.includes(a);
                charge.filieres.push(a.calendrierId + "/" + a.filiere.filiereCode);
            });
        });
    });
    charges.forEach(c => {
        if (c.selection && (c.niveaux.size !== 1 || c.niveaux.has(undefined))) anomalies.push("Partage entre niveaux différents interdit : " + c.code + " / " + c.cle);
        if (c.selection && c.total > Number(salles.find(s => s.code === c.code).capacite)) anomalies.push("Capacité cumulée dépassée : " + c.code + " / " + c.cle + " — " + c.total + " étudiants (" + c.filieres.join(", ") + ")");
    });
    return anomalies;
}

function validerReservationRepartition(prec, salles) {
    const r = prec.repartitionLocaux || prec.filiere.repartitionLocaux;
    if (!Array.isArray(r) || r.length !== prec.locaux.length) throw new Error("Répartition de réservation absente ou incomplète.");
    const codes = new Set();
    r.forEach(a => {
        if (!a || !prec.locaux.includes(a.codeLocal) || codes.has(a.codeLocal) || !Number.isInteger(a.effectif) || a.effectif <= 0) throw new Error("Répartition de réservation invalide.");
        codes.add(a.codeLocal);
        const local = salles.find(s => s.code === a.codeLocal);
        if (!local || a.effectif > Number(local.capacite)) throw new Error("Réservation supérieure à la capacité ou local inconnu.");
    });
}

// =================================================
// COMPTER LES MATIÈRES PROGRAMMÉES
// =================================================

function compterMatieresProgrammeesParFiliere(filiere) {
    const matieres = new Set();

    (filiere.cellules || []).forEach(function (cellule) {
        if (cellule && cellule.estOccupee && cellule.matiereLibelle) {
            matieres.add(String(cellule.matiereLibelle).trim());
        }
    });

    return matieres.size;
}

// =================================================
// VECTEUR DE PRIORITÉ D'UN NIVEAU
// =================================================

function construireVecteurPrioriteNiveau(planning) {
    if (!planning || !Array.isArray(planning.filieres)) {
        return [];
    }

    return planning.filieres
        .map(function (filiere) {
            return compterMatieresProgrammeesParFiliere(filiere);
        })
        .sort(function (a, b) {
            return b - a;
        });
}

// =================================================
// CLASSER LES CALENDRIERS
// =================================================

function classerCalendriersPourAffectation(documents, effectifs = []) {
    const elements = documents.map(function (documentCalendrier) {
        const donnees = documentCalendrier.data();
        const planning = donnees.planning;

        // Demande = effectif total du calendrier (niveaux les plus gros traités en premier)
        let demande = 0;
        if (planning && Array.isArray(planning.filieres)) {
            for (const f of planning.filieres) {
                try {
                    demande += lireEffectifStrict(effectifs, donnees.anneeUniversitaire, planning.niveauCode, f.filiereCode);
                } catch (_) { /* filière sans effectif : ignorée pour le classement */ }
            }
        }

        const cleGroupe = [
            donnees.anneeUniversitaire || "",
            donnees.regimeCode || "",
            donnees.sessionCode || "",
            donnees.semestreCode || ""
        ].join("|");

        return {
            document: documentCalendrier,
            cleGroupe: cleGroupe,
            niveauCode:
                (planning && planning.niveauCode) ||
                donnees.niveauCode ||
                "",
            vecteur: construireVecteurPrioriteNiveau(planning),
            demande: demande,
            planningValide:
                !!planning && Array.isArray(planning.filieres)
        };
    });

    // Regrouper les calendriers par groupe et par niveau.
    const groupesNiveaux = new Map();

    elements.forEach(function (element) {
        const cleNiveau =
            element.cleGroupe + "|" + element.niveauCode;

        if (!groupesNiveaux.has(cleNiveau)) {
            groupesNiveaux.set(cleNiveau, {
                cleGroupe: element.cleGroupe,
                niveauCode: element.niveauCode,
                elements: [],
                vecteur: [],
                demande: 0
            });
        }

        groupesNiveaux.get(cleNiveau).demande += element.demande;
        groupesNiveaux.get(cleNiveau).elements.push(element);
    });

    // Construire le vecteur de priorité global de chaque niveau.
    groupesNiveaux.forEach(function (groupe) {
        groupe.vecteur = groupe.elements
            .filter(function (element) {
                return element.planningValide;
            })
            .flatMap(function (element) {
                return element.vecteur;
            })
            .sort(function (a, b) {
                return b - a;
            });
    });

    const niveauxTries = Array.from(groupesNiveaux.values());

    niveauxTries.sort(function (a, b) {
        const comparaisonGroupe =
            a.cleGroupe.localeCompare(b.cleGroupe);

        if (comparaisonGroupe !== 0) {
            return comparaisonGroupe;
        }

        if (a.demande !== b.demande) {
            return b.demande - a.demande;
        }

        const longueur = Math.min(
            a.vecteur.length,
            b.vecteur.length
        );

        for (let i = 0; i < longueur; i++) {
            if (a.vecteur[i] !== b.vecteur[i]) {
                return b.vecteur[i] - a.vecteur[i];
            }
        }

        if (a.vecteur.length !== b.vecteur.length) {
            return b.vecteur.length - a.vecteur.length;
        }

        return a.niveauCode.localeCompare(b.niveauCode);
    });

    // Dans chaque niveau, traiter d'abord les calendriers
    // dont le vecteur de priorité est le plus élevé.
    const resultats = [];

    niveauxTries.forEach(function (groupe) {
        groupe.elements.sort(function (a, b) {
            if (a.planningValide !== b.planningValide) {
                return a.planningValide ? -1 : 1;
            }

            const longueur = Math.min(
                a.vecteur.length,
                b.vecteur.length
            );

            for (let i = 0; i < longueur; i++) {
                if (a.vecteur[i] !== b.vecteur[i]) {
                    return b.vecteur[i] - a.vecteur[i];
                }
            }

            if (a.vecteur.length !== b.vecteur.length) {
                return b.vecteur.length - a.vecteur.length;
            }

            return a.document.id.localeCompare(b.document.id);
        });

        groupe.elements.forEach(function (element) {
            resultats.push(element.document);
        });
    });

    console.log("Classement des calendriers par niveau :");

    console.table(
        niveauxTries.map(function (groupe, ordre) {
            return {
                ordre: ordre + 1,
                groupe: groupe.cleGroupe,
                niveau: groupe.niveauCode,
                effectifTotal: groupe.demande,
                vecteurPriorite: groupe.vecteur.join(", "),
                nombreCalendriers: groupe.elements.length
            };
        })
    );

    return resultats;
}

window.classerCalendriersPourAffectation = classerCalendriersPourAffectation;

// =================================================
// RECHERCHER LA MEILLEURE COMBINAISON DE LOCAUX
//
// - Un seul local : tous les locaux suffisants sont examinés (best-fit réel).
// - Sinon k locaux, avec k minimal (2, puis 3, puis 4).
// - Répartition proportionnelle à la capacité restante (taux homogène).
// - Préférence : moins de locaux, puis taux >= 66 %, puis ajustement le plus serré.
// =================================================

// Répartit l'effectif proportionnellement à la capacité restante de chaque local.
// Renvoie null si impossible.
function repartirProportionnellement(effectif, locaux) {
    const total = locaux.reduce((s, l) => s + l.cap, 0);
    if (total < effectif) return null;

    const parts = locaux.map(l => Math.floor(effectif * l.cap / total));
    let reste = effectif - parts.reduce((s, p) => s + p, 0);

    let progres = true;
    while (reste > 0 && progres) {
        progres = false;
        for (let j = 0; j < locaux.length && reste > 0; j++) {
            if (parts[j] < locaux[j].cap) { parts[j]++; reste--; progres = true; }
        }
    }
    if (reste !== 0 || parts.some(p => p <= 0)) return null;
    return locaux.map((l, i) => ({ codeLocal: l.code, effectif: parts[i] }));
}

function rechercherMeilleureCombinaisonLocaux(
    filiere,
    effectif,
    sallesAmphis,
    carteConflits,                 // conservé pour compatibilité (inutilisé)
    affectationsFilieresCourantes,
    affectationsPrecedentes,
    options = {}                   // { dejaValide: true } depuis affecterLocauxFixes
) {
    const eff = Number(effectif);
    if (
        typeof effectif === "boolean" || effectif == null ||
        String(effectif).trim() === "" || !Number.isInteger(eff) || eff <= 0
    ) {
        throw new Error("Effectif invalide.");
    }

    const courantes = Array.isArray(affectationsFilieresCourantes)
        ? affectationsFilieresCourantes
        : Array.from(affectationsFilieresCourantes?.values?.() || []);
    const toutes = [...(affectationsPrecedentes || []), ...courantes];

    if (!options.dejaValide) {
        catalogueLocauxValide(sallesAmphis);
        validerPlanningDates({ niveauCode: filiere.niveauCode, filieres: [filiere] });
        toutes.forEach(a => {
            codesLocauxStricts(a.locaux);
            validerPlanningDates({ niveauCode: a.filiere.niveauCode, filieres: [a.filiere] });
            validerReservationRepartition(a, sallesAmphis);
        });
    }

    const SEUIL_OCCUPATION = 0.66;
    const PART_MIN = 10;
    const TAILLE_MAX = 4;
    const MAX_RETENUES = 12;
    const MAX_VISITES = 5000;

    // Locaux libres pour TOUS les examens de la filière, triés par capacité restante décroissante
    const locaux = sallesAmphis
        .filter(s => s.disponible === "Oui")
        .map(s => {
            const nominale = Number(s.capacite);
            const cap = capaciteRestanteLocal(filiere, s.code, sallesAmphis, toutes);
            return { code: s.code, nominale, cap, utilise: nominale - cap };
        })
        .filter(l => l.cap > 0)
        .sort((a, b) => b.cap - a.cap || a.code.localeCompare(b.code));

    // Taux d'occupation = (déjà occupé par d'autres filières + cette filière) / capacité nominale
    function construire(groupe) {
        const repartition = repartirProportionnellement(eff, groupe);
        if (!repartition) return null;
        const nominale = groupe.reduce((s, l) => s + l.nominale, 0);
        const occupe = groupe.reduce((s, l, i) => s + l.utilise + repartition[i].effectif, 0);
        return {
            locaux: groupe.map(l => l.code),
            capaciteTotale: nominale,
            capaciteRestanteTotale: groupe.reduce((s, l) => s + l.cap, 0),
            tauxOccupation: occupe / nominale,
            partMin: Math.min(...repartition.map(r => r.effectif)),
            repartitionLocaux: repartition
        };
    }

    let combinaisons = [];

    // 1. Un seul local : on les teste TOUS
    for (const l of locaux) {
        if (l.cap >= eff) {
            const c = construire([l]);
            if (c) combinaisons.push(c);
        }
    }

    // 2. Sinon : k locaux, avec k minimal
    if (combinaisons.length === 0) {
        const prefixe = [0];
        locaux.forEach(l => prefixe.push(prefixe[prefixe.length - 1] + l.cap));
        const sommeDe = (i, n) => prefixe[Math.min(i + n, locaux.length)] - prefixe[i];
        let visites = 0;

        for (let k = 2; k <= TAILLE_MAX && combinaisons.length === 0; k++) {
            const groupe = [];
            const explorer = function (debut, cumul) {
                if (visites++ > MAX_VISITES) return;
                const restants = k - groupe.length;
                if (restants === 0) {
                    if (cumul >= eff) {
                        const c = construire(groupe);
                        if (c) combinaisons.push(c);
                    }
                    return;
                }
                for (let i = debut; i <= locaux.length - restants; i++) {
                    // Locaux triés : si même les plus grands restants ne suffisent pas, on coupe.
                    if (cumul + sommeDe(i, restants) < eff) break;
                    groupe.push(locaux[i]);
                    explorer(i + 1, cumul + locaux[i].cap);
                    groupe.pop();
                }
            };
            explorer(0, 0);
        }
    }

    // 3. Toujours rien avec 4 locaux : recherche gloutonne jusqu'à 12 locaux.
    //    On prend les plus grands locaux, et pour le dernier le plus petit qui suffit.
    //    Variantes : on exclut tour à tour l'un des plus grands locaux.
    if (combinaisons.length === 0) {
        const TAILLE_MAX_GLOUTON = 12;
        for (let exclu = -1; exclu < Math.min(MAX_RETENUES, locaux.length); exclu++) {
            const pool = locaux.filter((_, i) => i !== exclu);
            const groupe = [];
            let reste = eff;
            while (reste > 0 && pool.length > 0 && groupe.length < TAILLE_MAX_GLOUTON) {
                let choix = null;
                for (let i = pool.length - 1; i >= 0; i--) {
                    if (pool[i].cap >= reste) { choix = i; break; }
                }
                if (choix === null) choix = 0;
                const l = pool.splice(choix, 1)[0];
                groupe.push(l);
                reste -= l.cap;
            }
            if (reste <= 0) {
                const c = construire(groupe);
                if (c) combinaisons.push(c);
            }
        }
    }

    // Supprimer les doublons (même ensemble de locaux)
    const dejaVues = new Set();
    combinaisons = combinaisons.filter(function (c) {
        const cle = c.locaux.slice().sort().join("|");
        if (dejaVues.has(cle)) return false;
        dejaVues.add(cle);
        return true;
    });

    if (combinaisons.length === 0) {
        const capaciteLibre = locaux.reduce((s, l) => s + l.cap, 0);
        return {
            succes: false,
            locaux: [],
            capaciteTotale: 0,
            tauxOccupation: 0,
            combinaisons: [],
            message: "Aucune combinaison possible : effectif " + eff +
                ", " + locaux.length + " local(aux) libre(s) pour tous ses examens, capacité libre cumulée " +
                capaciteLibre + (locaux.length ? ", plus grand local libre " + locaux[0].cap : "") +
                " (maximum 12 locaux par filière)."
        };
    }

    // Ordre de préférence :
    //  1) moins de locaux
    //  2) pas de local presque vide (moins de PART_MIN étudiants), puis taux d'occupation >= 66 %
    //  3) ajustement le plus serré (favorise les locaux déjà entamés)
    //  4) taux le plus élevé
    combinaisons.sort(function (a, b) {
        if (a.locaux.length !== b.locaux.length) return a.locaux.length - b.locaux.length;
        // Éviter les locaux presque vides (moins de PART_MIN étudiants dans un local)
        const petitA = a.partMin < PART_MIN;
        const petitB = b.partMin < PART_MIN;
        if (petitA !== petitB) return petitA ? 1 : -1;
        const okA = a.tauxOccupation >= SEUIL_OCCUPATION;
        const okB = b.tauxOccupation >= SEUIL_OCCUPATION;
        if (okA !== okB) return okA ? -1 : 1;
        if (a.capaciteRestanteTotale !== b.capaciteRestanteTotale) {
            return a.capaciteRestanteTotale - b.capaciteRestanteTotale;
        }
        if (a.tauxOccupation !== b.tauxOccupation) return b.tauxOccupation - a.tauxOccupation;
        return a.locaux.join().localeCompare(b.locaux.join());
    });
    combinaisons = combinaisons.slice(0, MAX_RETENUES);

    const meilleure = combinaisons[0];

    return {
        succes: true,
        locaux: meilleure.locaux,
        capaciteTotale: meilleure.capaciteTotale,
        tauxOccupation: meilleure.tauxOccupation,
        repartitionLocaux: meilleure.repartitionLocaux,
        message: meilleure.locaux.length === 1
            ? "Un seul local suffit : capacité suffisante, priorité au minimum de locaux."
            : "Plusieurs locaux : capacité suffisante, priorité au minimum de locaux.",
        combinaisons: combinaisons
    };
}

window.rechercherMeilleureCombinaisonLocaux = rechercherMeilleureCombinaisonLocaux;

// =================================================
// AFFECTER LES LOCAUX FIXES (avec affectations précédentes)
// =================================================

function affecterLocauxFixes(
    planning,
    sallesAmphis,
    effectifs,
    affectationsPrecedentes = [],
    anneeUniversitaire
) {
    if (
        !planning ||
        !Array.isArray(planning.filieres) ||
        !Array.isArray(sallesAmphis) ||
        !Array.isArray(effectifs) ||
        !Array.isArray(affectationsPrecedentes)
    ) {
        return {
            succes: false,
            affectations: [],
            message: "Données insuffisantes."
        };
    }

    // Toutes les validations sont faites ICI, une seule fois.
    try {
        catalogueLocauxValide(sallesAmphis);
        validerPlanningDates(planning);
        planning = { ...planning, filieres: planning.filieres.map(f => filiereAvecNiveau(f, planning.niveauCode)) };
        affectationsPrecedentes.forEach(prec => {
            codesLocauxStricts(prec.locaux);
            validerPlanningDates({ niveauCode: prec.filiere.niveauCode, filieres: [prec.filiere] });
            validerReservationRepartition(prec, sallesAmphis);
            prec.locaux.forEach(code => { if (!sallesAmphis.some(s => s.code === code)) throw new Error("Local réservé inconnu : " + code); });
        });
        if (!anneeUniversitaire) throw new Error("Année universitaire explicite requise.");
    } catch (erreur) {
        return { succes: false, affectations: [], message: erreur.message };
    }

    const donneesFilieres = planning.filieres.map(function (filiere) {
        let effectif;

        try {
            effectif = lireEffectifStrict(
                effectifs,
                anneeUniversitaire,
                planning.niveauCode,
                filiere.filiereCode
            );
        } catch (erreur) {
            return {
                filiere: filiere,
                valide: false,
                effectif: null,
                message: erreur.message
            };
        }

        return {
            filiere: filiere,
            valide: true,
            effectif: effectif,
            message: ""
        };
    });

    // Filières sans effectif exploitable : signalées, exclues de la recherche
    const donneesInvalides = donneesFilieres.filter(d => !d.valide);

    if (donneesInvalides.length > 0) {
        console.warn(
            "⚠ Filières sans effectif exploitable (" + planning.niveauCode + ") :",
            donneesInvalides.map(d => "[" + d.filiere.filiereCode + "] " + d.message)
        );
        console.warn(
            "Codes présents dans les effectifs pour " + anneeUniversitaire + " / " + planning.niveauCode + " :",
            effectifs
                .filter(l => l &&
                    String(l.anneeUniversitaire ?? "").trim() === String(anneeUniversitaire).trim() &&
                    normaliserCode(l.niveauCode) === normaliserCode(planning.niveauCode))
                .map(l => "[" + l.filiereCode + "] = " + l.effectif)
        );
    }

    const donneesValides = donneesFilieres.filter(d => d.valide);

    const LIMITE_RECHERCHE = 3000;
    const LIMITE_APRES_SOLUTION = 500;
    const LIMITE_MS = 4000;
    const debutRecherche = performance.now();

    let noeudsExplores = 0;
    let limiteAtteinte = false;
    let solutionCompleteTrouvee = false;
    let noeudsPremiereSolution = 0;

    // Meilleure solution complète
    let meilleureSolution = new Map();
    let meilleurScoreComplet = null;

    // Meilleure solution partielle
    let meilleureSolutionPartielle = new Map();
    let meilleurNombreAffectePartiel = -1;
    let meilleurScorePartiel = null;

    function copierSolution(solution) {
        return new Map(
            Array.from(solution.entries()).map(function (entree) {
                const affectation = entree[1];

                return [
                    entree[0],
                    Object.assign({}, affectation, {
                        locaux: Array.isArray(affectation.locaux)
                            ? affectation.locaux.slice()
                            : [],

                        repartitionLocaux: Array.isArray(
                            affectation.repartitionLocaux
                        )
                            ? affectation.repartitionLocaux.map(function (r) {
                                return { ...r };
                            })
                            : affectation.repartitionLocaux
                    })
                ];
            })
        );
    }

    function calculerScoreSolution(solution) {
        const affectations = Array.from(solution.values())
            .filter(a => a.succes);

        const utilisations = new Map();

        affectations.forEach(a => {
            const repartition = a.repartitionLocaux;

            if (!Array.isArray(repartition)) {
                throw new Error(
                    "Répartition des locaux absente pour " + a.filiereCode
                );
            }

            const cles = clesExamens(a.filiere);

            cles.forEach(cle => {
                repartition.forEach(r => {
                    const k = r.codeLocal + "|" + cle;

                    if (!utilisations.has(k)) {
                        const local = sallesAmphis.find(
                            s => s.code === r.codeLocal
                        );

                        if (!local) {
                            throw new Error("Local inconnu : " + r.codeLocal);
                        }

                        utilisations.set(k, {
                            codeLocal: r.codeLocal,
                            cle,
                            capacite: Number(local.capacite),
                            effectif: 0
                        });
                    }

                    utilisations.get(k).effectif += Number(r.effectif);
                });
            });
        });

        const nombreAffecte = affectations.length;

        const nombreLocaux = utilisations.size;

        const capaciteTotale = Array.from(utilisations.values())
            .reduce((total, u) => total + u.capacite, 0);

        const effectifTotal = Array.from(utilisations.values())
            .reduce((total, u) => total + u.effectif, 0);

        const tauxOccupationMoyen = capaciteTotale > 0
            ? effectifTotal / capaciteTotale
            : 0;

        return {
            nombreAffecte,
            nombreLocaux,
            capaciteTotale,
            tauxOccupationMoyen
        };
    }

    function enregistrerMeilleureSolution(solution) {
        const score = calculerScoreSolution(solution);

        // 1. Conserver la meilleure solution partielle.
        if (
            score.nombreAffecte > meilleurNombreAffectePartiel ||
            (
                score.nombreAffecte === meilleurNombreAffectePartiel &&
                meilleurScorePartiel &&
                (
                    solution.size > meilleureSolutionPartielle.size ||
                    (
                        solution.size === meilleureSolutionPartielle.size &&
                        score.nombreLocaux < meilleurScorePartiel.nombreLocaux
                    )
                )
            )
        ) {
            meilleurNombreAffectePartiel = score.nombreAffecte;
            meilleureSolutionPartielle = copierSolution(solution);
            meilleurScorePartiel = score;
        }

        // 2. Une solution complète est prioritaire.
        if (
            solution.size !== donneesValides.length ||
            score.nombreAffecte !== donneesValides.length
        ) {
            return;
        }

        const meilleure =
            !meilleurScoreComplet ||
            score.nombreLocaux < meilleurScoreComplet.nombreLocaux ||
            (
                score.nombreLocaux === meilleurScoreComplet.nombreLocaux &&
                score.capaciteTotale < meilleurScoreComplet.capaciteTotale
            ) ||
            (
                score.nombreLocaux === meilleurScoreComplet.nombreLocaux &&
                score.capaciteTotale === meilleurScoreComplet.capaciteTotale &&
                score.tauxOccupationMoyen > meilleurScoreComplet.tauxOccupationMoyen
            );

        if (meilleure) {
            meilleureSolution = copierSolution(solution);
            meilleurScoreComplet = score;
            if (!solutionCompleteTrouvee) noeudsPremiereSolution = noeudsExplores;
            solutionCompleteTrouvee = true;
        }
    }

    function rechercher(filieresRestantes, affectationsCourantes) {

        if (
            noeudsExplores >= LIMITE_RECHERCHE ||
            performance.now() - debutRecherche > LIMITE_MS
        ) {
            limiteAtteinte = true;
            enregistrerMeilleureSolution(affectationsCourantes);
            return;
        }

        // Solution complète déjà trouvée : on laisse un budget limité pour l'améliorer
        if (solutionCompleteTrouvee && noeudsExplores - noeudsPremiereSolution > LIMITE_APRES_SOLUTION) {
            return;
        }

        noeudsExplores++;

        enregistrerMeilleureSolution(affectationsCourantes);

        // Toutes les filières ont été affectées ou examinées.
        if (filieresRestantes.length === 0) {
            return;
        }

        // -------------------------------------------------
        // 1. CALCULER LES POSSIBILITÉS DE CHAQUE FILIÈRE
        // -------------------------------------------------

        const affectationsReussies = Array.from(affectationsCourantes.values()).filter(
            function (affectation) {
                return affectation.succes;
            }
        );

        const possibilites = filieresRestantes.map(function (donnee) {

            if (!donnee.valide) {
                return {
                    donnee: donnee,
                    combinaisons: [],
                    message: donnee.message
                };
            }

            const resultatRecherche = rechercherMeilleureCombinaisonLocaux(
                donnee.filiere,
                donnee.effectif,
                sallesAmphis,
                null,
                affectationsReussies,
                affectationsPrecedentes,
                { dejaValide: true }
            );

            const combinaisons = Array.isArray(resultatRecherche.combinaisons)
                ? resultatRecherche.combinaisons
                : (
                    resultatRecherche.succes
                        ? [{
                            locaux: resultatRecherche.locaux,
                            capaciteTotale: resultatRecherche.capaciteTotale,
                            tauxOccupation: resultatRecherche.tauxOccupation,
                            repartitionLocaux: resultatRecherche.repartitionLocaux
                        }]
                        : []
                );

            return {
                donnee: donnee,
                combinaisons: combinaisons,
                message: resultatRecherche.message
            };
        });

        // -------------------------------------------------
        // 2. SÉLECTIONNER LA FILIÈRE MRV
        //    (la plus contrainte : moins de combinaisons, puis plus gros effectif)
        // -------------------------------------------------

        possibilites.sort(function (a, b) {
            if (a.combinaisons.length !== b.combinaisons.length) {
                return a.combinaisons.length - b.combinaisons.length;
            }
            return (b.donnee.effectif || 0) - (a.donnee.effectif || 0);
        });

        const selection = possibilites[0];

        const donnee = selection.donnee;
        const filiere = donnee.filiere;
        const code = filiere.filiereCode;

        const restantes = filieresRestantes.filter(
            function (item) {
                return item.filiere.filiereCode !== code;
            }
        );

        // -------------------------------------------------
        // 3. SI AUCUNE COMBINAISON N'EST POSSIBLE
        // -------------------------------------------------

        if (selection.combinaisons.length === 0) {

            const branche = new Map(affectationsCourantes);

            branche.set(code, {
                filiereCode: code,
                effectif: donnee.effectif,
                succes: false,
                locaux: [],
                message: selection.message ||
                    "Aucune combinaison compatible trouvée."
            });

            rechercher(restantes, branche);
            return;
        }

        // -------------------------------------------------
        // 4. ESSAYER LES COMBINAISONS DE LOCAUX
        // -------------------------------------------------

        for (const combinaison of selection.combinaisons) {

            if (limiteAtteinte) {
                break;
            }

            const branche = new Map(affectationsCourantes);

            branche.set(code, {
                filiereCode: code,
                effectif: donnee.effectif,
                succes: true,
                locaux: combinaison.locaux.slice(),
                filiere: filiere,
                repartitionLocaux: combinaison.repartitionLocaux.map(
                    function (a) {
                        return { ...a };
                    }
                ),
                capaciteTotale: combinaison.capaciteTotale,
                tauxOccupation: combinaison.tauxOccupation,
                message: combinaison.locaux.length === 1
                    ? "Un local : capacité résiduelle suffisante."
                    : "Plusieurs locaux : capacité résiduelle suffisante."
            });

            rechercher(restantes, branche);
        }

        // -------------------------------------------------
        // 5. EXPLORER AUSSI LA NON-AFFECTATION
        //    (inutile dès qu'une solution complète existe : elle ne peut pas être battue)
        // -------------------------------------------------

        if (!limiteAtteinte && !solutionCompleteTrouvee) {

            const branche = new Map(affectationsCourantes);

            branche.set(code, {
                filiereCode: code,
                effectif: donnee.effectif,
                succes: false,
                locaux: [],
                message: "Aucune affectation retenue pour cette filière."
            });

            rechercher(restantes, branche);
        }
    }

    console.log("DÉBUT DE LA RECHERCHE RÉCURSIVE :", {
        filieres: donneesFilieres.length,
        locaux: sallesAmphis.length
    });

    rechercher(donneesValides.slice(), new Map());

    console.log("FIN DE LA RECHERCHE RÉCURSIVE :", {
        dureeMs: Math.round(performance.now() - debutRecherche),
        noeudsExplores: noeudsExplores,
        limiteAtteinte: limiteAtteinte,
        solutionComplete: meilleureSolution.size,
        solutionPartielle: meilleureSolutionPartielle.size
    });

    // -------------------------------------------------
    // SÉLECTION DE LA SOLUTION FINALE
    // -------------------------------------------------

    const solutionFinale =
        solutionCompleteTrouvee
            ? meilleureSolution
            : meilleureSolutionPartielle;

    const resultats = donneesFilieres.map(function (donnee) {
        const code = donnee.filiere.filiereCode;
        const resultat = solutionFinale.get(code);

        if (resultat) {
            return resultat;
        }

        return {
            filiereCode: code,
            effectif: donnee.effectif,
            succes: false,
            locaux: [],
            message: !donnee.valide
                ? donnee.message
                : limiteAtteinte
                    ? "Affectation non résolue : limite de recherche atteinte."
                    : "Affectation non résolue."
        };
    });

    const nombreAffecte = resultats.filter(function (resultat) {
        return resultat.succes;
    }).length;

    const toutesAffectees = nombreAffecte === donneesFilieres.length;

    return {
        succes: toutesAffectees,
        affectations: resultats,
        message: toutesAffectees
            ? "Toutes les filières sont affectées."
            : limiteAtteinte
                ? "Meilleure solution trouvée, mais limite de recherche atteinte : résultat à vérifier."
                : "Solution partielle : " + nombreAffecte + " filière(s) affectée(s) sur " +
                    donneesFilieres.length + ".",
        rechercheLimitee: limiteAtteinte,
        nombreAffecte: nombreAffecte,
        nombreFilieres: donneesFilieres.length
    };
}

window.affecterLocauxFixes = affecterLocauxFixes;

// =================================================
// INITIALISER LES FILTRES
// =================================================

(function initialiserFiltresAffectation() {
    const selectAnnee =
        document.getElementById("anneeAffectationSalles");

    const selectSemestre =
        document.getElementById("semestreAffectationSalles");

    const selectRegime =
        document.getElementById("regimeAffectationSalles");

    const selectSession =
        document.getElementById("sessionAffectationSalles");

    if (
        !selectAnnee ||
        !selectSemestre ||
        !selectRegime ||
        !selectSession
    ) {
        console.error(
            "❌ Filtres d'affectation introuvables dans la page."
        );
        return;
    }

    let calendriersPublies = [];

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

    function valeursDistinctes(calendriers, champ) {
        return [
            ...new Set(
                calendriers
                    .map(function (calendrier) {
                        return valeurTexte(calendrier[champ]);
                    })
                    .filter(Boolean)
            )
        ].sort(function (a, b) {
            return a.localeCompare(b, "fr");
        });
    }

    // Reconstruire une liste et conserver la sélection
    // uniquement si elle reste disponible.
    function remplirSelect(
        select,
        valeurs,
        texteInitial,
        fonctionLibelle
    ) {
        const ancienneValeur = select.value;

        select.replaceChildren();

        ajouterOption(select, "", texteInitial);

        valeurs.forEach(function (valeur) {
            ajouterOption(
                select,
                valeur,
                fonctionLibelle
                    ? fonctionLibelle(valeur)
                    : valeur
            );
        });

        if (valeurs.includes(ancienneValeur)) {
            select.value = ancienneValeur;
        } else {
            select.value = "";
        }

        select.disabled = valeurs.length === 0;
    }

    // =================================================
    // ACTUALISATION EN CASCADE
    // Année → Semestre → Régime → Session
    // Uniquement à partir des calendriers publiés
    // =================================================
    function actualiserFiltres() {
        const ancienneAnnee = selectAnnee.value;
        const ancienSemestre = selectSemestre.value;
        const ancienRegime = selectRegime.value;
        const ancienneSession = selectSession.value;

        // 1. Années universitaires publiées
        const annees = valeursDistinctes(
            calendriersPublies,
            "anneeUniversitaire"
        );

        remplirSelect(
            selectAnnee,
            annees,
            annees.length
                ? "Choisir une année universitaire"
                : "Aucune année publiée"
        );

        if (annees.includes(ancienneAnnee)) {
            selectAnnee.value = ancienneAnnee;
        }

        const annee = selectAnnee.value;

        // 2. Semestres de l'année sélectionnée
        const calendriersAnnee = calendriersPublies.filter(
            function (calendrier) {
                return (
                    annee !== "" &&
                    valeurTexte(calendrier.anneeUniversitaire) === annee
                );
            }
        );

        const semestres = valeursDistinctes(
            calendriersAnnee,
            "semestreCode"
        );

        remplirSelect(
            selectSemestre,
            semestres,
            annee
                ? (semestres.length
                    ? "Choisir un semestre"
                    : "Aucun semestre publié")
                : "Choisir d'abord une année"
        );

        if (semestres.includes(ancienSemestre)) {
            selectSemestre.value = ancienSemestre;
        }

        const semestre = selectSemestre.value;

        // 3. Régimes disponibles pour l'année et le semestre
        const calendriersSemestre = calendriersAnnee.filter(
            function (calendrier) {
                return (
                    semestre !== "" &&
                    valeurTexte(calendrier.semestreCode) === semestre
                );
            }
        );

        const regimes = valeursDistinctes(
            calendriersSemestre,
            "regimeCode"
        );

        remplirSelect(
            selectRegime,
            regimes,
            semestre
                ? (regimes.length
                    ? "Choisir un régime"
                    : "Aucun régime publié")
                : "Choisir d'abord un semestre"
        );

        if (regimes.includes(ancienRegime)) {
            selectRegime.value = ancienRegime;
        }

        const regime = selectRegime.value;

        // 4. Sessions disponibles pour la sélection
        const calendriersRegime = calendriersSemestre.filter(
            function (calendrier) {
                return (
                    regime !== "" &&
                    valeurTexte(calendrier.regimeCode) === regime
                );
            }
        );

        const sessionsMap = new Map();

        calendriersRegime.forEach(function (calendrier) {
            const code = valeurTexte(calendrier.sessionCode);

            if (!code) return;

            const libelle =
                valeurTexte(calendrier.sessionLibelle) || code;

            if (!sessionsMap.has(code)) {
                sessionsMap.set(code, libelle);
            }
        });

        const sessions = Array.from(sessionsMap.keys()).sort(
            function (a, b) {
                return a.localeCompare(b, "fr");
            }
        );

        remplirSelect(
            selectSession,
            sessions,
            regime
                ? (sessions.length
                    ? "Choisir une session"
                    : "Aucune session publiée")
                : "Choisir d'abord un régime",
            function (code) {
                return sessionsMap.get(code) || code;
            }
        );

        if (sessions.includes(ancienneSession)) {
            selectSession.value = ancienneSession;
        }

        console.log("✓ Filtres actualisés :", {
            annee: selectAnnee.value,
            semestre: selectSemestre.value,
            regime: selectRegime.value,
            session: selectSession.value
        });
    }

    // =================================================
    // ÉVÉNEMENTS DES FILTRES
    // =================================================
    selectAnnee.addEventListener(
        "change",
        actualiserFiltres
    );

    selectSemestre.addEventListener(
        "change",
        actualiserFiltres
    );

    selectRegime.addEventListener(
        "change",
        actualiserFiltres
    );

    // =================================================
    // SOURCE UNIQUE : CALENDRIERS PUBLIÉS
    // =================================================
    [
        selectAnnee,
        selectSemestre,
        selectRegime,
        selectSession
    ].forEach(function (select) {
        select.disabled = true;
    });

    onSnapshot(
        collection(db, "calendriers"),

        function (snapshot) {
            calendriersPublies = snapshot.docs
                .map(function (documentFirestore) {
                    return {
                        id: documentFirestore.id,
                        ...documentFirestore.data()
                    };
                })
                .filter(function (calendrier) {
                    return calendrier.statut === "publie";
                });

            actualiserFiltres();

            console.log(
                "✓ Calendriers publiés chargés pour les filtres :",
                calendriersPublies.length
            );
        },

        function (erreur) {
            console.error(
                "❌ Erreur de lecture des calendriers publiés :",
                erreur
            );

            [
                selectAnnee,
                selectSemestre,
                selectRegime,
                selectSession
            ].forEach(function (select) {
                select.replaceChildren();

                ajouterOption(
                    select,
                    "",
                    "Erreur de chargement"
                );

                select.disabled = true;
            });
        }
    );
})();

/* =================================================
   GÉNÉRER LES AFFECTATIONS DE TOUS LES CALENDRIERS
   (écriture réelle dans Firestore)
================================================= */

const btnGenererAffectations = document.getElementById("btnGenererAffectations");

if (btnGenererAffectations) {
    btnGenererAffectations.addEventListener("click", async function () {
        const statut = document.getElementById("statutAffectationSalles");
        const resume = document.getElementById("resumeAffectationSalles");

        btnGenererAffectations.disabled = true;

        if (statut) {
            statut.textContent = "Chargement des calendriers enregistrés...";
        }

        try {
            const donnees = await window.generationExamens.obtenirDonnees();
            const sallesAmphis = donnees.sallesAmphis || [];
            const effectifs = donnees.effectifs || [];
            catalogueLocauxValide(sallesAmphis);

            if (sallesAmphis.length === 0 || effectifs.length === 0) {
                throw new Error("Les salles/amphis ou les effectifs sont absents.");
            }

            const annee = document.getElementById("anneeAffectationSalles")?.value;
            const semestre = document.getElementById("semestreAffectationSalles")?.value;
            const regime = document.getElementById("regimeAffectationSalles")?.value;
            const session = document.getElementById("sessionAffectationSalles")?.value;

            if (!annee || !semestre || !regime || !session) {
                throw new Error(
                    "Veuillez sélectionner l'année, le semestre, le régime et la session avant de générer les affectations."
                );
            }

            const snapshot = await getDocs(collection(db, "calendriers"));

            if (snapshot.empty) {
                throw new Error("Aucun calendrier enregistré dans Firestore.");
            }

            const calendriersSelectionnes = snapshot.docs.filter(function (documentCalendrier) {
                const calendrier = documentCalendrier.data();
                return (
                    String(calendrier.anneeUniversitaire ?? "").trim() === annee &&
                    String(calendrier.semestreCode ?? "").trim() === semestre &&
                    String(calendrier.regimeCode ?? "").trim() === regime &&
                    String(calendrier.sessionCode ?? "").trim() === session
                );
            });

            console.log("=== DIAGNOSTIC DES CALENDRIERS FILTRÉS ===", {
                annee, semestre, regime, session,
                nombreTrouve: calendriersSelectionnes.length,
                calendriers: calendriersSelectionnes.map(function (d) {
                    const c = d.data();
                    return {
                        id: d.id,
                        anneeUniversitaire: c.anneeUniversitaire,
                        semestreCode: c.semestreCode,
                        regimeCode: c.regimeCode,
                        sessionCode: c.sessionCode
                    };
                })
            });

            if (calendriersSelectionnes.length === 0) {
                throw new Error(
                    "Aucun calendrier trouvé pour la sélection : " +
                    annee + " / " + semestre + " / " + regime + " / " + session + "."
                );
            }

            let calendriersTraites = 0;
            let calendriersEnregistres = 0;
            let calendriersEnErreur = 0;
            const erreurs = [];
            const calendriersAEnregistrer = [];

            // Classement
            const calendriersTries = classerCalendriersPourAffectation(calendriersSelectionnes, effectifs);

            // Accumuler les affectations réussies des calendriers précédents
            const reservationsExternes = reservationsHorsSelection(snapshot.docs, calendriersSelectionnes, sallesAmphis, effectifs);
            const affectationsPrecedentesGlobales = reservationsExternes.slice();

            for (const documentCalendrier of calendriersTries) {
                const donneesCalendrier = documentCalendrier.data();
                const planning = donneesCalendrier.planning;

                if (!planning || !Array.isArray(planning.filieres)) {
                    calendriersEnErreur++;
                    erreurs.push(
                        documentCalendrier.id +
                        " : structure du planning invalide."
                    );
                    continue;
                }

                try {
                    validerPlanningDates(planning);
                } catch (erreur) {
                    console.error(
                        "ÉCHEC DE VALIDATION DU PLANNING :",
                        documentCalendrier.id,
                        erreur
                    );

                    calendriersEnErreur++;

                    erreurs.push(
                        documentCalendrier.id + " : " + erreur.message
                    );

                    continue;
                }

                console.log("PRÉPARATION DE L'APPEL À AFFECTER :", {
                    calendrier: documentCalendrier.id,
                    nombreFilieres: planning.filieres.length,
                    nombreSalles: sallesAmphis.length,
                    nombreEffectifs: effectifs.length,
                    reservationsPrecedentes: affectationsPrecedentesGlobales.length
                });

                calendriersTraites++;

                // Appel avec les affectations déjà préparées des calendriers précédents
                const resultat = window.affecterLocauxFixes(
                    planning,
                    sallesAmphis,
                    effectifs,
                    affectationsPrecedentesGlobales,
                    donneesCalendrier.anneeUniversitaire
                );

                if (!resultat || !Array.isArray(resultat.affectations)) {
                    calendriersEnErreur++;

                    erreurs.push(
                        documentCalendrier.id +
                        " : " + (resultat?.message || "résultat d'affectation invalide.")
                    );
                    continue;
                }

                console.group("Diagnostic affectations : " + documentCalendrier.id);
                console.log("Message général :", resultat.message);
                console.table(
                    resultat.affectations.map(function (a) {
                        return {
                            filiereCode: a.filiereCode,
                            succes: a.succes,
                            effectif: a.effectif,
                            message: a.message,
                            locaux: a.locaux
                        };
                    })
                );
                console.groupEnd();

                const affectationsParFiliere = new Map(
                    resultat.affectations.map(function (affectation) {
                        return [affectation.filiereCode, affectation];
                    })
                );

                let erreursCalendrier = 0;

                // Reporter les locaux dans les filières sans perdre
                // les affectations réussies lorsqu'une autre échoue.
                const filieresMisesAJour = planning.filieres.map(function (filiere) {
                    const affectation = affectationsParFiliere.get(
                        filiere.filiereCode
                    );

                    if (
                        !affectation ||
                        !affectation.succes ||
                        !Array.isArray(affectation.locaux) ||
                        affectation.locaux.length === 0
                    ) {
                        erreursCalendrier++;

                        erreurs.push(
                            documentCalendrier.id +
                            " — filière " + filiere.filiereCode +
                            " : " + (affectation?.message || "affectation impossible ou manquante.")
                        );

                        // Vider les anciens locaux : ils ne sont pas réservés pour les
                        // calendriers suivants et pourraient provoquer des conflits.
                        return { ...filiere, amphis: [], repartitionLocaux: null };
                    }

                    return {
                        ...filiere,
                        amphis: affectation.locaux,
                        repartitionLocaux: affectation.repartitionLocaux
                    };
                });

                if (erreursCalendrier > 0) {
                    calendriersEnErreur++;

                    console.warn(
                        "Calendrier partiellement affecté :",
                        documentCalendrier.id,
                        erreursCalendrier,
                        "filière(s) en échec."
                    );
                }

                const planningMisAJour = {
                    ...planning,
                    filieres: filieresMisesAJour
                };

                // Conserver le résultat pour la validation globale.
                calendriersAEnregistrer.push({
                    id: documentCalendrier.id,
                    planning: planningMisAJour
                });

                // Ajouter uniquement les affectations réussies
                // pour les contrôles des calendriers suivants.
                for (const aff of resultat.affectations) {
                    if (
                        !aff.succes ||
                        !Array.isArray(aff.locaux) ||
                        aff.locaux.length === 0
                    ) {
                        continue;
                    }

                    const filiereComplete = filieresMisesAJour.find(
                        function (f) {
                            return f.filiereCode === aff.filiereCode;
                        }
                    );

                    if (filiereComplete) {
                        affectationsPrecedentesGlobales.push({
                            calendrierId: documentCalendrier.id,
                            planning: planningMisAJour,
                            filiere: filiereAvecNiveau(filiereComplete, planning.niveauCode),
                            locaux: aff.locaux,
                            repartitionLocaux: aff.repartitionLocaux
                        });
                    }
                }
            }

            // =================================================
            // VALIDATION GLOBALE
            // =================================================
            const anomaliesGlobales = [];

            if (calendriersEnErreur > 0) {
                anomaliesGlobales.push(
                    "Au moins un calendrier comporte une erreur d'affectation."
                );
            }

            if (calendriersAEnregistrer.length !== calendriersSelectionnes.length) {
                anomaliesGlobales.push(
                    "Tous les calendriers sélectionnés n'ont pas été préparés (" +
                    calendriersAEnregistrer.length + " / " + calendriersSelectionnes.length + ")."
                );
            }

            anomaliesGlobales.push(...verifierAffectationsPartagees(
                calendriersAEnregistrer.map(e => ({
                    ...e,
                    anneeUniversitaire: calendriersSelectionnes.find(d => d.id === e.id).data().anneeUniversitaire
                })),
                sallesAmphis,
                effectifs,
                reservationsExternes
            ));

            console.table(anomaliesGlobales.map(function (m) {
                return { anomalie: m };
            }));

            // =================================================
            // BLOQUER L'ÉCRITURE EN CAS DE VRAI CONFLIT DE LOCAUX
            // =================================================
            const conflitsBloquants = anomaliesGlobales.filter(function (m) {
                return m.includes("Capacité cumulée") || m.includes("Partage entre niveaux");
            });

            if (conflitsBloquants.length > 0) {
                if (statut) {
                    statut.textContent =
                        "Enregistrement annulé : " + conflitsBloquants.length + " conflit(s) de locaux.";
                }
                if (resume) {
                    resume.textContent = conflitsBloquants.join("\n");
                }
                return; // le bloc finally réactive le bouton
            }

            // =================================================
            // ÉCRITURE RÉELLE DANS FIRESTORE
            // =================================================
            if (statut) {
                statut.textContent = "Contrôles terminés. Enregistrement en cours...";
            }

            if (calendriersAEnregistrer.length > 0) {
                const batch = writeBatch(db);

                for (const element of calendriersAEnregistrer) {
                    batch.update(
                        doc(db, "calendriers", element.id),
                        { planning: element.planning }
                    );
                }

                await batch.commit();

                calendriersEnregistres = calendriersAEnregistrer.length;

                console.log(
                    "Enregistrement groupé réussi :",
                    calendriersEnregistres,
                    "calendrier(s)."
                );
            }

            const bilan =
                "Calendriers correspondant aux filtres : " +
                calendriersSelectionnes.length +
                " | Traités : " + calendriersTraites +
                " | Enregistrés : " + calendriersEnregistres +
                " | En erreur : " + calendriersEnErreur;

            if (statut) {
                statut.textContent =
                    bilan +
                    " | Anomalies détectées : " +
                    anomaliesGlobales.length;
            }

            if (resume) {
                const lignesResume = [bilan];

                if (erreurs.length > 0) {
                    lignesResume.push(
                        "Erreurs d'affectation :",
                        ...erreurs
                    );
                }

                if (anomaliesGlobales.length > 0) {
                    lignesResume.push(
                        "Anomalies détectées :",
                        ...anomaliesGlobales
                    );
                }

                resume.textContent = lignesResume.join("\n");
            }

            console.log("Bilan des affectations :", {
                total: calendriersSelectionnes.length,
                totalFirestore: snapshot.size,
                traites: calendriersTraites,
                enregistres: calendriersEnregistres,
                erreurs: erreurs
            });

        } catch (erreur) {
            console.error("Erreur lors de la génération des affectations :", erreur);
            if (statut) {
                statut.textContent = "Échec : " + erreur.message;
            }
        } finally {
            btnGenererAffectations.disabled = false;
        }
    });
}

/* =====================================================
   CONTRÔLER LES AFFECTATIONS EXISTANTES
===================================================== */
(function installerControleAffectations() {
    const bouton = document.getElementById("btnControlerAffectations");
    if (!bouton || bouton.dataset.controleInstalle === "oui") return;
    bouton.dataset.controleInstalle = "oui";
    bouton.addEventListener("click", async function () {
        const statut = document.getElementById("statutAffectationSalles"), resume = document.getElementById("resumeAffectationSalles");
        bouton.disabled = true;
        try {
            const filtres = ["anneeAffectationSalles", "semestreAffectationSalles", "regimeAffectationSalles", "sessionAffectationSalles"].map(id => document.getElementById(id)?.value);
            if (filtres.some(v => !v)) throw new Error("Veuillez sélectionner l'année, le semestre, le régime et la session.");
            const donnees = await window.generationExamens.obtenirDonnees();
            const salles = donnees.sallesAmphis || [], effectifs = donnees.effectifs || [];
            catalogueLocauxValide(salles);
            const resultat = await getDocs(collection(db, "calendriers"));
            const selection = resultat.docs.filter(d => ["anneeUniversitaire", "semestreCode", "regimeCode", "sessionCode"].every((k, i) => String(d.data()[k] ?? "").trim() === filtres[i]));
            if (!selection.length) throw new Error("Aucun calendrier trouvé pour les filtres sélectionnés.");
            const externes = reservationsHorsSelection(resultat.docs, selection, salles, effectifs);
            const anomalies = verifierAffectationsPartagees(selection.map(d => ({ id: d.id, ...d.data() })), salles, effectifs, externes);
            console.table(anomalies.map(probleme => ({ probleme })));
            if (statut) statut.textContent = anomalies.length ? "Contrôle terminé : " + anomalies.length + " anomalie(s) détectée(s)." : "Contrôle terminé : aucune anomalie détectée.";
            if (resume) resume.textContent = "Calendriers correspondant aux filtres : " + selection.length + " | Réservations externes : " + externes.length + " | Anomalies : " + anomalies.length + (anomalies.length ? "\n" + anomalies.join("\n") : "");
        } catch (erreur) { console.error(erreur); if (statut) statut.textContent = "Échec : " + erreur.message; if (resume) resume.textContent = "Contrôle impossible : " + erreur.message; }
        finally { bouton.disabled = false; }
    });
})();

/* =================================================
   DIAGNOSTICS
================================================= */

window.diagnostiquerFiltresAffectation = async function () {
    const annee = document.getElementById("anneeAffectationSalles")?.value;
    const semestre = document.getElementById("semestreAffectationSalles")?.value;
    const regime = document.getElementById("regimeAffectationSalles")?.value;
    const session = document.getElementById("sessionAffectationSalles")?.value;

    if (!annee || !semestre || !regime || !session) {
        console.warn("Sélection incomplète : choisissez les quatre filtres.");
        return;
    }

    try {
        const snapshot = await getDocs(collection(db, "calendriers"));

        const resultats = snapshot.docs
            .filter(function (d) {
                const c = d.data();
                return (
                    String(c.anneeUniversitaire ?? "").trim() === annee &&
                    String(c.semestreCode ?? "").trim() === semestre &&
                    String(c.regimeCode ?? "").trim() === regime &&
                    String(c.sessionCode ?? "").trim() === session
                );
            })
            .map(function (d) {
                const c = d.data();
                return {
                    id: d.id,
                    anneeUniversitaire: c.anneeUniversitaire,
                    semestreCode: c.semestreCode,
                    regimeCode: c.regimeCode,
                    sessionCode: c.sessionCode,
                    nombreFilieres: Array.isArray(c.planning?.filieres)
                        ? c.planning.filieres.length
                        : "Planning absent ou invalide"
                };
            });

        console.log("Filtres sélectionnés :", { annee, semestre, regime, session });
        console.log("Nombre de calendriers correspondants :", resultats.length);
        console.table(resultats);
    } catch (erreur) {
        console.error("Erreur du diagnostic en lecture seule :", erreur);
    }
};

window.diagnostiquerTousLesCalendriers = async function () {
    try {
        const snapshot = await getDocs(collection(db, "calendriers"));
        const resultats = snapshot.docs.map(function (d) {
            const c = d.data();
            return {
                id: d.id,
                annee: c.anneeUniversitaire,
                semestre: c.semestreCode,
                regime: c.regimeCode,
                session: c.sessionCode,
                nombreFilieres: Array.isArray(c.planning?.filieres)
                    ? c.planning.filieres.length
                    : 0
            };
        });
        console.table(resultats);
        console.log("Nombre total de calendriers :", resultats.length);
    } catch (erreur) {
        console.error("Erreur du diagnostic :", erreur);
    }
};

window.diagnostiquerDatesAffectations = async function () {
    try {
        const snapshot = await getDocs(collection(db, "calendriers"));

        for (const documentCalendrier of snapshot.docs) {
            const donnees = documentCalendrier.data();
            const planning = donnees.planning;

            if (!planning || !Array.isArray(planning.filieres)) continue;

            const cellule = planning.filieres
                .flatMap(filiere => filiere.cellules || [])
                .find(cellule => cellule.estOccupee);

            if (cellule) {
                console.log("Diagnostic date/créneau :", documentCalendrier.id, {
                    date: cellule.date,
                    typeDate: typeof cellule.date,
                    creneauOrdre: cellule.creneauOrdre,
                    estOccupee: cellule.estOccupee
                });
                return;
            }
        }

        console.warn("Aucune cellule occupée trouvée.");
    } catch (erreur) {
        console.error("Erreur du diagnostic :", erreur);
    }
};
