
// =====================================================
// GENERATION.JS
// Planification des examens - FSGF
// =====================================================
// Rôle actuel :
// 1. Lire les données depuis Firestore
// 2. Vérifier les données nécessaires
// 3. Regrouper les matières par niveau
// 4. Regrouper ensuite par filière
// 5. Identifier les matières communes
// 6. Construire la grille Dates × Créneaux
//
// IMPORTANT :
// Cette version ne génère pas encore les examens.
// Les règles de planification seront ajoutées
// progressivement dans les prochaines étapes.
//
// RÈGLES MÉTIER À CONSERVER :
// - 1 niveau = 1 calendrier
// - matière commune = présente dans au moins 2 filières
// - éviter deux matières successives d'une même filière
//   le même jour
// - équilibrer les matières entre les créneaux
// - écart maximum entre créneau le plus chargé
//   et créneau le moins chargé : 2
// =====================================================


import { app } from "../firebase-config.js";

import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";


// =====================================================
// FIRESTORE
// =====================================================

const db = getFirestore(app);


// =====================================================
// DONNÉES DU MOTEUR DE GÉNÉRATION
// =====================================================

let donneesGeneration = {

    matieres: [],

    sessions: [],

    creneaux: [],

    sallesAmphis: []

};


// =====================================================
// ÉTAT DU MOTEUR
// =====================================================

let generationChargee = false;


// =====================================================
// CHARGER UNE COLLECTION FIRESTORE
// =====================================================

async function chargerCollection(nomCollection) {

    const snapshot = await getDocs(
        collection(db, nomCollection)
    );

    const donnees = [];


    snapshot.forEach(function (document) {

        donnees.push({

            id: document.id,

            ...document.data()

        });

    });


    return donnees;
}


// =====================================================
// CHARGER TOUTES LES DONNÉES
// =====================================================

async function chargerDonneesGeneration() {

    console.log("==========================================");

    console.log(
        "GÉNÉRATION - CHARGEMENT DES DONNÉES"
    );

    console.log("==========================================");


    try {

        console.log(
            "→ Chargement des matières..."
        );


        donneesGeneration.matieres =
            await chargerCollection("matieres");


        console.log(
            "✓ Matières :",
            donneesGeneration.matieres.length
        );


        console.log(
            "→ Chargement des sessions..."
        );


        donneesGeneration.sessions =
            await chargerCollection("sessions");


        console.log(
            "✓ Sessions :",
            donneesGeneration.sessions.length
        );


        console.log(
            "→ Chargement des créneaux..."
        );


        donneesGeneration.creneaux =
            await chargerCollection("creneaux");


        console.log(
            "✓ Créneaux :",
            donneesGeneration.creneaux.length
        );


        console.log(
            "→ Chargement des salles / amphis..."
        );


        donneesGeneration.sallesAmphis =
            await chargerCollection(
                "salles_amphis"
            );


        console.log(
            "✓ Salles / amphis :",
            donneesGeneration.sallesAmphis.length
        );


        generationChargee = true;


        console.log(
            "------------------------------------------"
        );

        console.log(
            "✓ DONNÉES DE GÉNÉRATION CHARGÉES"
        );

        console.log(
            "------------------------------------------"
        );


        return true;


    } catch (erreur) {

        console.error(
            "❌ Erreur lors du chargement des données :",
            erreur
        );


        generationChargee = false;


        return false;

    }

}


// =====================================================
// VÉRIFIER LES DONNÉES
// =====================================================

function verifierDonneesGeneration() {

    console.log(
        "=========================================="
    );

    console.log(
        "VÉRIFICATION DES DONNÉES"
    );

    console.log(
        "=========================================="
    );


    if (
        donneesGeneration.matieres.length === 0
    ) {

        console.error(
            "❌ Aucune matière disponible."
        );

        return false;

    }


    if (
        donneesGeneration.sessions.length === 0
    ) {

        console.error(
            "❌ Aucune session disponible."
        );

        return false;

    }


    if (
        donneesGeneration.creneaux.length === 0
    ) {

        console.error(
            "❌ Aucun créneau disponible."
        );

        return false;

    }


    if (
        donneesGeneration.sallesAmphis.length === 0
    ) {

        console.error(
            "❌ Aucune salle / amphi disponible."
        );

        return false;

    }


    console.log(
        "✓ Matières disponibles"
    );

    console.log(
        "✓ Sessions disponibles"
    );

    console.log(
        "✓ Créneaux disponibles"
    );

    console.log(
        "✓ Salles / amphis disponibles"
    );


    console.log(
        "------------------------------------------"
    );

    console.log(
        "✓ VÉRIFICATION TERMINÉE"
    );

    console.log(
        "------------------------------------------"
    );


    return true;

}


// =====================================================
// OBTENIR LES NIVEAUX
// =====================================================

function obtenirNiveaux() {

    const niveaux = [];


    donneesGeneration.matieres.forEach(
        function (matiere) {

            const niveau =
                matiere.niveauCode;


            if (!niveau) {

                return;

            }


            if (!niveaux.includes(niveau)) {

                niveaux.push(niveau);

            }

        }
    );


    niveaux.sort();


    return niveaux;

}


// =====================================================
// OBTENIR LES FILIÈRES D'UN NIVEAU
// =====================================================

function obtenirFilieresDuNiveau(
    niveauCode
) {

    const filieres = [];


    donneesGeneration.matieres.forEach(
        function (matiere) {

            if (
                matiere.niveauCode !==
                niveauCode
            ) {

                return;

            }


            const filiere =
                matiere.filiereCode;


            if (!filiere) {

                return;

            }


            if (!filieres.includes(filiere)) {

                filieres.push(filiere);

            }

        }
    );


    filieres.sort();


    return filieres;

}


// =====================================================
// OBTENIR LES MATIÈRES D'UNE FILIÈRE
// =====================================================

function obtenirMatieresDeFiliere(
    niveauCode,
    filiereCode
) {

    return donneesGeneration.matieres.filter(
        function (matiere) {

            return (

                matiere.niveauCode ===
                niveauCode

                &&

                matiere.filiereCode ===
                filiereCode

            );

        }
    );

}


// =====================================================
// IDENTIFIER LES MATIÈRES COMMUNES
// =====================================================
// RÈGLE :
// Une matière est commune si elle existe
// dans au moins deux filières du même niveau.
// =====================================================

function identifierMatieresCommunes(
    niveauCode
) {

    console.log(
        "------------------------------------------"
    );

    console.log(
        "IDENTIFICATION DES MATIÈRES COMMUNES"
    );

    console.log(
        "Niveau :",
        niveauCode
    );

    console.log(
        "------------------------------------------"
    );


    const compteurMatieres =
        new Map();


    // =================================================
    // PARCOURIR LES MATIÈRES DU NIVEAU
    // =================================================

    donneesGeneration.matieres.forEach(
        function (matiere) {

            if (
                matiere.niveauCode !==
                niveauCode
            ) {

                return;

            }


            const matiereLibelle =
                matiere.matiereLibelle;


            const filiereCode =
                matiere.filiereCode;


            if (
                !matiereLibelle ||
                !filiereCode
            ) {

                return;

            }


            // =========================================
            // CRÉER L'ENTRÉE DE LA MATIÈRE
            // =========================================

            if (
                !compteurMatieres.has(
                    matiereLibelle
                )
            ) {

                compteurMatieres.set(

                    matiereLibelle,

                    new Set()

                );

            }


            // =========================================
            // AJOUTER LA FILIÈRE
            // =========================================

            compteurMatieres
                .get(matiereLibelle)
                .add(filiereCode);

        }
    );


    // =================================================
    // CONSERVER LES MATIÈRES PRÉSENTES
    // DANS AU MOINS DEUX FILIÈRES
    // =================================================

    const matieresCommunes = [];


    compteurMatieres.forEach(
        function (
            filieres,
            matiereLibelle
        ) {

            if (
                filieres.size >= 2
            ) {

                matieresCommunes.push({

                    matiereLibelle:
                        matiereLibelle,

                    filieres:
                        Array.from(
                            filieres
                        ),

                    nombreFilieres:
                        filieres.size

                });

            }

        }
    );


    // =================================================
    // TRI ALPHABÉTIQUE
    // =================================================

    matieresCommunes.sort(
        function (a, b) {

            return a.matiereLibelle.localeCompare(
                b.matiereLibelle
            );

        }
    );


    // =================================================
    // AFFICHAGE CONSOLE
    // =================================================

    console.log(
        "Matières communes détectées :",
        matieresCommunes.length
    );


    matieresCommunes.forEach(
        function (matiere) {

            console.log(

                "✓",

                matiere.matiereLibelle,

                "→",

                matiere.nombreFilieres,

                "filières :",

                matiere.filieres

            );

        }
    );


    console.log(
        "------------------------------------------"
    );


    return matieresCommunes;

}
// =====================================================
// PRÉPARATION DES MATIÈRES À PLANIFIER
// =====================================================
// Pour un niveau donné :
// - les matières communes sont placées en premier
// - puis les matières spécifiques à chaque filière
//
// Règle métier :
// Une matière est commune lorsqu'elle existe
// dans au moins deux filières du même niveau.
// =====================================================

function preparerMatieresPourPlanification(niveauCode) {

    const matieresNiveau = donneesGeneration.matieres.filter(function (matiere) {
        return matiere.niveauCode === niveauCode;
    });

    if (matieresNiveau.length === 0) {
        console.warn(
            "⚠️ Aucune matière trouvée pour le niveau :",
            niveauCode
        );
        return {
            niveauCode: niveauCode,
            matieresCommunes: [],
            matieresSpecifiques: []
        };
    }

    // -------------------------------------------------
    // Regrouper les matières par libellé
    // -------------------------------------------------

    const groupesMatieres = {};

    matieresNiveau.forEach(function (matiere) {

        const libelle = String(
            matiere.matiereLibelle || ""
        ).trim();

        if (!libelle) {
            return;
        }

        if (!groupesMatieres[libelle]) {
            groupesMatieres[libelle] = [];
        }

        groupesMatieres[libelle].push(matiere);
    });

    // -------------------------------------------------
    // Identifier communes / spécifiques
    // -------------------------------------------------

    const matieresCommunes = [];
    const matieresSpecifiques = [];

    Object.keys(groupesMatieres).forEach(function (libelle) {

        const occurrences = groupesMatieres[libelle];

        // Ensemble des filières concernées
        const filieres = [];

        occurrences.forEach(function (matiere) {

            if (
                matiere.filiereCode &&
                !filieres.includes(matiere.filiereCode)
            ) {
                filieres.push(matiere.filiereCode);
            }

        });

        const information = {
            matiereLibelle: libelle,
            filieres: filieres,
            occurrences: occurrences
        };

        // Matière commune :
        // présente dans au moins deux filières
        if (filieres.length >= 2) {

            matieresCommunes.push(information);

        } else {

            matieresSpecifiques.push(information);

        }
    });

    // -------------------------------------------------
    // Affichage diagnostic
    // -------------------------------------------------

    console.log(
        "PRÉPARATION DES MATIÈRES POUR LE NIVEAU :",
        niveauCode
    );

    console.log(
        "→ Matières communes :",
        matieresCommunes.length
    );

    console.table(
        matieresCommunes.map(function (matiere) {
            return {
                Matiere: matiere.matiereLibelle,
                Filieres: matiere.filieres.join(" / ")
            };
        })
    );

    console.log(
        "→ Matières spécifiques :",
        matieresSpecifiques.length
    );

    console.table(
        matieresSpecifiques.map(function (matiere) {
            return {
                Matiere: matiere.matiereLibelle,
                Filiere: matiere.filieres.join(" / ")
            };
        })
    );

    return {
        niveauCode: niveauCode,
        matieresCommunes: matieresCommunes,
        matieresSpecifiques: matieresSpecifiques
    };
}

// =====================================================
// PRÉPARER LES MATIÈRES POUR UNE SESSION
// =====================================================

function preparerMatieresPourSession(niveauCode, sessionCode) {

    console.log("------------------------------------------");
    console.log("PRÉPARATION DES MATIÈRES POUR LA SESSION");
    console.log("Niveau :", niveauCode);
    console.log("Session :", sessionCode);
    console.log("------------------------------------------");

    const session = obtenirSession(sessionCode);

    if (!session) {
        console.error("❌ Session introuvable :", sessionCode);
        return null;
    }

    const matieresNiveau = donneesGeneration.matieres.filter(function (matiere) {
        return (
            matiere.niveauCode === niveauCode &&
            matiere.regimeCode === session.regimeCode &&
            matiere.semestreCode === session.semestreCode
        );
    });

    console.log("Régime :", session.regimeCode);
    console.log("Semestre :", session.semestreCode);
    console.log("Matières compatibles :", matieresNiveau.length);

    // Regrouper les matières par libellé
    const groupes = {};

    matieresNiveau.forEach(function (matiere) {

        const libelle = matiere.matiereLibelle;

        if (!groupes[libelle]) {
            groupes[libelle] = [];
        }

        groupes[libelle].push(matiere);
    });

    const matieresCommunes = [];
    const matieresSpecifiques = [];

    Object.keys(groupes).forEach(function (libelle) {

        const groupe = groupes[libelle];

        const filieres = [...new Set(
            groupe.map(function (matiere) {
                return matiere.filiereCode;
            })
        )];

        const premiereMatiere = groupe[0];

        if (filieres.length >= 2) {

            matieresCommunes.push({
                matiereLibelle: libelle,
                filieres: filieres,
                regimeCode: premiereMatiere.regimeCode,
                semestreCode: premiereMatiere.semestreCode
            });

        } else {

            matieresSpecifiques.push({
                matiereLibelle: libelle,
                filiereCode: filieres[0],
                regimeCode: premiereMatiere.regimeCode,
                semestreCode: premiereMatiere.semestreCode
            });
        }
    });

    console.log("→ Matières communes :", matieresCommunes.length);

    matieresCommunes.forEach(function (matiere) {
        console.log(
            "  ",
            matiere.matiereLibelle,
            "|",
            matiere.filieres.join(" / ")
        );
    });

    console.log("→ Matières spécifiques :", matieresSpecifiques.length);

    matieresSpecifiques.forEach(function (matiere) {
        console.log(
            "  ",
            matiere.matiereLibelle,
            "|",
            matiere.filiereCode
        );
    });

    return {
        niveauCode: niveauCode,
        sessionCode: sessionCode,
        regimeCode: session.regimeCode,
        semestreCode: session.semestreCode,
        matieresCommunes: matieresCommunes,
        matieresSpecifiques: matieresSpecifiques
    };
}

// =====================================================
// OBTENIR UNE SESSION
// =====================================================

function obtenirSession(sessionCode) {

    return donneesGeneration.sessions.find(
        function (session) {

            return (
                session.sessionCode ===
                sessionCode
            );

        }
    );

}


// =====================================================
// OBTENIR LES CRÉNEAUX D'UNE SESSION
// =====================================================

function obtenirCreneauxDeSession(
    sessionCode
) {

    const creneaux =
        donneesGeneration.creneaux.filter(
            function (creneau) {

                return (
                    creneau.sessionCode ===
                    sessionCode
                );

            }
        );


    creneaux.sort(
        function (a, b) {

            return Number(
                a.creneauOrdre
            ) - Number(
                b.creneauOrdre
            );

        }
    );


    return creneaux;

}


// =====================================================
// CONVERTIR UNE DATE EXCEL EN OBJET DATE
// =====================================================

function convertirDateExcelPourGeneration(
    valeur
) {

    if (
        valeur instanceof Date
    ) {

        return new Date(
            valeur.getFullYear(),
            valeur.getMonth(),
            valeur.getDate()
        );

    }


    if (
        typeof valeur === "number"
    ) {

        const date =
            new Date(
                Date.UTC(
                    1899,
                    11,
                    30
                )
            );


        date.setUTCDate(
            date.getUTCDate() +
            valeur
        );


        return new Date(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate()
        );

    }


    if (
        typeof valeur === "string" &&
        valeur.trim() !== ""
    ) {

        const date =
            new Date(valeur);


        if (
            !isNaN(date.getTime())
        ) {

            return new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
            );

        }

    }


    return null;

}


// =====================================================
// FORMATER UNE DATE
// =====================================================

function formaterDateGeneration(
    date
) {

    const jour =
        String(
            date.getDate()
        ).padStart(2, "0");


    const mois =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");


    const annee =
        date.getFullYear();


    return (
        jour +
        "/" +
        mois +
        "/" +
        annee
    );

}


// =====================================================
// GÉNÉRER LA LISTE DES DATES
// =====================================================

function genererListeDates(
    dateDebut,
    dateFin
) {

    const dates = [];


    const debut =
        convertirDateExcelPourGeneration(
            dateDebut
        );


    const fin =
        convertirDateExcelPourGeneration(
            dateFin
        );


    if (
        !debut ||
        !fin
    ) {

        console.error(
            "❌ Dates de session invalides."
        );

        return dates;

    }


    if (
        debut > fin
    ) {

        console.error(
            "❌ La date de début est après la date de fin."
        );

        return dates;

    }


    let dateCourante =
        new Date(debut);


    while (
        dateCourante <= fin
    ) {

        dates.push({

            date:
                new Date(dateCourante),

            dateAffichage:
                formaterDateGeneration(
                    dateCourante
                )

        });


        dateCourante.setDate(
            dateCourante.getDate() + 1
        );

    }


    return dates;

}


// =====================================================
// CONSTRUIRE LA GRILLE D'UNE SESSION
// =====================================================
// Structure :
//
// Session
//   ↓
// Date
//   ↓
// Créneaux disponibles
//
// Chaque élément de la grille représente
// une combinaison Date + Créneau.
// =====================================================

function construireGrilleSession(
    sessionCode
) {

    console.log(
        "=========================================="
    );

    console.log(
        "CONSTRUCTION DE LA GRILLE"
    );

    console.log(
        "Session :",
        sessionCode
    );

    console.log(
        "=========================================="
    );


    const session =
        obtenirSession(sessionCode);


    if (!session) {

        console.error(
            "❌ Session introuvable :",
            sessionCode
        );

        return [];

    }


    const creneaux =
        obtenirCreneauxDeSession(
            sessionCode
        );


    if (
        creneaux.length === 0
    ) {

        console.error(
            "❌ Aucun créneau trouvé pour :",
            sessionCode
        );

        return [];

    }


    const dates =
        genererListeDates(
            session.dateDebut,
            session.dateFin
        );


    if (
        dates.length === 0
    ) {

        console.error(
            "❌ Aucune date disponible pour la session."
        );

        return [];

    }


    const grille = [];


    // =================================================
    // DATE → TOUS LES CRÉNEAUX
    // =================================================

    dates.forEach(
        function (dateInfo) {

            creneaux.forEach(
                function (creneau) {

                    grille.push({

                        sessionCode:
                            sessionCode,

                        date:
                            dateInfo.date,

                        dateAffichage:
                            dateInfo.dateAffichage,

                        creneauOrdre:
                            Number(
                                creneau.creneauOrdre
                            ),

                        heureDebut:
                            creneau.heureDebut,

                        heureFin:
                            creneau.heureFin,

                        heureDebutAffichage:
                            creneau.heureDebutAffichage ||
                            "",

                        heureFinAffichage:
                            creneau.heureFinAffichage ||
                            "",

                        nombreMatieres:
                            0

                    });

                }
            );

        }
    );


    // =================================================
    // AFFICHAGE DU RÉSULTAT
    // =================================================

    console.log(
        "Dates disponibles :",
        dates.length
    );

    console.log(
        "Créneaux par jour :",
        creneaux.length
    );

    console.log(
        "Nombre total de positions :",
        grille.length
    );


    console.table(
        grille.map(
            function (position) {

                return {

                    Date:
                        position.dateAffichage,

                    Créneau:
                        position.creneauOrdre,

                    Horaire:
                        (
                            position.heureDebutAffichage
                            || ""
                        )
                        +
                        " - "
                        +
                        (
                            position.heureFinAffichage
                            || ""
                        ),

                    Matieres:
                        position.nombreMatieres

                };

            }
        )
    );


    console.log(
        "------------------------------------------"
    );

    console.log(
        "✓ GRILLE CONSTRUITE"
    );

    console.log(
        "------------------------------------------"
    );


    return grille;

}

function construireMatricePlanning(niveauCode, sessionCode) {

    const structure = preparerMatieresPourPlanification(niveauCode);

    const grille = construireGrilleSession(sessionCode);

    if (!grille || grille.length === 0) {
        console.error("❌ Impossible de construire la matrice : grille vide.");
        return null;
    }

    const filieres = obtenirFilieresDuNiveau(niveauCode);

    if (!filieres || filieres.length === 0) {
        console.error(
            "❌ Aucune filière trouvée pour le niveau :",
            niveauCode
        );
        return null;
    }

    // -------------------------------------------------
    // Création de la matrice
    // -------------------------------------------------

    const planning = {
        niveauCode: niveauCode,
        sessionCode: sessionCode,
        filieres: []
    };

    filieres.forEach(function (filiereCode) {

        const ligneFiliere = {
            filiereCode: filiereCode,
            amphis: [],
            cellules: []
        };

        grille.forEach(function (position) {

            ligneFiliere.cellules.push({

                date: position.date,
                dateAffichage: position.dateAffichage,

                creneauOrdre: position.creneauOrdre,

                heureDebut: position.heureDebut,
                heureFin: position.heureFin,

                heureDebutAffichage:
                    position.heureDebutAffichage || "",

                heureFinAffichage:
                    position.heureFinAffichage || "",

                // -------------------------------------------------
                // Aucune matière n'est encore affectée
                // -------------------------------------------------

                matiereLibelle: "",
                regimeCode: "",
                semestreCode: "",

                // -------------------------------------------------
                // Informations qui seront utilisées plus tard
                // -------------------------------------------------

                estOccupee: false,
                estCommune: false

            });

        });

        planning.filieres.push(ligneFiliere);
    });

    // -------------------------------------------------
    // Informations générales
    // -------------------------------------------------

    planning.matieresCommunes = structure.matieresCommunes;
    planning.matieresSpecifiques = structure.matieresSpecifiques;

    // -------------------------------------------------
    // Diagnostic
    // -------------------------------------------------

    console.log(
        "MATRICE DU PLANNING CONSTRUITE"
    );

    console.log(
        "Niveau :",
        niveauCode
    );

    console.log(
        "Session :",
        sessionCode
    );

    console.log(
        "Filières :",
        planning.filieres.map(function (filiere) {
            return filiere.filiereCode;
        })
    );

    console.log(
        "Nombre de positions par filière :",
        grille.length
    );

    console.log(
        "Matières communes disponibles :",
        planning.matieresCommunes.length
    );

    console.log(
        "Matières spécifiques disponibles :",
        planning.matieresSpecifiques.length
    );

    // -------------------------------------------------
    // Vérification visuelle des lignes
    // -------------------------------------------------

    planning.filieres.forEach(function (filiere) {

        console.log(
            "Filière :",
            filiere.filiereCode,
            "→",
            filiere.cellules.length,
            "cellules"
        );

    });

    return planning;
}
function placerMatieresCommunes(planning) {

    if (!planning) {
        console.error("❌ Planning absent.");
        return null;
    }

    if (
        !planning.matieresCommunes ||
        planning.matieresCommunes.length === 0
    ) {
        console.log("ℹ️ Aucune matière commune à placer.");
        return planning;
    }

    console.log("------------------------------------------");
    console.log("PLACEMENT DES MATIÈRES COMMUNES");
    console.log("------------------------------------------");

    // -------------------------------------------------
    // Pour chaque matière commune
    // -------------------------------------------------

    planning.matieresCommunes.forEach(function (matiereCommune) {

        const filieresConcernees = matiereCommune.filieres;

        if (!filieresConcernees || filieresConcernees.length < 2) {
            console.warn(
                "⚠️ Matière commune invalide :",
                matiereCommune.matiereLibelle
            );
            return;
        }

        // -------------------------------------------------
        // Recherche d'une position disponible commune
        // à toutes les filières concernées
        // -------------------------------------------------

        let positionChoisie = null;

        const premiereFiliere = planning.filieres.find(
            function (filiere) {
                return filieresConcernees.includes(
                    filiere.filiereCode
                );
            }
        );

        if (!premiereFiliere) {
            console.warn(
                "⚠️ Filière introuvable pour :",
                matiereCommune.matiereLibelle
            );
            return;
        }

        // -------------------------------------------------
        // On parcourt les cellules dans l'ordre
        // date → créneau
        // -------------------------------------------------

        for (
            let i = 0;
            i < premiereFiliere.cellules.length;
            i++
        ) {

            const celluleCandidate =
                premiereFiliere.cellules[i];

            // Vérifier que la même position existe
            // et est libre dans toutes les filières
            // concernées.
            const positionDisponible =
                filieresConcernees.every(
                    function (filiereCode) {

                        const filiere =
                            planning.filieres.find(
                                function (f) {
                                    return (
                                        f.filiereCode ===
                                        filiereCode
                                    );
                                }
                            );

                        if (!filiere) {
                            return false;
                        }

                        const cellule =
                            filiere.cellules.find(
                                function (c) {

                                    return (
                                        c.dateAffichage ===
                                            celluleCandidate.dateAffichage
                                        &&
                                        c.creneauOrdre ===
                                            celluleCandidate.creneauOrdre
                                    );

                                }
                            );

                        return (
                            cellule &&
                            cellule.estOccupee === false
                        );

                    }
                );

            if (positionDisponible) {

                positionChoisie = celluleCandidate;
                break;

            }

        }

        // -------------------------------------------------
        // Aucune position disponible
        // -------------------------------------------------

        if (!positionChoisie) {

            console.error(
                "❌ Aucune position disponible pour la matière commune :",
                matiereCommune.matiereLibelle
            );

            return;
        }

        // -------------------------------------------------
        // Affectation dans toutes les filières concernées
        // -------------------------------------------------

        filieresConcernees.forEach(function (filiereCode) {

            const filiere =
                planning.filieres.find(
                    function (f) {
                        return f.filiereCode === filiereCode;
                    }
                );

            if (!filiere) {
                return;
            }

            const cellule =
                filiere.cellules.find(
                    function (c) {

                        return (
                            c.dateAffichage ===
                                positionChoisie.dateAffichage
                            &&
                            c.creneauOrdre ===
                                positionChoisie.creneauOrdre
                        );

                    }
                );

            if (!cellule) {
                return;
            }

            cellule.matiereLibelle =
                matiereCommune.matiereLibelle;

            cellule.estOccupee = true;
            cellule.estCommune = true;

        });

        console.log(
            "✓ Matière commune placée :",
            matiereCommune.matiereLibelle
        );

        console.log(
            "  Filières :",
            filieresConcernees.join(" / ")
        );

        console.log(
            "  Date :",
            positionChoisie.dateAffichage
        );

        console.log(
            "  Créneau :",
            positionChoisie.creneauOrdre,
            "(" +
            (positionChoisie.heureDebutAffichage || "") +
            " - " +
            (positionChoisie.heureFinAffichage || "") +
            ")"
        );

    });

    // -------------------------------------------------
    // Diagnostic final
    // -------------------------------------------------

    console.log("------------------------------------------");
    console.log("✓ MATIÈRES COMMUNES PLACÉES");
    console.log("------------------------------------------");

    planning.filieres.forEach(function (filiere) {

        const matieresPlacees =
            filiere.cellules.filter(
                function (cellule) {
                    return cellule.estOccupee;
                }
            );

        console.log(
            filiere.filiereCode +
            " → " +
            matieresPlacees.length +
            " matière(s) placée(s)"
        );

    });

    return planning;
}


// =====================================================
// CONSTRUIRE LA STRUCTURE DU NIVEAU
// =====================================================

function construireStructureNiveau(
    niveauCode
) {

    const structure = {

        niveauCode:
            niveauCode,

        filieres: []

    };


    const filieres =
        obtenirFilieresDuNiveau(
            niveauCode
        );


    filieres.forEach(
        function (filiereCode) {

            const matieres =
                obtenirMatieresDeFiliere(

                    niveauCode,

                    filiereCode

                );


            structure.filieres.push({

                filiereCode:
                    filiereCode,

                matieres:
                    matieres

            });

        }
    );


    return structure;

}


// =====================================================
// CONSTRUIRE TOUTE LA STRUCTURE
// =====================================================

function construireStructureGeneration() {

    console.log(
        "=========================================="
    );

    console.log(
        "STRUCTURE DE PLANIFICATION"
    );

    console.log(
        "=========================================="
    );


    const niveaux =
        obtenirNiveaux();


    console.log(
        "Niveaux détectés :",
        niveaux
    );


    const structure = [];


    niveaux.forEach(
        function (niveauCode) {

            const niveau =
                construireStructureNiveau(
                    niveauCode
                );


            structure.push(
                niveau
            );


            console.log(
                "------------------------------------------"
            );


            console.log(
                "Niveau :",
                niveauCode
            );


            console.log(
                "Filières :",
                niveau.filieres.map(
                    function (filiere) {

                        return filiere.filiereCode;

                    }
                )
            );


            niveau.filieres.forEach(
                function (filiere) {

                    console.log(

                        "  Filière :",

                        filiere.filiereCode

                    );


                    console.log(

                        "  Matières :",

                        filiere.matieres.map(
                            function (matiere) {

                                return (
                                    matiere.matiereLibelle
                                );

                            }
                        )

                    );

                }
            );

        }
    );


    console.log(
        "------------------------------------------"
    );

    console.log(
        "✓ STRUCTURE CONSTRUITE"
    );

    console.log(
        "------------------------------------------"
    );


    return structure;

}


// =====================================================
// PRÉPARER LE MOTEUR
// =====================================================

async function preparerGeneration() {

    console.log("");

    console.log(
        "=========================================="
    );

    console.log(
        "MOTEUR DE GÉNÉRATION DES EXAMENS"
    );

    console.log(
        "=========================================="
    );


    const chargement =
        await chargerDonneesGeneration();


    if (!chargement) {

        console.error(
            "❌ Impossible de préparer la génération."
        );

        return null;

    }


    const verification =
        verifierDonneesGeneration();


    if (!verification) {

        console.error(
            "❌ Les données ne sont pas suffisantes."
        );

        return null;

    }


    const structure =
        construireStructureGeneration();


    console.log("");

    console.log(
        "✓ MOTEUR PRÊT"
    );

    console.log(
        "=========================================="
    );


    return structure;

}


// =====================================================
// EXPOSER LES FONCTIONS
// =====================================================

window.generationExamens = {

    chargerDonnees:
        chargerDonneesGeneration,

    verifierDonnees:
        verifierDonneesGeneration,

    obtenirNiveaux:
        obtenirNiveaux,

    obtenirFilieres:
        obtenirFilieresDuNiveau,

    obtenirMatieres:
        obtenirMatieresDeFiliere,

    identifierMatieresCommunes:
        identifierMatieresCommunes,
    preparerMatieresPourPlanification: 
        preparerMatieresPourPlanification,

    obtenirSession:
        obtenirSession,

    obtenirCreneauxDeSession:
        obtenirCreneauxDeSession,

    genererListeDates:
        genererListeDates,

    construireGrilleSession:
        construireGrilleSession,

    construireMatricePlanning:
        construireMatricePlanning,
    placerMatieresCommunes: 
        placerMatieresCommunes,
    construireStructure:
        construireStructureGeneration,

    preparer:
        preparerGeneration

};


// =====================================================
// INITIALISATION
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "✓ generation.js chargé."
        );


        await preparerGeneration();

    }
);

