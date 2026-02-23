// src/scripts/pwa-prompt.js
// PWA install prompt for admin panel — shows a toast after login

import { showToast } from './admin-dialog.js';

const STORAGE_KEY = 'tt-admin-pwa-dismissed';

let deferredPrompt = null;

/**
 * Register beforeinstallprompt listener early (before login)
 * and register the service worker needed for mobile installability.
 * Must be called at page load to capture the event.
 */
export function initPwaPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin/' }).catch(() => {});
    }
}

/**
 * Check if the app is running in standalone mode (installed).
 */
function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
        navigator.standalone === true;
}

/**
 * Detect if the user is on iOS/iPadOS.
 * Newer iPadOS reports as "Macintosh" in the UA string,
 * so we also check for multi-touch support to catch iPads.
 */
function isIOS() {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * Show install prompt if the user hasn't dismissed it and the app isn't installed.
 * Call this after successful login.
 */
export function showInstallPromptIfEligible() {
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    if (deferredPrompt) {
        showAndroidInstallToast();
    } else if (isIOS()) {
        showIOSInstallToast();
    }
}

function showAndroidInstallToast() {
    const toast = showToast('Legg til Admin på hjemskjermen for rask tilgang', 'info', { duration: 0 });
    if (!toast) return;

    const actions = document.createElement('div');
    actions.className = 'flex gap-2 mt-2';

    const installBtn = document.createElement('button');
    installBtn.className = 'text-xs font-bold text-teal-700 bg-teal-100 hover:bg-teal-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer';
    installBtn.textContent = 'Installer';
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            if (result.outcome === 'accepted') {
                localStorage.setItem(STORAGE_KEY, 'installed');
            }
            deferredPrompt = null;
        }
        toast.remove();
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'text-xs text-admin-muted hover:text-brand px-3 py-1.5 rounded-lg transition-colors cursor-pointer';
    dismissBtn.textContent = 'Ikke nå';
    dismissBtn.addEventListener('click', () => {
        localStorage.setItem(STORAGE_KEY, 'dismissed');
        toast.remove();
    });

    actions.appendChild(installBtn);
    actions.appendChild(dismissBtn);

    const msgSpan = toast.querySelector('span.flex-1');
    if (msgSpan) {
        msgSpan.appendChild(actions);
    }
}

function showIOSInstallToast() {
    const toast = showToast(
        'Legg til Admin på hjemskjermen: trykk Del-ikonet (⎋) → «Legg til på Hjem-skjerm»',
        'info',
        { duration: 15000 }
    );
    if (!toast) return;

    const actions = document.createElement('div');
    actions.className = 'flex gap-2 mt-2';

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'text-xs text-admin-muted hover:text-brand px-3 py-1.5 rounded-lg transition-colors cursor-pointer';
    dismissBtn.textContent = 'Ikke vis igjen';
    dismissBtn.addEventListener('click', () => {
        localStorage.setItem(STORAGE_KEY, 'dismissed');
        toast.remove();
    });

    actions.appendChild(dismissBtn);

    const msgSpan = toast.querySelector('span.flex-1');
    if (msgSpan) {
        msgSpan.appendChild(actions);
    }
}

/** Reset module state for testing. */
export function _resetForTesting() {
    deferredPrompt = null;
}

/** Expose deferredPrompt setter for testing. */
export function _setDeferredPromptForTesting(value) {
    deferredPrompt = value;
}
