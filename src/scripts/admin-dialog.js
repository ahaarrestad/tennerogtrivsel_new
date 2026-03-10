// src/scripts/admin-dialog.js
// Accessible dialog utilities replacing native alert()/confirm()

let toastContainer = null;
let confirmDialog = null;

export const ICON_CLOSE = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const TOAST_COLORS = {
    error: {
        bg: 'admin-toast-error',
        icon: 'admin-toast-error-icon',
        text: 'admin-toast-error-text',
    },
    success: {
        bg: 'admin-toast-success',
        icon: 'admin-toast-success-icon',
        text: 'admin-toast-success-text',
    },
    info: {
        bg: 'admin-toast-info',
        icon: 'admin-toast-info-icon',
        text: 'admin-toast-info-text',
    },
};

const TOAST_ICONS = {
    error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

function getToastContainer() {
    if (toastContainer && toastContainer.parentNode) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.id = 'admin-toast-container';
    toastContainer.className = 'fixed bottom-6 right-6 left-6 sm:left-auto z-50 flex flex-col gap-3 max-w-sm';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('role', 'status');
    document.body.appendChild(toastContainer);
    return toastContainer;
}

/**
 * Show a non-blocking toast notification.
 * @param {string} message
 * @param {'error'|'success'|'info'} type
 * @param {{ duration?: number }} [options]
 */
export function showToast(message, type = 'info', options = {}) {
    const duration = options.duration ?? 5000;
    const colors = TOAST_COLORS[type] || TOAST_COLORS.info;
    const container = getToastContainer();

    const toast = document.createElement('div');
    toast.className = `flex items-start gap-3 p-4 rounded-xl border shadow-lg ${colors.bg} animate-in fade-in slide-in-from-bottom-4 duration-300`;
    toast.setAttribute('role', 'alert');

    const iconSpan = document.createElement('span');
    iconSpan.className = `shrink-0 mt-0.5 ${colors.icon}`;
    iconSpan.innerHTML = TOAST_ICONS[type] || TOAST_ICONS.info;

    const msgSpan = document.createElement('span');
    msgSpan.className = `text-sm font-medium flex-1 ${colors.text}`;
    msgSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer';
    closeBtn.setAttribute('aria-label', 'Lukk');
    closeBtn.innerHTML = ICON_CLOSE;
    closeBtn.addEventListener('click', () => toast.remove());

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, duration);
    }

    return toast;
}

function getConfirmDialog() {
    if (confirmDialog && confirmDialog.parentNode) return confirmDialog;

    confirmDialog = document.createElement('dialog');
    confirmDialog.id = 'admin-confirm-dialog';
    confirmDialog.className = 'p-0 rounded-2xl shadow-2xl backdrop:admin-overlay backdrop:backdrop-blur-sm max-w-md w-[90vw]';

    confirmDialog.innerHTML = [
        '<div class="p-6 space-y-6">',
        '  <p id="admin-confirm-message" class="text-admin-muted text-base leading-relaxed"></p>',
        '  <div class="flex justify-end gap-3">',
        '    <button id="admin-confirm-cancel" class="admin-btn-secondary !py-3 !px-6 !rounded-xl text-sm cursor-pointer">Avbryt</button>',
        '    <button id="admin-confirm-ok" class="btn-primary py-3 px-6 text-sm cursor-pointer">Bekreft</button>',
        '  </div>',
        '</div>',
    ].join('\n');

    document.body.appendChild(confirmDialog);

    // Escape key → cancel (native dialog behavior closes on Escape)
    confirmDialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        confirmDialog.close('cancel');
    });

    return confirmDialog;
}

/**
 * Show a confirm dialog. Returns a Promise that resolves to true (confirm) or false (cancel).
 * @param {string} message
 * @param {{ destructive?: boolean, confirmLabel?: string, cancelLabel?: string }} [options]
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, options = {}) {
    const dialog = getConfirmDialog();
    const msgEl = dialog.querySelector('#admin-confirm-message');
    const okBtn = dialog.querySelector('#admin-confirm-ok');
    const cancelBtn = dialog.querySelector('#admin-confirm-cancel');

    if (msgEl) msgEl.textContent = message;

    if (okBtn) {
        okBtn.textContent = options.confirmLabel || 'Bekreft';
        if (options.destructive) {
            okBtn.className = 'admin-btn-destructive py-3 px-6 text-sm cursor-pointer';
        } else {
            okBtn.className = 'btn-primary py-3 px-6 text-sm cursor-pointer';
        }
    }

    if (cancelBtn && options.cancelLabel) {
        cancelBtn.textContent = options.cancelLabel;
    }

    return new Promise((resolve) => {
        function cleanup() {
            okBtn?.removeEventListener('click', onOk);
            cancelBtn?.removeEventListener('click', onCancel);
            dialog.removeEventListener('close', onClose);
        }

        function onOk() {
            cleanup();
            dialog.close('ok');
            resolve(true);
        }

        function onCancel() {
            cleanup();
            dialog.close('cancel');
            resolve(false);
        }

        function onClose() {
            cleanup();
            resolve(false);
        }

        okBtn?.addEventListener('click', onOk);
        cancelBtn?.addEventListener('click', onCancel);
        dialog.addEventListener('close', onClose);

        dialog.showModal();

        // Focus cancel button (safe default)
        cancelBtn?.focus();
    });
}

/**
 * Viser en prominent banner i en gitt container når brukerens økt har utløpt.
 * @param {HTMLElement} container - Elementet å prepende banneret i
 * @param {() => void} onLogin - Kalles når brukeren klikker "Logg inn"
 * @returns {HTMLElement|null}
 */
export function showAuthExpired(container, onLogin) {
    if (!container) return null;

    const ICON_LOCK = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

    const banner = document.createElement('div');
    banner.className = 'flex items-start gap-4 p-5 rounded-xl border admin-banner-warning mb-4';
    banner.setAttribute('role', 'alert');

    const iconSpan = document.createElement('span');
    iconSpan.className = 'shrink-0 admin-banner-warning-icon mt-0.5';
    iconSpan.innerHTML = ICON_LOCK;

    const textDiv = document.createElement('div');
    textDiv.className = 'flex-1 min-w-0';
    textDiv.innerHTML = '<p class="admin-banner-warning-title">Økten din er utløpt</p><p class="admin-banner-warning-text">Logg inn på nytt for å fortsette å redigere.</p>';

    const loginBtn = document.createElement('button');
    loginBtn.className = 'auth-expired-login-btn btn-primary text-xs py-2 px-4 shrink-0';
    loginBtn.textContent = 'Logg inn';
    loginBtn.addEventListener('click', () => {
        banner.remove();
        if (onLogin) onLogin();
    });

    banner.appendChild(iconSpan);
    banner.appendChild(textDiv);
    banner.appendChild(loginBtn);

    container.prepend(banner);
    return banner;
}

/**
 * Show an inline banner inside a container element.
 * @param {string} containerId - The ID of the container to prepend the banner to
 * @param {string} message
 * @param {'error'|'info'|'success'} [type='info']
 * @param {{ duration?: number }} [options]
 */
export function showBanner(containerId, message, type = 'info', options = {}) {
    const duration = options.duration ?? 10000;
    const container = document.getElementById(containerId);
    if (!container) return null;

    const colors = TOAST_COLORS[type] || TOAST_COLORS.info;

    const banner = document.createElement('div');
    banner.className = `flex items-center gap-3 p-4 rounded-xl border mb-4 ${colors.bg}`;
    banner.setAttribute('role', 'alert');

    const iconSpan = document.createElement('span');
    iconSpan.className = `shrink-0 ${colors.icon}`;
    iconSpan.innerHTML = TOAST_ICONS[type] || TOAST_ICONS.info;

    const msgSpan = document.createElement('span');
    msgSpan.className = `text-sm font-medium flex-1 ${colors.text}`;
    msgSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer';
    closeBtn.setAttribute('aria-label', 'Lukk');
    closeBtn.innerHTML = ICON_CLOSE;
    closeBtn.addEventListener('click', () => banner.remove());

    banner.appendChild(iconSpan);
    banner.appendChild(msgSpan);
    banner.appendChild(closeBtn);

    container.prepend(banner);

    if (duration > 0) {
        setTimeout(() => {
            if (banner.parentNode) banner.remove();
        }, duration);
    }

    return banner;
}
