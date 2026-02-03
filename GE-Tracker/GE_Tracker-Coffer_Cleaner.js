// ==UserScript==
// @name         GE Tracker - Hide Outdated Prices + Auto ROI Sort on Death's Coffer Page
// @namespace    https://ge-tracker.com/
// @version      1.0
// @author       SB
// @description  Hides outdated prices and forces ROI% descending sort
// @icon         https://raw.githubusercontent.com/SoggyBurritoVR/VM-Scripts/refs/heads/main/GE-Tracker/GETracker_logo_small.png
// @downloadURL  https://raw.githubusercontent.com/SoggyBurritoVR/VM-Scripts/refs/heads/main/GE-Tracker/GE_Tracker-Coffer_Cleaner.js
// @updateURL    https://raw.githubusercontent.com/SoggyBurritoVR/VM-Scripts/refs/heads/main/GE-Tracker/GE_Tracker-Coffer_Cleaner.js
// @match        https://www.ge-tracker.com/deaths-coffer
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    /* ----------------------------------------
     * 1. Inject CSS to hide outdated prices
     * ---------------------------------------- */
    const style = document.createElement('style');
    style.textContent = `.price-outdated { display: none !important; }`;
    document.head.appendChild(style);

    /* ----------------------------------------
     * 2. Force ROI% descending once table exists
     * ---------------------------------------- */
    const forceROISort = () => {
        const th = [...document.querySelectorAll('th')].find(el => el.textContent.trim() === 'ROI%');
        if (!th) return false;

        // Click once or twice depending on initial sort state
        if (th.classList.contains('sorting')) th.click(), th.click();
        else if (!th.classList.contains('sorting_desc')) th.click();

        return true;
    };

    // Try immediately (fast loads)
    if (forceROISort()) return;

    // Observe only the table container for minimal DOM watching
    const tableContainer = document.querySelector('#coffer-table') || document.body;
    const observer = new MutationObserver(() => {
        if (forceROISort()) observer.disconnect();
    });
    observer.observe(tableContainer, { childList: true, subtree: true });
})();
