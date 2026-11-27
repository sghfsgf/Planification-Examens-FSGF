// =================================================
// AFFECTATION DES SALLES / AMPHIS  (version améliorée)
//
// Améliorations :
//  - anomalies structurées { type, bloquant, message }
//  - contrôle planning (controle.js) : avertit sans bloquer l'affectation
//  - conflits de capacité/niveaux signalés sans annuler l'enregistrement
//  - calendriers hors sélection traités comme réservations
//  - écriture en transaction + historique + simulation + confirmation
//  - index d'occupation, recherche limitée, interface avec pauses
//  - constantes dans CONFIG
// =================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    getDocs,
    collection,
    onSnapshot,
    query,
    where,
    doc,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// =================================================
// FIRESTORE
// =================================================

const db = getFirestore(app);

console.log("✓ affectation-salles.js chargé.");

// =================================================
// CONFIGURATION
// =================================================

const CONFIG = {
    // Recherche de combinaisons de locaux
    SEUIL_OCCUPATION: 0.66,
    PART_MIN: 10,
    TAILLE_MAX: 4,
    TAILLE_MAX_GLOUTON: 12,
    MAX_RETENUES: 12,
    MAX_VISITES: 5000,

    // Recherche récursive
    LIMITE_RECHERCHE: 3000,
    LIMITE_APRES_SOLUTION: 500,
    LIMITE_MS: 4000,

    // Statuts des calendriers qui reçoivent des locaux (null = tous)
    STATUTS_A_AFFECTER: ["publie"],
    // Statuts dont les locaux sont considérés comme réservés (null = tous, plus prudent)
    STATUTS_RESERVATIONS: null,

    // Écriture
    SAUVEGARDER_AVANT_ECRITURE: true,
    SOUS_COLLECTION_HISTORIQUE: "historiqueAffectations",
    MAX_CALENDRIERS_TRANSACTION: 200,

    // Si true et que controle.js est absent : la génération est refusée
    CONTROLE_PLANNING_OBLIGATOIRE: false,

    // Expose les fonctions diagnostiquer… dans la console
    DIAGNOSTICS_ACTIFS: false
};

const IDS_BOUTONS = ["btnGenererAffectations", "btnControlerAffectations"];

// =================================================
// ANOMALIES STRUCTURÉES
// =================================================

const TYPES_BLOQUANTS = new Set(["CAPACITE_CUMULEE", "PARTAGE_NIVEAUX"]);

function anomalie(type, message, extra = {}) {
    return { type, bloquant: TYPES_BLOQUANTS.has(type), message, ...extra };
}

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
    // Même convention que generation.js et controle.js : jour civil dans le fuseau du navigateur.
    return String(date.getFullYear()).padStart(4, "0") + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function cleCreneauAffectation(cellule) {
    if (!cellule || cellule.creneauOrdre == null || cellule.creneauOrdre === "" || typeof cellule.creneauOrdre === "boolean") throw new Error("Créneau absent ou invalide.");
    const ordre = Number(cellule.creneauOrdre);
    if (!Number.isInteger(ordre) || ordre <= 0) throw new Error("Ordre de créneau invalide.");
    return jourCivilAffectation(cellule.date) + "|" + ordre;
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

// Disponibilité tolérante : "Oui", "oui", " OUI "
function estLocalDisponible(salle) {
    return normaliserCode(salle && salle.disponible) === "OUI";
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

// -------------------------------------------------
// Index d'occupation : "local|date|créneau" -> { utilise, niveaux }
// Construit une fois, au lieu de parcourir toutes les affectations
// pour chaque local et chaque examen.
// -------------------------------------------------

function construireIndexOccupation(affectations) {
    const index = new Map();

    for (const a of affectations) {
        if (!a.filiere || !a.filiere.niveauCode) throw new Error("Niveau canonique de réservation absent.");
        const r = a.repartitionLocaux || a.filiere.repartitionLocaux;
        if (!Array.isArray(r)) throw new Error("Répartition de réservation absente.");

        for (const cle of clesExamens(a.filiere)) {
            for (const x of r) {
                const k = x.codeLocal + "|" + cle;
                let entree = index.get(k);
                if (!entree) {
                    entree = { utilise: 0, niveaux: new Set() };
                    index.set(k, entree);
                }
                entree.utilise += x.effectif || 0;
                entree.niveaux.add(a.filiere.niveauCode);
            }
        }
    }

    return index;
}

// indexes : tableau d'index (réservations précédentes + affectations courantes)
function capaciteRestanteLocal(filiere, code, capacite, indexes) {
    let restant = capacite;

    for (const cle of clesExamens(filiere)) {
        const k = code + "|" + cle;
        let utilise = 0;

        for (const index of indexes) {
            const entree = index.get(k);
            if (!entree) continue;
            if (!filiere.niveauCode) throw new Error("Niveau canonique de réservation absent.");
            // Un local ne peut pas être partagé entre deux niveaux au même créneau.
            for (const niveau of entree.niveaux) {
                if (niveau !== filiere.niveauCode) return 0;
            }
            utilise += entree.utilise;
        }

        restant = Math.min(restant, capacite - utilise);
    }

    return Math.max(0, restant);
}

// -------------------------------------------------
// Réservations des calendriers hors sélection.
// Retourne { reservations, anomalies } : un document défectueux est signalé
// sans bloquer les autres.
// -------------------------------------------------

function reservationsHorsSelection(documents, selection, salles, effectifs = [], statuts = CONFIG.STATUTS_RESERVATIONS) {
    const ids = new Set(selection.map(d => d.id));
    const reservations = [];
    const anomalies = [];

    for (const docu of documents) {
        if (ids.has(docu.id)) continue;

        const donnees = docu.data();
        if (Array.isArray(statuts) && !statuts.includes(donnees.statut)) continue;

        const p = donnees.planning;
        if (!p || !Array.isArray(p.filieres)) {
            if (p != null) {
                anomalies.push(anomalie("RESERVATION_EXTERNE_INVALIDE", docu.id + " : planning externe inexploitable.", { calendrierId: docu.id }));
            }
            continue;
        }

        try {
            const locales = [];

            for (const sourceFiliere of p.filieres) {
                const f = filiereAvecNiveau(sourceFiliere, p.niveauCode);
                if (f.amphis == null || (Array.isArray(f.amphis) && f.amphis.length === 0)) continue;
                const locaux = codesLocauxStricts(f.amphis);
                validerPlanningDates({ niveauCode: p.niveauCode, filieres: [f] });
                locaux.forEach(code => { if (!salles.some(s => s.code === code)) throw new Error("local réservé inconnu : " + code); });

                let repartitionLocaux, prudente = false;
                if (f.repartitionLocaux != null) {
                    const effectif = lireEffectifStrict(effectifs, donnees.anneeUniversitaire, p.niveauCode, f.filiereCode);
                    repartitionLocaux = repartitionValidee(f, locaux, effectif, salles);
                } else {
                    // Monolocal historique : reconstruction exacte seulement si cohorte identifiable.
                    let effectif = null;
                    if (locaux.length === 1) {
                        try { effectif = lireEffectifStrict(effectifs, donnees.anneeUniversitaire, p.niveauCode, f.filiereCode); } catch (_) { /* Réserver le local entier, sans deviner l'année ni l'effectif. */ }
                        if (effectif != null && effectif > Number(salles.find(s => s.code === locaux[0]).capacite)) throw new Error("capacité de réservation insuffisante.");
                    }
                    prudente = effectif == null;
                    repartitionLocaux = locaux.map(code => ({ codeLocal: code, effectif: effectif ?? Number(salles.find(s => s.code === code).capacite) }));
                }

                locales.push({ calendrierId: docu.id, filiere: f, locaux, repartitionLocaux, reservationPrudente: prudente });
            }

            reservations.push(...locales);
        } catch (erreur) {
            anomalies.push(anomalie("RESERVATION_EXTERNE_INVALIDE", docu.id + " : " + erreur.message, { calendrierId: docu.id }));
        }
    }

    return { reservations, anomalies };
}

// Retourne un tableau d'anomalies structurées.
function verifierAffectationsPartagees(elements, salles, effectifs, reservations = []) {
    catalogueLocauxValide(salles);
    const anomalies = [], affectations = [];

    elements.forEach(e => {
        try { validerPlanningDates(e.planning); } catch (err) { anomalies.push(anomalie("PLANNING_INVALIDE", e.id + " : " + err.message, { calendrierId: e.id })); return; }

        e.planning.filieres.forEach(sourceFiliere => {
            const f = filiereAvecNiveau(sourceFiliere, e.planning.niveauCode);
            try {
                const locaux = codesLocauxStricts(f.amphis);
                if (!locaux.length) throw new Error("Aucun local affecté.");
                const effectif = lireEffectifStrict(effectifs, e.anneeUniversitaire, e.planning.niveauCode, f.filiereCode);
                locaux.forEach(code => {
                    const s = salles.find(s => s.code === code);
                    if (!s) throw new Error("Local inconnu : " + code);
                    if (!estLocalDisponible(s)) throw new Error("Local indisponible : " + code);
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
            } catch (err) {
                anomalies.push(anomalie("AFFECTATION_INVALIDE", e.id + " / " + f.filiereCode + " : " + err.message, { calendrierId: e.id }));
            }
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
        if (c.selection && (c.niveaux.size !== 1 || c.niveaux.has(undefined))) {
            anomalies.push(anomalie("PARTAGE_NIVEAUX", "Partage entre niveaux différents interdit : " + c.code + " / " + c.cle));
        }
        if (c.selection && c.total > Number(salles.find(s => s.code === c.code).capacite)) {
            anomalies.push(anomalie("CAPACITE_CUMULEE", "Capacité cumulée dépassée : " + c.code + " / " + c.cle + " — " + c.total + " étudiants (" + c.filieres.join(", ") + ")"));
        }
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
    options = {}                   // { dejaValide: true, indexes: [...] } depuis affecterLocauxFixes
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

    const indexes = options.indexes || [construireIndexOccupation(toutes)];

    let tronquee = false;

    // Locaux libres pour TOUS les examens de la filière, triés par capacité restante décroissante
    const locaux = sallesAmphis
        .filter(s => estLocalDisponible(s))
        .map(s => {
            const nominale = Number(s.capacite);
            const cap = capaciteRestanteLocal(filiere, s.code, nominale, indexes);
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

        for (let k = 2; k <= CONFIG.TAILLE_MAX && combinaisons.length === 0; k++) {
            const groupe = [];
            const explorer = function (debut, cumul) {
                if (visites++ > CONFIG.MAX_VISITES) { tronquee = true; return; }
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
    if (combinaisons.length === 0) {
        for (let exclu = -1; exclu < Math.min(CONFIG.MAX_RETENUES, locaux.length); exclu++) {
            const pool = locaux.filter((_, i) => i !== exclu);
            const groupe = [];
            let reste = eff;
            while (reste > 0 && pool.length > 0 && groupe.length < CONFIG.TAILLE_MAX_GLOUTON) {
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
            tronquee,
            message: "Aucune combinaison possible : effectif " + eff +
                ", " + locaux.length + " local(aux) libre(s) pour tous ses examens, capacité libre cumulée " +
                capaciteLibre + (locaux.length ? ", plus grand local libre " + locaux[0].cap : "") +
                " (maximum " + CONFIG.TAILLE_MAX_GLOUTON + " locaux par filière)."
        };
    }

    // Ordre de préférence :
    //  1) moins de locaux
    //  2) pas de local presque vide (moins de PART_MIN étudiants), puis taux d'occupation >= 66 %
    //  3) ajustement le plus serré (favorise les locaux déjà entamés)
    //  4) taux le plus élevé
    combinaisons.sort(function (a, b) {
        if (a.locaux.length !== b.locaux.length) return a.locaux.length - b.locaux.length;
        const petitA = a.partMin < CONFIG.PART_MIN;
        const petitB = b.partMin < CONFIG.PART_MIN;
        if (petitA !== petitB) return petitA ? 1 : -1;
        const okA = a.tauxOccupation >= CONFIG.SEUIL_OCCUPATION;
        const okB = b.tauxOccupation >= CONFIG.SEUIL_OCCUPATION;
        if (okA !== okB) return okA ? -1 : 1;
        if (a.capaciteRestanteTotale !== b.capaciteRestanteTotale) {
            return a.capaciteRestanteTotale - b.capaciteRestanteTotale;
        }
        if (a.tauxOccupation !== b.tauxOccupation) return b.tauxOccupation - a.tauxOccupation;
        return a.locaux.join().localeCompare(b.locaux.join());
    });
    combinaisons = combinaisons.slice(0, CONFIG.MAX_RETENUES);

    const meilleure = combinaisons[0];

    return {
        succes: true,
        locaux: meilleure.locaux,
        capaciteTotale: meilleure.capaciteTotale,
        tauxOccupation: meilleure.tauxOccupation,
        repartitionLocaux: meilleure.repartitionLocaux,
        tronquee,
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
    let indexPrecedent;

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

        // Index des réservations précédentes : construit une seule fois
        indexPrecedent = construireIndexOccupation(affectationsPrecedentes);
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

    const debutRecherche = performance.now();

    let noeudsExplores = 0;
    let limiteAtteinte = false;
    let combinaisonsTronquees = false;
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

        // 1. Meilleure solution partielle : plus d'affectations réussies,
        //    puis moins de locaux utilisés.
        if (
            score.nombreAffecte > meilleurNombreAffectePartiel ||
            (
                score.nombreAffecte === meilleurNombreAffectePartiel &&
                meilleurScorePartiel &&
                score.nombreLocaux < meilleurScorePartiel.nombreLocaux
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
            noeudsExplores >= CONFIG.LIMITE_RECHERCHE ||
            performance.now() - debutRecherche > CONFIG.LIMITE_MS
        ) {
            limiteAtteinte = true;
            enregistrerMeilleureSolution(affectationsCourantes);
            return;
        }

        // Solution complète déjà trouvée : on laisse un budget limité pour l'améliorer
        if (solutionCompleteTrouvee && noeudsExplores - noeudsPremiereSolution > CONFIG.LIMITE_APRES_SOLUTION) {
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

        // Index des affectations courantes : construit une fois par nœud
        const indexes = [indexPrecedent, construireIndexOccupation(affectationsReussies)];

        const possibilites = filieresRestantes.map(function (donnee) {
            const resultatRecherche = rechercherMeilleureCombinaisonLocaux(
                donnee.filiere,
                donnee.effectif,
                sallesAmphis,
                null,
                affectationsReussies,
                affectationsPrecedentes,
                { dejaValide: true, indexes: indexes }
            );

            if (resultatRecherche.tronquee) combinaisonsTronquees = true;

            const combinaisons = Array.isArray(resultatRecherche.combinaisons)
                ? resultatRecherche.combinaisons
                : [];

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
        combinaisonsTronquees: combinaisonsTronquees,
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
        combinaisonsTronquees: combinaisonsTronquees,
        nombreAffecte: nombreAffecte,
        nombreFilieres: donneesFilieres.length
    };
}

window.affecterLocauxFixes = affecterLocauxFixes;

// =================================================
// OUTILS DE PAGE : filtres, sélection, dépendances, verrou
// =================================================

const IDS_FILTRES = {
    annee: "anneeAffectationSalles",
    semestre: "semestreAffectationSalles",
    regime: "regimeAffectationSalles",
    session: "sessionAffectationSalles"
};

function lireFiltres() {
    const filtres = {
        annee: document.getElementById(IDS_FILTRES.annee)?.value,
        semestre: document.getElementById(IDS_FILTRES.semestre)?.value,
        regime: document.getElementById(IDS_FILTRES.regime)?.value,
        session: document.getElementById(IDS_FILTRES.session)?.value
    };

    return filtres.annee && filtres.semestre && filtres.regime && filtres.session
        ? filtres
        : null;
}

// Sélection unique par les quatre filtres (et, si demandé, par statut)
function selectionnerCalendriers(documents, filtres, statuts = null) {
    return documents.filter(function (d) {
        const c = d.data();

        if (Array.isArray(statuts) && !statuts.includes(c.statut)) return false;

        return (
            String(c.anneeUniversitaire ?? "").trim() === filtres.annee &&
            String(c.semestreCode ?? "").trim() === filtres.semestre &&
            String(c.regimeCode ?? "").trim() === filtres.regime &&
            String(c.sessionCode ?? "").trim() === filtres.session
        );
    });
}

async function obtenirDonneesReferentiel() {
    if (
        !window.generationExamens ||
        typeof window.generationExamens.obtenirDonnees !== "function"
    ) {
        throw new Error(
            "generation.js n'est pas chargé (window.generationExamens.obtenirDonnees introuvable)."
        );
    }

    const donnees = await window.generationExamens.obtenirDonnees();
    const salles = donnees.sallesAmphis || [];
    const effectifs = donnees.effectifs || [];

    catalogueLocauxValide(salles);

    if (salles.length === 0 || effectifs.length === 0) {
        throw new Error("Les salles/amphis ou les effectifs sont absents.");
    }

    return { salles, effectifs };
}

// Contrôle du planning par controle.js avant d'affecter des locaux.
// Lève une erreur si le planning est bloqué.
// Contrôle du planning : signale les anomalies sans bloquer l'affectation.
// Retourne { absent, avertissements: string[] }.
function controlerPlanningAvantAffectation(id, planning, sessionCode) {
    const controle = window.controleExamens;

    if (!controle || typeof controle.verifierPlanningGlobal !== "function") {
        if (CONFIG.CONTROLE_PLANNING_OBLIGATOIRE) {
            throw new Error("controle.js n'est pas chargé : impossible de contrôler le planning.");
        }
        return { absent: true, avertissements: [] };
    }

    const resultat = controle.verifierPlanningGlobal(planning, {
        silencieux: true,
        sessionCode: sessionCode,
        exigerLocaux: false,
        matieresNonPlaceesBloquantes: false
    });

    const avertissements = [];

    if (!resultat.valide || (resultat.anomalies && resultat.anomalies.length > 0)) {
        const messages = (resultat.anomalies || [])
            .map(a => a.message)
            .concat(resultat.anomaliesBloquantes || [])
            .concat(resultat.avertissements || []);

        const uniques = [...new Set(messages.filter(Boolean))];

        if (uniques.length > 0) {
            avertissements.push(
                id + " — contrôle planning : " + uniques.join(" ; ")
            );
        }
    }

    return { absent: false, avertissements: avertissements };
}

const pause = () => new Promise(resolve => setTimeout(resolve, 0));

// Une seule opération à la fois (générer OU contrôler)
let operationEnCours = false;

function demarrerOperation() {
    if (operationEnCours) return false;

    operationEnCours = true;
    IDS_BOUTONS.forEach(id => {
        const b = document.getElementById(id);
        if (b) b.disabled = true;
    });

    return true;
}

function terminerOperation() {
    operationEnCours = false;
    IDS_BOUTONS.forEach(id => {
        const b = document.getElementById(id);
        if (b) b.disabled = false;
    });
}

// =================================================
// INITIALISER LES FILTRES
// =================================================

(function initialiserFiltresAffectation() {
    const selectAnnee = document.getElementById(IDS_FILTRES.annee);
    const selectSemestre = document.getElementById(IDS_FILTRES.semestre);
    const selectRegime = document.getElementById(IDS_FILTRES.regime);
    const selectSession = document.getElementById(IDS_FILTRES.session);

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

    function valeurTexte(valeur) {
        return valeur == null ? "" : String(valeur).trim();
    }

    function ajouterOption(select, valeur, libelle) {
        const option = document.createElement("option");
        option.value = valeur;
        option.textContent = libelle;
        select.appendChild(option);
    }

    // Tri naturel (S2 avant S10) ; décroissant pour les années (la plus récente d'abord)
    function valeursDistinctes(calendriers, champ, decroissant = false) {
        return [
            ...new Set(
                calendriers
                    .map(function (calendrier) {
                        return valeurTexte(calendrier[champ]);
                    })
                    .filter(Boolean)
            )
        ].sort(function (a, b) {
            const ordre = a.localeCompare(b, "fr", { numeric: true });
            return decroissant ? -ordre : ordre;
        });
    }

    // Reconstruire une liste et conserver la sélection
    // uniquement si elle reste disponible.
    function remplirSelect(select, valeurs, texteInitial, fonctionLibelle) {
        const ancienneValeur = select.value;

        select.replaceChildren();

        ajouterOption(select, "", texteInitial);

        valeurs.forEach(function (valeur) {
            ajouterOption(
                select,
                valeur,
                fonctionLibelle ? fonctionLibelle(valeur) : valeur
            );
        });

        select.value = valeurs.includes(ancienneValeur) ? ancienneValeur : "";

        select.disabled = valeurs.length === 0;
    }

    // Cascade Année → Semestre → Régime → Session (calendriers publiés)
    function actualiserFiltres() {
        // 1. Années universitaires publiées
        const annees = valeursDistinctes(
            calendriersPublies,
            "anneeUniversitaire",
            true
        );

        remplirSelect(
            selectAnnee,
            annees,
            annees.length
                ? "Choisir une année universitaire"
                : "Aucune année publiée"
        );

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

        const semestres = valeursDistinctes(calendriersAnnee, "semestreCode");

        remplirSelect(
            selectSemestre,
            semestres,
            annee
                ? (semestres.length
                    ? "Choisir un semestre"
                    : "Aucun semestre publié")
                : "Choisir d'abord une année"
        );

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

        const regimes = valeursDistinctes(calendriersSemestre, "regimeCode");

        remplirSelect(
            selectRegime,
            regimes,
            semestre
                ? (regimes.length
                    ? "Choisir un régime"
                    : "Aucun régime publié")
                : "Choisir d'abord un semestre"
        );

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
                return a.localeCompare(b, "fr", { numeric: true });
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

        console.log("✓ Filtres actualisés :", {
            annee: selectAnnee.value,
            semestre: selectSemestre.value,
            regime: selectRegime.value,
            session: selectSession.value
        });
    }

    selectAnnee.addEventListener("change", actualiserFiltres);
    selectSemestre.addEventListener("change", actualiserFiltres);
    selectRegime.addEventListener("change", actualiserFiltres);

    [selectAnnee, selectSemestre, selectRegime, selectSession].forEach(function (select) {
        select.disabled = true;
    });

    // Source : calendriers publiés uniquement (filtre côté serveur)
    const arreterEcoute = onSnapshot(
        query(collection(db, "calendriers"), where("statut", "==", "publie")),

        function (snapshot) {
            calendriersPublies = snapshot.docs.map(function (documentFirestore) {
                return {
                    id: documentFirestore.id,
                    ...documentFirestore.data()
                };
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

            [selectAnnee, selectSemestre, selectRegime, selectSession].forEach(function (select) {
                select.replaceChildren();
                ajouterOption(select, "", "Erreur de chargement");
                select.disabled = true;
            });
        }
    );

    window.addEventListener("pagehide", arreterEcoute);
})();

// =================================================
// ÉCRITURE : transaction + sauvegarde de l'ancien planning
// =================================================

async function enregistrerAffectations(elements, signatures) {
    if (elements.length > CONFIG.MAX_CALENDRIERS_TRANSACTION) {
        throw new Error(
            "Trop de calendriers pour une transaction (" + elements.length +
            " > " + CONFIG.MAX_CALENDRIERS_TRANSACTION + ")."
        );
    }

    await runTransaction(db, async function (transaction) {
        const refs = elements.map(e => doc(db, "calendriers", e.id));

        // Toutes les lectures avant les écritures
        const instantanes = [];
        for (const ref of refs) {
            instantanes.push(await transaction.get(ref));
        }

        instantanes.forEach(function (instantane, i) {
            const id = elements[i].id;

            if (!instantane.exists()) {
                throw new Error(id + " : calendrier supprimé pendant le traitement.");
            }

            const actuel = JSON.stringify(instantane.data().planning ?? null);

            if (actuel !== signatures.get(id)) {
                throw new Error(
                    id + " : modifié par un autre utilisateur depuis le début du traitement. " +
                    "Rien n'a été enregistré : relancez la génération."
                );
            }
        });

        elements.forEach(function (element, i) {
            if (CONFIG.SAUVEGARDER_AVANT_ECRITURE) {
                const refHistorique = doc(
                    collection(db, "calendriers", element.id, CONFIG.SOUS_COLLECTION_HISTORIQUE)
                );

                transaction.set(refHistorique, {
                    planning: instantanes[i].data().planning ?? null,
                    sauvegardeLe: serverTimestamp(),
                    motif: "avant-affectation-salles"
                });
            }

            transaction.update(refs[i], {
                planning: element.planning,
                affectationsModifieesLe: serverTimestamp()
            });
        });
    });
}

// =================================================
// GÉNÉRER LES AFFECTATIONS DES CALENDRIERS SÉLECTIONNÉS
// =================================================

(function installerGenerationAffectations() {
    const bouton = document.getElementById("btnGenererAffectations");

    if (!bouton) return;

    bouton.addEventListener("click", async function () {
        if (!demarrerOperation()) return;

        const statut = document.getElementById("statutAffectationSalles");
        const resume = document.getElementById("resumeAffectationSalles");

        const afficher = async function (texte) {
            if (statut) statut.textContent = texte;
            await pause(); // laisse le navigateur redessiner
        };

        try {
            if (resume) resume.textContent = "";
            await afficher("Chargement des calendriers enregistrés...");

            const { salles: sallesAmphis, effectifs } = await obtenirDonneesReferentiel();

            const filtres = lireFiltres();

            if (!filtres) {
                throw new Error(
                    "Veuillez sélectionner l'année, le semestre, le régime et la session avant de générer les affectations."
                );
            }

            const snapshot = await getDocs(collection(db, "calendriers"));

            if (snapshot.empty) {
                throw new Error("Aucun calendrier enregistré dans Firestore.");
            }

            const calendriersSelectionnes = selectionnerCalendriers(
                snapshot.docs,
                filtres,
                CONFIG.STATUTS_A_AFFECTER
            );

            console.log("=== CALENDRIERS FILTRÉS ===", {
                ...filtres,
                statuts: CONFIG.STATUTS_A_AFFECTER,
                nombreTrouve: calendriersSelectionnes.length
            });

            if (calendriersSelectionnes.length === 0) {
                throw new Error(
                    "Aucun calendrier trouvé pour la sélection : " +
                    filtres.annee + " / " + filtres.semestre + " / " +
                    filtres.regime + " / " + filtres.session + "."
                );
            }

            // -------------------------------------------------
            // PRÉ-VALIDATION : structure + contrôle du planning
            // -------------------------------------------------
            await afficher("Contrôle des plannings...");

            const erreurs = [];
            const calendriersValides = [];
            const identifiantsIgnores = new Set();
            const signatures = new Map();
            const anneeParId = new Map();
            let controleAbsent = false;
            const avertissementsControle = [];

            for (const documentCalendrier of calendriersSelectionnes) {
                const donneesCalendrier = documentCalendrier.data();
                const planning = donneesCalendrier.planning;

                try {
                    if (!planning || !Array.isArray(planning.filieres)) {
                        throw new Error("structure du planning invalide.");
                    }

                    validerPlanningDates(planning);

                    // Contrôle : messages collectés, calendrier NON exclu
                    const controle = controlerPlanningAvantAffectation(
                        documentCalendrier.id,
                        planning,
                        donneesCalendrier.sessionCode
                    );
                    if (controle.absent) controleAbsent = true;
                    if (controle.avertissements && controle.avertissements.length) {
                        avertissementsControle.push(...controle.avertissements);
                    }

                    calendriersValides.push(documentCalendrier);
                    signatures.set(documentCalendrier.id, JSON.stringify(planning));
                    anneeParId.set(documentCalendrier.id, donneesCalendrier.anneeUniversitaire);
                } catch (erreur) {
                    // Uniquement structure / dates invalides
                    console.error("PLANNING IGNORÉ :", documentCalendrier.id, erreur);
                    identifiantsIgnores.add(documentCalendrier.id);
                    erreurs.push(documentCalendrier.id + " : " + erreur.message);
                }
            }

            if (avertissementsControle.length > 0) {
                await afficher(
                    "Contrôle : " + avertissementsControle.length +
                    " avertissement(s) — affectation poursuivie…"
                );
            }

            let calendriersEnErreur = identifiantsIgnores.size;
            let calendriersTraites = 0;
            let calendriersEnregistres = 0;
            let calendriersLimites = 0;
            let calendriersTronques = 0;
            let filieresEnEchec = 0;

            if (calendriersValides.length === 0) {
                throw new Error(
                    "Aucun calendrier exploitable. " + erreurs.join(" | ")
                );
            }

            // -------------------------------------------------
            // RÉSERVATIONS EXTERNES
            // Les calendriers ignorés gardent leurs locaux : ils comptent comme réservations.
            // -------------------------------------------------
            const externes = reservationsHorsSelection(
                snapshot.docs,
                calendriersValides,
                sallesAmphis,
                effectifs
            );

            const reservationsExternes = externes.reservations;

            // Les erreurs des calendriers ignorés sont déjà listées plus haut
            const anomaliesExternes = externes.anomalies.filter(
                a => !identifiantsIgnores.has(a.calendrierId)
            );

            const affectationsPrecedentesGlobales = reservationsExternes.slice();
            const calendriersAEnregistrer = [];

            // -------------------------------------------------
            // AFFECTATION, CALENDRIER PAR CALENDRIER
            // -------------------------------------------------
            const calendriersTries = classerCalendriersPourAffectation(calendriersValides, effectifs);

            for (let i = 0; i < calendriersTries.length; i++) {
                const documentCalendrier = calendriersTries[i];
                const donneesCalendrier = documentCalendrier.data();
                const planning = donneesCalendrier.planning;

                await afficher(
                    "Affectation " + (i + 1) + " / " + calendriersTries.length +
                    " : " + documentCalendrier.id + "..."
                );

                calendriersTraites++;

                const resultat = affecterLocauxFixes(
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

                if (resultat.rechercheLimitee) calendriersLimites++;
                if (resultat.combinaisonsTronquees) calendriersTronques++;

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
                    const affectation = affectationsParFiliere.get(filiere.filiereCode);

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
                    filieresEnEchec += erreursCalendrier;

                    console.warn(
                        "Calendrier partiellement affecté :",
                        documentCalendrier.id,
                        erreursCalendrier,
                        "filière(s) en échec."
                    );
                }

                const planningMisAJour = { ...planning, filieres: filieresMisesAJour };

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
                        f => f.filiereCode === aff.filiereCode
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

            // -------------------------------------------------
            // VALIDATION GLOBALE
            // -------------------------------------------------
            await afficher("Validation globale des affectations...");

            const anomaliesGlobales = [...anomaliesExternes];

            anomaliesGlobales.push(
                ...avertissementsControle.map(msg =>
                    anomalie("CONTROLE_PLANNING", msg)
                )
            );

            if (calendriersEnErreur > 0) {
                anomaliesGlobales.push(anomalie(
                    "ERREUR_AFFECTATION",
                    "Au moins un calendrier comporte une erreur d'affectation."
                ));
            }

            if (calendriersAEnregistrer.length !== calendriersSelectionnes.length) {
                anomaliesGlobales.push(anomalie(
                    "CALENDRIER_NON_PREPARE",
                    "Tous les calendriers sélectionnés n'ont pas été préparés (" +
                    calendriersAEnregistrer.length + " / " + calendriersSelectionnes.length + ")."
                ));
            }

            anomaliesGlobales.push(...verifierAffectationsPartagees(
                calendriersAEnregistrer.map(e => ({
                    ...e,
                    anneeUniversitaire: anneeParId.get(e.id)
                })),
                sallesAmphis,
                effectifs,
                reservationsExternes
            ));

            console.table(anomaliesGlobales.map(a => ({ type: a.type, bloquant: a.bloquant, message: a.message })));

            const simulation =
                document.getElementById("simulationAffectationSalles")?.checked === true;

            const bilan =
                "Calendriers correspondant aux filtres : " + calendriersSelectionnes.length +
                " | Traités : " + calendriersTraites +
                " | À enregistrer : " + calendriersAEnregistrer.length +
                " | En erreur : " + calendriersEnErreur;

            const construireResume = function (enregistres) {
                const lignes = [bilan + (enregistres != null ? " | Enregistrés : " + enregistres : "")];

                if (simulation) lignes.push("MODE SIMULATION : rien n'est enregistré.");
                if (controleAbsent) lignes.push("⚠ controle.js non chargé : contrôle du planning ignoré.");
                if (calendriersLimites > 0) lignes.push("⚠ Recherche limitée (temps ou nœuds) pour " + calendriersLimites + " calendrier(s) : résultat à vérifier.");
                if (calendriersTronques > 0) lignes.push("⚠ Exploration des combinaisons tronquée pour " + calendriersTronques + " calendrier(s).");

                const prudentes = reservationsExternes.filter(r => r.reservationPrudente).length;
                if (prudentes > 0) lignes.push("Réservations externes prudentes (effectif inconnu, local entier réservé) : " + prudentes);

                if (avertissementsControle.length > 0) {
                    lignes.push("Avertissements contrôle planning :", ...avertissementsControle);
                }
                if (erreurs.length > 0) lignes.push("Problèmes d'affectation :", ...erreurs);
                if (anomaliesGlobales.length > 0) {
                    lignes.push(
                        "Anomalies détectées :",
                        ...anomaliesGlobales.map(a => (a.bloquant ? "[important] " : "") + a.message)
                    );
                }

                return lignes.join("\n");
            };

            // -------------------------------------------------
            // Conflits de locaux : signalés, n'empêchent plus l'enregistrement
            // -------------------------------------------------
            const conflitsBloquants = anomaliesGlobales.filter(a => a.bloquant);

            if (conflitsBloquants.length > 0) {
                console.warn(
                    "Conflits de locaux signalés (enregistrement proposé quand même) :",
                    conflitsBloquants
                );
            }

            if (simulation) {
                if (statut) statut.textContent = "Simulation terminée : rien n'a été enregistré. " + bilan;
                if (resume) resume.textContent = construireResume(null);
                return;
            }

            if (calendriersAEnregistrer.length === 0) {
                if (statut) statut.textContent = "Aucune affectation à enregistrer. " + bilan;
                if (resume) resume.textContent = construireResume(0);
                return;
            }

            // -------------------------------------------------
            // CONFIRMATION
            // -------------------------------------------------
            if (resume) resume.textContent = construireResume(null);
            await afficher("Calcul terminé : en attente de confirmation...");

            const confirme = window.confirm(
                "Enregistrer les affectations de " + calendriersAEnregistrer.length + " calendrier(s) ?\n\n" +
                "• Filières sans local (leurs anciens locaux seront vidés) : " + filieresEnEchec + "\n" +
                "• Anomalies signalées : " + anomaliesGlobales.length +
                (conflitsBloquants.length
                    ? "\n• dont " + conflitsBloquants.length + " conflit(s) de capacité/niveaux (non bloquants pour l'enregistrement)"
                    : "") +
                (CONFIG.SAUVEGARDER_AVANT_ECRITURE
                    ? "\n\nL'ancien planning de chaque calendrier sera conservé dans son historique."
                    : "\n\nAucune sauvegarde de l'ancien planning n'est activée.")
            );

            if (!confirme) {
                if (statut) statut.textContent = "Enregistrement annulé par l'utilisateur. " + bilan;
                return;
            }

            // -------------------------------------------------
            // ÉCRITURE RÉELLE (transaction)
            // -------------------------------------------------
            await afficher("Enregistrement en cours...");

            await enregistrerAffectations(calendriersAEnregistrer, signatures);

            calendriersEnregistres = calendriersAEnregistrer.length;

            console.log("Enregistrement réussi :", calendriersEnregistres, "calendrier(s).");

            if (statut) {
                statut.textContent =
                    bilan + " | Enregistrés : " + calendriersEnregistres +
                    " | Anomalies détectées : " + anomaliesGlobales.length;
            }

            if (resume) resume.textContent = construireResume(calendriersEnregistres);

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
            terminerOperation();
        }
    });
})();

/* =====================================================
   CONTRÔLER LES AFFECTATIONS EXISTANTES
===================================================== */
(function installerControleAffectations() {
    const bouton = document.getElementById("btnControlerAffectations");

    if (!bouton || bouton.dataset.controleInstalle === "oui") return;

    bouton.dataset.controleInstalle = "oui";

    bouton.addEventListener("click", async function () {
        if (!demarrerOperation()) return;

        const statut = document.getElementById("statutAffectationSalles");
        const resume = document.getElementById("resumeAffectationSalles");

        try {
            const filtres = lireFiltres();

            if (!filtres) {
                throw new Error("Veuillez sélectionner l'année, le semestre, le régime et la session.");
            }

            const { salles, effectifs } = await obtenirDonneesReferentiel();

            const resultat = await getDocs(collection(db, "calendriers"));

            const selection = selectionnerCalendriers(
                resultat.docs,
                filtres,
                CONFIG.STATUTS_A_AFFECTER
            );

            if (!selection.length) {
                throw new Error("Aucun calendrier trouvé pour les filtres sélectionnés.");
            }

            const externes = reservationsHorsSelection(resultat.docs, selection, salles, effectifs);

            const anomalies = [
                ...externes.anomalies,
                ...verifierAffectationsPartagees(
                    selection.map(d => ({ id: d.id, ...d.data() })),
                    salles,
                    effectifs,
                    externes.reservations
                )
            ];

            console.table(anomalies.map(a => ({ type: a.type, bloquant: a.bloquant, message: a.message })));

            if (statut) {
                statut.textContent = anomalies.length
                    ? "Contrôle terminé : " + anomalies.length + " anomalie(s) détectée(s)."
                    : "Contrôle terminé : aucune anomalie détectée.";
            }

            if (resume) {
                resume.textContent =
                    "Calendriers correspondant aux filtres : " + selection.length +
                    " | Réservations externes : " + externes.reservations.length +
                    " | Anomalies : " + anomalies.length +
                    (anomalies.length ? "\n" + anomalies.map(a => a.message).join("\n") : "");
            }
        } catch (erreur) {
            console.error(erreur);
            if (statut) statut.textContent = "Échec : " + erreur.message;
            if (resume) resume.textContent = "Contrôle impossible : " + erreur.message;
        } finally {
            terminerOperation();
        }
    });
})();

/* =================================================
   DIAGNOSTICS (désactivés par défaut : CONFIG.DIAGNOSTICS_ACTIFS)
================================================= */

if (CONFIG.DIAGNOSTICS_ACTIFS) {

    window.diagnostiquerFiltresAffectation = async function () {
        const filtres = lireFiltres();

        if (!filtres) {
            console.warn("Sélection incomplète : choisissez les quatre filtres.");
            return;
        }

        try {
            const snapshot = await getDocs(collection(db, "calendriers"));

            const resultats = selectionnerCalendriers(snapshot.docs, filtres).map(function (d) {
                const c = d.data();
                return {
                    id: d.id,
                    statut: c.statut,
                    anneeUniversitaire: c.anneeUniversitaire,
                    semestreCode: c.semestreCode,
                    regimeCode: c.regimeCode,
                    sessionCode: c.sessionCode,
                    nombreFilieres: Array.isArray(c.planning?.filieres)
                        ? c.planning.filieres.length
                        : "Planning absent ou invalide"
                };
            });

            console.log("Filtres sélectionnés :", filtres);
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
                    statut: c.statut,
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
                const planning = documentCalendrier.data().planning;

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
}
