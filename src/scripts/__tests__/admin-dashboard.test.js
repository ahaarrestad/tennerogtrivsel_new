/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    updateUIWithUser, autoResizeTextarea, saveSingleSetting, loadMeldingerModule, initEditors, enforceAccessControl,
    loadTjenesterModule, initMarkdownEditor
} from '../admin-dashboard.js';
import * as adminClient from '../admin-client.js';
import * as textFormatter from '../textFormatter.js';

// Mock admin-client
vi.mock('../admin-client.js', () => ({
    updateSettings: vi.fn().mockResolvedValue(true),
    listFiles: vi.fn(),
    getFileContent: vi.fn(),
    saveFile: vi.fn(),
    createFile: vi.fn(),
    deleteFile: vi.fn(),
    parseMarkdown: vi.fn(),
    stringifyMarkdown: vi.fn(),
    getSettingsWithNotes: vi.fn(),
    checkMultipleAccess: vi.fn(),
    logout: vi.fn()
}));

// Mock textFormatter
vi.mock('../textFormatter.js', () => ({
    formatDate: vi.fn(d => d),
    sortMessages: vi.fn(m => m),
    stripStackEditData: vi.fn(c => c),
    slugify: vi.fn(t => t)
}));

describe('admin-dashboard.js', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('updateUIWithUser', () => {
        it('should show dashboard and hide login when user is provided', () => {
            document.body.innerHTML = `
                <div id="login-container"></div>
                <div id="dashboard" class="hidden"></div>
                <div id="no-access" class="hidden"></div>
                <button id="user-pill" style="display: none;"></button>
                <span id="nav-user-info"></span>
            `;

            const user = { name: 'Test User', email: 'test@example.com' };
            updateUIWithUser(user);

            expect(document.getElementById('login-container').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('dashboard').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('user-pill').style.display).toBe('flex');
            expect(document.getElementById('nav-user-info').textContent).toBe('Test User');
        });
    });

    describe('autoResizeTextarea', () => {
        it('should adjust height based on scrollHeight', () => {
            const textarea = document.createElement('textarea');
            // Mock scrollHeight
            Object.defineProperty(textarea, 'scrollHeight', { value: 100 });
            
            autoResizeTextarea(textarea);
            
            expect(textarea.style.height).toBe('100px');
        });
    });

    describe('saveSingleSetting', () => {
        it('should call updateSettings if value changed', async () => {
            document.body.innerHTML = '<div id="status-0"></div>';
            const input = document.createElement('input');
            input.value = 'new value';
            const currentSettings = [{ id: 'test', value: 'old value' }];
            const sheetId = 'mock-sheet-id';

            await saveSingleSetting(0, input, currentSettings, sheetId);

            expect(adminClient.updateSettings).toHaveBeenCalledWith(sheetId, [{ id: 'test', value: 'new value' }]);
            expect(document.getElementById('status-0').innerHTML).toContain('✅');
        });

        it('should do nothing if value is unchanged', async () => {
            document.body.innerHTML = '<div id="status-0"></div>';
            const input = document.createElement('input');
            input.value = 'old value';
            const currentSettings = [{ id: 'test', value: 'old value' }];

            await saveSingleSetting(0, input, currentSettings, 'id');

            expect(adminClient.updateSettings).not.toHaveBeenCalled();
        });
    });

    describe('loadMeldingerModule', () => {
        it('should list messages and attach edit/delete handlers', async () => {
            document.body.innerHTML = `
                <div id="module-inner"></div>
                <div id="module-actions"></div>
            `;

            adminClient.listFiles.mockResolvedValue([{ id: '1', name: 'test.md' }]);
            adminClient.getFileContent.mockResolvedValue('---title: Test---body');
            adminClient.parseMarkdown.mockReturnValue({ data: { title: 'Test' }, body: 'body' });

            const onEdit = vi.fn();
            const onDelete = vi.fn();

            await loadMeldingerModule('folder-id', onEdit, onDelete);

            expect(document.getElementById('module-inner').innerHTML).toContain('Test');
            
            const editBtn = document.querySelector('.edit-btn');
            editBtn.click();
            expect(onEdit).toHaveBeenCalledWith('1', 'test.md');

            const deleteBtn = document.querySelector('.delete-btn');
            deleteBtn.click();
            expect(onDelete).toHaveBeenCalledWith('1', 'test.md');
        });

        it('should show empty message when no files found', async () => {
            document.body.innerHTML = `
                <div id="module-inner"></div>
                <div id="module-actions"></div>
            `;

            adminClient.listFiles.mockResolvedValue([]);

            await loadMeldingerModule('folder-id', vi.fn(), vi.fn());

            expect(document.getElementById('module-inner').textContent).toContain('Ingen meldinger funnet');
        });
    });

    describe('loadTjenesterModule', () => {
        it('should list services and sort them by title', async () => {
            document.body.innerHTML = `
                <div id="module-inner"></div>
                <div id="module-actions"></div>
            `;

            adminClient.listFiles.mockResolvedValue([
                { id: 'z', name: 'z.md' },
                { id: 'a', name: 'a.md' }
            ]);
            adminClient.getFileContent.mockResolvedValue('---title: Z---body');
            // Mock parseMarkdown to return different titles
            adminClient.parseMarkdown
                .mockReturnValueOnce({ data: { title: 'Zebra' }, body: 'z' })
                .mockReturnValueOnce({ data: { title: 'Ape' }, body: 'a' });

            const onEdit = vi.fn();
            await loadTjenesterModule('folder-id', onEdit, vi.fn());

            const titles = Array.from(document.querySelectorAll('#module-inner h3')).map(h => h.textContent);
            expect(titles).toEqual(['Ape', 'Zebra']);

            const firstEditBtn = document.querySelector('.edit-btn');
            firstEditBtn.click();
            // Since Ape was first in sorted list, its id was 'a' and name was 'a.md'
            expect(onEdit).toHaveBeenCalledWith('a', 'a.md');
        });
    });

    describe('initMarkdownEditor', () => {
        it('should initialize EasyMDE without Flatpickr', () => {
            const mockMDE = vi.fn().mockImplementation(function() { this.value = () => 'content'; });
            window.EasyMDE = mockMDE;

            document.body.innerHTML = `
                <textarea id="edit-content"></textarea>
                <button id="btn-save-tjeneste"></button>
            `;

            initMarkdownEditor(vi.fn());
            expect(mockMDE).toHaveBeenCalled();
            expect(window.flatpickr).toBeUndefined();
            
            delete window.EasyMDE;
        });
    });

    describe('initEditors', () => {
        it('should handle missing globals gracefully', () => {
            document.body.innerHTML = `
                <input type="text" id="edit-start">
                <input type="text" id="edit-end">
                <textarea id="edit-content"></textarea>
                <button id="btn-save-melding"></button>
            `;
            
            const mde = initEditors(vi.fn(), vi.fn());
            expect(mde).toBeNull();
        });

        it('should initialize EasyMDE and Flatpickr when globals exist', () => {
            const mockMDE = vi.fn().mockImplementation(function() {
                this.value = () => 'content';
            });
            const mockFP = vi.fn();
            window.EasyMDE = mockMDE;
            window.flatpickr = mockFP;

            document.body.innerHTML = `
                <input type="text" id="edit-start">
                <input type="text" id="edit-end">
                <textarea id="edit-content"></textarea>
                <button id="btn-save-melding"></button>
            `;

            initEditors(vi.fn(), vi.fn());

            expect(mockMDE).toHaveBeenCalled();
            expect(mockFP).toHaveBeenCalled();
            
            delete window.EasyMDE;
            delete window.flatpickr;
        });
    });

    describe('enforceAccessControl', () => {
        const config = {
            SHEET_ID: 's1',
            TJENESTER_FOLDER: 'f1',
            MELDINGER_FOLDER: 'f2',
            TANNLEGER_FOLDER: 'f3'
        };

        it('should enable modules where user has access', async () => {
            document.body.innerHTML = `
                <div class="admin-card-interactive"><button id="btn-open-settings"></button></div>
                <div class="admin-card-interactive"><button id="btn-open-tjenester"></button></div>
            `;

            adminClient.checkMultipleAccess.mockResolvedValue({
                's1': true,
                'f1': false
            });

            await enforceAccessControl(config);

            const settingsBtn = document.getElementById('btn-open-settings');
            const tjenesterBtn = document.getElementById('btn-open-tjenester');

            expect(settingsBtn.disabled).toBe(false);
            expect(tjenesterBtn.disabled).toBe(true);
            expect(tjenesterBtn.textContent).toBe('Ingen tilgang');
        });

        it('should logout and redirect if no access at all', async () => {
            // Mock location
            const originalLocation = window.location;
            // In JSDOM we can sometimes just set it, but let's be careful
            delete window.location;
            window.location = { href: '' };

            adminClient.checkMultipleAccess.mockResolvedValue({
                's1': false, 'f1': false, 'f2': false, 'f3': false
            });

            await enforceAccessControl(config);

            expect(adminClient.logout).toHaveBeenCalled();
            expect(window.location.href).toContain('/?access_denied=true');

            window.location = originalLocation;
        });
    });
});
