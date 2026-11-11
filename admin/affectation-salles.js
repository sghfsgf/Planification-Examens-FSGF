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
    catalogueLocauxValide(sallesAmphis);
    if (typeof effectif === "boolean" || effectif == null || String(effectif).trim()==="" || !Number.isInteger(Number(effectif)) || Number(effectif)<=0) throw new Error("Effectif invalide.");

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
    cleCreneauAffectation({date, creneauOrdre});
    if (!affectations || affectations.length === 0) {
        return true;
    }

    const conflit = affectations.some(function (affectation) {
        return (
            affectation.codeLocal === codeLocal &&
            memeCreneau(affectation, {date, creneauOrdre}) &&
            Number(affectation.creneauOrdre) === Number(creneauOrdre)
        );
    });

    return !conflit;
}

window.localEstDisponiblePourCreneau = localEstDisponiblePourCreneau;

// =================================================
// CONTRÔLE DES CONFLITS ENTRE CELLULES (dates + créneaux)
// =================================================

// Validation partagée : génération, contrôle et réservations externes.
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
        const y=Number(m[1]), mo=Number(m[2]), d=Number(m[3]);
        const verif=new Date(0);verif.setUTCFullYear(y,mo-1,d);verif.setUTCHours(0,0,0,0);
        if (verif.getUTCFullYear()!==y || verif.getUTCMonth()!==mo-1 || verif.getUTCDate()!==d) throw new Error("Jour civil invalide.");
        if (!m[4]) return m[1]+"-"+m[2]+"-"+m[3];
        date=new Date(valeur);
    } else throw new Error("Format de date non pris en charge.");
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error("Date invalide.");
    // Même convention que generation.js : jour civil dans le fuseau du navigateur.
    return String(date.getFullYear()).padStart(4,"0")+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
}
function cleCreneauAffectation(cellule) {
    if (!cellule || cellule.creneauOrdre == null || cellule.creneauOrdre === "" || typeof cellule.creneauOrdre === "boolean") throw new Error("Créneau absent ou invalide.");
    const ordre=Number(cellule.creneauOrdre);
    if (!Number.isInteger(ordre) || ordre<=0) throw new Error("Ordre de créneau invalide.");
    return jourCivilAffectation(cellule.date)+"|"+ordre;
}
function memeCreneau(celluleA,celluleB) { return cleCreneauAffectation(celluleA)===cleCreneauAffectation(celluleB); }
function catalogueLocauxValide(salles) {
    if (!Array.isArray(salles)) throw new Error("Catalogue des locaux invalide.");
    const codes=new Set();
    salles.forEach(s=>{
        if (!s || typeof s.code!=="string" || !s.code.trim() || s.code!==s.code.trim()) throw new Error("Code local vide ou non normalisé.");
        if(codes.has(s.code)) throw new Error("Code local dupliqué : "+s.code);
        codes.add(s.code);
        if (typeof s.capacite==="boolean" || s.capacite==null || String(s.capacite).trim()==="" || !Number.isInteger(Number(s.capacite)) || Number(s.capacite)<=0) throw new Error("Capacité invalide : "+s.code);
    });
}
function codesLocauxStricts(amphis) {
    if (!Array.isArray(amphis)) throw new Error("Liste de locaux invalide.");
    const codes=amphis.map(l=> typeof l==="string"?l:(l && (l.code || l.localCode)));
    const vus=new Set();
    codes.forEach(c=>{if(typeof c!=="string" || !c.trim() || c!==c.trim()) throw new Error("Code d'affectation invalide.");if(vus.has(c)) throw new Error("Local affecté en double : "+c);vus.add(c);});
    return codes;
}
function validerPlanningDates(planning) {
    if (!planning || !Array.isArray(planning.filieres) || !planning.filieres.length || !planning.niveauCode) throw new Error("Structure du planning invalide.");
    const vus=new Set();
    planning.filieres.forEach(f=>{
        if (!f || !f.filiereCode || vus.has(f.filiereCode) || !Array.isArray(f.cellules)) throw new Error("Filière absente, dupliquée ou cellules invalides.");
        if(f.niveauCode!=null && f.niveauCode!==planning.niveauCode) throw new Error("Niveau de filière contradictoire avec le planning : "+f.filiereCode);
        vus.add(f.filiereCode);
        f.cellules.forEach(c=>{if(!c || typeof c.estOccupee!=="boolean") throw new Error("Cellule invalide."); if(c.estOccupee) cleCreneauAffectation(c);});
    });
}
// Copie en mémoire : le niveau parent fait autorité, sans mutation du document source.
function filiereAvecNiveau(filiere,niveauCode) {
    if(!filiere || !niveauCode || (filiere.niveauCode!=null && filiere.niveauCode!==niveauCode)) throw new Error("Niveau de filière contradictoire ou absent du planning.");
    return {...filiere,niveauCode};
}
function lireEffectifStrict(effectifs,annee,niveau,filiere) {
    if(typeof annee!=="string" || !annee.trim()) throw new Error("Année universitaire explicite requise.");
    const lignes=effectifs.filter(l=>l && l.anneeUniversitaire===annee && l.niveauCode===niveau && l.filiereCode===filiere);
    if(lignes.length!==1) throw new Error("effectif absent ou ambigu pour "+annee+" / "+niveau+" / "+filiere);
    const v=lignes[0].effectif;
    if(typeof v==="boolean" || v==null || String(v).trim()==="" || !Number.isInteger(Number(v)) || Number(v)<=0) throw new Error("Effectif invalide : "+filiere);
    return Number(v);
}
// Chaque répartition est fixe pour tous les examens de la filière.
function repartitionValidee(filiere,locaux,effectif,salles) {
    const r=filiere.repartitionLocaux;
    if(!Array.isArray(r) || r.length!==locaux.length) throw new Error("Répartition par local absente ou incomplète.");
    const vus=new Set();let total=0;
    r.forEach(a=>{
        if(!a || !locaux.includes(a.codeLocal) || vus.has(a.codeLocal))throw new Error("Code de répartition invalide ou dupliqué.");
        vus.add(a.codeLocal);
        if(typeof a.effectif==="boolean" || !Number.isInteger(a.effectif) || a.effectif<=0)throw new Error("Effectif par local invalide.");
        const s=salles.find(s=>s.code===a.codeLocal);
        if(!s || a.effectif>Number(s.capacite))throw new Error("Répartition supérieure à la capacité du local.");
        total+=a.effectif;
    });
    if(total!==effectif)throw new Error("Somme de la répartition différente de l'effectif annuel.");
    return r.map(a=>({codeLocal:a.codeLocal,effectif:a.effectif}));
}
function clesExamens(filiere) {
    return [...new Set(filiere.cellules.filter(c=>c.estOccupee).map(c=>cleCreneauAffectation(c)))];
}
function capaciteRestanteLocal(filiere,code,salles,affectations) {
    const capacite=Number(salles.find(s=>s.code===code).capacite);
    let restant=capacite;
    for(const cle of clesExamens(filiere)) {
        let utilise=0;
        for(const a of affectations) {
            if(!a.locaux.includes(code) || !clesExamens(a.filiere).includes(cle))continue;
            if(!filiere.niveauCode || !a.filiere.niveauCode)throw new Error("Niveau canonique de réservation absent.");
            if(filiere.niveauCode!==a.filiere.niveauCode)return 0;
            const r=a.repartitionLocaux || a.filiere.repartitionLocaux;
            if(!Array.isArray(r))throw new Error("Répartition de réservation absente.");
            utilise+=r.find(x=>x.codeLocal===code)?.effectif || 0;
        }
        restant=Math.min(restant,capacite-utilise);
    }
    return Math.max(0,restant);
}
function reservationsHorsSelection(documents,selection,salles,effectifs=[]) {
    const ids=new Set(selection.map(d=>d.id)), resultat=[];
    for(const docu of documents) {
        if(ids.has(docu.id))continue;
        const donnees=docu.data(),p=donnees.planning;
        if(!p || !Array.isArray(p.filieres)) {
            if(p!=null)throw new Error(docu.id+" : planning externe inexploitable.");
            continue;
        }
        for(const sourceFiliere of p.filieres) {
            const f=filiereAvecNiveau(sourceFiliere,p.niveauCode);
            if(!f)throw new Error(docu.id+" : filière externe invalide.");
            if(f.amphis==null || (Array.isArray(f.amphis)&&f.amphis.length===0))continue;
            const locaux=codesLocauxStricts(f.amphis);
            validerPlanningDates({niveauCode:p.niveauCode,filieres:[f]});
            locaux.forEach(code=>{if(!salles.some(s=>s.code===code))throw new Error(docu.id+" : local réservé inconnu : "+code);});
            let repartitionLocaux,prudente=false;
            if(f.repartitionLocaux!=null) {
                const effectif=lireEffectifStrict(effectifs,donnees.anneeUniversitaire,p.niveauCode,f.filiereCode);
                repartitionLocaux=repartitionValidee(f,locaux,effectif,salles);
            } else {
                // Monolocal historique : reconstruction exacte seulement si cohorte identifiable.
                let effectif=null;
                if(locaux.length===1) {
                    try {effectif=lireEffectifStrict(effectifs,donnees.anneeUniversitaire,p.niveauCode,f.filiereCode);} catch(_) { /* Réserver le local entier, sans deviner l'année ni l'effectif. */ }
                    if(effectif!=null && effectif>Number(salles.find(s=>s.code===locaux[0]).capacite))throw new Error(docu.id+" : capacité de réservation insuffisante.");
                }
                prudente=effectif==null;
                repartitionLocaux=locaux.map(code=>({codeLocal:code,effectif:effectif ?? Number(salles.find(s=>s.code===code).capacite)}));
            }
            resultat.push({calendrierId:docu.id,filiere:f,locaux,repartitionLocaux,reservationPrudente:prudente});
        }
    }
    return resultat;
}
function verifierAffectationsPartagees(elements,salles,effectifs,reservations=[]) {
    catalogueLocauxValide(salles);
    const anomalies=[],affectations=[];
    elements.forEach(e=>{
        try {validerPlanningDates(e.planning);}catch(err){anomalies.push(e.id+" : "+err.message);return;}
        e.planning.filieres.forEach(sourceFiliere=>{
            const f=filiereAvecNiveau(sourceFiliere,e.planning.niveauCode);
            try {
                const locaux=codesLocauxStricts(f.amphis);
                if(!locaux.length)throw new Error("Aucun local affecté.");
                const effectif=lireEffectifStrict(effectifs,e.anneeUniversitaire,e.planning.niveauCode,f.filiereCode);
                locaux.forEach(code=>{const s=salles.find(s=>s.code===code);if(!s)throw new Error("Local inconnu : "+code);if(s.disponible!=="Oui")throw new Error("Local indisponible : "+code);});
                // Compatibilité historique monolocal ; multilocaux doivent être régénérés.
                let repartitionLocaux,reservationPrudente=false;
                if(f.repartitionLocaux!=null)repartitionLocaux=repartitionValidee(f,locaux,effectif,salles);
                else if(locaux.length===1)repartitionLocaux=[{codeLocal:locaux[0],effectif}];
                else {
                    const capacite=locaux.reduce((s,c)=>s+Number(salles.find(x=>x.code===c).capacite),0);
                    if(capacite<effectif)throw new Error("Capacité insuffisante.");
                    repartitionLocaux=locaux.map(c=>({codeLocal:c,effectif:Number(salles.find(x=>x.code===c).capacite)}));
                    reservationPrudente=true;
                }
                repartitionLocaux.forEach(r=>{if(r.effectif>Number(salles.find(s=>s.code===r.codeLocal).capacite))throw new Error("Capacité insuffisante.");});
                affectations.push({calendrierId:e.id,filiere:f,locaux,repartitionLocaux,reservationPrudente});
            }catch(err){anomalies.push(e.id+" / "+f.filiereCode+" : "+err.message);}
        });
    });
    const charges=new Map();
    [...reservations,...affectations].forEach(a=>{
        clesExamens(a.filiere).forEach(cle=>{
            a.repartitionLocaux.forEach(r=>{
                const k=r.codeLocal+"|"+cle;
                if(!charges.has(k))charges.set(k,{code:r.codeLocal,cle,total:0,selection:false,filieres:[],niveaux:new Set()});
                const charge=charges.get(k);charge.niveaux.add(a.filiere.niveauCode);charge.total+=r.effectif;charge.selection ||= affectations.includes(a);charge.filieres.push(a.calendrierId+"/"+a.filiere.filiereCode);
            });
        });
    });
    charges.forEach(c=>{if(c.selection && (c.niveaux.size!==1 || c.niveaux.has(undefined)))anomalies.push("Partage entre niveaux différents interdit : "+c.code+" / "+c.cle);if(c.selection && c.total>Number(salles.find(s=>s.code===c.code).capacite))anomalies.push("Capacité cumulée dépassée : "+c.code+" / "+c.cle+" — "+c.total+" étudiants ("+c.filieres.join(", ")+")");});
    return anomalies;
}

function validerReservationRepartition(prec,salles) {
    const r=prec.repartitionLocaux || prec.filiere.repartitionLocaux;
    if(!Array.isArray(r) || r.length!==prec.locaux.length)throw new Error("Répartition de réservation absente ou incomplète.");
    const codes=new Set();
    r.forEach(a=>{
        if(!a || !prec.locaux.includes(a.codeLocal) || codes.has(a.codeLocal) || !Number.isInteger(a.effectif) || a.effectif<=0)throw new Error("Répartition de réservation invalide.");
        codes.add(a.codeLocal);
        const local=salles.find(s=>s.code===a.codeLocal);
        if(!local || a.effectif>Number(local.capacite))throw new Error("Réservation supérieure à la capacité ou local inconnu.");
    });
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

    // Même niveau : pas de conflit selon la règle métier.
    if (
        filiereA.niveauCode === filiereB.niveauCode
    ) {
        continue;
    }

            const examensA = (filiereA.cellules || []).filter(function (c) {
                return c.estOccupee;
            });

            const examensB = (filiereB.cellules || []).filter(function (c) {
                return c.estOccupee;
            });

            // Rechercher tous les créneaux communs aux deux filières.
            for (let a = 0; a < examensA.length; a++) {
                for (let b = 0; b < examensB.length; b++) {
                    const celluleA = examensA[a];
                    const celluleB = examensB[b];

                    if (memeCreneau(celluleA, celluleB)) {
                        // Éviter de déclarer deux fois le même conflit.
                        const dejaDeclare = conflits.some(function (conflit) {
                            return (
                                conflit.filiereA === filiereA.filiereCode &&
                                conflit.filiereB === filiereB.filiereCode &&
                                memeCreneau(
                                    { date: conflit.date, creneauOrdre: conflit.creneauOrdre },
                                    celluleA
                                )
                            );
                        });

                        if (!dejaDeclare) {
                            conflits.push({
                                filiereA: filiereA.filiereCode,
                                filiereB: filiereB.filiereCode,
                                date: celluleA.date,
                                creneauOrdre: celluleA.creneauOrdre
                            });
                        }
                    }
                }
            }
        }
    }

    return conflits;
}

function afficherConflitsFilieres(conflits) {
    const message = document.getElementById(
        "messageConflitsFilieres"
    );
    const tableau = document.getElementById(
        "tableConflitsFilieres"
    );
    const corps = document.getElementById(
        "corpsTableConflitsFilieres"
    );

    if (!message || !tableau || !corps) {
        console.warn(
            "Le tableau des conflits est introuvable dans le HTML."
        );
        return;
    }

    corps.replaceChildren();

    if (!conflits || conflits.length === 0) {
        tableau.hidden = true;
        message.textContent = "Aucun conflit détecté.";
        return;
    }

    conflits.forEach(function (conflit) {
        const ligne = document.createElement("tr");

        let dateTexte = "Date inconnue";
        const date = conflit.date;

        if (date) {
            let dateObjet = null;

            if (typeof date.toDate === "function") {
                dateObjet = date.toDate();
            } else if (date instanceof Date) {
                dateObjet = date;
            } else if (typeof date.seconds === "number") {
                dateObjet = new Date(date.seconds * 1000);
            }

            if (dateObjet && !isNaN(dateObjet.getTime())) {
                dateTexte = dateObjet.toLocaleDateString("fr-FR");
            }
        }

        [
            conflit.filiereA,
            conflit.filiereB,
            dateTexte,
            "Créneau " + conflit.creneauOrdre
        ].forEach(function (valeur) {
            const cellule = document.createElement("td");
            cellule.textContent = String(valeur ?? "");
            ligne.appendChild(cellule);
        });

        corps.appendChild(ligne);
    });

    message.textContent =
        conflits.length + " conflit(s) détecté(s).";

    tableau.hidden = false;
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
    catalogueLocauxValide(sallesAmphis);
    if (typeof effectif === "boolean" || effectif == null || String(effectif).trim()==="" || !Number.isInteger(Number(effectif)) || Number(effectif)<=0) throw new Error("Effectif invalide.");
    validerPlanningDates({niveauCode: filiere.niveauCode, filieres:[filiere]});
    const filiereCode = filiere.filiereCode;

    const courantes=Array.isArray(affectationsFilieresCourantes) ? affectationsFilieresCourantes : Array.from(affectationsFilieresCourantes?.values?.() || []);
    const toutes=[...(affectationsPrecedentes || []),...courantes];
    toutes.forEach(a=>{codesLocauxStricts(a.locaux);validerPlanningDates({niveauCode:a.filiere.niveauCode,filieres:[a.filiere]});validerReservationRepartition(a,sallesAmphis);});
    // Partage autorisé uniquement sur la capacité réellement restante par local/créneau.
    const locauxDisponibles=sallesAmphis.filter(s=>s.disponible==="Oui").map(s=>({...s,capaciteRestante:capaciteRestanteLocal(filiere,s.code,sallesAmphis,toutes)})).filter(s=>s.capaciteRestante>0);

    // 2. Rechercher toutes les combinaisons compatibles suffisantes.
    const combinaisons = [];

 
function rechercherCombinaisons(debut,combinaison,capaciteDisponible) {
    if(combinaison.length && capaciteDisponible>=effectif) {
        // Répartition déterministe et sûre ; 1 étudiant minimum dans chaque local retenu.
        let restant=Number(effectif);
        const repartitionLocaux=[];
        for(let j=0;j<combinaison.length;j++) {
            const s=locauxDisponibles.find(s=>s.code===combinaison[j]);
            const quantite=Math.min(s.capaciteRestante,restant-(combinaison.length-j-1));
            if(quantite<=0)return;
            repartitionLocaux.push({codeLocal:s.code,effectif:quantite});restant-=quantite;
        }
        if(restant!==0)return;
        const capaciteTotale=combinaison.reduce((s,c)=>s+Number(sallesAmphis.find(x=>x.code===c).capacite),0);
        combinaisons.push({locaux:combinaison.slice(),capaciteTotale,capaciteDisponible,tauxOccupation:effectif/capaciteTotale,repartitionLocaux});
        return;
    }
    for(let i=debut;i<locauxDisponibles.length;i++) {
        combinaison.push(locauxDisponibles[i].code);
        rechercherCombinaisons(i+1,combinaison,capaciteDisponible+locauxDisponibles[i].capaciteRestante);
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
        // Option C : moins de locaux, puis capacité suffisante minimale.
        if (a.locaux.length !== b.locaux.length) {
            return a.locaux.length - b.locaux.length;
        }

        // Priorité 2 : capacité totale minimale.
        return a.capaciteTotale - b.capaciteTotale;
    });

    // 4. Préparer la meilleure combinaison pour rester compatible
    // avec les appels qui utilisent encore les propriétés classiques.
    const meilleure = combinaisons[0];
    const tauxOccupation = meilleure.tauxOccupation;

    const message = meilleure.locaux.length === 1
        ? "Un seul local suffit : capacité suffisante, priorité au minimum de locaux."
        : "Plusieurs locaux : capacité suffisante, priorité au minimum de locaux.";

    return {
        succes: true,
        locaux: meilleure.locaux,
        capaciteTotale: meilleure.capaciteTotale,
        tauxOccupation: tauxOccupation,
        repartitionLocaux: meilleure.repartitionLocaux,
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

    try {
        catalogueLocauxValide(sallesAmphis);
        validerPlanningDates(planning);
        planning={...planning,filieres:planning.filieres.map(f=>filiereAvecNiveau(f,planning.niveauCode))};
        affectationsPrecedentes.forEach(prec=>{
            codesLocauxStricts(prec.locaux);
            validerPlanningDates({niveauCode:prec.filiere.niveauCode,filieres:[prec.filiere]});
            validerReservationRepartition(prec,sallesAmphis);
            prec.locaux.forEach(code=>{if(!sallesAmphis.some(s=>s.code===code))throw new Error("Local réservé inconnu : "+code);});
        });
        if (!anneeUniversitaire) throw new Error("Année universitaire explicite requise.");
    } catch (erreur) {
        return {succes:false, affectations:[], message:erreur.message};
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
        let effectif;
        try {effectif=lireEffectifStrict(effectifs,anneeUniversitaire,planning.niveauCode,filiere.filiereCode);}
        catch(erreur){return {filiere, valide:false,effectif:null,message:erreur.message};}

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
                filiere: filiere,
                repartitionLocaux: combinaison.repartitionLocaux.map(a=>({...a})),
                capaciteTotale: combinaison.capaciteTotale,
                tauxOccupation: combinaison.tauxOccupation,
                message: combinaison.locaux.length===1
                    ? "Un local : capacité résiduelle suffisante."
                    : "Plusieurs locaux : capacité résiduelle suffisante."
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
            const conflitsDetectes = [];
            const calendriersAEnregistrer = [];

            // Classement
            const calendriersTries = classerCalendriersPourAffectation(calendriersSelectionnes);

            // Accumuler les affectations réussies des calendriers précédents
            const reservationsExternes = reservationsHorsSelection(snapshot.docs, calendriersSelectionnes, sallesAmphis,effectifs);
            const affectationsPrecedentesGlobales = reservationsExternes.slice();

               
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

    try {validerPlanningDates(planning);} catch(erreur) {
        calendriersEnErreur++; erreurs.push(documentCalendrier.id+" : "+erreur.message); continue;
    }
    // Partage simultané réservé au même niveau ; capacité cumulée vérifiée ensuite.

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

            // Préserver la filière source et ses anciens locaux en cas d'échec.
            return filiere;
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
                filiere: filiereAvecNiveau(filiereComplete,planning.niveauCode),
                locaux: aff.locaux,
                repartitionLocaux: aff.repartitionLocaux
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

            if (calendriersAEnregistrer.length !== calendriersSelectionnes.length) {
                anomaliesGlobales.push(
                    "Tous les calendriers sélectionnés n'ont pas été préparés (" +
                    calendriersAEnregistrer.length + " / " + calendriersSelectionnes.length + ")."
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
            anomaliesGlobales.push(...verifierAffectationsPartagees(
                calendriersAEnregistrer.map(e=>({...e, anneeUniversitaire:calendriersSelectionnes.find(d=>d.id===e.id).data().anneeUniversitaire})),
                sallesAmphis,effectifs,reservationsExternes
            ));
            console.table(anomaliesGlobales.map(function (m) {
                return { anomalie: m };
            }));

if (anomaliesGlobales.length > 0) {
    const message =
        "Enregistrement bloqué : " + anomaliesGlobales.length +
        " anomalie(s). Enregistrés : 0. Anciennes affectations inchangées.";

    if (statut) statut.textContent = message;
    if (resume) {
        resume.textContent = [
            message,
            "Erreurs d'affectation :",
            ...erreurs,
            "Anomalies détectées :",
            ...anomaliesGlobales
        ].join("\n");
    }

    console.warn(message, { erreurs, anomaliesGlobales });
    return;
}

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
    const bouton=document.getElementById("btnControlerAffectations");
    if(!bouton || bouton.dataset.controleInstalle==="oui")return;
    bouton.dataset.controleInstalle="oui";
    bouton.addEventListener("click",async function(){
        const statut=document.getElementById("statutAffectationSalles"),resume=document.getElementById("resumeAffectationSalles");
        bouton.disabled=true;
        try {
            const filtres=["anneeAffectationSalles","semestreAffectationSalles","regimeAffectationSalles","sessionAffectationSalles"].map(id=>document.getElementById(id)?.value);
            if(filtres.some(v=>!v))throw new Error("Veuillez sélectionner l'année, le semestre, le régime et la session.");
            const donnees=await window.generationExamens.obtenirDonnees();
            const salles=donnees.sallesAmphis||[],effectifs=donnees.effectifs||[];
            catalogueLocauxValide(salles);
            const resultat=await getDocs(collection(db,"calendriers"));
            const selection=resultat.docs.filter(d=>["anneeUniversitaire","semestreCode","regimeCode","sessionCode"].every((k,i)=>String(d.data()[k]??"").trim()===filtres[i]));
            if(!selection.length)throw new Error("Aucun calendrier trouvé pour les filtres sélectionnés.");
            const externes=reservationsHorsSelection(resultat.docs,selection,salles,effectifs);
            const anomalies=verifierAffectationsPartagees(selection.map(d=>({id:d.id,...d.data()})),salles,effectifs,externes);
            console.table(anomalies.map(probleme=>({probleme})));
            if(statut)statut.textContent=anomalies.length ? "Contrôle terminé : "+anomalies.length+" anomalie(s) détectée(s)." : "Contrôle terminé : aucune anomalie détectée.";
            if(resume)resume.textContent="Calendriers correspondant aux filtres : "+selection.length+" | Réservations externes : "+externes.length+" | Anomalies : "+anomalies.length+(anomalies.length?"\n"+anomalies.join("\n"):"");
        }catch(erreur){console.error(erreur);if(statut)statut.textContent="Échec : "+erreur.message;if(resume)resume.textContent="Contrôle impossible : "+erreur.message;}
        finally{bouton.disabled=false;}
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
