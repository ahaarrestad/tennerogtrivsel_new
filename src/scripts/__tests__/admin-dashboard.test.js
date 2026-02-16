/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    updateUIWithUser, autoResizeTextarea, saveSingleSetting, loadMeldingerModule, initEditors
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
    getSettingsWithNotes: vi.fn()
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
            expect(onEdit).toHaveBeenCalledWith('1');

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
});
