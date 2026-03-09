/**
 * Delte test-hjelpere for admin-moduler.
 *
 * Bruk:
 *   import { createMockAutoSaver, mockAdminDialog, setupModuleDOM } from './test-helpers.js';
 */

/**
 * Lag en mock createAutoSaver-factory.
 * Returnerer et objekt med trigger/cancel og tilgang til saveFn.
 */
export function createMockAutoSaver() {
    return vi.fn((saveFn) => ({
        trigger: vi.fn(),
        cancel: vi.fn(),
        _saveFn: saveFn,
    }));
}

/**
 * Standard admin-dialog mock-factory.
 * @param {Object} overrides — overstyr individuelle funksjoner
 */
export function mockAdminDialog(overrides = {}) {
    return {
        showToast: vi.fn(),
        showConfirm: vi.fn().mockResolvedValue(false),
        showAuthExpired: vi.fn(),
        showBanner: vi.fn(),
        ...overrides,
    };
}

/**
 * Sett opp standard modul-DOM med admin-config og containere.
 * @param {Object} opts
 * @param {string} opts.configAttrs — ekstra attributter på #admin-config
 * @param {string} opts.extraHTML — ekstra HTML etter standard-elementer
 */
export function setupModuleDOM({ configAttrs = '', extraHTML = '' } = {}) {
    document.body.innerHTML = `
        <div id="admin-config" ${configAttrs}></div>
        <div id="module-inner"></div>
        <div id="module-actions"></div>
        ${extraHTML}
    `;
}
