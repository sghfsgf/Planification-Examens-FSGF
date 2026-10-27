// =================================================
// AFFECTATION DES SALLES / AMPHIS
// =================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    getDocs,
    collection,
    doc,
    updateDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// =================================================
// FIRESTORE
// =================================================

const db = getFirestore(app);

console.log("✓ affectation-salles.js chargé.");
console.log("✓ Firestore initialisé pour l'affectation des salles.");

// =================================================
// LECTURE DES SALLES / AMPHIS DEPUIS FIRESTORE
// =================================================

async function chargerSallesAmphisFirestore() {
    const snapshot = await getDocs(collection(db, "salles_amphis"));
    const sallesAmphis = [];

    snapshot.forEach(function (documentFirestore) {
        sallesAmphis.push({
            id: documentFirestore.id,
            ...documentFirestore.data()
        });
    });

    console.log("✓ Salles / amphis Firestore :", sallesAmphis.length);
    console.log("Données salles / amphis :", sallesAmphis);
    return sallesAmphis;
}

chargerSallesAmphisFirestore().catch(function (erreur) {
    console.error("❌ Erreur lecture salles / amphis Firestore :", erreur);
});

// =================================================
// TEST DES DONNÉES DU MOTEUR
// =================================================

function testerDonneesAffectation() {
    if (!window.generationExamens || !window.generationExamens.obtenirDonnees) {
        console.warn("⏳ Moteur de génération pas encore disponible.");
        return;
    }

    const donnees = window.generationExamens.obtenirDonnees();

    console.log("==========================================");
    console.log("TEST DES DONNÉES POUR AFFECTATION");
    console.log("==========================================");
    console.log("Salles / amphis :", donnees.sallesAmphis);
    console.log("Effectifs :", donnees.effectifs);
    console.log("Nombre de salles / amphis :", donnees.sallesAmphis.length);
    console.log("Nombre d'effectifs :", donnees.effectifs.length);
    console.log("==========================================");
    console.log("DÉTAIL DES SALLES / AMPHIS");
    console.table(donnees.sallesAmphis);
    console.log("==========================================");
    console.log("DÉTAIL DES EFFECTIFS");
    console.table(donnees.effectifs);

    console.log("Effectifs détaillés :");
    donnees.effectifs.forEach(function (effectif) {
        console.log(
            effectif.anneeUniversitaire, "|",
            effectif.niveauCode, "|",
            effectif.filiereCode, "| Effectif =",
            effectif.effectif
        );
    });

    console.log("Salles / amphis détaillés :");
    donnees.sallesAmphis.forEach(function (salle) {
        console.log(
            salle.code, "|",
            salle.type, "|",
            salle.libelle, "| Capacité =",
            salle.capacite, "| Disponible =",
            salle.disponible
        );
    });

    console.log("==========================================");
}

setTimeout(testerDonneesAffectation, 1000);

// =================================================
// RECHERCHER DES LOCAUX POUR UNE FILIÈRE (version simple)
// =================================================

function trouverLocauxPourFiliere(filiereCode, effectif, sallesAmphis) {
    if (!effectif || !sallesAmphis || sallesAmphis.length === 0) {
        return {
            succes: false,
            locaux: [],
            message: "Aucun local disponible."
        };
    }

    const locauxDisponibles = sallesAmphis.filter(function (salle) {
        return salle.disponible === "Oui" && Number(salle.capacite) > 0;
    });

    // 1. Un seul local
    const localUnique = locauxDisponibles
        .filter(function (salle) {
            return Number(salle.capacite) >= Number(effectif);
        })
        .sort(function (a, b) {
            return Number(a.capacite) - Number(b.capacite);
        })[0];

    if (localUnique) {
        return {
            succes: true,
            locaux: [localUnique.code],
            capaciteTotale: Number(localUnique.capacite),
            effectif: Number(effectif),
            message: "Un seul local suffit."
        };
    }

    // 2. Plusieurs locaux (greedy par capacité décroissante)
    const locauxTries = locauxDisponibles
        .slice()
        .sort(function (a, b) {
            return Number(b.capacite) - Number(a.capacite);
        });

    const locauxChoisis = [];
    let capaciteTotale = 0;

    for (let i = 0; i < locauxTries.length; i++) {
        const salle = locauxTries[i];
        locauxChoisis.push(salle.code);
        capaciteTotale += Number(salle.capacite);

        if (capaciteTotale >= Number(effectif)) {
            return {
                succes: true,
                locaux: locauxChoisis,
                capaciteTotale: capaciteTotale,
                effectif: Number(effectif),
                message: "Plusieurs locaux sont nécessaires."
            };
        }
    }

    return {
        succes: false,
        locaux: [],
        capaciteTotale: capaciteTotale,
        effectif: Number(effectif),
        message: "Affectation impossible."
    };
}

window.trouverLocauxPourFiliere = trouverLocauxPourFiliere;

// =================================================
// VÉRIFIER SI UN LOCAL EST DÉJÀ UTILISÉ À UNE DATE / CRÉNEAU
// =================================================

function localEstDisponiblePourCreneau(codeLocal, date, creneauOrdre, affectations) {
    if (!affectations || affectations.length === 0) {
        return true;
    }

    const conflit = affectations.some(function (affectation) {
        return (
            affectation.codeLocal === codeLocal &&
            affectation.date === date &&
            Number(affectation.creneauOrdre) === Number(creneauOrdre)
        );
    });

    return !conflit;
}

window.localEstDisponiblePourCreneau = localEstDisponiblePourCreneau;

// =================================================
// CONTRÔLE DES CONFLITS ENTRE CELLULES (dates + créneaux)
// =================================================

function memeCreneau(celluleA, celluleB) {
    if (!celluleA?.date || !celluleB?.date) {
        return false;
    }

    const ordreA = celluleA.creneauOrdre;
    const ordreB = celluleB.creneauOrdre;

    if (
        ordreA === null || ordreA === undefined || ordreA === "" ||
        ordreB === null || ordreB === undefined || ordreB === ""
    ) {
        return false;
    }

    const dateA = celluleA.date;
    const dateB = celluleB.date;

    const memeDate =
        typeof dateA.isEqual === "function"
            ? dateA.isEqual(dateB)
            : (
                dateA.seconds === dateB.seconds &&
                (dateA.nanoseconds || 0) === (dateB.nanoseconds || 0)
            );

    return (
        memeDate &&
        Number.isFinite(Number(ordreA)) &&
        Number.isFinite(Number(ordreB)) &&
        Number(ordreA) === Number(ordreB)
    );
}

// =================================================
// CONSTRUIRE LA MATRICE DES CONFLITS ENTRE FILIÈRES (intra-calendrier)
// =================================================

function construireConflitsFilieres(planning) {
    const conflits = [];

    if (!planning || !Array.isArray(planning.filieres)) {
        return conflits;
    }

    for (let i = 0; i < planning.filieres.length; i++) {
        const filiereA = planning.filieres[i];

        for (let j = i + 1; j < planning.filieres.length; j++) {
            const filiereB = planning.filieres[j];

            const examensA = (filiereA.cellules || []).filter(function (c) {
                return c.estOccupee;
            });
            const examensB = (filiereB.cellules || []).filter(function (c) {
                return c.estOccupee;
            });

            let conflitTrouve = false;

            for (let a = 0; a < examensA.length && !conflitTrouve; a++) {
                for (let b = 0; b < examensB.length; b++) {
                    if (memeCreneau(examensA[a], examensB[b])) {
                        conflitTrouve = true;
                        break;
                    }
                }
            }

            if (conflitTrouve) {
                conflits.push({
                    filiereA: filiereA.filiereCode,
                    filiereB: filiereB.filiereCode
                });
            }
        }
    }

    return conflits;
}

window.construireConflitsFilieres = construireConflitsFilieres;

// =================================================
// CONSTRUIRE LA CARTE DES CONFLITS
// =================================================

function construireCarteConflits(conflits) {
    const carteConflits = {};

    if (!conflits) {
        return carteConflits;
    }

    conflits.forEach(function (conflit) {
        const filiereA = conflit.filiereA;
        const filiereB = conflit.filiereB;

        if (!carteConflits[filiereA]) carteConflits[filiereA] = [];
        if (!carteConflits[filiereB]) carteConflits[filiereB] = [];

        carteConflits[filiereA].push(filiereB);
        carteConflits[filiereB].push(filiereA);
    });

    return carteConflits;
}

window.construireCarteConflits = construireCarteConflits;

// =================================================
// COMPATIBILITÉ AVEC LES CONFLITS INTRA-CALENDRIER
// =================================================

function localCompatibleAvecConflits(
    filiereCode,
    codeLocal,
    carteConflits,
    affectationsFilieres
) {
    if (!carteConflits || !affectationsFilieres) {
        return true;
    }

    const conflits = carteConflits[filiereCode] || [];

    for (let i = 0; i < conflits.length; i++) {
        const filiereEnConflit = conflits[i];
        const affectation = affectationsFilieres.find(function (item) {
            return item.filiereCode === filiereEnConflit;
        });

        if (
            affectation &&
            affectation.locaux &&
            affectation.locaux.includes(codeLocal)
        ) {
            return false;
        }
    }

    return true;
}

window.localCompatibleAvecConflits = localCompatibleAvecConflits;

// =================================================
// NOUVEAU : COMPATIBILITÉ AVEC LES AFFECTATIONS DES CALENDRIERS PRÉCÉDENTS
// (dates + créneaux réels)
// =================================================

function localCompatibleAvecAffectationsPrecedentes(
    filiereCourante,
    codeLocal,
    affectationsPrecedentes
) {
    if (!affectationsPrecedentes || affectationsPrecedentes.length === 0) {
        return true;
    }

    const examensCourants = (filiereCourante.cellules || []).filter(function (c) {
        return c.estOccupee;
    });

    if (examensCourants.length === 0) {
        return true;
    }

    for (const prec of affectationsPrecedentes) {
        if (!prec.locaux || !prec.locaux.includes(codeLocal)) {
            continue;
        }

        const examensPrec = (prec.filiere.cellules || []).filter(function (c) {
            return c.estOccupee;
        });

       
for (const cellA of examensCourants) {
    for (const cellB of examensPrec) {

        
const conflit = memeCreneau(cellA, cellB);

if (conflit || (
    cellA.date?.toDate?.()?.toISOString() ===
        cellB.date?.toDate?.()?.toISOString() &&
    Number(cellA.creneauOrdre) === Number(cellB.creneauOrdre)
)) {
    console.log("Créneau identique détecté :", {
        codeLocal,
        calendrierPrecedent: prec.calendrierId,
        dateCourante: cellA.date?.toDate?.()?.toISOString(),
        datePrecedente: cellB.date?.toDate?.()?.toISOString(),
        ordreCourant: cellA.creneauOrdre,
        ordrePrecedent: cellB.creneauOrdre,
        memeCreneau: conflit
    });
}


        if (memeCreneau(cellA, cellB)) {
            return false; // conflit temporel réel
        }
    }
}

    }

    return true;
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

function classerCalendriersPourAffectation(documents) {
    const elements = documents.map(function (documentCalendrier) {
        const donnees = documentCalendrier.data();
        const planning = donnees.planning;

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
                vecteur: []
            });
        }

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
// (prend en compte conflits intra + affectations précédentes)
// =================================================

function rechercherMeilleureCombinaisonLocaux(
    filiere,
    effectif,
    sallesAmphis,
    carteConflits,
    affectationsFilieresCourantes,
    affectationsPrecedentes
) {
    const filiereCode = filiere.filiereCode;

    // 1. Conserver uniquement les locaux disponibles et compatibles.
    const locauxDisponibles = sallesAmphis.filter(function (salle) {
        const capacite = Number(salle.capacite);

        if (
            salle.disponible !== "Oui" ||
            !Number.isFinite(capacite) ||
            capacite <= 0
        ) {
            return false;
        }

        if (!localCompatibleAvecConflits(
            filiereCode,
            salle.code,
            carteConflits,
            affectationsFilieresCourantes
        )) {
            return false;
        }

        if (!localCompatibleAvecAffectationsPrecedentes(
            filiere,
            salle.code,
            affectationsPrecedentes
        )) {
            return false;
        }

        return true;
    });

    // 2. Rechercher toutes les combinaisons compatibles suffisantes.
    const combinaisons = [];

    function rechercherCombinaisons(debut, combinaison, capaciteTotale) {
        if (capaciteTotale >= effectif) {
            const locaux = combinaison.slice();
            const tauxOccupation = effectif / capaciteTotale;

            combinaisons.push({
                locaux: locaux,
                capaciteTotale: capaciteTotale,
                tauxOccupation: tauxOccupation
            });

            return;
        }

        for (let i = debut; i < locauxDisponibles.length; i++) {
            const salle = locauxDisponibles[i];
            const capacite = Number(salle.capacite);

            combinaison.push(salle.code);

            rechercherCombinaisons(
                i + 1,
                combinaison,
                capaciteTotale + capacite
            );

            combinaison.pop();
        }
    }

    rechercherCombinaisons(0, [], 0);

    // Aucune combinaison compatible ne permet d'accueillir l'effectif.
    if (combinaisons.length === 0) {
        return {
            succes: false,
            locaux: [],
            capaciteTotale: 0,
            tauxOccupation: 0,
            combinaisons: [],
            message:
                "Aucune combinaison de locaux ne permet d'accueillir l'effectif (contraintes intra + inter-calendriers)."
        };
    }

    // 3. Classer les combinaisons selon les priorités définies.
    combinaisons.sort(function (a, b) {
        const prioriteA =
            a.tauxOccupation >= 0.83 ? 0 :
            a.tauxOccupation >= 0.66 ? 1 : 2;

        const prioriteB =
            b.tauxOccupation >= 0.83 ? 0 :
            b.tauxOccupation >= 0.66 ? 1 : 2;

        // Priorité 1 : catégorie du taux d'occupation.
        if (prioriteA !== prioriteB) {
            return prioriteA - prioriteB;
        }

        // Priorité 2 : utiliser le moins de locaux possible.
        if (a.locaux.length !== b.locaux.length) {
            return a.locaux.length - b.locaux.length;
        }

        // Priorité 3 : capacité totale minimale.
        return a.capaciteTotale - b.capaciteTotale;
    });

    // 4. Préparer la meilleure combinaison pour rester compatible
    // avec les appels qui utilisent encore les propriétés classiques.
    const meilleure = combinaisons[0];
    const tauxOccupation = meilleure.tauxOccupation;

    const message =
        tauxOccupation >= 0.83
            ? (meilleure.locaux.length === 1
                ? "Un seul local suffit : priorité 83 %."
                : "Plusieurs locaux : priorité 83 %.")
            : tauxOccupation >= 0.66
                ? (meilleure.locaux.length === 1
                    ? "Un seul local suffit : priorité 66 %."
                    : "Plusieurs locaux : priorité 66 %.")
                : (meilleure.locaux.length === 1
                    ? "Un seul local suffit : dernier recours sous 66 %."
                    : "Plusieurs locaux : dernier recours sous 66 %.");

    return {
        succes: true,
        locaux: meilleure.locaux,
        capaciteTotale: meilleure.capaciteTotale,
        tauxOccupation: tauxOccupation,
        message: message,

        // Nouvelle propriété utilisée par la recherche avec retour arrière.
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
    affectationsPrecedentes = []
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

    const conflits = construireConflitsFilieres(planning);
    const carteConflits = construireCarteConflits(conflits);

    const filieresTriees = planning.filieres
        .slice()
        .sort(function (a, b) {
            return (
                compterMatieresProgrammeesParFiliere(b) -
                compterMatieresProgrammeesParFiliere(a)
            );
        });

    const donneesFilieres = filieresTriees.map(function (filiere) {
        const lignes = effectifs.filter(function (ligne) {
            return (
                ligne.niveauCode === planning.niveauCode &&
                ligne.filiereCode === filiere.filiereCode
            );
        });

        if (lignes.length !== 1) {
            return {
                filiere: filiere,
                valide: false,
                effectif: null,
                message: lignes.length === 0
                    ? "Effectif introuvable."
                    : "Plusieurs lignes d'effectif correspondent à cette filière."
            };
        }

        const effectif = Number(lignes[0].effectif);

        if (!Number.isFinite(effectif) || effectif <= 0) {
            return {
                filiere: filiere,
                valide: false,
                effectif: effectif,
                message: "Effectif invalide."
            };
        }

        return {
            filiere: filiere,
            valide: true,
            effectif: effectif,
            message: ""
        };
    });

    const LIMITE_RECHERCHE = 10000;
    let noeudsExplores = 0;
    let limiteAtteinte = false;

    let meilleureSolution = new Map();
    let meilleurNombreAffecte = -1;

    function copierSolution(solution) {
        return new Map(
            Array.from(solution.entries()).map(function (entree) {
                return [
                    entree[0],
                    Object.assign({}, entree[1], {
                        locaux: entree[1].locaux.slice()
                    })
                ];
            })
        );
    }

    function enregistrerMeilleureSolution(solution) {
        const nombreAffecte = Array.from(solution.values()).filter(
            function (affectation) {
                return affectation.succes;
            }
        ).length;

        if (nombreAffecte > meilleurNombreAffecte) {
            meilleurNombreAffecte = nombreAffecte;
            meilleureSolution = copierSolution(solution);
        }
    }

    function rechercher(index, affectationsCourantes) {
        if (noeudsExplores >= LIMITE_RECHERCHE) {
            limiteAtteinte = true;
            enregistrerMeilleureSolution(affectationsCourantes);
            return;
        }

        noeudsExplores++;

        enregistrerMeilleureSolution(affectationsCourantes);

        // Toutes les filières ont été examinées.
        if (index >= donneesFilieres.length) {
            return;
        }

        // Une solution complète ne peut pas être améliorée.
        if (meilleurNombreAffecte === donneesFilieres.length) {
            return;
        }

        const donnee = donneesFilieres[index];
        const filiere = donnee.filiere;
        const code = filiere.filiereCode;

        if (!donnee.valide) {
            const branche = new Map(affectationsCourantes);

            branche.set(code, {
                filiereCode: code,
                effectif: donnee.effectif,
                succes: false,
                locaux: [],
                message: donnee.message
            });

            rechercher(index + 1, branche);
            return;
        }

        // Recalculer les possibilités selon les affectations de cette branche.
        const resultatRecherche = rechercherMeilleureCombinaisonLocaux(
            filiere,
            donnee.effectif,
            sallesAmphis,
            carteConflits,
            Array.from(affectationsCourantes.values()).filter(
                function (affectation) {
                    return affectation.succes;
                }
            ),
            affectationsPrecedentes
        );
console.log("Diagnostic recherche locaux :", {
    filiere: filiere.filiereCode,
    effectif: donnee.effectif,
     conflits: carteConflits,
     affectationsCourantes: Array.from(
        affectationsCourantes.values()
    ).filter(function (a) {
        return a.succes;
    }),
    affectationsPrecedentes: affectationsPrecedentes,
    resultatRecherche: resultatRecherche
});

        
        const combinaisons = Array.isArray(resultatRecherche.combinaisons)
            ? resultatRecherche.combinaisons
            : (
                resultatRecherche.succes
                    ? [{
                        locaux: resultatRecherche.locaux,
                        capaciteTotale: resultatRecherche.capaciteTotale,
                        tauxOccupation: resultatRecherche.tauxOccupation,
                        message: resultatRecherche.message
                    }]
                    : []
            );

        // Essayer chaque combinaison dans l'ordre de priorité.
        for (const combinaison of combinaisons) {
            if (limiteAtteinte) {
                break;
            }

            const branche = new Map(affectationsCourantes);

            branche.set(code, {
                filiereCode: code,
                effectif: donnee.effectif,
                succes: true,
                locaux: combinaison.locaux.slice(),
                capaciteTotale: combinaison.capaciteTotale,
                tauxOccupation: combinaison.tauxOccupation,
                message: combinaison.message ||
                    resultatRecherche.message ||
                    "Combinaison compatible trouvée."
            });

            rechercher(index + 1, branche);

            if (meilleurNombreAffecte === donneesFilieres.length) {
                return;
            }
        }

        // Explorer aussi le cas où cette filière reste non affectée.
        // Cela permet de rechercher une meilleure solution partielle.
        if (!limiteAtteinte) {
            const branche = new Map(affectationsCourantes);

            branche.set(code, {
                filiereCode: code,
                effectif: donnee.effectif,
                succes: false,
                locaux: [],
                message: resultatRecherche.message ||
                    "Aucune combinaison compatible trouvée."
            });

            rechercher(index + 1, branche);
        }
    }

    rechercher(0, new Map());

    const resultats = donneesFilieres.map(function (donnee) {
        const code = donnee.filiere.filiereCode;
        const resultat = meilleureSolution.get(code);

        if (resultat) {
            return resultat;
        }

        return {
            filiereCode: code,
            effectif: donnee.effectif,
            succes: false,
            locaux: [],
            message: limiteAtteinte
                ? "Affectation non résolue : limite de recherche atteinte."
                : donnee.message || "Affectation non résolue."
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
// INITIALISER LES FILTRES (inchangé)
// =================================================

(function initialiserFiltresAffectation() {
    const selectAnnee = document.getElementById("anneeAffectationSalles");
    const selectSemestre = document.getElementById("semestreAffectationSalles");
    const selectRegime = document.getElementById("regimeAffectationSalles");
    const selectSession = document.getElementById("sessionAffectationSalles");

    if (!selectAnnee || !selectSemestre || !selectRegime || !selectSession) {
        console.error("❌ Filtres d'affectation introuvables dans la page.");
        return;
    }

    let calendriersFiltresDisponibles = [];

    function valeurTexte(valeur) {
        return valeur == null ? "" : String(valeur).trim();
    }

    function ajouterOption(select, valeur, libelle) {
        const option = document.createElement("option");
        option.value = valeur;
        option.textContent = libelle;
        select.appendChild(option);
    }

    async function actualiserSessions() {
        const annee = selectAnnee.value;
        const semestre = selectSemestre.value;
        const regime = selectRegime.value;

        selectSession.replaceChildren();
        ajouterOption(selectSession, "", "Choisir une session");

        if (!annee || !semestre || !regime) {
            selectSession.disabled = true;
            selectSession.options[0].textContent =
                "Choisir d'abord l'année, le semestre et le régime";
            return;
        }

        try {
            const chargement = await window.generationExamens.chargerDonnees();
            if (!chargement) {
                throw new Error("Impossible de charger les données de génération.");
            }

            const donnees = window.generationExamens.obtenirDonnees();

            const sessionsDisponibles = donnees.sessions.filter(function (session) {
                return (
                    valeurTexte(session.semestreCode) === semestre &&
                    valeurTexte(session.regimeCode) === regime
                );
            });

            const sessions = new Map();
            sessionsDisponibles.forEach(function (session) {
                const code = valeurTexte(session.sessionCode);
                const libelle = valeurTexte(session.sessionLibelle);
                if (code && !sessions.has(code)) {
                    sessions.set(code, libelle || code);
                }
            });

            Array.from(sessions.entries())
                .sort(function (a, b) {
                    return a[0].localeCompare(b[0]);
                })
                .forEach(function ([code, libelle]) {
                    ajouterOption(selectSession, code, libelle);
                });

            selectSession.disabled = sessions.size === 0;
            if (sessions.size === 0) {
                selectSession.options[0].textContent =
                    "Aucune session disponible pour cette sélection";
            }
        } catch (erreur) {
            console.error("❌ Impossible de charger les sessions :", erreur);
            selectSession.replaceChildren();
            ajouterOption(selectSession, "", "Erreur de chargement des sessions");
            selectSession.disabled = true;
        }
    }

    async function chargerFiltres() {
        selectAnnee.disabled = true;
        selectSemestre.disabled = true;
        selectRegime.disabled = true;
        selectSession.disabled = true;

        try {
            const snapshot = await getDocs(collection(db, "calendriers"));
            calendriersFiltresDisponibles = snapshot.docs.map(function (d) {
                return d.data();
            });

            const annees = Array.from(
                new Set(
                    calendriersFiltresDisponibles
                        .map(function (c) {
                            return valeurTexte(c.anneeUniversitaire);
                        })
                        .filter(Boolean)
                )
            ).sort();

            selectAnnee.replaceChildren();
            ajouterOption(
                selectAnnee,
                "",
                annees.length ? "Choisir une année universitaire" : "Aucune année disponible"
            );

            annees.forEach(function (annee) {
                ajouterOption(selectAnnee, annee, annee);
            });

            selectSemestre.value = "";
            selectRegime.value = "";

            selectAnnee.disabled = annees.length === 0;
            selectSemestre.disabled = annees.length === 0;
            selectRegime.disabled = annees.length === 0;

            actualiserSessions();

            console.log("✓ Filtres d'affectation initialisés.", {
                calendriers: snapshot.size,
                annees: annees
            });
        } catch (erreur) {
            console.error("❌ Impossible de charger les filtres d'affectation :", erreur);
            selectAnnee.replaceChildren();
            ajouterOption(selectAnnee, "", "Erreur de chargement");
            selectAnnee.disabled = true;
            selectSemestre.disabled = true;
            selectRegime.disabled = true;
            selectSession.disabled = true;
        }
    }

    selectAnnee.addEventListener("change", actualiserSessions);
    selectSemestre.addEventListener("change", actualiserSessions);
    selectRegime.addEventListener("change", actualiserSessions);

    chargerFiltres();
})();

/* =================================================
   GÉNÉRER LES AFFECTATIONS DE TOUS LES CALENDRIERS
   (intègre maintenant les affectations précédentes)
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
            const calendriersTries = classerCalendriersPourAffectation(calendriersSelectionnes);

            // Accumuler les affectations réussies des calendriers précédents
            const affectationsPrecedentesGlobales = [];

               
for (const documentCalendrier of calendriersTries) {
    const donneesCalendrier = documentCalendrier.data();
    const planning = donneesCalendrier.planning;

    console.log(
        "Diagnostic cellules du calendrier :",
        documentCalendrier.id,
        planning?.filieres?.[0]?.cellules?.[0]
    );

    if (!planning || !Array.isArray(planning.filieres)) {
        calendriersEnErreur++;
        erreurs.push(
            documentCalendrier.id +
            " : structure du planning invalide."
        );
        continue;
    }

    calendriersTraites++;

    // Appel avec les affectations déjà préparées des calendriers précédents
    const resultat = window.affecterLocauxFixes(
        planning,
        sallesAmphis,
        effectifs,
        affectationsPrecedentesGlobales
    );

    if (!resultat || !Array.isArray(resultat.affectations)) {
        calendriersEnErreur++;

        erreurs.push(
            documentCalendrier.id +
            " : résultat d'affectation invalide."
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
                " : affectation impossible ou manquante."
            );

            return {
                ...filiere,
                amphis: []
            };
        }

        return {
            ...filiere,
            amphis: affectation.locaux
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
    } else {
        calendriersEnregistres++;
    }

    const planningMisAJour = {
        ...planning,
        filieres: filieresMisesAJour
    };

    // Conserver le résultat pour la validation globale.
    // Cela ne signifie pas qu'il sera automatiquement enregistré.
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
                filiere: filiereComplete,
                locaux: aff.locaux
            });
        }
    }
}

            // =================================================
            // VALIDATION GLOBALE (sécurité supplémentaire)
            // =================================================
            const anomaliesGlobales = [];

            if (calendriersEnErreur > 0) {
                anomaliesGlobales.push(
                    "Au moins un calendrier comporte une erreur d'affectation."
                );
            }



            console.log(
    "Diagnostic avant validation globale :",
    calendriersAEnregistrer.map(function (element) {
        return {
            calendrierId: element.id,
            filieres: element.planning.filieres.map(function (filiere) {
                return {
                    filiereCode: filiere.filiereCode,
                    amphis: filiere.amphis
                };
            })
        };
    })
);
            const affectationsGlobales = [];

            for (const element of calendriersAEnregistrer) {
                const documentSource = calendriersTries.find(function (d) {
                    return d.id === element.id;
                });
                const donneesSource = documentSource ? documentSource.data() : null;

                if (!donneesSource) {
                    anomaliesGlobales.push(element.id + " : calendrier source introuvable.");
                    continue;
                }

                const planning = element.planning;

                if (!Array.isArray(planning.filieres)) {
                    anomaliesGlobales.push(element.id + " : liste des filières invalide.");
                    continue;
                }

                for (const filiere of planning.filieres) {
                    const codeFiliere = filiere.filiereCode;
                    const locaux = Array.isArray(filiere.amphis) ? filiere.amphis : [];

                    if (locaux.length === 0) {
                        anomaliesGlobales.push(
                            element.id + " / " + codeFiliere + " : aucun local affecté."
                        );
                        continue;
                    }

                    let capaciteTotale = 0;
                    let locauxValides = true;

                    for (const codeLocal of locaux) {
                        const salle = sallesAmphis.find(function (s) {
                            return s.code === codeLocal;
                        });

                        if (!salle) {
                            anomaliesGlobales.push(
                                element.id + " / " + codeFiliere +
                                " : local inconnu " + codeLocal + "."
                            );
                            locauxValides = false;
                            continue;
                        }

                        if (
                            salle.disponible !== "Oui" ||
                            !Number.isFinite(Number(salle.capacite)) ||
                            Number(salle.capacite) <= 0
                        ) {
                            anomaliesGlobales.push(
                                element.id + " / " + codeFiliere +
                                " : local indisponible ou capacité invalide : " + codeLocal + "."
                            );
                            locauxValides = false;
                            continue;
                        }

                        capaciteTotale += Number(salle.capacite);
                    }

                    const anneeCalendrier = donneesSource.anneeUniversitaire || annee;

                    const lignesEffectif = effectifs.filter(function (ligne) {
                        return (
                            ligne.niveauCode === planning.niveauCode &&
                            ligne.filiereCode === codeFiliere &&
                            ligne.anneeUniversitaire === anneeCalendrier
                        );
                    });

                    if (lignesEffectif.length !== 1) {
                        anomaliesGlobales.push(
                            element.id + " / " + codeFiliere +
                            " : effectif absent ou ambigu pour l'année " + anneeCalendrier + "."
                        );
                        continue;
                    }

                    const effectif = Number(lignesEffectif[0].effectif);

                    if (!Number.isFinite(effectif) || effectif <= 0) {
                        anomaliesGlobales.push(
                            element.id + " / " + codeFiliere + " : effectif invalide."
                        );
                        continue;
                    }

                    if (locauxValides && capaciteTotale < effectif) {
                        anomaliesGlobales.push(
                            element.id + " / " + codeFiliere +
                            " : capacité insuffisante (" + capaciteTotale +
                            " places pour " + effectif + " étudiants)."
                        );
                    }

                    affectationsGlobales.push({
                        calendrierId: element.id,
                        planning: planning,
                        filiere: filiere,
                        locaux: locaux,
                        niveauCode: planning.niveauCode
                    });
                }

                // Conflits intra-calendrier (double vérification)
                const conflits = construireConflitsFilieres(planning);
                for (const conflit of conflits) {
                    const filiereA = planning.filieres.find(function (f) {
                        return f.filiereCode === conflit.filiereA;
                    });
                    const filiereB = planning.filieres.find(function (f) {
                        return f.filiereCode === conflit.filiereB;
                    });

                    if (!filiereA || !filiereB) continue;

                    const locauxA = filiereA.amphis || [];
                    const locauxB = filiereB.amphis || [];

                    for (const codeLocal of locauxA) {
                        if (locauxB.includes(codeLocal)) {
                            anomaliesGlobales.push(
                                element.id + " : conflit entre " +
                                conflit.filiereA + " et " + conflit.filiereB +
                                " sur le local " + codeLocal + "."
                            );
                        }
                    }
                }
            }

            // Conflits inter-calendriers (dates + créneaux)
            for (let i = 0; i < affectationsGlobales.length; i++) {
                for (let j = i + 1; j < affectationsGlobales.length; j++) {
                    const a = affectationsGlobales[i];
                    const b = affectationsGlobales[j];

                    if (a.calendrierId === b.calendrierId) continue;

                    const locauxCommuns = a.locaux.filter(function (code) {
                        return b.locaux.includes(code);
                    });

                    if (locauxCommuns.length === 0) continue;

                    const cellulesA = (a.filiere.cellules || []).filter(function (c) {
                        return c.estOccupee;
                    });
                    const cellulesB = (b.filiere.cellules || []).filter(function (c) {
                        return c.estOccupee;
                    });

                    for (const celluleA of cellulesA) {
                        for (const celluleB of cellulesB) {
                            if (memeCreneau(celluleA, celluleB)) {
                                for (const codeLocal of locauxCommuns) {
                                    anomaliesGlobales.push(
                                        "Conflit inter-calendriers : " +
                                        a.calendrierId + " / " + a.filiere.filiereCode +
                                        " et " + b.calendrierId + " / " + b.filiere.filiereCode +
                                        " utilisent " + codeLocal +
                                        " à la même date et au même créneau."
                                    );
                                }
                            }
                        }
                    }
                }
            }

            console.table(anomaliesGlobales.map(function (m) {
                return { anomalie: m };
            }));

            if (anomaliesGlobales.length > 0) {
                const message =
                    "Enregistrement annulé : " +
                    anomaliesGlobales.length +
                    " anomalie(s) détectée(s).";

                if (statut) statut.textContent = message;
                if (resume) {
                    resume.textContent = message + "\n" + anomaliesGlobales.join("\n");
                }
                console.error(message, anomaliesGlobales);
                return;
            }

            // Aucune anomalie → enregistrement
            if (statut) {
                statut.textContent = "Contrôles réussis. Enregistrement en cours...";
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

            
            if (statut) statut.textContent = bilan;
            if (resume) {
                resume.textContent = erreurs.length > 0
                    ? bilan + "\n" + erreurs.join("\n")
                    : bilan;
            }

            console.log("Bilan des affectations :", {
                total: calendriersSelectionnes.length,
               totalFirestore: snapshot.size,

                traites: calendriersTraites,
                enregistres: calendriersEnregistres,
                erreurs: erreurs
            });
            console.table(erreurs);

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
   CONTRÔLER LES AFFECTATIONS EXISTANTES (inchangé)
===================================================== */

(function installerControleAffectations() {
    const bouton = document.getElementById("btnControlerAffectations");
    if (!bouton || bouton.dataset.controleInstalle === "oui") return;

    bouton.dataset.controleInstalle = "oui";

    bouton.addEventListener("click", async function () {
        const statut = document.getElementById("statutAffectationSalles");
        const resume = document.getElementById("resumeAffectationSalles");
        const texte = valeur => valeur == null ? "" : String(valeur).trim();

        const filtres = {
            annee: texte(document.getElementById("anneeAffectationSalles")?.value),
            semestre: texte(document.getElementById("semestreAffectationSalles")?.value),
            regime: texte(document.getElementById("regimeAffectationSalles")?.value),
            session: texte(document.getElementById("sessionAffectationSalles")?.value)
        };

        if (Object.values(filtres).some(valeur => !valeur)) {
            if (statut) {
                statut.textContent =
                    "Veuillez sélectionner l'année, le semestre, le régime et la session.";
            }
            if (resume) resume.textContent = "";
            return;
        }

        bouton.disabled = true;

        if (statut) statut.textContent = "Contrôle des affectations en cours...";
        if (resume) resume.textContent = "";

        const anomalies = [];
        const clesAnomalies = new Set();
        const calendriersAComparer = [];

        let nbCalendriers = 0;
        let nbCalendriersExploitables = 0;
        let nbFilieres = 0;
        let nbLocauxVerifies = 0;

        function ajouterAnomalie(calendrierId, filiereCode, probleme) {
            const anomalie = {
                calendrier: calendrierId || "Non déterminé",
                filiere: filiereCode || "Non déterminée",
                probleme: probleme
            };

            const cle = [
                anomalie.calendrier,
                anomalie.filiere,
                anomalie.probleme
            ].join("\u0000");

            if (!clesAnomalies.has(cle)) {
                clesAnomalies.add(cle);
                anomalies.push(anomalie);
            }
        }

        function obtenirCodesLocaux(amphis) {
            if (!Array.isArray(amphis)) return [];

            return amphis.map(local => {
                if (typeof local === "string") return local.trim();

                if (local && typeof local === "object") {
                    return texte(local.code || local.localCode);
                }

                return "";
            }).filter(Boolean);
        }

        // Normaliser une date en jour civil pour comparer les créneaux.
        function dateJour(date) {
            if (date == null || date === "") return null;

            // Une chaîne AAAA-MM-JJ représente directement un jour civil.
            if (typeof date === "string") {
                const correspondance = date.trim().match(
                    /^(\d{4})-(\d{2})-(\d{2})$/
                );

                if (correspondance) {
                    const annee = Number(correspondance[1]);
                    const mois = Number(correspondance[2]);
                    const jour = Number(correspondance[3]);

                    const verification = new Date(
                        Date.UTC(annee, mois - 1, jour)
                    );

                    if (
                        verification.getUTCFullYear() !== annee ||
                        verification.getUTCMonth() !== mois - 1 ||
                        verification.getUTCDate() !== jour
                    ) {
                        return null;
                    }

                    return correspondance[0];
                }
            }

            if (typeof date.toDate === "function") {
                date = date.toDate();
            } else if (
                typeof date.seconds === "number" &&
                Number.isFinite(date.seconds)
            ) {
                date = new Date(date.seconds * 1000);
            } else if (!(date instanceof Date)) {
                date = new Date(date);
            }

            if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
                return null;
            }

            const annee = date.getFullYear();
            const mois = String(date.getMonth() + 1).padStart(2, "0");
            const jour = String(date.getDate()).padStart(2, "0");

            return annee + "-" + mois + "-" + jour;
        }

        function numeroCreneau(valeur) {
            if (
                valeur == null ||
                valeur === "" ||
                (typeof valeur === "string" && valeur.trim() === "")
            ) {
                return null;
            }

            const nombre = Number(valeur);
            return Number.isFinite(nombre) ? nombre : null;
        }

        function memeCreneau(celluleA, celluleB) {
            if (!celluleA || !celluleB) return false;

            const jourA = dateJour(celluleA.date);
            const jourB = dateJour(celluleB.date);
            const ordreA = numeroCreneau(celluleA.creneauOrdre);
            const ordreB = numeroCreneau(celluleB.creneauOrdre);

            return (
                jourA !== null &&
                jourB !== null &&
                jourA === jourB &&
                ordreA !== null &&
                ordreB !== null &&
                ordreA === ordreB
            );
        }

        function cellulesOccupees(filiere) {
            return Array.isArray(filiere?.cellules)
                ? filiere.cellules.filter(
                    cellule => cellule?.estOccupee === true
                )
                : null;
        }

        function calendrierIdPair(idA, idB) {
            return idA + " / " + idB;
        }

        // Contrôle des conflits dans un calendrier ou entre deux calendriers.
        function controlerConflits(listeCalendriers, interCalendriers) {
            for (let i = 0; i < listeCalendriers.length; i++) {
                const debutJ = interCalendriers ? i + 1 : i;

                for (let j = debutJ; j < listeCalendriers.length; j++) {
                    const calendrierA = listeCalendriers[i];
                    const calendrierB = listeCalendriers[j];

                    if (
                        interCalendriers &&
                        calendrierA.calendrierId === calendrierB.calendrierId
                    ) {
                        continue;
                    }

                    for (let a = 0; a < calendrierA.filieres.length; a++) {
                        const departB = interCalendriers || i !== j ? 0 : a + 1;
                        const filiereA = calendrierA.filieres[a];

                        if (!filiereA || typeof filiereA !== "object") continue;

                        const locauxA = new Set(
                            obtenirCodesLocaux(filiereA.amphis)
                        );

                        const cellulesA = cellulesOccupees(filiereA) || [];

                        for (
                            let b = departB;
                            b < calendrierB.filieres.length;
                            b++
                        ) {
                            const filiereB = calendrierB.filieres[b];

                            if (!filiereB || typeof filiereB !== "object") {
                                continue;
                            }

                            const locauxPartages = obtenirCodesLocaux(
                                filiereB.amphis
                            ).filter(code => locauxA.has(code));

                            if (locauxPartages.length === 0) continue;

                            const cellulesB = cellulesOccupees(filiereB) || [];

                            const simultanes = cellulesA.some(celluleA =>
                                cellulesB.some(celluleB =>
                                    memeCreneau(celluleA, celluleB)
                                )
                            );

                            if (!simultanes) continue;

                            const id = interCalendriers
                                ? calendrierIdPair(
                                    calendrierA.calendrierId,
                                    calendrierB.calendrierId
                                )
                                : calendrierA.calendrierId;

                            locauxPartages.forEach(codeLocal => {
                                ajouterAnomalie(
                                    id,
                                    texte(filiereA.filiereCode) + " / " +
                                    texte(filiereB.filiereCode),
                                    (interCalendriers
                                        ? "Conflit inter-calendriers"
                                        : "Conflit intra-calendrier") +
                                    " : le local " + codeLocal +
                                    " est attribué à deux examens simultanés."
                                );
                            });
                        }
                    }
                }
            }
        }

        try {
            if (
                !window.generationExamens ||
                typeof window.generationExamens.obtenirDonnees !== "function"
            ) {
                throw new Error(
                    "Le moteur de génération des examens n'est pas disponible."
                );
            }

            // Conserver le mécanisme de chargement existant s'il est disponible.
            if (
                typeof window.generationExamens.chargerDonnees === "function"
            ) {
                await window.generationExamens.chargerDonnees();
            }

            const donnees = await window.generationExamens.obtenirDonnees();

            const salles = Array.isArray(donnees?.sallesAmphis)
                ? donnees.sallesAmphis
                : [];

            const effectifs = Array.isArray(donnees?.effectifs)
                ? donnees.effectifs
                : [];

            if (salles.length === 0) {
                ajouterAnomalie(
                    "Données de référence",
                    "Salles/amphis",
                    "Liste des locaux absente ou vide."
                );
            }

            if (effectifs.length === 0) {
                ajouterAnomalie(
                    "Données de référence",
                    "Effectifs",
                    "Liste des effectifs absente ou vide."
                );
            }

            // Les quatre filtres sont obligatoires.
            // Aucun filtre sur le niveau : tous les niveaux correspondants sont inclus.
            const snapshot = await getDocs(collection(db, "calendriers"));

            const selection = snapshot.docs.filter(documentCalendrier => {
                const calendrier = documentCalendrier.data();

                return (
                    texte(calendrier.anneeUniversitaire) === filtres.annee &&
                    texte(calendrier.semestreCode) === filtres.semestre &&
                    texte(calendrier.regimeCode) === filtres.regime &&
                    texte(calendrier.sessionCode) === filtres.session
                );
            });

            nbCalendriers = selection.length;

            if (nbCalendriers === 0) {
                if (statut) {
                    statut.textContent =
                        "Aucun calendrier trouvé pour les quatre filtres sélectionnés.";
                }

                if (resume) {
                    resume.textContent =
                        "Filtres : " + filtres.annee + " / " +
                        filtres.semestre + " / " + filtres.regime + " / " +
                        filtres.session +
                        " | Calendriers : 0 | Contrôle non concluant.";
                }

                return;
            }

            selection.forEach(documentCalendrier => {
                const calendrierId = documentCalendrier.id;
                const calendrier = documentCalendrier.data();
                const planning = calendrier.planning;

                if (!planning || !Array.isArray(planning.filieres)) {
                    ajouterAnomalie(
                        calendrierId,
                        "Planning",
                        "Planning absent ou liste des filières invalide."
                    );
                    return;
                }

                if (planning.filieres.length === 0) {
                    ajouterAnomalie(
                        calendrierId,
                        "Planning",
                        "Aucune filière dans le planning."
                    );
                    return;
                }

                nbCalendriersExploitables++;

                const niveau = texte(
                    planning.niveauCode || calendrier.niveauCode
                );

                if (!niveau) {
                    ajouterAnomalie(
                        calendrierId,
                        "Niveau",
                        "Niveau absent : impossible de rapprocher les effectifs."
                    );
                }

                calendriersAComparer.push({
                    calendrierId: calendrierId,
                    filieres: planning.filieres
                });

                planning.filieres.forEach(filiere => {
                    nbFilieres++;

                    if (!filiere || typeof filiere !== "object") {
                        ajouterAnomalie(
                            calendrierId,
                            "Filière",
                            "Données de filière absentes ou invalides."
                        );
                        return;
                    }

                    const filiereCode = texte(filiere.filiereCode);

                    if (!filiereCode) {
                        ajouterAnomalie(
                            calendrierId,
                            "Filière",
                            "Code de filière absent."
                        );
                    }

                    // Vérification des examens et de leurs créneaux.
                    const cellules = cellulesOccupees(filiere);

                    if (cellules === null) {
                        ajouterAnomalie(
                            calendrierId,
                            filiereCode,
                            "Liste des examens/cellules absente ou invalide."
                        );
                    } else if (cellules.length === 0) {
                        ajouterAnomalie(
                            calendrierId,
                            filiereCode,
                            "Aucun examen planifié : contrôle des affectations incomplet."
                        );
                    } else {
                        cellules.forEach(cellule => {
                            if (
                                dateJour(cellule.date) === null ||
                                numeroCreneau(cellule.creneauOrdre) === null
                            ) {
                                ajouterAnomalie(
                                    calendrierId,
                                    filiereCode,
                                    "Examen occupé sans date ou créneau valide : conflit impossible à exclure."
                                );
                            }
                        });
                    }

                    // Vérification des locaux affectés.
                    const codesLocaux = obtenirCodesLocaux(filiere.amphis);

                    if (codesLocaux.length === 0) {
                        ajouterAnomalie(
                            calendrierId,
                            filiereCode,
                            "Aucun local affecté."
                        );
                    }

                    if (new Set(codesLocaux).size !== codesLocaux.length) {
                        ajouterAnomalie(
                            calendrierId,
                            filiereCode,
                            "Un même local est affecté plusieurs fois à cette filière."
                        );
                    }

                    const locauxValides = [];

                    codesLocaux.forEach(codeLocal => {
                        const local = salles.find(
                            salle => texte(salle?.code) === codeLocal
                        );

                        if (!local) {
                            ajouterAnomalie(
                                calendrierId,
                                filiereCode,
                                "Local inconnu : " + codeLocal + "."
                            );
                            return;
                        }

                        const disponible =
                            local.disponible === true ||
                            texte(local.disponible).toLowerCase() === "oui";

                        if (!disponible) {
                            ajouterAnomalie(
                                calendrierId,
                                filiereCode,
                                "Local indisponible : " + codeLocal + "."
                            );
                            return;
                        }

                        const capacite = Number(local.capacite);

                        if (!Number.isFinite(capacite) || capacite <= 0) {
                            ajouterAnomalie(
                                calendrierId,
                                filiereCode,
                                "Capacité absente ou invalide pour le local : " +
                                codeLocal + "."
                            );
                            return;
                        }

                        nbLocauxVerifies++;
                        locauxValides.push(local);
                    });

                    // Vérification de l'effectif réel de la filière.
                    const anneeCalendrier = texte(
                        calendrier.anneeUniversitaire ||
                        planning.anneeUniversitaire ||
                        filtres.annee
                    );

                    const correspondances = effectifs.filter(ligne =>
                        texte(ligne?.niveauCode) === niveau &&
                        texte(ligne?.filiereCode) === filiereCode &&
                        texte(ligne?.anneeUniversitaire) === anneeCalendrier
                    );

                    if (!niveau || !filiereCode || !anneeCalendrier) {
                        ajouterAnomalie(
                            calendrierId,
                            filiereCode,
                            "Niveau, filière ou année manquant : effectif non vérifiable."
                        );
                    } else if (correspondances.length !== 1) {
                        ajouterAnomalie(
                            calendrierId,
                            filiereCode,
                            correspondances.length === 0
                                ? "Effectif introuvable pour cette année, ce niveau et cette filière."
                                : "Effectif ambigu : plusieurs lignes correspondent à cette année, ce niveau et cette filière."
                        );
                    } else {
                        const valeurEffectif = correspondances[0].effectif;
                        const effectif =
                            valeurEffectif == null || valeurEffectif === ""
                                ? NaN
                                : Number(valeurEffectif);

                        if (
                            !Number.isFinite(effectif) ||
                            effectif < 0
                        ) {
                            ajouterAnomalie(
                                calendrierId,
                                filiereCode,
                                "Effectif absent ou invalide."
                            );
                        } else if (
                            codesLocaux.length > 0 &&
                            locauxValides.length === codesLocaux.length &&
                            new Set(codesLocaux).size === codesLocaux.length
                        ) {
                            const capaciteTotale = locauxValides.reduce(
                                (total, local) =>
                                    total + Number(local.capacite),
                                0
                            );

                            if (capaciteTotale < effectif) {
                                ajouterAnomalie(
                                    calendrierId,
                                    filiereCode,
                                    "Capacité insuffisante : " +
                                    capaciteTotale + " places pour " +
                                    effectif + " étudiants."
                                );
                            }
                        }
                    }
                });

                // Détecter les filières attendues mais entièrement absentes.
                // Cette vérification suppose que les effectifs répertorient
                // toutes les filières attendues pour l'année et le niveau.
                if (niveau) {
                    const anneeCalendrier = texte(
                        calendrier.anneeUniversitaire ||
                        planning.anneeUniversitaire ||
                        filtres.annee
                    );

                    const filieresAttendues = effectifs.filter(ligne =>
                        texte(ligne?.niveauCode) === niveau &&
                        texte(ligne?.anneeUniversitaire) === anneeCalendrier &&
                        texte(ligne?.filiereCode) !== ""
                    );

                    const codesPresents = new Set(
                        planning.filieres
                            .filter(filiere =>
                                filiere && typeof filiere === "object"
                            )
                            .map(filiere => texte(filiere.filiereCode))
                            .filter(Boolean)
                    );

                    const codesAttendus = new Set(
                        filieresAttendues.map(ligne =>
                            texte(ligne.filiereCode)
                        )
                    );

                    codesAttendus.forEach(code => {
                        if (!codesPresents.has(code)) {
                            ajouterAnomalie(
                                calendrierId,
                                code,
                                "Filière attendue dans les effectifs mais absente du planning."
                            );
                        }
                    });
                }
            });

            // Conflits entre filières d'un même calendrier.
            controlerConflits(calendriersAComparer, false);

            // Conflits entre tous les calendriers correspondant aux filtres.
            controlerConflits(calendriersAComparer, true);

            console.table(anomalies);

            const niveaux = new Set();

            selection.forEach(documentCalendrier => {
                const calendrier = documentCalendrier.data();
                const niveau = texte(
                    calendrier.planning?.niveauCode ||
                    calendrier.niveauCode
                );

                if (niveau) niveaux.add(niveau);
            });

            if (statut) {
                statut.textContent = anomalies.length === 0
                    ? "Contrôle terminé : aucune anomalie détectée."
                    : "Contrôle terminé avec " + anomalies.length +
                      " anomalie(s). Les données manquantes ou non vérifiables sont signalées.";
            }

            if (resume) {
                resume.textContent =
                    "Calendriers correspondant aux 4 filtres : " +
                    nbCalendriers +
                    " (plannings exploitables : " +
                    nbCalendriersExploitables + ")" +
                    " | Niveaux inclus : " +
                    (Array.from(niveaux).sort().join(", ") || "non renseigné") +
                    " | Filières examinées : " + nbFilieres +
                    " | Locaux vérifiés : " + nbLocauxVerifies +
                    " | Anomalies : " + anomalies.length;

                if (anomalies.length > 0) {
                    resume.textContent += " | Détails : console F12.";
                }
            }
        } catch (erreur) {
            console.error(
                "Erreur lors du contrôle des affectations :",
                erreur
            );

            if (statut) {
                statut.textContent =
                    "Échec du contrôle : " + erreur.message;
            }

            if (resume) {
                resume.textContent =
                    "Le contrôle n'a pas pu aboutir ; aucun résultat positif n'est annoncé.";
            }
        } finally {
            bouton.disabled = false;
        }
    });
})();

/* =================================================
   DIAGNOSTICS (inchangés)
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

        console.log("Tous les calendriers S2 / MX / 2025-2026 :");
        console.table(
            snapshot.docs
                .map(function (d) {
                    const c = d.data();
                    return {
                        id: d.id,
                        annee: c.anneeUniversitaire,
                        semestre: c.semestreCode,
                        regime: c.regimeCode,
                        session: c.sessionCode
                    };
                })
                .filter(function (c) {
                    return (
                        c.annee === "2025-2026" &&
                        c.semestre === "S2" &&
                        c.regime === "MX"
                    );
                })
        );

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
