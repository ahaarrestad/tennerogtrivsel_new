/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as adminDashboard from '../admin-dashboard.js';
import * as adminClient from '../admin-client.js';

// Mock admin-client
vi.mock('../admin-client.js', () => ({
    listFiles: vi.fn(),
    getFileContent: vi.fn(),
    saveFile: vi.fn(),
    createFile: vi.fn(),
    deleteFile: vi.fn(),
    parseMarkdown: vi.fn(content => {
        // Enkel mock av parseMarkdown logikk
        if (content.includes('title: Active')) return { data: { title: 'Active', startDate: '2026-02-10', endDate: '2026-02-20' }, body: '' };
        if (content.includes('title: Planned')) return { data: { title: 'Planned', startDate: '2026-03-01', endDate: '2026-03-10' }, body: '' };
        if (content.includes('title: Expired')) return { data: { title: 'Expired', startDate: '2026-01-01', endDate: '2026-01-10' }, body: '' };
        if (content.includes('title: A')) return { data: { title: 'A' }, body: '' };
        if (content.includes('title: B')) return { data: { title: 'B' }, body: '' };
        return { data: { title: 'Test' }, body: '' };
    }),
    stringifyMarkdown: vi.fn(),
    updateSettings: vi.fn(),
    getSettingsWithNotes: vi.fn(),
    checkMultipleAccess: vi.fn(),
    logout: vi.fn(),
    getTannlegerRaw: vi.fn(),
    updateTannlegeRow: vi.fn(),
    addTannlegeRow: vi.fn(),
    deleteTannlegeRow: vi.fn()
}));

// Mock textFormatter
vi.mock('../textFormatter.js', () => ({
    formatDate: vi.fn(d => d),
    stripStackEditData: vi.fn(s => s),
    sortMessages: vi.fn(m => m),
    slugify: vi.fn(s => s)
}));

const { 
    enforceAccessControl, updateUIWithUser, autoResizeTextarea, 
    saveSingleSetting, loadMeldingerModule, loadTjenesterModule, 
    loadTannlegerModule 
} = adminDashboard;

describe('admin-dashboard.js', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="login-container"></div>
            <div id="dashboard" class="hidden"></div>
            <div id="user-pill" style="display:none"></div>
            <div id="nav-user-info"></div>
            <div id="module-inner"></div>
            <div id="module-actions"></div>
            <div class="admin-card-interactive"><button id="btn-open-settings"></button></div>
            <div class="admin-card-interactive"><button id="btn-open-tjenester"></button></div>
            <div class="admin-card-interactive"><button id="btn-open-meldinger"></button></div>
            <div class="admin-card-interactive"><button id="btn-open-tannleger"></button></div>
            <div class="admin-card-interactive"><button id="btn-open-forsidebilde"></button></div>
        `;
        vi.clearAllMocks();
    });

    describe('updateUIWithUser', () => {
        it('should show dashboard and hide login when user is provided', () => {
            updateUIWithUser({ name: 'Ola', email: 'ola@test.no' });
            expect(document.getElementById('login-container').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('dashboard').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('nav-user-info').textContent).toBe('Ola');
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
            const settings = [{ id: 'siteTitle', value: 'Old' }];
            const input = document.createElement('input');
            input.value = 'New';
            const status = document.createElement('div');
            status.id = 'status-0';
            document.body.appendChild(status);

            adminClient.updateSettings.mockResolvedValue(true);
            
            await saveSingleSetting(0, input, settings, 'sheet-123');
            
            expect(adminClient.updateSettings).toHaveBeenCalled();
            expect(settings[0].value).toBe('New');
        });

        it('should handle save error', async () => {
            const settings = [{ id: 'siteTitle', value: 'Old' }];
            const input = document.createElement('input');
            input.value = 'New';
            const status = document.createElement('div');
            status.id = 'status-0';
            document.body.appendChild(status);

            adminClient.updateSettings.mockRejectedValue(new Error('fail'));
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            await saveSingleSetting(0, input, settings, 'sheet-123');
            expect(status.innerHTML).toContain('❌');
            spy.mockRestore();
        });

        it('should do nothing if value is unchanged', async () => {
            const settings = [{ id: 'siteTitle', value: 'Same' }];
            const input = document.createElement('input');
            input.value = 'Same';
            const status = document.createElement('div');
            status.id = 'status-0';
            document.body.appendChild(status);

            await saveSingleSetting(0, input, settings, 'sheet-123');
            expect(adminClient.updateSettings).not.toHaveBeenCalled();
        });
    });

    describe('loadMeldingerModule', () => {
        it('should list messages and attach edit/delete handlers', async () => {
            const mockFiles = [{ id: '1', name: 'active.md' }];
            adminClient.listFiles.mockResolvedValue(mockFiles);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: Active\nstartDate: 2026-01-01\n---');
            
            const onEdit = vi.fn();
            const onDelete = vi.fn();
            
            await loadMeldingerModule('folder-id', onEdit, onDelete);
            
            const inner = document.getElementById('module-inner');
            expect(inner.innerHTML).toContain('Active');
            
            inner.querySelector('.edit-btn').click();
            expect(onEdit).toHaveBeenCalledWith('1', 'active.md');
            
            inner.querySelector('.delete-btn').click();
            expect(onDelete).toHaveBeenCalledWith('1', 'active.md');
        });

        it('should show empty message when no files found', async () => {
            adminClient.listFiles.mockResolvedValue([]);
            await loadMeldingerModule('folder-id', vi.fn(), vi.fn());
            expect(document.getElementById('module-inner').textContent).toContain('Ingen oppslag funnet');
        });

        it('should handle API errors gracefully', async () => {
            adminClient.listFiles.mockRejectedValue(new Error('Fail'));
            await loadMeldingerModule('folder-id', vi.fn(), vi.fn());
            expect(document.getElementById('module-inner').textContent).toContain('Kunne ikke laste oppslag');
        });

        it('should categorize messages into groups', async () => {
            const today = new Date('2026-02-15');
            vi.setSystemTime(today);

            const mockFiles = [
                { id: '1', name: 'active.md' },
                { id: '2', name: 'planned.md' },
                { id: '3', name: 'expired.md' }
            ];
            adminClient.listFiles.mockResolvedValue(mockFiles);
            adminClient.getFileContent.mockImplementation(id => {
                if (id === '1') return Promise.resolve('---\ntitle: Active\nstartDate: 2026-02-10\nendDate: 2026-02-20\n---');
                if (id === '2') return Promise.resolve('---\ntitle: Planned\nstartDate: 2026-03-01\nendDate: 2026-03-10\n---');
                return Promise.resolve('---\ntitle: Expired\nstartDate: 2026-01-01\nendDate: 2026-01-10\n---');
            });

            await loadMeldingerModule('folder-id', vi.fn(), vi.fn());
            const html = document.getElementById('module-inner').innerHTML;
            expect(html).toContain('Aktive oppslag');
            expect(html).toContain('Planlagte oppslag');
            expect(html).toContain('Historikk');

            vi.useRealTimers();
        });

        it('should highlight overlapping messages with amber border', async () => {
            const today = new Date('2026-02-15');
            vi.setSystemTime(today);

            const mockFiles = [
                { id: '1', name: 'msg1.md' },
                { id: '2', name: 'msg2.md' }
            ];
            adminClient.listFiles.mockResolvedValue(mockFiles);
            adminClient.getFileContent
                .mockResolvedValueOnce('---\ntitle: Active1\nstartDate: 2026-02-10\nendDate: 2026-02-20\n---')
                .mockResolvedValueOnce('---\ntitle: Active2\nstartDate: 2026-02-12\nendDate: 2026-02-25\n---');
            adminClient.parseMarkdown
                .mockReturnValueOnce({ data: { title: 'Active1', startDate: '2026-02-10', endDate: '2026-02-20' }, body: '' })
                .mockReturnValueOnce({ data: { title: 'Active2', startDate: '2026-02-12', endDate: '2026-02-25' }, body: '' });

            await loadMeldingerModule('folder-id', vi.fn(), vi.fn());
            const html = document.getElementById('module-inner').innerHTML;
            expect(html).toContain('border-amber-300');

            vi.useRealTimers();
        });

        it('should use file name when message has no title', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: '1', name: 'no-title.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\n---');
            adminClient.parseMarkdown.mockReturnValueOnce({
                data: { startDate: '2026-02-10', endDate: '2026-02-20' },
                body: ''
            });

            await loadMeldingerModule('folder-id', vi.fn(), vi.fn());
            const html = document.getElementById('module-inner').innerHTML;
            expect(html).toContain('no-title.md');
        });

        it('should show Uendelig when message has no endDate', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: '1', name: 'open.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: Open\n---');
            adminClient.parseMarkdown.mockReturnValueOnce({
                data: { title: 'Open', startDate: '2026-01-01' },
                body: ''
            });

            await loadMeldingerModule('folder-id', vi.fn(), vi.fn());
            const html = document.getElementById('module-inner').innerHTML;
            expect(html).toContain('Uendelig');
        });

        it('should treat message with no startDate as expired', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: '1', name: 'nodates.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: NoDates\n---');
            adminClient.parseMarkdown.mockReturnValueOnce({
                data: { title: 'NoDates' },
                body: ''
            });

            await loadMeldingerModule('folder-id', vi.fn(), vi.fn());
            const html = document.getElementById('module-inner').innerHTML;
            expect(html).toContain('Utløpt');
        });

        it('should trigger edit when card is clicked (click delegation)', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: '1', name: 'active.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: Active\nstartDate: 2026-01-01\n---');

            const onEdit = vi.fn();
            await loadMeldingerModule('folder-id', onEdit, vi.fn());

            const card = document.getElementById('module-inner').querySelector('.admin-card-interactive');
            card.click();

            expect(onEdit).toHaveBeenCalledWith('1', 'active.md');
        });

        it('should not double-trigger edit when edit-btn is clicked directly', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: '1', name: 'active.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: Active\nstartDate: 2026-01-01\n---');

            const onEdit = vi.fn();
            await loadMeldingerModule('folder-id', onEdit, vi.fn());

            document.getElementById('module-inner').querySelector('.edit-btn').click();

            expect(onEdit).toHaveBeenCalledTimes(1);
        });
    });

    describe('loadTjenesterModule', () => {
        it('should list services and sort them by title', async () => {
            const mockFiles = [
                { id: 'b', name: 'b.md' },
                { id: 'a', name: 'a.md' }
            ];
            adminClient.listFiles.mockResolvedValue(mockFiles);
            adminClient.getFileContent.mockImplementation(id => {
                return Promise.resolve(`---\ntitle: ${id.toUpperCase()}\ningress: bio\n---`);
            });

            await loadTjenesterModule('folder-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            // 'A' should come before 'B' in sorted list
            const titles = Array.from(inner.querySelectorAll('h3')).map(h => h.textContent);
            expect(titles).toEqual(['A', 'B']);
        });

        it('should use file name as fallback when title is missing', async () => {
            // Two services: one without title, one with title – forces sort comparator to run with missing title
            adminClient.listFiles.mockResolvedValue([
                { id: 'x', name: 'fallback.md' },
                { id: 'y', name: 'named.md' }
            ]);
            adminClient.getFileContent
                .mockResolvedValueOnce('---\n---')
                .mockResolvedValueOnce('---\ntitle: Named\n---');
            adminClient.parseMarkdown
                .mockReturnValueOnce({ data: {}, body: '' })
                .mockReturnValueOnce({ data: { title: 'Named' }, body: '' });

            await loadTjenesterModule('folder-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            expect(inner.innerHTML).toContain('fallback.md');
        });

        it('should render ingress text when provided', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: 'y', name: 'y.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: Y\ningress: My ingress\n---');
            adminClient.parseMarkdown.mockReturnValueOnce({ data: { title: 'Y', ingress: 'My ingress' }, body: '' });

            await loadTjenesterModule('folder-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            expect(inner.innerHTML).toContain('My ingress');
        });

        it('should handle API errors', async () => {
            adminClient.listFiles.mockRejectedValue(new Error('Fail'));
            await loadTjenesterModule('folder-id', vi.fn(), vi.fn());
            expect(document.getElementById('module-inner').textContent).toContain('Kunne ikke laste behandlinger');
        });

        it('should handle empty list', async () => {
            adminClient.listFiles.mockResolvedValue([]);
            await loadTjenesterModule('folder-id', vi.fn(), vi.fn());
            expect(document.getElementById('module-inner').textContent).toContain('Ingen behandlinger funnet');
        });

        it('should trigger edit when card is clicked (click delegation)', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: 's1', name: 'tjeneste.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: Tjeneste\n---');

            const onEdit = vi.fn();
            await loadTjenesterModule('folder-id', onEdit, vi.fn());

            document.getElementById('module-inner').querySelector('.admin-card-interactive').click();

            expect(onEdit).toHaveBeenCalledWith('s1', 'tjeneste.md');
        });
    });

    describe('loadTannlegerModule', () => {
        it('should list dentists and sort them alphabetically', async () => {
            const mockDentists = [
                { rowIndex: 3, name: 'Zoe', title: 'T', active: true },
                { rowIndex: 2, name: 'Adam', title: 'T', active: true },
                { rowIndex: 1, active: true } // no name - covers sort fallback branch
            ];
            adminClient.getTannlegerRaw.mockResolvedValue(mockDentists);

            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn());

            const names = Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim()).filter(Boolean);
            expect(names).toContain('Adam');
            expect(names).toContain('Zoe');
        });

        it('should render inactive dentist with correct styling', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 1, name: 'Inaktiv', title: 'Tittel', active: false }
            ]);

            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            expect(inner.innerHTML).toContain('Inaktiv');
            expect(inner.innerHTML).toContain('opacity-60');
        });

        it('should use fallback title when dentist has no title', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 1, name: 'Ingen Tittel', active: true }
            ]);

            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            expect(inner.innerHTML).toContain('Ingen tittel');
        });

        it('should return early when module-inner is missing from DOM', async () => {
            document.body.innerHTML = '<div id="module-actions"></div>';

            await loadTannlegerModule('id', vi.fn(), vi.fn());

            expect(adminClient.getTannlegerRaw).not.toHaveBeenCalled();
        });

        it('should show empty message when no dentists found', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([]);
            await loadTannlegerModule('id', vi.fn(), vi.fn());
            expect(document.getElementById('module-inner').textContent).toContain('Ingen team-medlemmer funnet');
        });

        it('should handle API errors', async () => {
            adminClient.getTannlegerRaw.mockRejectedValue(new Error('fail'));
            await loadTannlegerModule('id', vi.fn(), vi.fn());
            expect(document.getElementById('module-inner').textContent).toContain('Kunne ikke laste teamet');
        });

        it('should trigger edit when card is clicked (click delegation)', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 2, name: 'Anna', title: 'Lege', active: true }
            ]);

            const onEdit = vi.fn();
            await loadTannlegerModule('sheet-id', onEdit, vi.fn());

            document.getElementById('module-inner').querySelector('.admin-card-interactive').click();

            expect(onEdit).toHaveBeenCalledWith(2, expect.objectContaining({ name: 'Anna' }));
        });
    });

    describe('enforceAccessControl', () => {
        it('should show modules where user has access and hide others', async () => {
            const config = {
                SHEET_ID: 's',
                TJENESTER_FOLDER: 'tj',
                MELDINGER_FOLDER: 'm',
                TANNLEGER_FOLDER: 'ta'
            };
            // Only access to settings and meldinger
            // Note: Tannleger requires BOTH ta and s
            adminClient.checkMultipleAccess.mockResolvedValue({
                's': true,
                'tj': false,
                'm': true,
                'ta': true
            });

            await enforceAccessControl(config);
            
            const cardSettings = document.getElementById('btn-open-settings').closest('.admin-card-interactive');
            const cardTjenester = document.getElementById('btn-open-tjenester').closest('.admin-card-interactive');
            const cardMeldinger = document.getElementById('btn-open-meldinger').closest('.admin-card-interactive');
            const cardTannleger = document.getElementById('btn-open-tannleger').closest('.admin-card-interactive');

            expect(cardSettings.style.display).not.toBe('none');
            expect(cardTjenester.style.display).toBe('none');
            expect(cardMeldinger.style.display).not.toBe('none');
            expect(cardTannleger.style.display).not.toBe('none');
        });

        it('should hide tannleger if one of its required resources is missing', async () => {
             const config = {
                SHEET_ID: 's',
                TANNLEGER_FOLDER: 'ta'
            };
            // Access to folder but NOT sheet
            adminClient.checkMultipleAccess.mockResolvedValue({
                's': false,
                'ta': true
            });

            await enforceAccessControl(config);
            const cardTannleger = document.getElementById('btn-open-tannleger').closest('.admin-card-interactive');
            expect(cardTannleger.style.display).toBe('none');
        });

        it('should logout and redirect if no access at all', async () => {
            adminClient.checkMultipleAccess.mockResolvedValue({ 'id': false });
            // Mock location
            delete window.location;
            window.location = { href: '' };

            await enforceAccessControl({ SHEET_ID: 'id' });

            expect(adminClient.logout).toHaveBeenCalled();
            expect(window.location.href).toContain('access_denied');
        });

        it('should show forsidebilde card when user has access to sheet', async () => {
            adminClient.checkMultipleAccess.mockResolvedValue({ 's': true });

            await enforceAccessControl({ SHEET_ID: 's' });

            const cardForside = document.getElementById('btn-open-forsidebilde').closest('.admin-card-interactive');
            expect(cardForside.style.display).not.toBe('none');
        });

        it('should hide forsidebilde card when user lacks sheet access', async () => {
            adminClient.checkMultipleAccess.mockResolvedValue({ 's': false });

            await enforceAccessControl({ SHEET_ID: 's' });

            const cardForside = document.getElementById('btn-open-forsidebilde').closest('.admin-card-interactive');
            expect(cardForside.style.display).toBe('none');
        });
    });
});
