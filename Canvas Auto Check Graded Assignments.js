// ==UserScript==
// @name         Canvas Auto Check All Graded Assignments (Optimized)
// @namespace    Violentmonkey Scripts
// @version      6.3
// @description  Click all assignment comments and open unread submissions in background with completion popup on Canvas. Responsive toggle button, live progress counter. Optimized for performance.
// @author       OGK
// @match        https://perscholas.instructure.com/courses/*/grades*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const LOAD_DELAY_MS = 500; // Delay per submission iframe
    const POPUP_DURATION_MS = 3000; // Duration of completion popup
    const BUTTON_WRAPPER_PADDING = 20; // Extra spacing for dropdown

    /***** UTILITY FUNCTIONS *****/
    const clickButton = (button) => {
        if (!button) return false;
        button.click();
        return true;
    };

    const hasUnreadAndCommentDots = (button) =>
        button.querySelector('.unread_dot') && button.querySelector('.comment_dot');

    /***** CLICK ALL ASSIGNMENT COMMENT BUTTONS *****/
    const clickAllAssignmentButtons = () => {
        const buttons = document.querySelectorAll('[id^="assignment_comment_"]');
        let clicked = 0;
        for (const btn of buttons) {
            if (hasUnreadAndCommentDots(btn) && clickButton(btn)) clicked++;
        }
        if (clicked > 0) clickButton(document.querySelector('.css-1eu5zj9-view--inlineBlock-baseButton'));
        console.log(`Clicked ${clicked} assignment comment buttons.`);
    };

    /***** COLLECT UNREAD SUBMISSION LINKS *****/
    const collectUnreadSubmissionLinks = () => {
        const containers = document.querySelectorAll('[id^="submission_"]');
        const urls = [];
        for (const container of containers) {
            const unread = container.querySelector('[id^="submission_unread_dot_"]');
            if (!unread) continue;
            const link = container.querySelector('a[href*="/assignments/"][href*="/submissions/"]');
            if (link?.href) urls.push(link.href);
        }
        console.log(`Queued ${urls.length} unread submissions`);
        return urls;
    };

    /***** LOAD SUBMISSION IN BACKGROUND *****/
    const loadSubmissionInBackground = (url) => new Promise(resolve => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        setTimeout(() => {
            iframe.remove();
            resolve();
        }, LOAD_DELAY_MS);
    });

    /***** SEQUENTIAL PROCESSING WITH PROGRESS *****/
    const processSubmissionQueue = async (queue) => {
        const total = queue.length;
        for (let i = 0; i < total; i++) {
            const url = queue[i];
            console.log(`Processing (${i + 1}/${total}): ${url}`);
            if (window.combinedButtonRef) window.combinedButtonRef.innerText = `Auto Check All (${i + 1}/${total})`;
            await loadSubmissionInBackground(url);
        }
        console.log('Finished processing all unread submissions.');
        showCompletionPopup();
        if (window.combinedButtonRef) window.combinedButtonRef.innerText = 'Auto Check All';
    };

    const openUnreadSubmissionsSequentially = () => {
        const queue = collectUnreadSubmissionLinks();
        if (!queue.length) {
            console.log('No unread submissions found.');
            showCompletionPopup('No unread submissions found!');
            if (window.combinedButtonRef) window.combinedButtonRef.innerText = 'Auto Check All';
            return;
        }
        processSubmissionQueue(queue);
    };

    /***** COMBINED AUTO CHECK FUNCTION *****/
    const autoCheckAll = () => {
        clickAllAssignmentButtons();
        openUnreadSubmissionsSequentially();
    };

    /***** COMPLETION POPUP *****/
    const showCompletionPopup = (message = 'Auto Check All finished!') => {
        const popup = document.createElement('div');
        Object.assign(popup.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: 'rgba(0,123,255,0.9)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '5px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            zIndex: '10000',
            fontSize: '14px',
            opacity: '0',
            transition: 'opacity 0.3s ease',
        });
        popup.innerText = message;
        document.body.appendChild(popup);
        requestAnimationFrame(() => popup.style.opacity = '1');
        setTimeout(() => {
            popup.style.opacity = '0';
            popup.addEventListener('transitionend', () => popup.remove(), { once: true });
        }, POPUP_DURATION_MS);
    };

    /***** UI CREATION (RESPONSIVE TOGGLE BUTTON + PROGRESS) *****/
    const createTriggerButton = () => {
        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'fixed',
            bottom: '50px',  // distance from bottom of viewport
            right: '50px',   // distance from right of viewport
            zIndex: '9999',
        });

        const buttonWrapper = document.createElement('div');
        buttonWrapper.style.position = 'relative';
        container.appendChild(buttonWrapper);

        // Main button
        const mainButton = document.createElement('button');
        Object.assign(mainButton.style, {
            padding: '10px 20px',
            width: '150px',
            fontSize: '11px',
            textAlign: 'left',
            backgroundColor: '#007bff',
            color: '#fff',
            border: '3px solid black',
            borderRadius: '20px',
            cursor: 'pointer',
            boxShadow: '0px 7px 15px 5px rgba(0,0,0,1)',
        });
        mainButton.innerText = 'Auto Check';
        buttonWrapper.appendChild(mainButton);

        // Toggle button
        const toggleButton = document.createElement('button');
        Object.assign(toggleButton.style, {
            position: 'absolute',
            right: '5px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            backgroundColor: '#28a745',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
        });
        toggleButton.innerText = '⏶';
        buttonWrapper.appendChild(toggleButton);

        // Dropdown container
        const actionContainer = document.createElement('div');
        Object.assign(actionContainer.style, {
            position: 'absolute',
            top: '100%',
            left: '0',
            width: '100%',
            height: '0',
            overflow: 'hidden',
            opacity: '0',
            transition: 'height 0.3s ease, opacity 0.3s ease',
        });
        container.appendChild(actionContainer);

        // Combined Auto Check All button
        const combinedButton = document.createElement('button');
        Object.assign(combinedButton.style, {
            padding: '8px 12px',
            backgroundColor: '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '10px',
            width: '100%',
        });
        combinedButton.innerText = 'Auto Check All';
        combinedButton.onclick = autoCheckAll;
        window.combinedButtonRef = combinedButton;
        actionContainer.appendChild(combinedButton);

        // Toggle dropdown behavior
        toggleButton.onclick = () => {
            const collapsed = actionContainer.style.height === '0px';
            actionContainer.style.height = collapsed ? `${combinedButton.offsetHeight + 20}px` : '0px';
            actionContainer.style.opacity = collapsed ? '1' : '0';
            toggleButton.innerText = collapsed ? '⏷' : '⏶';
        };

        document.body.appendChild(container);
    };
    window.addEventListener('load', createTriggerButton);

})();
