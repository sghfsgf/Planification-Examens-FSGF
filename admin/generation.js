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
// - équilibre global considéré atteint si l'écart
//   entre le créneau le plus chargé et le moins chargé
//   est inférieur ou égal à 1
// =====================================================

// =====================================================
// FONCTION UTILITAIRE : IDENTIFICATION D'UN CRÉNEAU
// =====================================================

function obtenirCleCreneau(cellule) {
    return (
        String(cellule.date) +
        "|" +
        String(cellule.creneauOrdre)
    );
}

import { app } from "../firebase-config.js";


import {
    getFirestore,
    collection,
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    serverTimestamp,
    runTransaction
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

    sallesAmphis: [],

     effectifs: []

};


// =====================================================
// ÉTAT DU MOTEUR
// =====================================================

let generationChargee = false;

// =====================================================
// DERNIER CALENDRIER ENREGISTRÉ
// =====================================================

let dernierCalendrierEnregistre = null;
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
    console.log("CHARGEMENT DES DONNÉES POUR LA GÉNÉRATION");
    console.log("==========================================");

    try {

        // -------------------------------------------------
        // Attendre que data.js ait terminé le chargement
        // -------------------------------------------------

       

        // -------------------------------------------------
        // Récupérer les données déjà chargées par data.js
        // -------------------------------------------------

       // -------------------------------------------------
// Récupérer les données actuelles depuis Firestore
// -------------------------------------------------

const snapshotMatieres =
    await getDocs(
        collection(
            db,
            "matieres"
        )
    );

donneesGeneration.matieres =
    snapshotMatieres.docs.map(
        function (documentFirestore) {
            return documentFirestore.data();
        }
    );


const snapshotSessions =
    await getDocs(
        collection(
            db,
            "sessions"
        )
    );

donneesGeneration.sessions =
    snapshotSessions.docs.map(
        function (documentFirestore) {
            return documentFirestore.data();
        }
    );


const snapshotCreneaux =
    await getDocs(
        collection(
            db,
            "creneaux"
        )
    );

donneesGeneration.creneaux =
    snapshotCreneaux.docs.map(
        function (documentFirestore) {
            return documentFirestore.data();
        }
    );


const snapshotSallesAmphis =
    await getDocs(
        collection(
            db,
            "salles_amphis"
        )
    );

donneesGeneration.sallesAmphis =
    snapshotSallesAmphis.docs.map(
        function (documentFirestore) {
            return documentFirestore.data();
        }
    );

        const snapshotEffectifs =
    await getDocs(
        collection(
            db,
            "effectifs"
        )
    );

donneesGeneration.effectifs =
    snapshotEffectifs.docs.map(
        function (documentFirestore) {
            return documentFirestore.data();
        }
    );

        // -------------------------------------------------
        // Contrôle
        // -------------------------------------------------

        console.log(
            "Matières :",
            donneesGeneration.matieres.length
        );

        console.log(
            "Sessions :",
            donneesGeneration.sessions.length
        );

        console.log(
            "Créneaux :",
            donneesGeneration.creneaux.length
        );

        console.log(
            "Salles / amphis :",
            donneesGeneration.sallesAmphis.length
        );

        console.log(
    "Effectifs :",
    donneesGeneration.effectifs.length
);

        console.log(
    "✓ Données de génération récupérées depuis Firestore"
);

        return true;

    } catch (erreur) {

        console.error(
            "❌ Erreur lors du chargement des données de génération :",
            erreur
        );

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

    // ⛔ Dimanche interdit pour les examens
    if (
        dateCourante.getDay() !== 0
    ) {

        dates.push({

            date:
                new Date(dateCourante),

            dateAffichage:
                formaterDateGeneration(
                    dateCourante
                )

        });

    }


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

    const structure = preparerMatieresPourSession(niveauCode, sessionCode);

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

    console.log(
    "DIAGNOSTIC FINAL DES FILIÈRES DU PLANNING :",
    planning.filieres.map(f => ({
        filiereCode: f.filiereCode,
        longueur: f.filiereCode.length
    }))
);

    return planning;
}

function aUnExamenAdjacent(filiere, celluleCandidate) {
    const ordreCandidate =
        Number(celluleCandidate.creneauOrdre);

    // Une valeur de créneau incorrecte ne doit pas être acceptée.
    if (!Number.isFinite(ordreCandidate)) {
        throw new Error(
            "Ordre de créneau invalide : " +
            celluleCandidate.creneauOrdre
        );
    }

    return filiere.cellules.some(function (autreCellule) {
        if (autreCellule.estOccupee !== true) {
            return false;
        }

        if (
            autreCellule.dateAffichage !==
            celluleCandidate.dateAffichage
        ) {
            return false;
        }

        const autreOrdre =
            Number(autreCellule.creneauOrdre);

        if (!Number.isFinite(autreOrdre)) {
            throw new Error(
                "Ordre de créneau invalide : " +
                autreCellule.creneauOrdre
            );
        }

        return Math.abs(
            autreOrdre - ordreCandidate
        ) === 1;
    });
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

                       if (!cellule || cellule.estOccupee !== false) {
    return false;
}

return !aUnExamenAdjacent(
    filiere,
    cellule
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
// TROUVER UNE POSITION POUR UNE MATIÈRE SPÉCIFIQUE
// =====================================================


function trouverPositionPourMatiereSpecifique(planning, filiereCode) {

    // -------------------------------------------------
    // 1. Rechercher la filière
    // -------------------------------------------------

    const filiere = planning.filieres.find(function (f) {
        return f.filiereCode === filiereCode;
    });

    if (!filiere) {
        console.error(
            "❌ Filière introuvable dans le planning :",
            filiereCode
        );

        return null;
    }

    // -------------------------------------------------
    // 2. Calculer la charge globale des créneaux
    // -------------------------------------------------

    const chargesCreneaux =
        calculerChargeDesCreneaux(planning);

    console.log(
        "Charge globale utilisée pour",
        filiereCode,
        ":",
        chargesCreneaux
    );

    // -------------------------------------------------
    // 3. Rechercher les cellules disponibles
    // -------------------------------------------------

    const positionsPossibles = filiere.cellules.filter(
        function (cellule) {

            // Une cellule déjà occupée ne peut pas être utilisée.
            if (cellule.estOccupee) {
                return false;
            }

            // Rechercher les cellules du même jour.
            const cellulesMemeJour = filiere.cellules.filter(
                function (autre) {
                    return autre.dateAffichage ===
                        cellule.dateAffichage;
                }
            );

            // Vérifier le créneau précédent.
            const cellulePrecedente = cellulesMemeJour.find(
                function (autre) {
                    return autre.creneauOrdre ===
                        cellule.creneauOrdre - 1;
                }
            );

            // Vérifier le créneau suivant.
            const celluleSuivante = cellulesMemeJour.find(
                function (autre) {
                    return autre.creneauOrdre ===
                        cellule.creneauOrdre + 1;
                }
            );

            // Interdire deux examens successifs le même jour.
            if (
                (cellulePrecedente && cellulePrecedente.estOccupee) ||
                (celluleSuivante && celluleSuivante.estOccupee)
            ) {
                return false;
            }

            return true;
        }
    );

    // -------------------------------------------------
    // 4. Vérifier qu'une cellule est disponible
    // -------------------------------------------------

    if (positionsPossibles.length === 0) {

        console.error(
            "❌ Aucune cellule disponible pour :",
            filiereCode
        );

        return null;
    }

   // Priorité 1 : choisir le créneau le moins chargé avant placement.
   // Priorité 2 : minimiser l'écart global après placement.
   // Priorité 3 : minimiser la dispersion globale.

    let positionChoisie = null;
    let meilleurEcart = Infinity;
    let meilleureDispersion = Infinity;
    let meilleureChargeAvant = Infinity;

    positionsPossibles.forEach(function (position) {

        // Simuler le placement sans modifier le planning.
        const chargesSimulees = {
            ...chargesCreneaux
        };

       const cle = obtenirCleCreneau(position);

           chargesSimulees[cle] =
              (chargesSimulees[cle] || 0) + 1;

        const valeursCharges =
            Object.values(chargesSimulees);

        const chargeMin =
            Math.min(...valeursCharges);

        const chargeMax =
            Math.max(...valeursCharges);

        const ecart =
            chargeMax - chargeMin;

        // Calculer la dispersion globale.
        const moyenne =
            valeursCharges.reduce(function (somme, charge) {
                return somme + charge;
            }, 0) / valeursCharges.length;

        const dispersion =
            valeursCharges.reduce(function (somme, charge) {
                return somme + Math.pow(charge - moyenne, 2);
            }, 0);

          const chargeAvant =
                 chargesCreneaux[cle] || 0;

        // Priorité 1 : minimiser l'écart maximal.
        // Priorité 2 : minimiser la dispersion.
        // Priorité 3 : préférer le créneau le moins chargé
        // avant placement.

      if (
    chargeAvant < meilleureChargeAvant ||
    (
        chargeAvant === meilleureChargeAvant &&
        ecart < meilleurEcart
    ) ||
    (
        chargeAvant === meilleureChargeAvant &&
        ecart === meilleurEcart &&
        dispersion < meilleureDispersion
    )
) {
            positionChoisie = position;
            meilleurEcart = ecart;
            meilleureDispersion = dispersion;
            meilleureChargeAvant = chargeAvant;
        }
    });

    // -------------------------------------------------
    // 6. Afficher la position retenue
    // -------------------------------------------------

    console.log(
        "✓ Position trouvée :",
        filiereCode,
        "|",
        positionChoisie.dateAffichage,
        "| Créneau",
        positionChoisie.creneauOrdre,
        "|",
        positionChoisie.heureDebutAffichage,
        "-",
        positionChoisie.heureFinAffichage
    );

    console.log(
        "📊 Écart global après simulation :",
        meilleurEcart
    );

    console.log(
        "📊 Dispersion après simulation :",
        meilleureDispersion
    );

    console.log(
        "📊 Charge avant placement :",
        meilleureChargeAvant
    );

    return positionChoisie;
}

function placerMatieresSpecifiques(planning) {

    console.log("------------------------------------------");
    console.log("PLACEMENT DES MATIÈRES SPÉCIFIQUES");
    console.log("------------------------------------------");

    if (!planning) {
        console.error("❌ Planning introuvable.");
        return planning;
    }

    const matieresSpecifiques =
        planning.matieresSpecifiques || [];

    const matieresNonPlacees = [];

    if (matieresSpecifiques.length === 0) {
        console.log("ℹ️ Aucune matière spécifique à placer.");
        return planning;
    }

// -------------------------------------------------
// 1. PLACEMENT INITIAL
//    ARRÊT AU PREMIER BLOCAGE
// -------------------------------------------------

for (
    let i = 0;
    i < matieresSpecifiques.length;
    i++
) {

    const matiere = matieresSpecifiques[i];

    const filiereCode = matiere.filiereCode;

    const position =
        trouverPositionPourMatiereSpecifique(
            planning,
            filiereCode
        );

    if (!position) {

        console.warn(
            "⚠️ Premier blocage détecté :",
            matiere.matiereLibelle,
            "|",
            filiereCode
        );

        matieresNonPlacees.push(
            ...matieresSpecifiques.slice(i)
        );

        break;
    }

    position.estOccupee = true;
    position.matiereLibelle =
        matiere.matiereLibelle;
    position.regimeCode =
        matiere.regimeCode;
    position.semestreCode =
        matiere.semestreCode;
    position.filiereCode =
        filiereCode;

    console.log(
        "✓ Matière placée :",
        matiere.matiereLibelle,
        "|",
        filiereCode,
        "|",
        position.dateAffichage,
        "| Créneau",
        position.creneauOrdre
    );
}

    // -------------------------------------------------
    // 2. SAUVEGARDE ET RESTAURATION
    // -------------------------------------------------

    function sauvegarderCellule(cellule) {

        const sauvegarde = {};
        const proprietes = [
            "estOccupee", "estCommune", "matiereLibelle",
            "regimeCode", "semestreCode", "filiereCode"
        ];

        proprietes.forEach(function (propriete) {
            if (Object.prototype.hasOwnProperty.call(cellule, propriete)) {
                sauvegarde[propriete] = cellule[propriete];
            }
        });

        return sauvegarde;
    }

    function restaurerCellule(cellule, sauvegarde) {

        const proprietes = [
            "estOccupee", "estCommune", "matiereLibelle",
            "regimeCode", "semestreCode", "filiereCode"
        ];

        proprietes.forEach(function (propriete) {
            if (Object.prototype.hasOwnProperty.call(sauvegarde, propriete)) {
                cellule[propriete] = sauvegarde[propriete];
            } else {
                delete cellule[propriete];
            }
        });
    }

    // -------------------------------------------------
    // 3. VÉRIFIER LES CRÉNEAUX SUCCESSIFS
    // -------------------------------------------------

    function positionRespecteContraintes(
        filiere,
        cellule
    ) {

        const cellulesMemeJour = filiere.cellules.filter(
            function (autre) {
                return autre.dateAffichage ===
                    cellule.dateAffichage;
            }
        );

        const precedente = cellulesMemeJour.find(
            function (autre) {
                return autre.creneauOrdre ===
                    cellule.creneauOrdre - 1;
            }
        );

        const suivante = cellulesMemeJour.find(
            function (autre) {
                return autre.creneauOrdre ===
                    cellule.creneauOrdre + 1;
            }
        );

        return !(
            (precedente && precedente.estOccupee) ||
            (suivante && suivante.estOccupee)
        );
    }

    // -------------------------------------------------
    // 4. PERMUTATION :
    //    ANCIENNE MATIÈRE EN CRÉNEAU 1
    //    NOUVELLE MATIÈRE EN CRÉNEAU 3
    // -------------------------------------------------

    function tenterPermutation(
        filiere,
        celluleExistante,
        ancienneMatiere,
        nouvelleMatiere,
        filiereCode
    ) {

        if (celluleExistante.creneauOrdre !== 2) {
            return false;
        }

        const date = celluleExistante.dateAffichage;

        const cellulesMemeJour = filiere.cellules.filter(
            function (cellule) {
                return cellule.dateAffichage === date;
            }
        );

        const creneau1 = cellulesMemeJour.find(
            function (cellule) {
                return cellule.creneauOrdre === 1;
            }
        );

        const creneau3 = cellulesMemeJour.find(
            function (cellule) {
                return cellule.creneauOrdre === 3;
            }
        );

        if (!creneau1 || !creneau3) {
            return false;
        }

        if (
            creneau1.estOccupee ||
            creneau3.estOccupee
        ) {
            return false;
        }

        const sauvegarde2 =
            sauvegarderCellule(celluleExistante);

        const sauvegarde1 =
            sauvegarderCellule(creneau1);

        const sauvegarde3 =
            sauvegarderCellule(creneau3);

        // Libérer le créneau 2.

        celluleExistante.estOccupee = false;
        celluleExistante.matiereLibelle = "";
        celluleExistante.regimeCode = "";
        celluleExistante.semestreCode = "";
        celluleExistante.filiereCode = "";

        // Déplacer l'ancienne matière en créneau 1.

        creneau1.estOccupee = true;
        creneau1.matiereLibelle =
            ancienneMatiere.matiereLibelle;
        creneau1.regimeCode =
            ancienneMatiere.regimeCode;
        creneau1.semestreCode =
            ancienneMatiere.semestreCode;
        creneau1.filiereCode = filiereCode;

        // Placer la nouvelle matière en créneau 3.

        creneau3.estOccupee = true;
        creneau3.matiereLibelle =
            nouvelleMatiere.matiereLibelle;
        creneau3.regimeCode =
            nouvelleMatiere.regimeCode;
        creneau3.semestreCode =
            nouvelleMatiere.semestreCode;
        creneau3.filiereCode = filiereCode;

        const valide =
            positionRespecteContraintes(filiere, creneau1) &&
            positionRespecteContraintes(filiere, creneau3);

        if (!valide) {

            restaurerCellule(celluleExistante, sauvegarde2);
            restaurerCellule(creneau1, sauvegarde1);
            restaurerCellule(creneau3, sauvegarde3);

            return false;
        }

        console.log(
            "✓ PERMUTATION VALIDÉE :",
            ancienneMatiere.matiereLibelle,
            "→ Créneau 1 ;",
            nouvelleMatiere.matiereLibelle,
            "→ Créneau 3 ; Date :",
            date
        );

        return true;
    }

   // -------------------------------------------------
// 5. PRÉPARATION DE LA RECHERCHE RÉCURSIVE
// -------------------------------------------------

let matieresRestantes =
    matieresNonPlacees.slice();

console.log(
    "Matières transmises à la stratégie 3 :",
    matieresRestantes.length
);
   
    // -------------------------------------------------
    // 6. STRATÉGIE 3 :
    //    RÉORGANISATION COMPLÈTE PAR FILIÈRE
    // -------------------------------------------------

    console.log("");
    console.log("==========================================");
    console.log("STRATÉGIE 3 : RÉORGANISATION COMPLÈTE");
    console.log("==========================================");

    // Limite de sécurité pour éviter de bloquer le navigateur.
    const LIMITE_NOEUDS = 50000;

    
    // -------------------------------------------------
    // 6.1. IDENTIFIER ET CALCULER TOUS LES CRÉNEAUX
    //      RÉELS DU CALENDRIER EN COURS
    // -------------------------------------------------

   

    function calculerChargesGlobales() {

        const charges = {};

        // Recenser tous les créneaux réels du calendrier.

        planning.filieres.forEach(function (filiere) {

            filiere.cellules.forEach(function (cellule) {

                const cle = obtenirCleCreneau(cellule);

                if (charges[cle] === undefined) {
                    charges[cle] = 0;
                }
            });
        });

        // Compter les matières de toutes les filières.

        planning.filieres.forEach(function (filiere) {

            filiere.cellules.forEach(function (cellule) {

                if (cellule.estOccupee) {

                    const cle = obtenirCleCreneau(cellule);

                    charges[cle]++;
                }
            });
        });

        return charges;
    }

    // -------------------------------------------------
    // 6.2. ÉVALUATION DE L'ÉQUILIBRAGE GLOBAL
    // -------------------------------------------------

    function evaluerEquilibrageGlobal() {

        const charges = calculerChargesGlobales();

        const valeurs = Object.values(charges);

        if (valeurs.length === 0) {
            return {
                ecart: 0,
                dispersion: 0
            };
        }

        const maximum = Math.max(...valeurs);
        const minimum = Math.min(...valeurs);

        const moyenne =
            valeurs.reduce(function (total, valeur) {
                return total + valeur;
            }, 0) / valeurs.length;

        const dispersion =
            valeurs.reduce(function (total, valeur) {

                return total +
                    Math.pow(valeur - moyenne, 2);

            }, 0);

        return {
            ecart: maximum - minimum,
            dispersion: dispersion
        };
    }

    // -------------------------------------------------
    // 6.3. COMPARER DEUX ORGANISATIONS COMPLÈTES
    // -------------------------------------------------

    function meilleureOrganisation(score, meilleurScore) {

        if (!meilleurScore) {
            return true;
        }

        if (score.ecart < meilleurScore.ecart) {
            return true;
        }

        if (
            score.ecart === meilleurScore.ecart &&
            score.dispersion < meilleurScore.dispersion
        ) {
            return true;
        }

        return false;
    }

    // -------------------------------------------------
    // 6.4. IDENTIFIER LES FILIÈRES EN DIFFICULTÉ
    // -------------------------------------------------

    const filieresAReorganiser = [
        ...new Set(
            matieresRestantes.map(function (matiere) {
                return matiere.filiereCode;
            })
        )
    ];

    console.log(
    "Matières restantes avant stratégie 3 :",
    matieresRestantes.length
);

console.log(
    "Filières à réorganiser :",
    filieresAReorganiser
);

    filieresAReorganiser.forEach(function (filiereCode) {

        const filiere = planning.filieres.find(
            function (f) {
                return f.filiereCode === filiereCode;
            }
        );

        if (!filiere) {
            return;
        }

        console.log("");
        console.log(
            "🔎 Réorganisation de la filière :",
            filiereCode
        );

        // Toutes les matières spécifiques de cette filière,
        // y compris celles déjà placées.

        const matieresFiliere = matieresSpecifiques.filter(
            function (matiere) {
                return matiere.filiereCode === filiereCode;
            }
        );

        const libellesSpecifiques = new Set(
            matieresFiliere.map(function (matiere) {
                return matiere.matiereLibelle;
            })
        );

        // -------------------------------------------------
        // SAUVEGARDE DE L'ÉTAT INITIAL
        // -------------------------------------------------

        const sauvegardesFiliere =
            filiere.cellules.map(function (cellule) {
                return sauvegarderCellule(cellule);
            });

        // -------------------------------------------------
        // LIBÉRER UNIQUEMENT LES MATIÈRES SPÉCIFIQUES
        // -------------------------------------------------

        filiere.cellules.forEach(function (cellule) {

            if (
                cellule.estOccupee &&
                !cellule.estCommune &&
                libellesSpecifiques.has(cellule.matiereLibelle)
            ) {

                cellule.estOccupee = false;
                cellule.matiereLibelle = "";
                cellule.regimeCode = "";
                cellule.semestreCode = "";
                cellule.filiereCode = "";
            }
        });

        // -------------------------------------------------
        // VARIABLES DE RECHERCHE
        // -------------------------------------------------

        let noeudsVisites = 0;
        let rechercheInterrompue = false;

        let meilleureAffectation = null;
        let meilleurScore = null;

        const affectationCourante = [];

        // -------------------------------------------------
        // 6.5. RECHERCHE RÉCURSIVE
        // -------------------------------------------------

        function rechercherOrganisation(matieresRestantesRecherche) {

            if (noeudsVisites >= LIMITE_NOEUDS) {
                rechercheInterrompue = true;
                return;
            }

            noeudsVisites++;

            // Toutes les matières sont placées :
            // évaluer cette organisation complète.

            if (matieresRestantesRecherche.length === 0) {

                const score = evaluerEquilibrageGlobal();

                if (meilleureOrganisation(score, meilleurScore)) {

                    meilleurScore = score;

                    meilleureAffectation =
                        affectationCourante.slice();

                }

                return;
            }

            // ---------------------------------------------
            // CHOIX DE LA PROCHAINE MATIÈRE
            // ---------------------------------------------

            // Les matières spécifiques d'une même filière
            // ayant les mêmes contraintes, on conserve
            // un ordre fixe pour éviter les permutations
            // inutiles de matières.

            const meilleureMatiere =
                matieresRestantesRecherche[0];

            const meilleuresCellules =
    filiere.cellules.filter(
        function (cellule) {

            return (
                !cellule.estOccupee &&
                !cellule.estCommune &&
                positionRespecteContraintes(
                    filiere,
                    cellule
                )
            );
        }
    );

            if (meilleuresCellules.length === 0) {
                return;
            }

            // ---------------------------------------------
            // ORDRE DES CANDIDATS :
            // PRIVILÉGIER LES CRÉNEAUX LES MOINS CHARGÉS
            // ---------------------------------------------

            const chargesActuelles =
                calculerChargesGlobales();

            meilleuresCellules.sort(function (a, b) {

                const chargeA =
                    chargesActuelles[obtenirCleCreneau(a)] || 0;

                const chargeB =
                    chargesActuelles[obtenirCleCreneau(b)] || 0;

                return chargeA - chargeB;
            });


            // ---------------------------------------------
            // ESSAYER CHAQUE POSITION
            // ---------------------------------------------

           const nouvellesMatieres =
               matieresRestantesRecherche.slice(1);
            
            for (
                let i = 0;
                i < meilleuresCellules.length;
                i++
            ) {

                if (rechercheInterrompue) {
                    break;
                }

                const cellule = meilleuresCellules[i];

                const sauvegarde =
                    sauvegarderCellule(cellule);

                // Placer la matière.

                cellule.estOccupee = true;
                cellule.estCommune = false;
                cellule.matiereLibelle =
                    meilleureMatiere.matiereLibelle;
                cellule.regimeCode =
                    meilleureMatiere.regimeCode;
                cellule.semestreCode =
                    meilleureMatiere.semestreCode;
                cellule.filiereCode = filiereCode;

                affectationCourante.push({
                    cellule: cellule,
                    matiere: meilleureMatiere
                });

                // Continuer la recherche.

                rechercherOrganisation(nouvellesMatieres);

                // Retour en arrière :
                // restaurer exactement la cellule essayée.

                affectationCourante.pop();

                restaurerCellule(cellule, sauvegarde);
            }
        }

        // -------------------------------------------------
        // 6.6. LANCER LA RECHERCHE
        // -------------------------------------------------

        rechercherOrganisation(matieresFiliere);

        // -------------------------------------------------
        // 6.7. RESTAURER L'ÉTAT INITIAL
        // -------------------------------------------------

        filiere.cellules.forEach(function (cellule, index) {

            restaurerCellule(
                cellule,
                sauvegardesFiliere[index]
            );
        });

        // -------------------------------------------------
        // 6.8. APPLIQUER LA MEILLEURE SOLUTION
        // -------------------------------------------------

        if (meilleureAffectation) {

            // Libérer à nouveau les anciennes positions spécifiques.

            filiere.cellules.forEach(function (cellule) {

                if (
                    cellule.estOccupee &&
                    !cellule.estCommune &&
                    libellesSpecifiques.has(cellule.matiereLibelle)
                ) {

                    cellule.estOccupee = false;
                    cellule.matiereLibelle = "";
                    cellule.regimeCode = "";
                    cellule.semestreCode = "";
                    cellule.filiereCode = "";
                }
            });

            // Installer la meilleure organisation trouvée.

            meilleureAffectation.forEach(function (affectation) {

                const cellule = affectation.cellule;
                const matiere = affectation.matiere;

                cellule.estOccupee = true;
                cellule.estCommune = false;
                cellule.matiereLibelle =
                    matiere.matiereLibelle;
                cellule.regimeCode =
                    matiere.regimeCode;
                cellule.semestreCode =
                    matiere.semestreCode;
                cellule.filiereCode = filiereCode;
            });

            // Toutes les matières spécifiques de cette filière
            // sont désormais placées.

            matieresRestantes = matieresRestantes.filter(
                function (matiere) {
                    return matiere.filiereCode !== filiereCode;
                }
            );

            console.log(
                "✓ RÉORGANISATION RÉUSSIE :",
                filiereCode
            );

            console.log(
                "Nombre de matières placées :",
                meilleureAffectation.length
            );

            console.log(
                "Meilleur écart global :",
                meilleurScore.ecart
            );

            console.log(
                "Dispersion globale :",
                meilleurScore.dispersion
            );

        } else {

            console.warn(
                "⚠️ Aucune organisation complète trouvée pour :",
                filiereCode
            );

            if (rechercheInterrompue) {

                console.warn(
                    "Recherche interrompue par la limite de calcul.",
                    "L'impossibilité n'est pas démontrée."
                );

            } else {

                console.warn(
                    "Recherche exhaustive : aucune organisation complète valide."
                );
            }
        }

        console.log(
            "Nœuds de recherche visités :",
            noeudsVisites
        );

        if (rechercheInterrompue && meilleureAffectation) {

            console.warn(
                "⚠️ Une solution complète a été trouvée,",
                "mais l'optimisation globale n'est pas exhaustive."
            );
        }
    });


    // -------------------------------------------------
    // 7. BILAN FINAL
    // -------------------------------------------------

    console.log("------------------------------------------");
    console.log(
        "MATIÈRES NON AFFECTÉES :",
        matieresRestantes.length
    );

    matieresRestantes.forEach(function (matiere) {
        console.warn(
            "❌ Non affectée :",
            matiere.matiereLibelle,
            "| Filière :",
            matiere.filiereCode
        );
    });

    console.log("------------------------------------------");
    console.log("FIN DU PLACEMENT DES MATIÈRES SPÉCIFIQUES");
    console.log("------------------------------------------");

    return planning;
}


// =====================================================
// CALCULER LA CHARGE DES CRÉNEAUX DU NIVEAU
// =====================================================

function calculerChargeDesCreneaux(planning) {

    const charges = {};

    if (!planning || !Array.isArray(planning.filieres)) {
        console.error("Planning invalide pour le calcul des charges.");
        return charges;
    }

    planning.filieres.forEach(function(filiere) {

        filiere.cellules.forEach(function(cellule) {

            // Identifier le créneau par sa date et son ordre.
            const cle = obtenirCleCreneau(cellule);

            // Initialiser chaque créneau réel à zéro.
            if (charges[cle] === undefined) {
                charges[cle] = 0;
            }

            // Compter les matières de toutes les filières.
            if (cellule.estOccupee) {
                charges[cle]++;
            }

        });

    });

    console.log("CHARGE DES CRÉNEAUX — TOUTES FILIÈRES");
    console.table(charges);

    return charges;
}

function verifierEquilibreGlobalCreneaux(planning) {

    const charges = calculerChargeDesCreneaux(planning);
    const valeursCharges = Object.values(charges);

    if (valeursCharges.length === 0) {
        console.warn(
            "⚠️ Aucune charge de créneau à vérifier."
        );
        return null;
    }

    const chargeMin = Math.min(...valeursCharges);
    const chargeMax = Math.max(...valeursCharges);
    const ecart = chargeMax - chargeMin;

   const equilibreAtteint = ecart <= 2;

    console.log(
        "Équilibre global des créneaux :",
        charges,
        "| Écart :",
        ecart
    );

    if (!equilibreAtteint) {

       const detail = Object.entries(charges)
    .sort(function (a, b) {
        return a[0].localeCompare(b[0]);
    })
    .map(function ([cle, charge]) {

        const elements = cle.split("|");
        const date = elements[0];
        const ordre = elements[1];

        return "Date " + date +
            " — Créneau " + ordre +
            " : " + charge + " épreuve(s)";
    })
    .join("\n");
        
        alert(
            "L'équilibre global des créneaux non atteint.\n\n" +
            "Écart global : " + ecart + " épreuve(s).\n\n" +
            detail +
            "\n\nUne correction manuelle du planning est recommandée."
        );

    } else {

        console.log(
            "✓ Équilibre global des créneaux atteint."
        );
    }

    return {
        equilibreAtteint: equilibreAtteint,
        ecart: ecart,
        charges: charges
    };
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
// CHARGER UN CALENDRIER DEPUIS FIRESTORE
// =====================================================

async function chargerCalendrier(
    niveauCode,
    semestreCode,
    regimeCode,
    sessionCode
) {

    const session =
        obtenirSession(sessionCode);

    if (!session) {

        console.error(
            "❌ Session introuvable :",
            sessionCode
        );

        return null;
    }

    const anneeUniversitaire =
        session.anneeUniversitaire;

    const idCalendrier =
        "calendrier_" +
        anneeUniversitaire + "_" +
        niveauCode + "_" +
        semestreCode + "_" +
        regimeCode + "_" +
        sessionCode;

    console.log(
        "🔎 Recherche du calendrier dans Firestore :",
        idCalendrier
    );

    const referenceCalendrier =
        doc(
            db,
            "calendriers",
            idCalendrier
        );

    const documentCalendrier =
        await getDoc(
            referenceCalendrier
        );

    if (!documentCalendrier.exists()) {

        console.log(
            "ℹ️ Aucun calendrier enregistré pour :",
            idCalendrier
        );

        return null;
    }

    const donnees =
        documentCalendrier.data();

    console.log(
        "✓ Calendrier trouvé dans Firestore :",
        idCalendrier
    );

   
return {
    ...donnees.planning,
    anneeUniversitaire:
        donnees.anneeUniversitaire ||
        anneeUniversitaire
};
}


// =====================================================
// ENREGISTRER UN CALENDRIER DANS FIRESTORE
// =====================================================
// Un document = un calendrier complet
//
// ID dynamique :
// calendrier_[anneeUniversitaire]_L2_S2_CC_DS_S2
//
// Le calendrier est enregistré comme brouillon.
// =====================================================

async function enregistrerCalendrier(planning) {

    console.log("==========================================");
    console.log("ENREGISTREMENT DU CALENDRIER");
    console.log("==========================================");

    // -------------------------------------------------
    // Vérifier le planning
    // -------------------------------------------------

    if (!planning) {

        console.error(
            "❌ Aucun planning à enregistrer."
        );

        return null;
    }

    if (!planning.niveauCode) {

        console.error(
            "❌ Niveau du planning absent."
        );

        return null;
    }

    if (!planning.sessionCode) {

        console.error(
            "❌ Session du planning absente."
        );

        return null;
    }

    // -------------------------------------------------
    // Récupérer la session
    // -------------------------------------------------

    const session =
        obtenirSession(
            planning.sessionCode
        );

    if (!session) {

        console.error(
            "❌ Session introuvable :",
            planning.sessionCode
        );

        return null;
    }

    // -------------------------------------------------
    // Récupérer l'année universitaire
    // -------------------------------------------------

    const anneeUniversitaire =
        session.anneeUniversitaire;

    if (!anneeUniversitaire) {

        console.error(
            "❌ Année universitaire absente de la session."
        );

        return null;
    }

    // -------------------------------------------------
    // Récupérer semestre et régime
    // -------------------------------------------------

    const semestreCode =
        session.semestreCode;

    const regimeCode =
        session.regimeCode;

    if (!semestreCode || !regimeCode) {

        console.error(
            "❌ Semestre ou régime absent de la session."
        );

        return null;
    }

    // -------------------------------------------------
    // Construire l'identifiant du calendrier
    // -------------------------------------------------

    const idCalendrier =
        "calendrier_" +
        anneeUniversitaire +
        "_" +
        planning.niveauCode +
        "_" +
        semestreCode +
        "_" +
        regimeCode +
        "_" +
        planning.sessionCode;

    console.log(
        "ID du calendrier :",
        idCalendrier
    );

    // -------------------------------------------------
    // Référence Firestore
    // -------------------------------------------------

    const referenceCalendrier =
        doc(
            db,
            "calendriers",
            idCalendrier
        );
    const documentExistant =
    await getDoc(
        referenceCalendrier
    );

if (documentExistant.exists()) {

    console.log(
        "⚠️ Le calendrier existe déjà dans Firestore :",
        idCalendrier
    );

} else {

    console.log(
        "✓ Aucun calendrier existant. Création du calendrier :",
        idCalendrier
    );
}


    // -------------------------------------------------
    // Construire le document
    // -------------------------------------------------

    const controleInitial = {

        valide: false,
        dateControle: null,
        matieresNonPlacees: [],
        doublons: [],
        erreursCommunes: [],
        erreursCreneauxSuccessifs: [],
        ecartEquilibrage: null

    };

    const documentCalendrier = {

        anneeUniversitaire: anneeUniversitaire,

        niveauCode: planning.niveauCode,

        semestreCode: semestreCode,

        regimeCode: regimeCode,

        sessionCode: planning.sessionCode,

        sessionLibelle: session.sessionLibelle || "",

        // Toute modification repasse le calendrier en brouillon
        statut: "brouillon",

        // Conserver la date de création si le document existe
        creeLe: documentExistant.exists()
            ? documentExistant.data().creeLe
            : serverTimestamp(),

        modifieLe: serverTimestamp(),

        // Remplacer le planning par sa nouvelle version
        planning: planning,

        // Invalider l'ancien contrôle
        controle: controleInitial

    };

    // -------------------------------------------------
    // Enregistrer ou mettre à jour dans Firestore
    // -------------------------------------------------

    try {

        if (documentExistant.exists()) {

            // Mise à jour du calendrier individuel existant
            await updateDoc(
                referenceCalendrier,
                documentCalendrier
            );

            console.log(
                "✓ Calendrier existant mis à jour :",
                idCalendrier
            );

        } else {

            // Création d'un nouveau calendrier individuel
            await setDoc(
                referenceCalendrier,
                documentCalendrier
            );

            console.log(
                "✓ Nouveau calendrier créé :",
                idCalendrier
            );

        }

        console.log(
            "✓ Calendrier enregistré dans Firestore."
        );

        console.log(
            "Document :",
            idCalendrier
        );

        console.log(
            "Niveau :",
            planning.niveauCode
        );

        console.log(
            "Session :",
            planning.sessionCode
        );

        console.log(
            "Statut : brouillon"
        );

        return {

            id: idCalendrier,

            anneeUniversitaire: anneeUniversitaire,

            niveauCode: planning.niveauCode,

            semestreCode: semestreCode,

            regimeCode: regimeCode,

            sessionCode: planning.sessionCode,

            statut: "brouillon"

        };

    } catch (erreur) {

        console.error(
            "❌ Erreur lors de l'enregistrement du calendrier :",
            erreur
        );

        return null;
    }

    // -------------------------------------------------
    // Enregistrer dans Firestore
    // -------------------------------------------------

    try {

        await setDoc(
            referenceCalendrier,
            documentCalendrier
        );

        console.log("------------------------------------------");

        console.log(
            "✓ CALENDRIER ENREGISTRÉ DANS FIRESTORE"
        );

        console.log(
            "Collection : calendriers"
        );

        console.log(
            "Document :",
            idCalendrier
        );

        console.log(
            "Année universitaire :",
            anneeUniversitaire
        );

        console.log(
            "Niveau :",
            planning.niveauCode
        );

        console.log(
            "Semestre :",
            semestreCode
        );

        console.log(
            "Régime :",
            regimeCode
        );

        console.log(
            "Session :",
            planning.sessionCode
        );

        console.log(
            "Statut : brouillon"
        );

        console.log("------------------------------------------");

        return {

            id:
                idCalendrier,

            anneeUniversitaire:
                anneeUniversitaire,

            niveauCode:
                planning.niveauCode,

            semestreCode:
                semestreCode,

            regimeCode:
                regimeCode,

            sessionCode:
                planning.sessionCode,

            statut:
                "brouillon"

        };

    } catch (erreur) {

        console.error(
            "❌ Erreur lors de l'enregistrement du calendrier :",
            erreur
        );

        return null;
    }

}


// =====================================================
// PUBLIER UN CALENDRIER DANS FIRESTORE
// =====================================================

async function publierCalendrier(idCalendrier) {
    if (!idCalendrier) {
        console.error("Aucun calendrier à publier.");
        return false;
    }

    const validateur =
        window.controleExamens?.verifierPlanningGlobal;

    if (typeof validateur !== "function") {
        console.error(
            "Le module de contrôle n'est pas disponible."
        );
        return false;
    }

    const referenceCalendrier =
        doc(db, "calendriers", idCalendrier);

    try {
        await runTransaction(db, async function (transaction) {
            const documentCalendrier =
                await transaction.get(referenceCalendrier);

            if (!documentCalendrier.exists()) {
                throw new Error("Calendrier introuvable.");
            }

            const donneesCalendrier =
                documentCalendrier.data();

            if (donneesCalendrier.statut !== "brouillon") {
                throw new Error(
                    "Seul un calendrier en brouillon peut être publié."
                );
            }

            const planning = donneesCalendrier.planning;

            // Refuser un planning absent ou sans filières.
            if (
                !planning ||
                !Array.isArray(planning.filieres) ||
                planning.filieres.length === 0 ||
                !Array.isArray(planning.matieresCommunes) ||
                !Array.isArray(planning.matieresSpecifiques)
            ) {
                throw new Error(
                    "Le planning enregistré est absent ou mal structuré."
                );
            }

            const nombreMatieresPrevues =
                planning.matieresCommunes.length +
                planning.matieresSpecifiques.length;

            if (nombreMatieresPrevues === 0) {
                throw new Error(
                    "Le planning ne contient aucune matière prévue."
                );
            }

            const resultatControle = validateur(planning);

            if (
                !resultatControle ||
                resultatControle.valide !== true ||
                resultatControle.matieresPlacees?.valide !== true
            ) {
                throw new Error(
                    "Le planning enregistré est invalide ou incomplet."
                );
            }

            transaction.update(referenceCalendrier, {
                statut: "publie",
                modifieLe: serverTimestamp()
            });
        });

        console.log(
            "Calendrier contrôlé et publié :",
            idCalendrier
        );

        return true;
    } catch (erreur) {
        console.error(
            "Publication refusée ou échouée :",
            erreur
        );

        alert(
            "Le calendrier n'a pas été publié. " +
            "Consultez la console pour connaître la cause."
        );

        return false;
    }
}

// =====================================================
// ACCÈS AUX DONNÉES CHARGÉES POUR LES AUTRES MODULES
// =====================================================

function obtenirDonneesGeneration() {

    return donneesGeneration;

}
// =====================================================
// EXPOSER LES FONCTIONS
// =====================================================
function definirDernierCalendrierEnregistre(idCalendrier) {

    dernierCalendrierEnregistre =
        idCalendrier;

    console.log(
        "✓ Dernier calendrier enregistré défini :",
        dernierCalendrierEnregistre
    );
}

console.log("EXPORT GENERATION.JS ATTEINT");
window.generationExamens = {

    definirDernierCalendrierEnregistre:
    definirDernierCalendrierEnregistre,

    chargerDonnees:
        chargerDonneesGeneration,
    obtenirDonnees:
    obtenirDonneesGeneration,
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

    preparerMatieresPourSession: 
        preparerMatieresPourSession,
    
     trouverPositionPourMatiereSpecifique:
         trouverPositionPourMatiereSpecifique,
    
     calculerChargeDesCreneaux: 
         calculerChargeDesCreneaux,

    placerMatieresSpecifiques:
        placerMatieresSpecifiques,
    construireStructure:
         construireStructureGeneration,
    chargerCalendrier:
        chargerCalendrier,

        enregistrerCalendrier:
        enregistrerCalendrier,


    publierCalendrier:
    publierCalendrier,
    
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

        // -------------------------------------------------
        // BOUTON : GÉNÉRER LE CALENDRIER
        // -------------------------------------------------

        const boutonGenerer =
            document.getElementById(
                "btnGenererCalendrier"
            );

        console.log(
            "🔎 Bouton trouvé :",
            boutonGenerer
        );

        if (!boutonGenerer) {

            console.error(
                "❌ Bouton btnGenererCalendrier introuvable."
            );

            return;
        }

        boutonGenerer.addEventListener(
            "click",
            async function () {

                console.log(
                    "=========================================="
                );

                console.log(
                    "🚀 BOUTON GÉNÉRER LE CALENDRIER"
                );

                console.log(
                    "=========================================="
                );

              // =================================================
            // PARAMÈTRES DE GÉNÉRATION DEPUIS LES FILTRES ADMIN
            // =================================================

const selectNiveau =
    document.getElementById("niveauCalendrierAdmin");

const selectSemestre =
    document.getElementById("semestreCalendrierAdmin");

const selectRegime =
    document.getElementById("regimeCalendrierAdmin");

const selectSession =
    document.getElementById("sessionCalendrierAdmin");

// Récupération des valeurs sélectionnées
const niveauCode = selectNiveau?.value;
const semestreCode = selectSemestre?.value;
const regimeCode = selectRegime?.value;
const sessionCode = selectSession?.value;

// Vérification des sélections
if (
    !niveauCode ||
    !semestreCode ||
    !regimeCode ||
    !sessionCode
) {
    alert(
        "Veuillez sélectionner le niveau, le semestre, le régime et la session."
    );

    return;
}

  // =================================================
// ACTUALISER LES DONNÉES AVANT LA GÉNÉRATION
// =================================================

const moteurPret = await preparerGeneration();

if (!moteurPret) {

    console.error(
        "❌ Impossible d'actualiser les données avant la génération."
    );

    alert(
        "Impossible de récupérer les données actualisées depuis Firestore."
    );

    return;
}              
const donnees = obtenirDonneesGeneration();

console.log(
    "Filières présentes dans les données actualisées :",
    [...new Set(
        donnees.matieres
            .filter(m => m.niveauCode === niveauCode)
            .map(m => m.filiereCode)
    )]
);
                
// Vérification de la cohérence de la session
const session = obtenirSession(sessionCode);

if (
    !session ||
    session.semestreCode !== semestreCode ||
    session.regimeCode !== regimeCode
) {
    alert(
        "La session sélectionnée ne correspond pas au semestre ou au régime choisi."
    );

    return;
}

console.log("Paramètres de génération :", {
    niveauCode,
    semestreCode,
    regimeCode,
    sessionCode
});


                
                // =================================================
                // CONSTRUCTION DE LA MATRICE
                // =================================================

                const planning =
                    construireMatricePlanning(
                        niveauCode,
                        sessionCode
                    );
                          if (!planning) {
                    console.error(
                      "❌ Impossible de construire la matrice du calendrier."
                        );

                     return;
                  }

                // =================================================
                // PLACEMENT DES MATIÈRES COMMUNES
                // =================================================

                placerMatieresCommunes(
                    planning
                );

                console.log(
                    "✓ Matières communes placées."
                );

                console.log(
                    "Planning après placement des matières communes :",
                    planning
                );

                // =================================================
                // PLACEMENT DES MATIÈRES SPÉCIFIQUES
                // =================================================

               console.log("🔎 AVANT PLACEMENT SPÉCIFIQUE");

placerMatieresSpecifiques(planning);

console.log("🔎 APRÈS PLACEMENT SPÉCIFIQUE");

// Vérification finale de l'équilibre global.
verifierEquilibreGlobalCreneaux(planning);

console.log("✓ Matières spécifiques placées.");

console.log(
    "Planning après placement des matières spécifiques :",
    planning
);

                // =================================================
                // CONTRÔLE GLOBAL DU PLANNING
                // =================================================

                const resultatControle =
                    controleExamens.verifierPlanningGlobal(
                        planning
                    );

             console.log(
                "✓ Résultat du contrôle global :\n",
                JSON.stringify(resultatControle, null, 2)
                   );

                // =================================================
                // VÉRIFIER QUE LE PLANNING EST VALIDE
                // =================================================

                if (
    !resultatControle ||
    resultatControle.valide !== true ||
    resultatControle.matieresPlacees?.valide !== true
) {
    console.warn(
        "Enregistrement annulé : planning invalide ou incomplet.",
        resultatControle
    );

    alert(
        "Le calendrier ne peut pas être enregistré : " +
        "des matières sont manquantes, non prévues " +
        "ou d'autres contraintes ne sont pas respectées. " +
        "Consultez le résultat du contrôle."
    );

    return;
}


                // =================================================
                // ENREGISTRER LE CALENDRIER
                // =================================================

                const calendrierEnregistre =
                    await enregistrerCalendrier(
                        planning
                    );

                if (calendrierEnregistre) {

                    dernierCalendrierEnregistre =
                        calendrierEnregistre.id;

                    console.log(
                        "✅ CALENDRIER ENREGISTRÉ COMME BROUILLON"
                    );

                    console.log(
                        "📌 Dernier calendrier enregistré :",
                        dernierCalendrierEnregistre
                    );

                    // -------------------------------------------------
                    // ACTIVER LE BOUTON PUBLIER
                    // -------------------------------------------------

                    const boutonPublier =
                        document.getElementById(
                            "btnPublierCalendrierAdmin"
                        );

                    if (boutonPublier) {

                        boutonPublier.disabled = false;

                        console.log(
                            "✓ Bouton Publier activé."
                        );
                    }

                } else {

                    console.error(
                        "❌ Échec de l'enregistrement du calendrier."
                    );
                }

            }
        );

        console.log(
            "✓ Bouton Générer le calendrier connecté."
        );


        // =================================================
        // BOUTON : PUBLIER LE CALENDRIER
        // =================================================

        const boutonPublier =
            document.getElementById(
                "btnPublierCalendrierAdmin"
            );

        console.log(
            "🔎 Bouton Publier trouvé :",
            boutonPublier
        );

        if (boutonPublier) {

            boutonPublier.addEventListener(
                "click",
                async function () {

                    console.log(
                        "=========================================="
                    );

                    console.log(
                        "📢 BOUTON PUBLIER LE CALENDRIER"
                    );

                    console.log(
                        "=========================================="
                    );

                    // -------------------------------------------------
                    // Vérifier qu'un calendrier existe
                    // -------------------------------------------------

                    if (!dernierCalendrierEnregistre) {

                        console.error(
                            "❌ Aucun calendrier enregistré à publier."
                        );

                        return;
                    }

                    // -------------------------------------------------
                    // Publier
                    // -------------------------------------------------

                    const publicationOK =
                        await publierCalendrier(
                            dernierCalendrierEnregistre
                        );

                    if (publicationOK) {

                        console.log(
                            "🎉 PUBLICATION TERMINÉE AVEC SUCCÈS."
                        );

                        boutonPublier.disabled = true;

                    } else {

                        console.error(
                            "❌ La publication a échoué."
                        );
                    }

                }
            );

            console.log(
                "✓ Bouton Publier connecté."
            );
        }

    }
);



