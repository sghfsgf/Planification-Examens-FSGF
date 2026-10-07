// =================================================
// AFFECTATION DES SALLES / AMPHIS
// =================================================

import { app } from "../firebase-config.js";

import {
    getFirestore,
    getDocs,
    collection
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";


// =================================================
// FIRESTORE
// =================================================

const db =
    getFirestore(app);


console.log(
    "✓ affectation-salles.js chargé."
);

console.log(
    "✓ Firestore initialisé pour l'affectation des salles."
);
