// ==UserScript==
// @name         Uncap HTML5 Video Speed & Fast Complete
// @namespace    https://github.com/SoggyBurritoVR/VM-Scripts/tree/main/Uncap%20HTML5%20Video%20Speed
// @version      1.0.1
// @description  Remove playbackRate limits and allow speeds beyond 2x, plus hotkey to instantly finish video
// @author       SB
// @match        *://*/*
// @grant        none
// @downloadURL https://raw.githubusercontent.com/SoggyBurritoVR/VM-Scripts/refs/heads/main/Uncap%20HTML5%20Video%20Speed/UncapHTML5VideoSpeed.js
// @updateURL https://raw.githubusercontent.com/SoggyBurritoVR/VM-Scripts/refs/heads/main/Uncap%20HTML5%20Video%20Speed/UncapHTML5VideoSpeed.js
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const MAX_RATE = Infinity; // hard cap (you can raise this)
  const videos = new Set();

  /** Override playbackRate setter */
  const desc = Object.getOwnPropertyDescriptor(
    HTMLMediaElement.prototype,
    'playbackRate'
  );

  Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
    configurable: true,
    enumerable: true,
    get() {
      return desc.get.call(this);
    },
    set(value) {
      const unclamped = Math.max(0.1, Math.min(value, MAX_RATE));
      desc.set.call(this, unclamped);
    }
  });

  /** Track videos */
  function hookVideo(video) {
    if (videos.has(video)) return;
    videos.add(video);

    // Force-enable higher speeds
    video.playbackRate = video.playbackRate;

    // Kill common clamping tricks
    video.addEventListener('ratechange', () => {
      if (video.playbackRate > MAX_RATE) {
        video.playbackRate = MAX_RATE;
      }
    });
  }

  /** Initial scan */
  function scan() {
    document.querySelectorAll('video').forEach(hookVideo);
  }

  /** Watch for dynamically added videos */
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  /** Keyboard controls */
  document.addEventListener('keydown', e => {
    const v = document.querySelector('video');
    if (!v) return;

    if (e.key === ']') {
      v.playbackRate += 0.25;
      console.log('Speed:', v.playbackRate);
    }
    if (e.key === '[') {
      v.playbackRate -= 0.25;
      console.log('Speed:', v.playbackRate);
    }
    if (e.key === '\\') {
      v.playbackRate = 1;
      console.log('Speed reset');
    }

    // Shift + 1: instantly finish video
    if (e.shiftKey && e.code === 'Digit1') {
      console.log('Fast-completing video...');
      const step = 200; // seconds per tick (can increase for faster completion)
      const intervalMs = 10; // ms per tick

      const fastInterval = setInterval(() => {
        if (v.currentTime + step >= v.duration) {
          v.currentTime = v.duration;
          v.dispatchEvent(new Event('timeupdate'));
          v.dispatchEvent(new Event('ended'));
          clearInterval(fastInterval);
          console.log('Video finished!');
        } else {
          v.currentTime += step;
          v.dispatchEvent(new Event('timeupdate'));
        }
      }, intervalMs);
    }
  });

  /** Expose helper */
  window.__videoSpeed = {
    set(rate) {
      document.querySelectorAll('video').forEach(v => {
        v.playbackRate = rate;
      });
    }
  };

  scan();
})();
