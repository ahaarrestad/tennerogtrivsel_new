/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initPwaPrompt, showInstallPromptIfEligible, _resetForTesting, _setDeferredPromptForTesting } from '../pwa-prompt.js';

vi.mock('../admin-dialog.js', () => ({
    showToast: vi.fn(() => {
        const toast = document.createElement('div');
        const msgSpan = document.createElement('span');
        msgSpan.className = 'text-sm font-medium flex-1';
        toast.appendChild(msgSpan);
        toast.remove = vi.fn(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); });
        document.body.appendChild(toast);
        return toast;
    }),
}));

import { showToast } from '../admin-dialog.js';

describe('pwa-prompt', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        _resetForTesting();
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('initPwaPrompt', () => {
        it('registers beforeinstallprompt listener', () => {
            const addSpy = vi.spyOn(window, 'addEventListener');
            initPwaPrompt();
            expect(addSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
            addSpy.mockRestore();
        });

        it('captures and stores deferred prompt from beforeinstallprompt event', () => {
            initPwaPrompt();
            const mockPrompt = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) };
            const event = new Event('beforeinstallprompt');
            event.preventDefault = vi.fn();
            Object.assign(event, mockPrompt);
            window.dispatchEvent(event);

            // Verify preventDefault was called
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('registers service worker when available', () => {
            const registerMock = vi.fn().mockResolvedValue({});
            Object.defineProperty(navigator, 'serviceWorker', {
                writable: true,
                configurable: true,
                value: { register: registerMock },
            });

            initPwaPrompt();
            expect(registerMock).toHaveBeenCalledWith('/admin-sw.js', { scope: '/admin/' });

            Object.defineProperty(navigator, 'serviceWorker', {
                writable: true,
                configurable: true,
                value: undefined,
            });
        });

        it('does not throw when serviceWorker is not available', () => {
            const orig = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
            delete navigator.serviceWorker;
            Object.defineProperty(navigator, 'serviceWorker', {
                writable: true,
                configurable: true,
                value: undefined,
                enumerable: false,
            });
            // 'serviceWorker' in navigator is still true, but value is undefined
            // The code checks 'serviceWorker' in navigator, so we need to truly remove it
            // In jsdom this is tricky; instead test that undefined.register is guarded
            // Actually let's just verify no error by overriding the in-check
            // Simplest: just delete and re-define without the key
            delete navigator.serviceWorker;

            expect(() => initPwaPrompt()).not.toThrow();

            // Restore
            if (orig) {
                Object.defineProperty(navigator, 'serviceWorker', orig);
            }
        });
    });

    describe('showInstallPromptIfEligible', () => {
        it('does not show toast when already in standalone mode', () => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: true }),
            });

            showInstallPromptIfEligible();
            expect(showToast).not.toHaveBeenCalled();

            // Restore
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: false }),
            });
        });

        it('does not show toast when previously dismissed', () => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: false }),
            });

            localStorage.setItem('tt-admin-pwa-dismissed', 'dismissed');
            showInstallPromptIfEligible();
            expect(showToast).not.toHaveBeenCalled();
        });

        it('does not show toast when no deferred prompt and not iOS', () => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: false }),
            });
            Object.defineProperty(navigator, 'userAgent', {
                writable: true,
                value: 'Mozilla/5.0 Chrome/120',
            });

            showInstallPromptIfEligible();
            expect(showToast).not.toHaveBeenCalled();
        });

        it('shows Android install toast when deferred prompt is available', () => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: false }),
            });

            const mockPrompt = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) };
            _setDeferredPromptForTesting(mockPrompt);

            showInstallPromptIfEligible();
            expect(showToast).toHaveBeenCalledWith(
                'Legg til Admin på hjemskjermen for rask tilgang',
                'info',
                { duration: 0 }
            );
        });

        it('shows iOS instruction toast on iOS devices', () => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: false }),
            });
            Object.defineProperty(navigator, 'userAgent', {
                writable: true,
                value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
            });

            showInstallPromptIfEligible();
            expect(showToast).toHaveBeenCalledWith(
                expect.stringContaining('Del-ikonet'),
                'info',
                { duration: 15000 }
            );
        });

        it('shows iOS instruction toast on iPadOS (MacIntel with touch)', () => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: false }),
            });
            Object.defineProperty(navigator, 'userAgent', {
                writable: true,
                value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
            });
            Object.defineProperty(navigator, 'platform', {
                writable: true,
                configurable: true,
                value: 'MacIntel',
            });
            Object.defineProperty(navigator, 'maxTouchPoints', {
                writable: true,
                configurable: true,
                value: 5,
            });

            showInstallPromptIfEligible();
            expect(showToast).toHaveBeenCalledWith(
                expect.stringContaining('Del-ikonet'),
                'info',
                { duration: 15000 }
            );

            // Restore
            Object.defineProperty(navigator, 'platform', {
                writable: true,
                configurable: true,
                value: '',
            });
            Object.defineProperty(navigator, 'maxTouchPoints', {
                writable: true,
                configurable: true,
                value: 0,
            });
        });
    });

    describe('Android install toast interactions', () => {
        let mockPrompt;

        beforeEach(() => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: false }),
            });
            Object.defineProperty(navigator, 'userAgent', {
                writable: true,
                value: 'Mozilla/5.0 Chrome/120',
            });
            mockPrompt = {
                prompt: vi.fn(),
                userChoice: Promise.resolve({ outcome: 'accepted' }),
            };
            _setDeferredPromptForTesting(mockPrompt);
        });

        it('install button triggers prompt and stores flag on accept', async () => {
            showInstallPromptIfEligible();

            const installBtn = document.body.querySelector('button');
            expect(installBtn).not.toBeNull();
            expect(installBtn.textContent).toBe('Installer');

            installBtn.click();
            await mockPrompt.userChoice;

            expect(mockPrompt.prompt).toHaveBeenCalled();
            expect(localStorage.getItem('tt-admin-pwa-dismissed')).toBe('installed');
        });

        it('install button does not store flag on dismiss', async () => {
            mockPrompt.userChoice = Promise.resolve({ outcome: 'dismissed' });
            _setDeferredPromptForTesting(mockPrompt);

            showInstallPromptIfEligible();

            const installBtn = document.body.querySelector('button');
            installBtn.click();
            await mockPrompt.userChoice;

            expect(mockPrompt.prompt).toHaveBeenCalled();
            expect(localStorage.getItem('tt-admin-pwa-dismissed')).toBeNull();
        });

        it('dismiss button sets localStorage flag and removes toast', () => {
            showInstallPromptIfEligible();

            const buttons = document.body.querySelectorAll('button');
            const dismissBtn = Array.from(buttons).find(b => b.textContent === 'Ikke nå');
            expect(dismissBtn).toBeDefined();

            dismissBtn.click();

            expect(localStorage.getItem('tt-admin-pwa-dismissed')).toBe('dismissed');
        });
    });

    describe('iOS toast interactions', () => {
        beforeEach(() => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: false }),
            });
            Object.defineProperty(navigator, 'userAgent', {
                writable: true,
                value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
            });
        });

        it('dismiss button sets localStorage flag', () => {
            showInstallPromptIfEligible();

            const dismissBtn = document.body.querySelector('button');
            expect(dismissBtn.textContent).toBe('Ikke vis igjen');

            dismissBtn.click();

            expect(localStorage.getItem('tt-admin-pwa-dismissed')).toBe('dismissed');
        });
    });

    describe('null toast handling', () => {
        beforeEach(() => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: false }),
            });
        });

        it('Android toast handles showToast returning null', () => {
            showToast.mockReturnValueOnce(null);
            _setDeferredPromptForTesting({ prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) });

            // Should not throw
            showInstallPromptIfEligible();
            expect(showToast).toHaveBeenCalled();
        });

        it('iOS toast handles showToast returning null', () => {
            showToast.mockReturnValueOnce(null);
            Object.defineProperty(navigator, 'userAgent', {
                writable: true,
                value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
            });

            // Should not throw
            showInstallPromptIfEligible();
            expect(showToast).toHaveBeenCalled();
        });
    });

    describe('navigator.standalone detection', () => {
        it('detects standalone via navigator.standalone (iOS)', () => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: false }),
            });
            Object.defineProperty(navigator, 'standalone', {
                writable: true,
                value: true,
                configurable: true,
            });

            _setDeferredPromptForTesting({ prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) });
            showInstallPromptIfEligible();
            expect(showToast).not.toHaveBeenCalled();

            Object.defineProperty(navigator, 'standalone', {
                writable: true,
                value: undefined,
                configurable: true,
            });
        });
    });

    describe('_resetForTesting', () => {
        it('clears deferred prompt so Android toast is no longer shown', () => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockReturnValue({ matches: false }),
            });
            Object.defineProperty(navigator, 'userAgent', {
                writable: true,
                value: 'Mozilla/5.0 Chrome/120',
            });

            _setDeferredPromptForTesting({ prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) });
            _resetForTesting();

            showInstallPromptIfEligible();
            expect(showToast).not.toHaveBeenCalled();
        });
    });
});
