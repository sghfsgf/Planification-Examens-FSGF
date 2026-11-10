const PRINT_CSS = "body { font-family: Arial, sans-serif; }\n@page {\n    size: A3 landscape;\n    margin: 10mm;\n}\n\n@media print {\n   /* Masquer uniquement les éléments inutiles à l'impression */\n.menu-principal,\n.pied-page,\nbutton,\n#accueil,\n.aide-calendrier {\n    display: none !important;\n}\n\n    /* Afficher uniquement la section des calendriers */\n    body > * {\n        visibility: hidden;\n    }\n\n    #calendriers,\n    #calendriers * {\n        visibility: visible;\n    }\n\n    #calendriers {\n        display: block !important;\n        position: absolute;\n        left: 0;\n        top: 0;\n        width: 100% !important;\n        margin: 0 !important;\n        padding: 0 !important;\n    }\n\n    /* Page */\n    html,\n    body {\n        width: 100%;\n        margin: 0;\n        padding: 0;\n        background: #ffffff !important;\n        color: #000000 !important;\n    }\n\n    /* Contenu principal */\n    main,\n    .espace-travail {\n        width: 100% !important;\n        max-width: 100% !important;\n        margin: 0 !important;\n        padding: 0 !important;\n    }\n\n    /* Carte */\n    .carte {\n        width: 100% !important;\n        margin: 0 !important;\n        padding: 0 !important;\n        border: none !important;\n        box-shadow: none !important;\n    }\n\n/* Masquer les filtres sur le document imprimé */\n#calendriers .filtres-calendrier {\n    display: none !important;\n}\n\n    /* Titre */\n   \n    #calendriers .carte h2 {\n        display: block !important;\n        color: #000000 !important;\n        text-align: center;\n        border-bottom: 1px solid #000000;\n        font-size: 16pt;\n        margin: 0 0 5mm 0;\n        padding: 0 0 2mm 0;\n    }\n\n    /* Conteneur du calendrier */\n    .tableau-conteneur {\n        width: 100% !important;\n        max-width: 100% !important;\n        margin: 0 !important;\n        padding: 0 !important;\n        overflow: visible !important;\n        border: none !important;\n    }\n\n    /* Tableau */\n    #tableauCalendrier {\n        width: 100% !important;\n        max-width: 100% !important;\n        min-width: 0 !important;\n        margin: 0 auto !important;\n\n        border-collapse: collapse;\n\n        table-layout: fixed;\n\n        background: #ffffff;\n    }\n\n  \n/* Cellules du calendrier à l'impression */\n#tableauCalendrier th,\n#tableauCalendrier td {\n    min-width: 0 !important;\n    max-width: none !important;\n    height: auto !important;\n\n    border: 1px solid #000000 !important;\n    padding: 4px !important;\n\n    text-align: center;\n    vertical-align: middle;\n\n    /* Autoriser le texte à occuper plusieurs lignes */\n    white-space: normal !important;\n    overflow: visible !important;\n    overflow-wrap: anywhere;\n    word-wrap: break-word;\n    line-height: 1.25;\n}\n\n/* Hauteur des lignes adaptée à leur contenu */\n#tableauCalendrier tr {\n    height: auto !important;\n    page-break-inside: avoid;\n    break-inside: avoid;\n}\n\n/* =====================================================\n   EN-TÊTES ET COLONNES DU CALENDRIER\n   ===================================================== */\n\n/* FILIÈRE : en-tête + colonne entière */\n#tableauCalendrier th:first-child,\n#tableauCalendrier td:first-child {\n    background-color: rgb(252, 228, 214) !important;\n    color: #000000 !important;\n\n    font-size: 9pt;\n    font-weight: 700;\n    padding: 3px;\n\n    -webkit-print-color-adjust: exact !important;\n    print-color-adjust: exact !important;\n}\n\n/* AMPHIS : en-tête uniquement */\n#tableauCalendrier thead th:nth-child(2) {\n    background-color: rgb(252, 228, 214) !important;\n    color: #000000 !important;\n\n    font-size: 9pt;\n    font-weight: 700;\n    padding: 3px;\n\n    -webkit-print-color-adjust: exact !important;\n    print-color-adjust: exact !important;\n}\n\n/* DATES : première ligne */\n#tableauCalendrier thead tr:first-child th {\n    background-color: rgb(252, 228, 214) !important;\n    color: #000000 !important;\n\n    font-size: 9pt;\n    font-weight: 700;\n    padding: 3px;\n\n    -webkit-print-color-adjust: exact !important;\n    print-color-adjust: exact !important;\n}\n\n\n/* =====================================================\n   CRÉNEAUX : SANS COULEUR\n   ===================================================== */\n\n#tableauCalendrier thead tr:nth-child(2) th {\n    background-color: #ffffff !important;\n    color: #000000 !important;\n\n    font-size: 9pt;\n    font-weight: 700;\n    padding: 3px;\n\n    -webkit-print-color-adjust: exact !important;\n    print-color-adjust: exact !important;\n}\n\n/* FILIÈRE et AMPHIS */\n#tableauCalendrier thead th:first-child,\n#tableauCalendrier thead th:nth-child(2) {\n    background-color: rgb(252, 228, 214) !important;\n}\n\n   /* FILIÈRE et AMPHIS */\n#tableauCalendrier th:first-child,\n#tableauCalendrier td:first-child,\n#tableauCalendrier th:nth-child(2),\n#tableauCalendrier td:nth-child(2) {\n    background: rgb(252, 228, 214) !important;\n    color: #000000 !important;\n    font-size: 9pt;\n    font-weight: 700;\n    padding: 3px;\n}\n\n\n/* MATIÈRES */\n#tableauCalendrier .cellule-examen {\n    background: rgb(153, 204, 255) !important;\n    color: #000000 !important;\n\n    font-family: \"Calibri Light\", Calibri, sans-serif !important;\n    font-size: 11pt !important;\n    font-weight: 400 !important;\n    line-height: 1.2 !important;\n\n    padding: 4px !important;\n    height: auto !important;\n\n    /* Conserver le texte vertical */\n    writing-mode: vertical-rl;\n    transform: rotate(180deg);\n\n    white-space: normal !important;\n    overflow: visible !important;\n    overflow-wrap: anywhere;\n\n    -webkit-print-color-adjust: exact !important;\n    print-color-adjust: exact !important;\n}\n \n/* Cellules vides */\n#tableauCalendrier tbody td:not(.cellule-examen):not(:first-child):not(:nth-child(2)) {\n    background: #ffffff !important;\n    color: #000000 !important;\n}\n\n/* Réduire les en-têtes et les noms des filières à l'impression */\n#tableauCalendrier thead th {\n    font-size: 7pt !important;\n    line-height: 1 !important;\n    padding: 2px !important;\n}\n\n#tableauCalendrier th:first-child,\n#tableauCalendrier td:first-child {\n    font-size: 7pt !important;\n    line-height: 1 !important;\n    padding: 2px !important;\n}\n\n  \n\n/* =====================================================\n   BORDURES DE TOUTES LES CELLULES DU CALENDRIER\n   ===================================================== */\n\n#tableauCalendrier {\n    border-collapse: collapse !important;\n    border: 1px solid #000000 !important;\n\n    -webkit-print-color-adjust: exact !important;\n    print-color-adjust: exact !important;\n}\n\n#tableauCalendrier th,\n#tableauCalendrier td {\n    border: 1px solid #000000 !important;\n}\n\n\n/* =====================================================\n   PAGINATION DU CALENDRIER PUBLIC\n   ===================================================== */\n\n#tableauCalendrier {\n    width: 100% !important;\n    max-width: 100% !important;\n    min-width: 0 !important;\n    border-collapse: collapse !important;\n    page-break-inside: auto;\n    break-inside: auto;\n}\n\n/* Répéter les en-têtes sur les pages suivantes */\n#tableauCalendrier thead {\n    display: table-header-group;\n}\n\n/* Éviter de couper les lignes entre deux pages */\n#tableauCalendrier tr {\n    height: auto !important;\n    page-break-inside: avoid;\n    break-inside: avoid;\n}\n  \n}\n\n/* =========================================================\n   IMPRESSION CALENDRIER PUBLIC\n   Créneaux de largeur uniforme\n   FILIÈRE et AMPHIS préservés\n========================================================= */\n\n@media print {\n\n    /* Répartition fixe des colonnes à l'impression */\n    #calendriers #tableauCalendrier {\n        table-layout: fixed !important;\n        width: 100% !important;\n        min-width: 0 !important;\n    }\n\n    /*\n       FILIÈRE et AMPHIS :\n       conserver leurs largeurs définies par les règles\n       d'impression existantes.\n    */\n\n    /*\n       Dates :\n       chaque cellule de date regroupe plusieurs créneaux.\n       Sa largeur sera répartie selon son colspan.\n    */\n    #calendriers #tableauCalendrier thead tr:first-child th:nth-child(n+3) {\n        white-space: normal !important;\n        overflow-wrap: normal !important;\n        word-break: normal !important;\n        text-align: center !important;\n        vertical-align: middle !important;\n    }\n\n    /*\n       Horaires :\n       même répartition de largeur que les cellules\n       d'examen situées sous les créneaux.\n    */\n    #calendriers #tableauCalendrier thead tr:nth-child(2) th,\n    #calendriers #tableauCalendrier tbody td:nth-child(n+3) {\n        white-space: normal !important;\n        overflow-wrap: break-word !important;\n        word-break: normal !important;\n        text-align: center !important;\n        vertical-align: middle !important;\n        padding-left: 3px !important;\n        padding-right: 3px !important;\n    }\n\n}\n\n";

// Impression du DOM affiché : aucune lecture du planning global ni de Firebase.
export function calendrierAffiche(root, view) {
    const table = root?.querySelector('.bloc-calendrier table.tableau-calendrier');
    if (!table?.querySelector('thead th')) return null;
    const rows = [...table.querySelectorAll('tbody tr')];
    if (!rows.some(row => [...row.querySelectorAll('td')].some(cell => cell.textContent.trim()))) return null;
    for (let element = table; element; element = element.parentElement) {
        const style = view.getComputedStyle(element);
        if (element.hidden || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return null;
    }
    return table;
}

// Liste blanche : pas de scripts, d'attributs on*, de liens ou de HTML interpolé.
// Les contrôles éventuels deviennent leur valeur actuelle, pas leur attribut initial.
export function copierContenu(source, target, doc) {
    for (const node of source.childNodes) {
        if (node.nodeType === 3) { target.appendChild(doc.createTextNode(node.textContent)); continue; }
        if (node.nodeType !== 1) continue;
        const tag = node.tagName.toLowerCase();
        if (['script', 'style', 'iframe', 'object', 'embed'].includes(tag)) continue;
        if (['input', 'textarea', 'select'].includes(tag)) {
            const text = tag === 'select' ? [...node.selectedOptions].map(o => o.textContent).join(', ') : node.value;
            target.appendChild(doc.createTextNode(text || '')); continue;
        }
        if (tag === 'br') { target.appendChild(doc.createElement('br')); continue; }
        if (['span', 'div', 'p', 'strong', 'b', 'em', 'i'].includes(tag)) {
            const copy = doc.createElement(tag); copierContenu(node, copy, doc); target.appendChild(copy);
        } else copierContenu(node, target, doc);
    }
}

export function documentImpression(doc, source, root) {
    doc.title = root.querySelector('#titreCalendrierAdmin')?.textContent.trim() || 'Calendrier des examens';
    const style = doc.createElement('style'); style.textContent = PRINT_CSS; doc.head.appendChild(style);
    const section = doc.createElement('section'); section.id = 'calendriers';
    const card = doc.createElement('div'); card.className = 'carte'; section.appendChild(card);
    for (const [selector, tag] of [['#titreCalendrierAdmin', 'h2'], ['#sousTitreCalendrierAdmin', 'p']]) {
        const text = root.querySelector(selector)?.textContent;
        if (text) { const node = doc.createElement(tag); node.textContent = text; card.appendChild(node); }
    }
    const container = doc.createElement('div'); container.className = 'tableau-conteneur'; card.appendChild(container);
    const table = doc.createElement('table'); table.id = 'tableauCalendrier'; container.appendChild(table);
    for (const group of source.children) {
        if (!['THEAD', 'TBODY', 'TFOOT'].includes(group.tagName)) continue;
        const copyGroup = doc.createElement(group.tagName.toLowerCase()); table.appendChild(copyGroup);
        for (const row of group.children) {
            if (row.tagName !== 'TR') continue;
            const copyRow = doc.createElement('tr'); copyGroup.appendChild(copyRow);
            [...row.children].forEach((cell, index) => {
                if (!['TH', 'TD'].includes(cell.tagName)) return;
                const copy = doc.createElement(cell.tagName.toLowerCase());
                copy.colSpan = cell.colSpan; copy.rowSpan = cell.rowSpan;
                copierContenu(cell, copy, doc);
                if (group.tagName === 'TBODY' && index >= 2 && copy.textContent.trim()) copy.className = 'cellule-examen';
                copyRow.appendChild(copy);
            });
        }
    }
    doc.body.appendChild(section);
    return table;
}

export function initialiserImpression(doc = document, view = window) {
    const root = doc.getElementById('calendriers-admin');
    const button = doc.getElementById('btnImprimerCalendrierAdmin');
    if (!root || !button) return;
    let busy = false;
    const update = () => { button.disabled = busy || !calendrierAffiche(root, view); };
    const observer = new view.MutationObserver(update);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    root.addEventListener('input', update); root.addEventListener('change', update);
    view.addEventListener('resize', update);
    button.addEventListener('click', () => {
        const table = calendrierAffiche(root, view);
        if (busy || !table) { update(); return; }
        busy = true; update();
        const frame = doc.createElement('iframe');
        frame.title = 'Impression du calendrier'; frame.setAttribute('aria-hidden', 'true');
        // Hors écran, mais pas display:none (sinon certains navigateurs impriment une page vide).
        frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1123px;height:794px;border:0;';
        let timer, finished = false;
        const cleanup = () => {
            if (finished) return; finished = true;
            view.clearTimeout(timer); frame.remove(); busy = false; update();
        };
        try {
            doc.body.appendChild(frame);
            const printWindow = frame.contentWindow;
            const printDoc = frame.contentDocument;
            if (!printWindow || !printDoc || typeof printWindow.print !== 'function') throw new Error('Impression indisponible');
            documentImpression(printDoc, table, root);
            printWindow.addEventListener('afterprint', cleanup, { once: true });
            // Secours pour les navigateurs qui ne déclenchent pas afterprint dans une iframe.
            timer = view.setTimeout(cleanup, 300000);
            printWindow.requestAnimationFrame(() => {
                try { printWindow.focus(); printWindow.print(); }
                catch (error) { cleanup(); view.alert('Impossible d’ouvrir l’impression du calendrier. Vérifiez les autorisations du navigateur.'); }
            });
        } catch (error) {
            cleanup(); view.alert('Impossible d’ouvrir l’impression du calendrier. Vérifiez les autorisations du navigateur.');
        }
    });
    update();
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initialiserImpression(), { once: true });
    else initialiserImpression();
}
