// ==UserScript==
// @name         Coursera Auto Click Multiple Buttons (Delayed)
// @namespace    violentmonkey-coursera-autoclick
// @version      1.0
// @author       SB
// @description  Auto-click multiple buttons based on their text after full page load
// @match        https://www.coursera.org/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Define the array of button texts you're looking for
    const BUTTON_TEXTS = [
        "Mark as completed",  // Existing button
        // Add more button texts as needed
    ];

    // Function to check if the button contains one of the desired texts
    function hasButtonText(el) {
        return BUTTON_TEXTS.some(text => el.textContent.trim() === text);
    }

    function tryClick() {
        const buttons = document.querySelectorAll('button');
        console.log(`Found ${buttons.length} buttons`);

        // Loop through buttons and click the one with the matching text
        for (const btn of buttons) {
            const btnText = btn.textContent.trim();
            console.log(`Checking button with text: "${btnText}"`);

            if (hasButtonText(btn)) {
                console.log(`[AutoClick] Button with text "${btnText}" matched, clicking...`);
                btn.click();
                console.log('[AutoClick] Button clicked');
                return true;
            }
        }

        console.log('[AutoClick] No matching button found.');
        return false;
    }

    // Wait for full page load
    window.addEventListener('load', () => {
        console.log('[AutoClick] Page loaded. Starting auto-click process...');

        // Delay to simulate human-like behavior
        setTimeout(() => {
            tryClick(); // Try clicking immediately after the delay

            // Set up observer for buttons that appear later
            const observer = new MutationObserver(() => {
                console.log('[AutoClick] Mutation detected, attempting to click...');
                tryClick();
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }, 1000); // 1 second delay after full load
    });
})();
