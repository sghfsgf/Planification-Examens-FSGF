// =================================================
// AFFECTATION DES SALLES / AMPHIS - VERSION OPTIMISÉE FIRESTORE
// Règle : Sauver d'abord ce qui est propre + minimiser lectures/écritures
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
console.log("✓ affectation-salles.js (version optimisée Firestore) chargé.");

// =================================================
// OUTILS (identiques à la version précédente)
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
        const m = valeur.match(/^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/);
        if (!m) throw new Error("Date non ISO ou invalide.");
        const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
        const verif = new Date(0);
        verif.setUTCFullYear(y, mo - 1, d);
        verif.setUTCHours(0, 0, 0, 0);
        if (verif.getUTCFullYear() !== y || verif.getUTCMonth() !== mo - 1 || verif.getUTCDate() !== d) {
            throw new Error("Jour civil invalide.");
        }
        if (!m[4]) return `${m[1]}-${m[2]}-${m[3]}`;
        date = new Date(valeur);
    } else {
        throw new Error("Format de date non pris en charge.");
    }
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error("Date invalide.");
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function cleCreneauAffectation(cellule) {
    if (!cellule || cellule.creneauOrdre == null || cellule.creneauOrdre === "" || typeof cellule.creneauOrdre === "boolean") {
        throw new Error("Créneau absent ou invalide.");
    }
    const ordre = Number(cellule.creneauOrdre);
    if (!Number.isInteger(ordre) || ordre <= 0) throw new Error("Ordre de créneau invalide.");
    return jourCivilAffectation(cellule.date) + "|" + ordre;
}

function memeCreneau(a, b) {
    return cleCreneauAffectation(a) === cleCreneauAffectation(b);
}

function catalogueLocauxValide(salles) {
    if (!Array.isArray(salles)) throw new Error("Catalogue des locaux invalide.");
    const codes = new Set();
    salles.forEach(s => {
        if (!s || typeof s.code !== "string" || !s.code.trim()) throw new Error("Code local invalide.");
        if (codes.has(s.code)) throw new Error("Code local dupliqué : " + s.code);
        codes.add(s.code);
        if (!Number.isInteger(Number(s.capacite)) || Number(s.capacite) <= 0) {
            throw new Error("Capacité invalide : " + s.code);
        }
    });
}

function codesLocauxStricts(amphis) {
    if (!Array.isArray(amphis)) throw new Error("Liste de locaux invalide.");
    const codes = amphis.map(l => typeof l === "string" ? l : (l?.code || l?.localCode));
    const vus = new Set();
    codes.forEach(c => {
        if (typeof c !== "string" || !c.trim()) throw new Error("Code d'affectation invalide.");
        if (vus.has(c)) throw new Error("Local affecté en double : " + c);
        vus.add(c);
    });
    return codes;
}

function validerPlanningDates(planning) {
    if (!planning?.filieres?.length || !planning.niveauCode) throw new Error("Structure du planning invalide.");
    const vus = new Set();
    planning.filieres.forEach(f => {
        if (!f?.filiereCode || vus.has(f.filiereCode) || !Array.isArray(f.cellules)) {
            throw new Error("Filière invalide : " + (f?.filiereCode || "?"));
        }
        vus.add(f.filiereCode);
        f.cellules.forEach(c => {
            if (c?.estOccupee) cleCreneauAffectation(c);
        });
    });
}

function filiereAvecNiveau(filiere, niveauCode) {
    if (!filiere || !niveauCode) throw new Error("Niveau de filière manquant.");
    return { ...filiere, niveauCode };
}

function lireEffectifStrict(effectifs, annee, niveau, filiere) {
    const lignes = effectifs.filter(l =>
        l?.anneeUniversitaire === annee &&
        l?.niveauCode === niveau &&
        l?.filiereCode === filiere
    );
    if (lignes.length !== 1) throw new Error(`Effectif absent ou ambigu : ${annee}/${niveau}/${filiere}`);
    const v = Number(lignes[0].effectif);
    if (!Number.isInteger(v) || v <= 0) throw new Error("Effectif invalide : " + filiere);
    return v;
}

function clesExamens(filiere) {
    return [...new Set((filiere.cellules || []).filter(c => c.estOccupee).map(c => cleCreneauAffectation(c)))];
}

// =================================================
// CAPACITÉ RÉSIDUELLE + INTERDICTION INTER-NIVEAUX
// =================================================

function capaciteRestanteLocal(filiere, code, salles, affectations) {
    const capacite = Number(salles.find(s => s.code === code)?.capacite || 0);
    let restant = capacite;

    for (const cle of clesExamens(filiere)) {
        let utilise = 0;
        for (const a of affectations) {
            if (!a.locaux.includes(code) || !clesExamens(a.filiere).includes(cle)) continue;

            // Règle stricte : pas de partage entre niveaux différents
            if (filiere.niveauCode !== a.filiere.niveauCode) return 0;

            const r = a.repartitionLocaux || a.filiere.repartitionLocaux || [];
            utilise += r.find(x => x.codeLocal === code)?.effectif || 0;
        }
        restant = Math.min(restant, capacite - utilise);
    }
    return Math.max(0, restant);
}

// =================================================
// RECHERCHE DE COMBINAISON (simplifiée et sécurisée)
// =================================================

function rechercherMeilleureCombinaisonLocaux(filiere, effectif, sallesAmphis, affectationsExistantes) {
    catalogueLocauxValide(sallesAmphis);

    const locauxDisponibles = sallesAmphis
        .filter(s => s.disponible === "Oui")
        .map(s => ({
            ...s,
            capaciteRestante: capaciteRestanteLocal(filiere, s.code, sallesAmphis, affectationsExistantes)
        }))
        .filter(s => s.capaciteRestante > 0)
        .sort((a, b) => b.capaciteRestante - a.capaciteRestante); // plus grands d'abord

    // 1. Un seul local suffit ?
    const mono = locauxDisponibles.find(s => s.capaciteRestante >= effectif);
    if (mono) {
        return {
            succes: true,
            locaux: [mono.code],
            repartitionLocaux: [{ codeLocal: mono.code, effectif }],
            message: "Un seul local suffit."
        };
    }

    // 2. Plusieurs locaux (greedy)
    const choisis = [];
    let restant = effectif;
    let capaciteTotale = 0;

    for (const s of locauxDisponibles) {
        if (restant <= 0) break;
        const prend = Math.min(s.capaciteRestante, restant);
        if (prend <= 0) continue;
        choisis.push({ codeLocal: s.code, effectif: prend });
        capaciteTotale += Number(s.capacite);
        restant -= prend;
    }

    if (restant > 0) {
        return {
            succes: false,
            locaux: [],
            repartitionLocaux: [],
            message: "Capacité insuffisante (contraintes de niveau + réservation)."
        };
    }

    return {
        succes: true,
        locaux: choisis.map(c => c.codeLocal),
        repartitionLocaux: choisis,
        message: "Plusieurs locaux nécessaires."
    };
}

// =================================================
// AFFECTATION D'UN PLANNING (partiel autorisé)
// =================================================

function affecterLocauxFixes(planning, sallesAmphis, effectifs, affectationsPrecedentes = [], anneeUniversitaire) {
    try {
        catalogueLocauxValide(sallesAmphis);
        validerPlanningDates(planning);
        if (!anneeUniversitaire) throw new Error("Année universitaire requise.");
    } catch (e) {
        return { succes: false, affectations: [], message: e.message };
    }

    const resultats = [];

    // On traite les filières une par une (ordre simple)
    for (const sourceFiliere of planning.filieres) {
        const filiere = filiereAvecNiveau(sourceFiliere, planning.niveauCode);

        let effectif;
        try {
            effectif = lireEffectifStrict(effectifs, anneeUniversitaire, planning.niveauCode, filiere.filiereCode);
        } catch (e) {
            resultats.push({
                filiereCode: filiere.filiereCode,
                succes: false,
                locaux: [],
                message: e.message
            });
            continue;
        }

        const resultat = rechercherMeilleureCombinaisonLocaux(
            filiere,
            effectif,
            sallesAmphis,
            affectationsPrecedentes
        );

        if (resultat.succes) {
            resultats.push({
                filiereCode: filiere.filiereCode,
                succes: true,
                locaux: resultat.locaux,
                repartitionLocaux: resultat.repartitionLocaux,
                message: resultat.message
            });

            // On ajoute immédiatement pour les filières suivantes du même planning
            affectationsPrecedentes.push({
                filiere,
                locaux: resultat.locaux,
                repartitionLocaux: resultat.repartitionLocaux
            });
        } else {
            resultats.push({
                filiereCode: filiere.filiereCode,
                succes: false,
                locaux: [],
                message: resultat.message
            });
        }
    }

    const nbReussies = resultats.filter(r => r.succes).length;

    return {
        succes: nbReussies === planning.filieres.length,
        affectations: resultats,
        nombreAffecte: nbReussies,
        nombreFilieres: planning.filieres.length,
        message: nbReussies === planning.filieres.length
            ? "Toutes les filières affectées."
            : `Solution partielle : ${nbReussies}/${planning.filieres.length} filière(s) affectée(s).`
    };
}

// =================================================
// BOUTON GÉNÉRER – VERSION OPTIMISÉE FIRESTORE
// =================================================

const btnGenererAffectations = document.getElementById("btnGenererAffectations");

if (btnGenererAffectations) {
    btnGenererAffectations.addEventListener("click", async function () {
        const statut = document.getElementById("statutAffectationSalles");
        const resume = document.getElementById("resumeAffectationSalles");
        btnGenererAffectations.disabled = true;

        if (statut) statut.textContent = "Chargement des calendriers filtrés...";

        try {
            const donnees = await window.generationExamens.obtenirDonnees();
            const sallesAmphis = donnees.sallesAmphis || [];
            const effectifs = donnees.effectifs || [];
            catalogueLocauxValide(sallesAmphis);

            if (!sallesAmphis.length || !effectifs.length) {
                throw new Error("Salles ou effectifs manquants.");
            }

            const annee = document.getElementById("anneeAffectationSalles")?.value;
            const semestre = document.getElementById("semestreAffectationSalles")?.value;
            const regime = document.getElementById("regimeAffectationSalles")?.value;
            const session = document.getElementById("sessionAffectationSalles")?.value;

            if (!annee || !semestre || !regime || !session) {
                throw new Error("Veuillez sélectionner année, semestre, régime et session.");
            }

            // ========== LECTURE OPTIMISÉE (filtre serveur) ==========
            const q = query(
                collection(db, "calendriers"),
                where("anneeUniversitaire", "==", annee),
                where("semestreCode", "==", semestre),
                where("regimeCode", "==", regime),
                where("sessionCode", "==", session)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                throw new Error("Aucun calendrier trouvé pour cette sélection.");
            }

            const calendriers = snapshot.docs;
            console.log(`✓ ${calendriers.length} calendrier(s) chargé(s) avec filtre serveur.`);

            // On récupère aussi les autres calendriers de la même année/semestre
            // uniquement si nécessaire pour les réservations externes (version légère)
            const qExternes = query(
                collection(db, "calendriers"),
                where("anneeUniversitaire", "==", annee),
                where("semestreCode", "==", semestre)
            );
            const snapshotExternes = await getDocs(qExternes);

            const affectationsPrecedentesGlobales = [];

            // Construction légère des réservations externes
            snapshotExternes.docs.forEach(docu => {
                if (calendriers.some(c => c.id === docu.id)) return; // on ignore ceux qu'on traite

                const data = docu.data();
                const p = data.planning;
                if (!p?.filieres) return;

                p.filieres.forEach(f => {
                    if (!f.amphis || f.amphis.length === 0) return;
                    try {
                        const locaux = codesLocauxStricts(f.amphis);
                        affectationsPrecedentesGlobales.push({
                            calendrierId: docu.id,
                            filiere: filiereAvecNiveau(f, p.niveauCode),
                            locaux,
                            repartitionLocaux: f.repartitionLocaux || locaux.map(c => ({
                                codeLocal: c,
                                effectif: Number(sallesAmphis.find(s => s.code === c)?.capacite || 0)
                            }))
                        });
                    } catch (_) { /* on ignore les réservations invalides */ }
                });
            });

            let traites = 0;
            let enregistres = 0;
            let partiels = 0;
            const erreurs = [];
            const batch = writeBatch(db);
            let operationsBatch = 0;

            for (const documentCalendrier of calendriers) {
                const data = documentCalendrier.data();
                const planning = data.planning;

                if (!planning?.filieres) {
                    erreurs.push(documentCalendrier.id + " : planning invalide");
                    continue;
                }

                traites++;

                const resultat = affecterLocauxFixes(
                    planning,
                    sallesAmphis,
                    effectifs,
                    [...affectationsPrecedentesGlobales], // copie
                    data.anneeUniversitaire
                );

                // ===== RÈGLE : on ne touche que les filières réussies =====
                let aChange = false;
                const filieresMisesAJour = planning.filieres.map(filiere => {
                    const aff = resultat.affectations.find(a => a.filiereCode === filiere.filiereCode);

                    if (aff?.succes && aff.locaux?.length > 0) {
                        // Vérifier si ça a vraiment changé
                        const anciens = Array.isArray(filiere.amphis) ? filiere.amphis.slice().sort().join(",") : "";
                        const nouveaux = aff.locaux.slice().sort().join(",");

                        if (anciens !== nouveaux) {
                            aChange = true;
                            return {
                                ...filiere,
                                amphis: aff.locaux,
                                repartitionLocaux: aff.repartitionLocaux
                            };
                        }
                    }
                    // Échec ou identique → on garde l'ancien
                    return filiere;
                });

                if (aChange) {
                    batch.update(doc(db, "calendriers", documentCalendrier.id), {
                        planning: { ...planning, filieres: filieresMisesAJour }
                    });
                    operationsBatch++;
                    enregistres++;

                    if (resultat.nombreAffecte < resultat.nombreFilieres) {
                        partiels++;
                    }
                }

                // Ajouter les réussites pour les calendriers suivants
                resultat.affectations.forEach(aff => {
                    if (aff.succes && aff.locaux.length > 0) {
                        const f = filieresMisesAJour.find(x => x.filiereCode === aff.filiereCode);
                        if (f) {
                            affectationsPrecedentesGlobales.push({
                                calendrierId: documentCalendrier.id,
                                filiere: filiereAvecNiveau(f, planning.niveauCode),
                                locaux: aff.locaux,
                                repartitionLocaux: aff.repartitionLocaux
                            });
                        }
                    }
                });
            }

            // ===== ÉCRITURE UNIQUE =====
            if (operationsBatch > 0) {
                await batch.commit();
                console.log(`✓ Batch commit : ${operationsBatch} calendrier(s) mis à jour.`);
            }

            const bilan = `Traités : ${traites} | Écrits : ${enregistres} | Partiels : ${partiels} | Erreurs : ${erreurs.length}`;
            if (statut) statut.textContent = bilan + " | Seules les affectations propres ont été enregistrées.";
            if (resume) {
                resume.textContent = [
                    bilan,
                    erreurs.length ? "Détails erreurs :\n" + erreurs.join("\n") : "Aucune erreur bloquante."
                ].join("\n\n");
            }

        } catch (erreur) {
            console.error(erreur);
            if (statut) statut.textContent = "Échec : " + erreur.message;
        } finally {
            btnGenererAffectations.disabled = false;
        }
    });
}
