
// =====================================================
// RÉCAPITULATIF — ÉTAPE 1
// Lecture des calendriers existants dans Firestore
// =====================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Initialisation de Firestore
const db = getFirestore(app);

// Référence à la collection des calendriers
const calendriersRef = collection(db, "calendriers");

// Chargement des calendriers existants
async function chargerCalendriersRecap() {
    try {
        console.log("📋 Début du chargement des calendriers du récapitulatif.");

        const resultat = await getDocs(calendriersRef);

        const calendriers = resultat.docs.map(document => ({
            id: document.id,
            ...document.data()
        }));

        console.log("✅ Nombre de calendriers récupérés :", calendriers.length);

        console.table(
            calendriers.map(calendrier => ({
                id: calendrier.id,
                anneeUniversitaire: calendrier.anneeUniversitaire,
                semestreCode: calendrier.semestreCode,
                regimeCode: calendrier.regimeCode,
                sessionCode: calendrier.sessionCode
            }))
        );

        return calendriers;

    } catch (erreur) {
        console.error(
            "❌ Erreur lors du chargement des calendriers du récapitulatif :",
            erreur
        );

        return [];
    }
}

// Exécution du chargement
chargerCalendriersRecap();

