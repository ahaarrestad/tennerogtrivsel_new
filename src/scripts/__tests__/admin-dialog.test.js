/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Polyfill HTMLDialogElement methods missing in jsdom
if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute('open', '');
    };
}
if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (returnValue) {
        this.removeAttribute('open');
        this.returnValue = returnValue || '';
        this.dispatchEvent(new Event('close'));
    };
}

import { showToast, showConfirm, showBanner, showAuthExpired } from '../admin-dialog.js';

describe('admin-dialog.js', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // -------------------------------------------------------------------------
    // showToast
    // -------------------------------------------------------------------------
    describe('showToast', () => {
        it('skal opprette toast-container ved første kall', () => {
            showToast('Testmelding', 'info');
            const container = document.getElementById('admin-toast-container');
            expect(container).not.toBeNull();
            expect(container.getAttribute('aria-live')).toBe('polite');
            expect(container.getAttribute('role')).toBe('status');
        });

        it('skal vise meldingstekst', () => {
            showToast('Noe gikk galt', 'error');
            const container = document.getElementById('admin-toast-container');
            expect(container.textContent).toContain('Noe gikk galt');
        });

        it('skal ha role="alert" på toast-elementet', () => {
            const toast = showToast('Test', 'error');
            expect(toast.getAttribute('role')).toBe('alert');
        });

        it('skal bruke rød farge for error-type', () => {
            const toast = showToast('Feil', 'error');
            expect(toast.className).toContain('bg-red-50');
        });

        it('skal bruke grønn farge for success-type', () => {
            const toast = showToast('OK', 'success');
            expect(toast.className).toContain('bg-green-50');
        });

        it('skal bruke gul farge for info-type', () => {
            const toast = showToast('Info', 'info');
            expect(toast.className).toContain('bg-amber-50');
        });

        it('skal falle tilbake til info-farge for ukjent type', () => {
            const toast = showToast('Ukjent', 'unknown');
            expect(toast.className).toContain('bg-amber-50');
        });

        it('skal fjernes automatisk etter varighet', () => {
            showToast('Auto-dismiss', 'info', { duration: 3000 });
            const container = document.getElementById('admin-toast-container');
            expect(container.children.length).toBe(1);

            vi.advanceTimersByTime(3000);
            expect(container.children.length).toBe(0);
        });

        it('skal fjernes ved klikk på lukk-knapp', () => {
            showToast('Lukk meg', 'info');
            const container = document.getElementById('admin-toast-container');
            const closeBtn = container.querySelector('button[aria-label="Lukk"]');
            expect(closeBtn).not.toBeNull();
            closeBtn.click();
            expect(container.children.length).toBe(0);
        });

        it('skal ikke auto-dismiss når duration er 0', () => {
            showToast('Varig', 'info', { duration: 0 });
            const container = document.getElementById('admin-toast-container');
            vi.advanceTimersByTime(60000);
            expect(container.children.length).toBe(1);
        });

        it('skal gjenbruke eksisterende container', () => {
            showToast('Først', 'info');
            showToast('Andre', 'error');
            const containers = document.querySelectorAll('#admin-toast-container');
            expect(containers.length).toBe(1);
            expect(containers[0].children.length).toBe(2);
        });

        it('skal bruke default varighet på 5000ms', () => {
            showToast('Default', 'info');
            const container = document.getElementById('admin-toast-container');
            vi.advanceTimersByTime(4999);
            expect(container.children.length).toBe(1);
            vi.advanceTimersByTime(1);
            expect(container.children.length).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // showConfirm
    // -------------------------------------------------------------------------
    describe('showConfirm', () => {
        it('skal opprette dialog med riktig melding', async () => {
            const promise = showConfirm('Er du sikker?');
            const dialog = document.getElementById('admin-confirm-dialog');
            expect(dialog).not.toBeNull();
            expect(dialog.textContent).toContain('Er du sikker?');

            // Resolve by clicking OK
            dialog.querySelector('#admin-confirm-ok').click();
            expect(await promise).toBe(true);
        });

        it('skal returnere false ved klikk på avbryt', async () => {
            const promise = showConfirm('Avbryt?');
            const dialog = document.getElementById('admin-confirm-dialog');
            dialog.querySelector('#admin-confirm-cancel').click();
            expect(await promise).toBe(false);
        });

        it('skal returnere false ved Escape (cancel-event)', async () => {
            const promise = showConfirm('Escape?');
            const dialog = document.getElementById('admin-confirm-dialog');
            dialog.dispatchEvent(new Event('cancel'));
            // The cancel handler calls close('cancel') which triggers the close event
            expect(await promise).toBe(false);
        });

        it('skal bruke rød bekreft-knapp med destructive-flagg', async () => {
            const promise = showConfirm('Slett?', { destructive: true });
            const dialog = document.getElementById('admin-confirm-dialog');
            const okBtn = dialog.querySelector('#admin-confirm-ok');
            expect(okBtn.className).toContain('bg-red-600');
            okBtn.click();
            await promise;
        });

        it('skal bruke standard btn-primary uten destructive-flagg', async () => {
            const promise = showConfirm('Bekreft?');
            const dialog = document.getElementById('admin-confirm-dialog');
            const okBtn = dialog.querySelector('#admin-confirm-ok');
            expect(okBtn.className).toContain('btn-primary');
            okBtn.click();
            await promise;
        });

        it('skal tillate egendefinerte knappetekster', async () => {
            const promise = showConfirm('Slett alt?', {
                confirmLabel: 'Ja, slett',
                cancelLabel: 'Nei',
            });
            const dialog = document.getElementById('admin-confirm-dialog');
            expect(dialog.querySelector('#admin-confirm-ok').textContent).toBe('Ja, slett');
            expect(dialog.querySelector('#admin-confirm-cancel').textContent).toBe('Nei');
            dialog.querySelector('#admin-confirm-ok').click();
            await promise;
        });

        it('skal gjenbruke eksisterende dialog', async () => {
            const p1 = showConfirm('Første?');
            document.getElementById('admin-confirm-dialog').querySelector('#admin-confirm-ok').click();
            await p1;

            const p2 = showConfirm('Andre?');
            const dialogs = document.querySelectorAll('#admin-confirm-dialog');
            expect(dialogs.length).toBe(1);
            expect(dialogs[0].textContent).toContain('Andre?');
            dialogs[0].querySelector('#admin-confirm-ok').click();
            await p2;
        });

        it('skal sette fokus på avbryt-knappen', async () => {
            const promise = showConfirm('Fokustest');
            const dialog = document.getElementById('admin-confirm-dialog');
            const cancelBtn = dialog.querySelector('#admin-confirm-cancel');
            expect(document.activeElement).toBe(cancelBtn);
            cancelBtn.click();
            await promise;
        });
    });

    // -------------------------------------------------------------------------
    // showBanner
    // -------------------------------------------------------------------------
    describe('showBanner', () => {
        beforeEach(() => {
            const container = document.createElement('div');
            container.id = 'test-container';
            document.body.appendChild(container);
        });

        it('skal legge til banner i angitt container', () => {
            showBanner('test-container', 'Varsel!', 'info');
            const container = document.getElementById('test-container');
            expect(container.children.length).toBe(1);
            expect(container.textContent).toContain('Varsel!');
        });

        it('skal ha role="alert"', () => {
            const banner = showBanner('test-container', 'Alert', 'error');
            expect(banner.getAttribute('role')).toBe('alert');
        });

        it('skal returnere null for ukjent container-ID', () => {
            const result = showBanner('finnes-ikke', 'Test');
            expect(result).toBeNull();
        });

        it('skal fjernes automatisk etter varighet', () => {
            showBanner('test-container', 'Auto', 'info', { duration: 5000 });
            const container = document.getElementById('test-container');
            expect(container.children.length).toBe(1);
            vi.advanceTimersByTime(5000);
            expect(container.children.length).toBe(0);
        });

        it('skal fjernes ved klikk på lukk-knapp', () => {
            showBanner('test-container', 'Lukk meg', 'info');
            const container = document.getElementById('test-container');
            const closeBtn = container.querySelector('button[aria-label="Lukk"]');
            closeBtn.click();
            expect(container.children.length).toBe(0);
        });

        it('skal bruke default varighet på 10000ms', () => {
            showBanner('test-container', 'Default', 'info');
            const container = document.getElementById('test-container');
            vi.advanceTimersByTime(9999);
            expect(container.children.length).toBe(1);
            vi.advanceTimersByTime(1);
            expect(container.children.length).toBe(0);
        });

        it('skal ikke auto-dismiss når duration er 0', () => {
            showBanner('test-container', 'Varig', 'info', { duration: 0 });
            const container = document.getElementById('test-container');
            vi.advanceTimersByTime(60000);
            expect(container.children.length).toBe(1);
        });

        it('skal prepende (legge til først) i container', () => {
            const container = document.getElementById('test-container');
            const existing = document.createElement('p');
            existing.textContent = 'Eksisterende';
            container.appendChild(existing);

            showBanner('test-container', 'Ny banner', 'info');
            expect(container.firstElementChild.getAttribute('role')).toBe('alert');
        });

        it('skal bruke error-farge for error-type', () => {
            const banner = showBanner('test-container', 'Feil', 'error');
            expect(banner.className).toContain('bg-red-50');
        });
    });

    // -------------------------------------------------------------------------
    // showAuthExpired
    // -------------------------------------------------------------------------
    describe('showAuthExpired', () => {
        let container;

        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
        });

        it('skal vise banner med "Økten din er utløpt"', () => {
            showAuthExpired(container, vi.fn());
            expect(container.textContent).toContain('Økten din er utløpt');
        });

        it('skal ha role="alert"', () => {
            const banner = showAuthExpired(container, vi.fn());
            expect(banner.getAttribute('role')).toBe('alert');
        });

        it('skal prepende banneret i containeren', () => {
            const existing = document.createElement('p');
            existing.textContent = 'Eksisterende';
            container.appendChild(existing);
            showAuthExpired(container, vi.fn());
            expect(container.firstElementChild.getAttribute('role')).toBe('alert');
        });

        it('skal ha "Logg inn"-knapp', () => {
            showAuthExpired(container, vi.fn());
            const btn = container.querySelector('.auth-expired-login-btn');
            expect(btn).not.toBeNull();
            expect(btn.textContent).toContain('Logg inn');
        });

        it('skal kalle onLogin og fjerne banner ved klikk på Logg inn', () => {
            const onLogin = vi.fn();
            showAuthExpired(container, onLogin);
            container.querySelector('.auth-expired-login-btn').click();
            expect(onLogin).toHaveBeenCalled();
            expect(container.querySelector('[role="alert"]')).toBeNull();
        });

        it('skal returnere null og ikke krasje hvis container er null', () => {
            const result = showAuthExpired(null, vi.fn());
            expect(result).toBeNull();
        });

        it('skal ikke krasje hvis onLogin er null/undefined ved klikk', () => {
            showAuthExpired(container, null);
            const btn = container.querySelector('.auth-expired-login-btn');
            expect(btn).not.toBeNull();
            // Click login button with null onLogin — should not throw
            expect(() => btn.click()).not.toThrow();
            // Banner should still be removed
            expect(container.querySelector('[role="alert"]')).toBeNull();
        });

        it('skal ikke krasje hvis onLogin er undefined ved klikk', () => {
            showAuthExpired(container, undefined);
            const btn = container.querySelector('.auth-expired-login-btn');
            expect(() => btn.click()).not.toThrow();
            expect(container.querySelector('[role="alert"]')).toBeNull();
        });
    });
});

describe('admin-dialog.js — additional branch coverage', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('showToast parentNode check on auto-removal', () => {
        it('should not throw when toast is already removed before timer fires', () => {
            const toast = showToast('Fjern meg', 'info', { duration: 3000 });
            const container = document.getElementById('admin-toast-container');
            expect(container.children.length).toBe(1);

            // Manually remove the toast before the timer fires (simulates close button click)
            toast.remove();
            expect(container.children.length).toBe(0);

            // Timer fires — toast.parentNode is null, so remove() should be skipped
            expect(() => vi.advanceTimersByTime(3000)).not.toThrow();
        });
    });

    describe('showBanner parentNode check on auto-removal', () => {
        beforeEach(() => {
            const c = document.createElement('div');
            c.id = 'test-container';
            document.body.appendChild(c);
        });

        it('should not throw when banner is already removed before timer fires', () => {
            const banner = showBanner('test-container', 'Fjern meg', 'info', { duration: 5000 });
            const container = document.getElementById('test-container');
            expect(container.children.length).toBe(1);

            // Manually remove the banner before the timer fires
            banner.remove();
            expect(container.children.length).toBe(0);

            // Timer fires — banner.parentNode is null, so remove() should be skipped
            expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
        });
    });

    describe('showBanner with unknown type (fallback to info)', () => {
        beforeEach(() => {
            const c = document.createElement('div');
            c.id = 'test-container';
            document.body.appendChild(c);
        });

        it('should fall back to info colors for unknown type', () => {
            const banner = showBanner('test-container', 'Unknown type', 'nonexistent');
            // Falls back to TOAST_COLORS.info (amber) and TOAST_ICONS.info
            expect(banner.className).toContain('bg-amber-50');
            expect(banner.className).toContain('border-amber-200');
        });

        it('should fall back to info icon for unknown type', () => {
            const banner = showBanner('test-container', 'Unknown type', 'nonexistent');
            // The icon span should contain the info icon SVG (circle with line)
            const iconSpan = banner.querySelector('span');
            expect(iconSpan.className).toContain('text-amber-500');
            expect(iconSpan.innerHTML).toContain('svg');
        });
    });
});
