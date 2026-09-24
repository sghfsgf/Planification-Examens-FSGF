// =====================================================
// FIREBASE CONFIGURATION
// Planification des examens - FSGF
// =====================================================

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";


// =====================================================
// CONFIGURATION DU PROJET FIREBASE
// =====================================================

const firebaseConfig = {

    apiKey: "AIzaSyCdnlH_EOawvaeT-HuBvmW8W5n7VnnZzkk",

    authDomain:
        "planification-examens-fsgf.firebaseapp.com",

    projectId:
        "planification-examens-fsgf",

    storageBucket:
        "planification-examens-fsgf.firebasestorage.app",

    messagingSenderId:
        "1085226735133",

    appId:
        "1:1085226735133:web:31033402476c50dd31d8f4"

};


// =====================================================
// INITIALISATION FIREBASE
// =====================================================

const app =
    initializeApp(firebaseConfig);


// =====================================================
// EXPORT
// =====================================================

export { app };
