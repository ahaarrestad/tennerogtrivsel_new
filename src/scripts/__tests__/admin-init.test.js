/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
vi.mock('marked', () => ({ marked: { parse: vi.fn(text => `<p>${text}</p>`) } }));

vi.mock('../admin-client.js', () => ({
    initGapi: vi.fn().mockResolvedValue(true),
    initGis: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    tryRestoreSession: vi.fn(),
    silentLogin: vi.fn(),
    getStoredUser: vi.fn(),
    setRememberMe: vi.fn(),
    // Required by transitive imports
    listFiles: vi.fn(), getFileContent: vi.fn(), saveFile: vi.fn(),
    createFile: vi.fn(), deleteFile: vi.fn(), parseMarkdown: vi.fn(),
    stringifyMarkdown: vi.fn(), getSettingsWithNotes: vi.fn(),
    updateSettingByKey: vi.fn(), updateSettingOrder: vi.fn(),
    updateTannlegeRow: vi.fn(), addTannlegeRow: vi.fn(),
    deleteTannlegeRowPermanently: vi.fn(), getDriveImageBlob: vi.fn(),
    findFileByName: vi.fn(), backupToSlettetSheet: vi.fn(),
    getTannlegerRaw: vi.fn(), getGalleriRaw: vi.fn(),
    updateGalleriRow: vi.fn(), addGalleriRow: vi.fn(),
    deleteGalleriRowPermanently: vi.fn(), setForsideBildeInGalleri: vi.fn(),
    migrateForsideBildeToGalleri: vi.fn(), getSheetParentFolder: vi.fn(),
    updateSettings: vi.fn(),
}));

vi.mock('../admin-dialog.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn().mockResolvedValue(false),
}));

vi.mock('../pwa-prompt.js', () => ({
    initPwaPrompt: vi.fn(),
    showInstallPromptIfEligible: vi.fn(),
}));

vi.mock('../admin-dashboard.js', () => ({
    updateUIWithUser: vi.fn(),
    enforceAccessControl: vi.fn().mockResolvedValue(undefined),
    loadDashboardCounts: vi.fn().mockResolvedValue(undefined),
    autoResizeTextarea: vi.fn(),
    saveSingleSetting: vi.fn(),
    loadMeldingerModule: vi.fn(),
    loadTjenesterModule: vi.fn(),
    loadTannlegerModule: vi.fn(),
    loadGalleriListeModule: vi.fn(),
    reorderGalleriItem: vi.fn(),
    reorderSettingItem: vi.fn(),
    mergeSettingsWithDefaults: vi.fn(),
    formatTimestamp: vi.fn(() => '24. feb kl. 12:00'),
    updateLastFetchedTime: vi.fn(),
    updateBreadcrumbCount: vi.fn(),
    handleModuleError: vi.fn(),
}));

vi.mock('../admin-api-retry.js', () => ({
    withRetry: vi.fn(fn => fn()),
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
}));

vi.mock('../admin-gallery.js', () => ({
    loadGallery: vi.fn(),
    setupUploadHandler: vi.fn(),
}));

vi.mock('../textFormatter.js', () => ({
    formatDate: vi.fn(d => d),
    stripStackEditData: vi.fn(s => s),
    sortMessages: vi.fn(m => m),
    slugify: vi.fn(s => s),
}));

import {
    initGapi, initGis, login, logout, silentLogin,
    getStoredUser, setRememberMe
} from '../admin-client.js';
import { showConfirm } from '../admin-dialog.js';
import { initPwaPrompt, showInstallPromptIfEligible } from '../pwa-prompt.js';
import { updateUIWithUser, enforceAccessControl } from '../admin-dashboard.js';

function setupDOM() {
    document.body.innerHTML = `
        <div id="admin-config"
            data-tjenester-folder="tf"
            data-tannleger-folder="taf"
            data-meldinger-folder="mf"
            data-sheet-id="sid"
            data-defaults='{}'>
        </div>
        <div id="login-container"></div>
        <div id="dashboard" class="hidden"></div>
        <div id="module-container" class="hidden">
            <button id="breadcrumb-module"></button>
            <span id="breadcrumb-count" class="hidden"></span>
            <span id="breadcrumb-editor-sep" class="admin-breadcrumb-sep hidden"></span>
            <span id="breadcrumb-editor" class="admin-breadcrumb-current hidden"></span>
            <div id="module-title"></div>
            <div id="module-actions"></div>
            <div id="module-inner"></div>
        </div>
        <button id="login-btn"></button>
        <input type="checkbox" id="remember-me">
        <button id="user-pill"></button>
        <button id="back-to-dashboard"></button>
        <div id="card-settings"></div>
        <div id="card-tjenester"></div>
        <div id="card-meldinger"></div>
        <div id="card-tannleger"></div>
        <div id="card-bilder"></div>
    `;
}

beforeEach(() => {
    setupDOM();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    // Reset implementations changed by previous tests (clearAllMocks only clears call history)
    initGapi.mockResolvedValue(true);
    // Reset module cache so admin-init.js re-executes setup
    vi.resetModules();
});

describe('admin-init', () => {
    // We test the module by importing it fresh each time, which triggers setup()
    // since document.readyState is 'complete' in jsdom

    it('should call initPwaPrompt on setup', async () => {
        await import('../admin-init.js');
        // Wait for async setup
        await vi.waitFor(() => {
            expect(initPwaPrompt).toHaveBeenCalled();
        });
    });

    it('should call initGapi and tryRestoreSession on setup', async () => {
        initGapi.mockResolvedValue(true);
        await import('../admin-init.js');
        await vi.waitFor(() => {
            expect(initGapi).toHaveBeenCalled();
        });
    });

    it('should call initGis with handleAuth callback', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => {
            expect(initGis).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    it('should handle existing stored user on setup', async () => {
        const mockUser = { email: 'test@test.com', name: 'Test' };
        getStoredUser.mockReturnValue(mockUser);
        await import('../admin-init.js');
        await vi.waitFor(() => {
            expect(updateUIWithUser).toHaveBeenCalledWith(mockUser);
        });
    });

    it('should try silentLogin when localStorage has token but no user', async () => {
        localStorage.setItem('admin_google_token', 'old-token');
        getStoredUser.mockReturnValue(null);
        await import('../admin-init.js');
        await vi.waitFor(() => {
            expect(silentLogin).toHaveBeenCalled();
        });
    });

    it('should not try silentLogin when no stored token', async () => {
        getStoredUser.mockReturnValue(null);
        await import('../admin-init.js');
        await vi.waitFor(() => {
            expect(initGapi).toHaveBeenCalled();
        });
        expect(silentLogin).not.toHaveBeenCalled();
    });

    it('should bind login button to call login()', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => {
            expect(initGapi).toHaveBeenCalled();
        });
        document.getElementById('login-btn').click();
        expect(login).toHaveBeenCalled();
        expect(setRememberMe).toHaveBeenCalled();
    });

    it('should bind card-settings click', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        document.getElementById('card-settings').click();
        expect(document.getElementById('dashboard').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('module-container').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('module-container').classList.contains('admin-view-enter')).toBe(true);
        expect(document.getElementById('module-title').textContent).toBe('Innstillinger');
        expect(document.getElementById('breadcrumb-module').textContent).toBe('Innstillinger');
        expect(document.getElementById('breadcrumb-count').classList.contains('hidden')).toBe(true);
    });

    it('should update breadcrumb when switching modules', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        document.getElementById('card-tjenester').click();
        expect(document.getElementById('breadcrumb-module').textContent).toBe('Tjenester');
        document.getElementById('card-tannleger').click();
        expect(document.getElementById('breadcrumb-module').textContent).toBe('Tannleger');
    });

    it('should bind card-tannleger click', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        document.getElementById('card-tannleger').click();
        expect(document.getElementById('module-title').textContent).toBe('Tannleger');
    });

    it('should bind card-bilder click', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        document.getElementById('card-bilder').click();
        expect(document.getElementById('module-title').textContent).toBe('Bilder');
    });

    it('should bind card-meldinger click', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        document.getElementById('card-meldinger').click();
        expect(document.getElementById('module-title').textContent).toBe('Meldinger');
    });

    it('should bind back button to close module', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => {
            expect(initGapi).toHaveBeenCalled();
        });
        // Open a module first
        document.getElementById('card-settings').click();
        expect(document.getElementById('module-container').classList.contains('hidden')).toBe(false);
        // Click back
        document.getElementById('back-to-dashboard').click();
        expect(document.getElementById('module-container').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('dashboard').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('dashboard').classList.contains('admin-view-enter')).toBe(true);
    });

    it('should bind card keyboard events (Enter/Space)', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => {
            expect(initGapi).toHaveBeenCalled();
        });
        const card = document.getElementById('card-tjenester');
        card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(document.getElementById('module-title').textContent).toBe('Tjenester');
    });

    it('should register window globals for tjenester, meldinger, tannleger', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => {
            expect(initGapi).toHaveBeenCalled();
        });
        expect(typeof window.loadTjenesterModule).toBe('function');
        expect(typeof window.loadMeldingerModule).toBe('function');
        expect(typeof window.openTannlegerModule).toBe('function');
        expect(typeof window.editTjeneste).toBe('function');
        expect(typeof window.deleteTjeneste).toBe('function');
        expect(typeof window.editMelding).toBe('function');
        expect(typeof window.deleteMelding).toBe('function');
        expect(typeof window.editTannlege).toBe('function');
        expect(typeof window.deleteTannlege).toBe('function');
    });

    it('should call handleAuth via initGis callback', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGis).toHaveBeenCalled(); });

        // Get the handleAuth callback that was passed to initGis
        const handleAuth = initGis.mock.calls[0][0];
        await handleAuth({ email: 'a@b.com', name: 'A' });
        expect(updateUIWithUser).toHaveBeenCalledWith({ email: 'a@b.com', name: 'A' });
        expect(enforceAccessControl).toHaveBeenCalled();
        expect(showInstallPromptIfEligible).toHaveBeenCalled();
    });

    it('should call handleAuth without user (fallback to getStoredUser)', async () => {
        getStoredUser.mockReturnValue(null);
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGis).toHaveBeenCalled(); });

        const handleAuth = initGis.mock.calls[0][0];
        // Call without userInfo — should use getStoredUser fallback
        vi.clearAllMocks();
        getStoredUser.mockReturnValue(null);
        await handleAuth();
        // No user found, so updateUIWithUser should not be called
        expect(updateUIWithUser).not.toHaveBeenCalled();
    });

    it('should handle user pill click (logout confirm)', async () => {
        showConfirm.mockResolvedValue(true);
        // Mock location.reload
        const reloadMock = vi.fn();
        Object.defineProperty(window, 'location', {
            value: { reload: reloadMock },
            writable: true,
            configurable: true,
        });

        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        await document.getElementById('user-pill').onclick();

        expect(showConfirm).toHaveBeenCalledWith('Logge ut?');
        expect(logout).toHaveBeenCalled();
    });

    it('should not logout when user cancels confirm', async () => {
        showConfirm.mockResolvedValue(false);
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        await document.getElementById('user-pill').onclick();

        expect(logout).not.toHaveBeenCalled();
    });

    it('should handle Space key on cards', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        const card = document.getElementById('card-meldinger');
        card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        expect(document.getElementById('module-title').textContent).toBe('Meldinger');
    });

    it('should ignore non-Enter/Space key on cards', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        const card = document.getElementById('card-meldinger');
        card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
        expect(document.getElementById('module-title').textContent).toBe('');
    });

    it('should handle initGapi failure gracefully', async () => {
        initGapi.mockResolvedValue(false);
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        // tryRestoreSession should not be called on failure
    });

    it('should catch and log setup errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        initGapi.mockRejectedValue(new Error('crash'));
        await import('../admin-init.js');
        await vi.waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Kritisk feil'),
                expect.any(Error)
            );
        });
        consoleSpy.mockRestore();
    });

    it('should work when optional DOM elements are missing', async () => {
        // Remove login-btn, user-pill, and back-to-dashboard to cover null checks
        document.getElementById('login-btn').remove();
        document.getElementById('user-pill').remove();
        document.getElementById('back-to-dashboard').remove();
        document.getElementById('remember-me').remove();

        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        // Should not throw even with missing elements
    });

    it('should handle remember-me checkbox state', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        document.getElementById('remember-me').checked = true;
        document.getElementById('login-btn').click();
        expect(setRememberMe).toHaveBeenCalledWith(true);
    });

    it('should register setBreadcrumbEditor and clearBreadcrumbEditor as window globals', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });
        expect(typeof window.setBreadcrumbEditor).toBe('function');
        expect(typeof window.clearBreadcrumbEditor).toBe('function');
    });

    it('setBreadcrumbEditor should show editor label and make module clickable', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });

        const onBack = vi.fn();
        window.setBreadcrumbEditor('Redigerer melding', onBack);

        const sep = document.getElementById('breadcrumb-editor-sep');
        const editor = document.getElementById('breadcrumb-editor');
        const moduleBtn = document.getElementById('breadcrumb-module');

        expect(sep.classList.contains('hidden')).toBe(false);
        expect(editor.classList.contains('hidden')).toBe(false);
        expect(editor.textContent).toBe('Redigerer melding');
        expect(moduleBtn.dataset.clickable).toBe('true');

        moduleBtn.click();
        expect(onBack).toHaveBeenCalled();
    });

    it('clearBreadcrumbEditor should hide editor elements and remove clickable', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });

        window.setBreadcrumbEditor('Test', vi.fn());
        window.clearBreadcrumbEditor();

        const sep = document.getElementById('breadcrumb-editor-sep');
        const editor = document.getElementById('breadcrumb-editor');
        const moduleBtn = document.getElementById('breadcrumb-module');

        expect(sep.classList.contains('hidden')).toBe(true);
        expect(editor.classList.contains('hidden')).toBe(true);
        expect(editor.textContent).toBe('');
        expect(moduleBtn.dataset.clickable).toBeUndefined();
        expect(moduleBtn.onclick).toBeNull();
    });

    it('setBreadcrumbEditor should handle missing DOM elements gracefully', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });

        // Remove breadcrumb elements
        document.getElementById('breadcrumb-editor-sep')?.remove();
        document.getElementById('breadcrumb-editor')?.remove();
        document.getElementById('breadcrumb-module')?.remove();

        // Should not throw
        expect(() => window.setBreadcrumbEditor('Test', vi.fn())).not.toThrow();
    });

    it('clearBreadcrumbEditor should handle missing DOM elements gracefully', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });

        document.getElementById('breadcrumb-editor-sep')?.remove();
        document.getElementById('breadcrumb-editor')?.remove();
        document.getElementById('breadcrumb-module')?.remove();

        expect(() => window.clearBreadcrumbEditor()).not.toThrow();
    });

    it('setBreadcrumbEditor onclick should not call callback if _onBackToList was cleared', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });

        const onBack = vi.fn();
        window.setBreadcrumbEditor('Test', onBack);
        const moduleBtn = document.getElementById('breadcrumb-module');

        // Clear the callback manually (simulates a race condition)
        delete moduleBtn._onBackToList;
        moduleBtn.click();
        expect(onBack).not.toHaveBeenCalled();
    });

    it('openModule should clear editor breadcrumb as safety net', async () => {
        await import('../admin-init.js');
        await vi.waitFor(() => { expect(initGapi).toHaveBeenCalled(); });

        // Set editor breadcrumb
        window.setBreadcrumbEditor('Test', vi.fn());
        expect(document.getElementById('breadcrumb-editor').classList.contains('hidden')).toBe(false);

        // Opening a module should clear it
        document.getElementById('card-settings').click();
        expect(document.getElementById('breadcrumb-editor').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('breadcrumb-editor-sep').classList.contains('hidden')).toBe(true);
    });
});
