// ==UserScript==
// @name         Coursera Hide Success Icons Max Optimized
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Efficiently hides success icons inside outline items on Coursera (fully optimized, local only)
// @author       SB
// @match        https://www.coursera.org/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const WRAPPER_CLASS = ['outline-single-item-content-wrapper', 'css-7jksvh'];
    const TEST_ID = 'learn-item-success-icon';

    /**
     * Hides the target items
     * @param {HTMLElement[]} elements
     */
    function hideItems(elements) {
        elements.forEach(el => {
            if (!el || el.dataset.hiddenByScript) return;

            const icon = el.querySelector(`[data-testid="${TEST_ID}"]`);
            if (icon) {
                el.style.display = 'none';
                el.dataset.hiddenByScript = 'true';
            }
        });
    }

    /**
     * Checks if an element has all the wrapper classes
     * @param {HTMLElement} el
     */
    function isWrapper(el) {
        return WRAPPER_CLASS.every(cls => el.classList.contains(cls));
    }

    // Initial hide: only relevant elements
    const initial = Array.from(document.getElementsByClassName(WRAPPER_CLASS.join(' ')));
    hideItems(initial);

    // MutationObserver: only processes relevant nodes
    const observer = new MutationObserver(mutations => {
        const newItems = [];
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue; // skip non-elements

                // Node itself is a wrapper
                if (isWrapper(node)) newItems.push(node);

                // Any children that match
                const children = node.getElementsByClassName(WRAPPER_CLASS.join(' '));
                if (children.length > 0) newItems.push(...children);
            }
        }
        if (newItems.length > 0) hideItems(newItems);
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
