/* =================================================
   GÉNÉRER LES AFFECTATIONS DE TOUS LES CALENDRIERS
   (écriture réelle dans Firestore + sauvegarde partielle autorisée)
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
                nombreTrouve: calendriersSelectionnes.length
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

            // Réservations externes (hors sélection)
            const reservationsExternes = reservationsHorsSelection(
                snapshot.docs,
                calendriersSelectionnes,
                sallesAmphis,
                effectifs
            );
            const affectationsPrecedentesGlobales = reservationsExternes.slice();

            for (const documentCalendrier of calendriersTries) {
                const donneesCalendrier = documentCalendrier.data();
                const planning = donneesCalendrier.planning;

                if (!planning || !Array.isArray(planning.filieres)) {
                    calendriersEnErreur++;
                    erreurs.push(documentCalendrier.id + " : structure du planning invalide.");
                    continue;
                }

                try {
                    validerPlanningDates(planning);
                } catch (erreur) {
                    calendriersEnErreur++;
                    erreurs.push(documentCalendrier.id + " : " + erreur.message);
                    continue;
                }

                calendriersTraites++;

                const resultat = window.affecterLocauxFixes(
                    planning,
                    sallesAmphis,
                    effectifs,
                    affectationsPrecedentesGlobales,
                    donneesCalendrier.anneeUniversitaire
                );

                if (!resultat || !Array.isArray(resultat.affectations)) {
                    calendriersEnErreur++;
                    erreurs.push(documentCalendrier.id + " : résultat d'affectation invalide.");
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
                let auMoinsUneAffectation = false;

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
                            " : affectation impossible ou manquante."
                        );
                        // On conserve l'ancienne affectation si elle existait
                        return filiere;
                    }

                    auMoinsUneAffectation = true;

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

                // On prépare l'enregistrement dès qu'au moins une filière a été affectée
                // (ou même si aucune n'a changé, pour pouvoir valider globalement)
                const planningMisAJour = {
                    ...planning,
                    filieres: filieresMisesAJour
                };

                calendriersAEnregistrer.push({
                    id: documentCalendrier.id,
                    planning: planningMisAJour,
                    aDesAffectations: auMoinsUneAffectation
                });

                // On n'ajoute aux affectations précédentes que les réussites
                for (const aff of resultat.affectations) {
                    if (
                        !aff.succes ||
                        !Array.isArray(aff.locaux) ||
                        aff.locaux.length === 0
                    ) {
                        continue;
                    }

                    const filiereComplete = filieresMisesAJour.find(function (f) {
                        return f.filiereCode === aff.filiereCode;
                    });

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

            // =================================================
            // VALIDATION GLOBALE (informatif, ne bloque plus l'écriture)
            // =================================================
            const anomaliesGlobales = [];

            if (calendriersEnErreur > 0) {
                anomaliesGlobales.push(
                    "Au moins un calendrier comporte une ou plusieurs filières non affectées."
                );
            }

            try {
                anomaliesGlobales.push(...verifierAffectationsPartagees(
                    calendriersAEnregistrer.map(e => ({
                        ...e,
                        anneeUniversitaire: calendriersSelectionnes
                            .find(d => d.id === e.id)
                            .data().anneeUniversitaire
                    })),
                    sallesAmphis,
                    effectifs,
                    reservationsExternes
                ));
            } catch (errValidation) {
                anomaliesGlobales.push("Erreur lors de la validation globale : " + errValidation.message);
            }

            console.table(anomaliesGlobales.map(function (m) {
                return { anomalie: m };
            }));

            // =================================================
            // ÉCRITURE RÉELLE DANS FIRESTORE
            // =================================================
            if (statut) {
                statut.textContent = "Enregistrement des affectations en cours...";
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

            // =================================================
            // BILAN FINAL
            // =================================================
            const bilan =
                "Calendriers correspondant aux filtres : " +
                calendriersSelectionnes.length +
                " | Traités : " + calendriersTraites +
                " | Enregistrés : " + calendriersEnregistres +
                " | En erreur (partiel ou total) : " + calendriersEnErreur;

            if (statut) {
                statut.textContent =
                    bilan +
                    (anomaliesGlobales.length > 0
                        ? " | Anomalies signalées : " + anomaliesGlobales.length
                        : " | Aucune anomalie détectée.");
            }

            if (resume) {
                const lignesResume = [bilan];

                if (erreurs.length > 0) {
                    lignesResume.push("Erreurs d'affectation :", ...erreurs);
                }

                if (anomaliesGlobales.length > 0) {
                    lignesResume.push("Anomalies détectées :", ...anomaliesGlobales);
                }

                resume.textContent = lignesResume.join("\n");
            }

            console.log("Bilan des affectations :", {
                total: calendriersSelectionnes.length,
                traites: calendriersTraites,
                enregistres: calendriersEnregistres,
                erreurs: erreurs,
                anomalies: anomaliesGlobales
            });

        } catch (erreur) {
            console.error("Erreur lors de la génération des affectations :", erreur);
            if (statut) {
                statut.textContent = "Échec : " + erreur.message;
            }
            if (resume) {
                resume.textContent = "Échec de la génération : " + erreur.message;
            }
        } finally {
            btnGenererAffectations.disabled = false;
        }
    });
}
