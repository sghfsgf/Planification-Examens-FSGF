
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

     
const calendriers = resultat.docs
    .map(document => ({
        id: document.id,
        ...document.data()
    }))
    .filter(calendrier => calendrier.statut === "publie");

       console.log(
    "✅ Nombre de calendriers publiés récupérés :",
    calendriers.length
);
console.table(
    calendriers.map(calendrier => ({
        id: calendrier.id,
        anneeUniversitaire: calendrier.anneeUniversitaire ?? "(absente)",
        semestreCode: calendrier.semestreCode ?? "(absent)",
        regimeCode: calendrier.regimeCode ?? "(absent)",
        sessionCode: calendrier.sessionCode ?? "(absente)",
        nombreFilieres: calendrier.planning?.filieres?.length ?? 0,
        statut: calendrier.statut ?? "(absent)"
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

// =====================================================
// ÉTAPE 2 — FILTRE ANNÉE UNIVERSITAIRE
// =====================================================

const selectAnneeRecap = document.getElementById("anneeRecap");

function initialiserFiltreAnneeRecap(calendriers) {
    if (!selectAnneeRecap) {
        console.error("❌ Élément HTML #anneeRecap introuvable.");
        return;
    }

    // Réinitialiser le menu
    selectAnneeRecap.innerHTML =
        '<option value="">Choisir une année universitaire</option>';

    // Récupérer les années présentes dans les calendriers publiés
    const annees = [
        ...new Set(
            calendriers
                .map(calendrier => calendrier.anneeUniversitaire)
                .filter(Boolean)
        )
    ].sort();

    // Ajouter les années au menu
    annees.forEach(annee => {
        const option = document.createElement("option");
        option.value = annee;
        option.textContent = annee;
        selectAnneeRecap.appendChild(option);
    });

    console.log("✅ Années universitaires disponibles :", annees);
}

// =====================================================
// ÉTAPE 3 — FILTRE SEMESTRE
// =====================================================

const selectSemestreRecap = document.getElementById("semestreRecap");

function initialiserFiltreSemestreRecap(calendriers, anneeSelectionnee) {
    if (!selectSemestreRecap) {
        console.error("❌ Élément HTML #semestreRecap introuvable.");
        return;
    }

    selectSemestreRecap.innerHTML =
        '<option value="">Choisir un semestre</option>';

    selectSemestreRecap.disabled = true;

    if (!anneeSelectionnee) {
        return;
    }

    const semestres = [
        ...new Set(
            calendriers
                .filter(
                    calendrier =>
                        calendrier.anneeUniversitaire === anneeSelectionnee
                )
                .map(calendrier => calendrier.semestreCode)
                .filter(Boolean)
        )
    ].sort();

    semestres.forEach(semestre => {
        const option = document.createElement("option");
        option.value = semestre;
        option.textContent = semestre;
        selectSemestreRecap.appendChild(option);
    });

    selectSemestreRecap.disabled = semestres.length === 0;

    console.log(
        "✅ Semestres disponibles pour",
        anneeSelectionnee,
        ":",
        semestres
    );
}

// =====================================================
// EXÉCUTION DU CHARGEMENT
// =====================================================

chargerCalendriersRecap().then(calendriers => {
    initialiserFiltreAnneeRecap(calendriers);

    // Réinitialiser le semestre lorsque l'année change
    selectAnneeRecap.addEventListener("change", () => {
        initialiserFiltreSemestreRecap(
            calendriers,
            selectAnneeRecap.value
        );
    });
});

