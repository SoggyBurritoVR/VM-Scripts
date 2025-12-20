// ==UserScript==
// @name         Canvas Grade Reader
// @namespace    https://github.com/SoggyBurritoVR/VM-Scripts/tree/main/CanvasGradeReader
// @version      1.0.1
// @description  Auto-check unread Canvas submissions with draggable, persistent UI. SPA-safe, touch-friendly, resettable position.
// @author       SB
// @icon         https://raw.githubusercontent.com/SoggyBurritoVR/VM-Scripts/refs/heads/main/CanvasGradeReader/CanvasScriptIcon.png
// @match        https://perscholas.instructure.com/courses/*/grades*
// @grant        none
// ==/UserScript==
//this is a test of the update function!
(function () {
    'use strict';

    /******** CONFIG ********/
    const LOAD_DELAY_MS = 100;
    const POPUP_DURATION_MS = 3000;
    const ROUTE_CHECK_INTERVAL = 500;
    const STORAGE_KEY = 'vmAutoCheckButtonPos';
    const DRAG_THRESHOLD = 6;

    /******** STATE ********/
    let combinedButtonRef = null;
    let lastUrl = location.href;

    /******** UTIL ********/
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

    /******** ASSIGNMENT HANDLING ********/
    const clickAllAssignmentButtons = () => {
        const root = document.querySelector('#grades_summary') || document;
        const buttons = root.querySelectorAll('[id^="assignment_comment_"]');

        for (const btn of buttons) {
            if (btn.querySelector('.unread_dot') && btn.querySelector('.comment_dot')) {
                btn.click();
            }
        }

        const closeBtn = [...document.querySelectorAll('button')]
            .find(b => b.textContent.trim().toLowerCase() === 'close');

        closeBtn?.click();
    };

    const collectUnreadSubmissionLinks = () =>
        [...document.querySelectorAll('[id^="submission_"]')]
            .filter(c => c.querySelector('[id^="submission_unread_dot_"]'))
            .map(c => c.querySelector('a[href*="/assignments/"][href*="/submissions/"]')?.href)
            .filter(Boolean);

    const loadSubmissionInBackground = (url) =>
        new Promise(resolve => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = url;

            const cleanup = () => {
                iframe.remove();
                resolve();
            };

            iframe.onload = () => setTimeout(cleanup, 100);
            setTimeout(cleanup, LOAD_DELAY_MS * 2);

            document.body.appendChild(iframe);
        });

    const autoCheckAll = async () => {
        clickAllAssignmentButtons();
        const queue = collectUnreadSubmissionLinks();

        if (!queue.length) {
            showPopup('No unread submissions found!');
            return;
        }

        combinedButtonRef.disabled = true;

        for (let i = 0; i < queue.length; i++) {
            combinedButtonRef.textContent = `Auto Check All (${i + 1}/${queue.length})`;
            await loadSubmissionInBackground(queue[i]);
        }

        combinedButtonRef.textContent = 'Auto Check All';
        combinedButtonRef.disabled = false;
        showPopup('Auto Check All finished!');
    };

    /******** POPUP ********/
    const showPopup = (msg) => {
        const el = document.createElement('div');
        el.textContent = msg;

        Object.assign(el.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'rgba(0,123,255,0.9)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '5px',
            zIndex: 10000,
            opacity: 0,
            transition: 'opacity .3s'
        });

        document.body.appendChild(el);
        requestAnimationFrame(() => el.style.opacity = '1');

        setTimeout(() => {
            el.style.opacity = '0';
            el.addEventListener('transitionend', () => el.remove(), { once: true });
        }, POPUP_DURATION_MS);
    };

    /******** DRAGGING (NO SNAP) ********/
    const makeDraggable = (container) => {
        let startX, startY, originX, originY, dragging = false;

        const getPoint = e => (e.touches ? e.touches[0] : e);

        const start = (e) => {
            if (e.target.closest('button')) return;

            const p = getPoint(e);
            startX = p.clientX;
            startY = p.clientY;

            const rect = container.getBoundingClientRect();
            originX = rect.left;
            originY = rect.top;
            dragging = false;

            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', end);
            document.addEventListener('touchmove', move, { passive: false });
            document.addEventListener('touchend', end);
        };

        const move = (e) => {
            const p = getPoint(e);
            const dx = p.clientX - startX;
            const dy = p.clientY - startY;

            if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
                dragging = true;
                container.style.cursor = 'grabbing';
            }

            if (!dragging) return;
            e.preventDefault();

            const maxX = window.innerWidth - container.offsetWidth;
            const maxY = window.innerHeight - container.offsetHeight;

            const x = clamp(originX + dx, 0, maxX);
            const y = clamp(originY + dy, 0, maxY);

            Object.assign(container.style, {
                left: `${x}px`,
                top: `${y}px`,
                right: 'auto',
                bottom: 'auto'
            });
        };

        const end = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', end);
            document.removeEventListener('touchmove', move);
            document.removeEventListener('touchend', end);

            container.style.cursor = 'grab';

            if (!dragging) return;

            const rect = container.getBoundingClientRect();
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ x: rect.left, y: rect.top })
            );
        };

        container.style.cursor = 'grab';
        container.addEventListener('mousedown', start);
        container.addEventListener('touchstart', start, { passive: false });
    };

    /******** UI ********/
    const createTriggerButton = () => {
        if (document.querySelector('#vm-auto-check-container')) return;

        const container = document.createElement('div');
        container.id = 'vm-auto-check-container';

        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');

        Object.assign(container.style, {
            position: 'fixed',
            left: saved ? `${saved.x}px` : 'auto',
            top: saved ? `${saved.y}px` : 'auto',
            right: saved ? 'auto' : '50px',
            bottom: saved ? 'auto' : '50px',
            zIndex: 9999,
            fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        });

        makeDraggable(container);

        // Flex wrapper for main + toggle button
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.borderRadius = '20px';
        wrapper.style.overflow = 'hidden';
        //wrapper.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        container.appendChild(wrapper);

        // Main button
        const main = document.createElement('button');
        main.textContent = 'Auto Check';
        Object.assign(main.style, {
            flexGrow: '1',
            padding: '10px 17px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            fontSize: '14px',
            cursor: 'pointer',
            outline: 'none',
            userSelect: 'none',
            fontWeight: '600',
        });
        wrapper.appendChild(main);

        // Toggle button
        const toggle = document.createElement('button');
        toggle.textContent = '⏶';
        Object.assign(toggle.style, {
            width: '36px',
            height: '42.5px',
            background: '#28a745',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: '35px',
            textAlign: 'center',
            userSelect: 'none',
            outline: 'none',
        });
        wrapper.appendChild(toggle);

        // Dropdown container
        const menu = document.createElement('div');
        Object.assign(menu.style, {
            height: '0',
            overflow: 'hidden',
            transition: 'height .3s ease, opacity .3s ease',
            opacity: 0,
            maxWidth: 'calc(100% + 4px)',
            marginTop: '8px',
            borderRadius: '8px',
            backgroundColor: '#28a745',
            boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
            fontSize: '13px',
        });
        container.appendChild(menu);

        // Dropdown buttons
        const run = document.createElement('button');
        run.textContent = 'Auto Check All';
        run.onclick = autoCheckAll;

        const reset = document.createElement('button');
        reset.textContent = 'Reset Position';
        reset.onclick = () => {
            localStorage.removeItem(STORAGE_KEY);
            Object.assign(container.style, {
                right: '50px',
                bottom: '50px',
                left: 'auto',
                top: 'auto'
            });
        };

        for (const btn of [run, reset]) {
            Object.assign(btn.style, {
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: '#1e7e34',
                color: '#fff',
                cursor: 'pointer',
                marginTop: '6px',
                fontWeight: '600',
                textAlign: 'center',
                userSelect: 'none',
                outline: 'none',
                transition: 'background-color 0.2s ease',
            });
            btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#155d27');
            btn.addEventListener('mouseleave', () => btn.style.backgroundColor = '#1e7e34');
            menu.appendChild(btn);
        }

        combinedButtonRef = run;

        toggle.onclick = () => {
            const open = menu.offsetHeight === 0;
            menu.style.height = open ? `${menu.scrollHeight}px` : '0';
            menu.style.opacity = open ? '1' : '0';
            toggle.textContent = open ? '⏷' : '⏶';
        };

        document.body.appendChild(container);
    };

    /******** SPA WATCH ********/
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            requestAnimationFrame(createTriggerButton);
        }
    }, ROUTE_CHECK_INTERVAL);

    createTriggerButton();
})();
