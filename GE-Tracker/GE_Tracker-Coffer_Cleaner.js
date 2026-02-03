// ==UserScript==
// @name         GE Tracker - Hide Outdated Prices + Auto ROI Sort
// @namespace    https://ge-tracker.com/
// @version      1.0
// @author       SB
// @description   Hides outdated prices and forces ROI% descending sort
// @downloadURL https://raw.githubusercontent.com/SoggyBurritoVR/VM-Scripts/refs/heads/main/GE-Tracker/GE_Tracker-Coffer_Cleaner.js
// @updateURL https://raw.githubusercontent.com/SoggyBurritoVR/VM-Scripts/refs/heads/main/GE-Tracker/GE_Tracker-Coffer_Cleaner.js
// @match        https://www.ge-tracker.com/deaths-coffer
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    /* ----------------------------------------
     * 1. Hide outdated prices (CSS-only)
     * ---------------------------------------- */
    if (!document.getElementById('ge-hide-outdated-style')) {
        const style = document.createElement('style');
        style.id = 'ge-hide-outdated-style';
        style.textContent = `.price-outdated { display: none !important; }`;
        document.head.appendChild(style);
    }

    /* ----------------------------------------
     * 2. Force ROI% descending once DataTable exists
     * ---------------------------------------- */
    let done = false;

    const forceROISort = () => {
        if (done) return true;

        // Narrow scope: only table headers
        const th = [...document.querySelectorAll('th')]
            .find(el => el.textContent.trim() === 'ROI%');

        if (!th) return false;

        // Normalize into descending with minimal clicks
        if (th.classList.contains('sorting')) {
            th.click(); // asc
            th.click(); // desc
        } else if (th.classList.contains('sorting_asc')) {
            th.click(); // desc
        }

        done = true;
        return true;
    };

    // Try immediately (covers fast loads / cached pages)
    if (forceROISort()) return;

    // Observe only until it succeeds
    const observer = new MutationObserver(() => {
        if (forceROISort()) observer.disconnect();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
