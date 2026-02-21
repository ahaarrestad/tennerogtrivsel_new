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
    updateSettingByKey: vi.fn(),
    getSettingsWithNotes: vi.fn(),
    checkMultipleAccess: vi.fn(),
    logout: vi.fn(),
    getTannlegerRaw: vi.fn(),
    updateTannlegeRow: vi.fn(),
    addTannlegeRow: vi.fn(),
    deleteTannlegeRow: vi.fn(),
    getGalleriRaw: vi.fn(),
    updateGalleriRow: vi.fn(),
    findFileByName: vi.fn(),
    getDriveImageBlob: vi.fn()
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
    loadTannlegerModule, loadGalleriListeModule, reorderGalleriItem,
    mergeSettingsWithDefaults
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
            <div class="admin-card-interactive"><button id="btn-open-bilder"></button></div>
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

    describe('loadGalleriListeModule', () => {
        beforeEach(() => {
            document.body.innerHTML += `<div id="galleri-liste-container"></div>`;
        });

        it('should list gallery images sorted by order with forsidebilde first', async () => {
            const mockImages = [
                { rowIndex: 3, title: 'Fasade', image: 'fasade.jpg', active: true, order: 2, type: 'galleri' },
                { rowIndex: 2, title: 'Venterom', image: 'venterom.jpg', active: true, order: 1, type: 'galleri' },
                { rowIndex: 4, title: 'Forside', image: 'forside.jpg', active: true, order: 0, type: 'forsidebilde' },
                { rowIndex: 5, title: 'Inaktiv', image: 'inaktiv.jpg', active: false, order: 3, type: 'galleri' }
            ];
            adminClient.getGalleriRaw.mockResolvedValue(mockImages);

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null);

            const container = document.getElementById('galleri-liste-container');
            const titles = Array.from(container.querySelectorAll('h3')).map(h => h.textContent.trim());
            expect(titles[0]).toBe('Forside');   // forsidebilde alltid først
            expect(titles[1]).toBe('Venterom');  // order 1
            expect(titles[2]).toBe('Fasade');    // order 2
            expect(titles[3]).toBe('Inaktiv');   // order 3
        });

        it('should render forsidebilde badge', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Forside', image: 'f.jpg', active: true, order: 0, type: 'forsidebilde' }
            ]);

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null);

            const container = document.getElementById('galleri-liste-container');
            expect(container.innerHTML).toContain('Forsidebilde');
            expect(container.innerHTML).toContain('bg-amber-100');
        });

        it('should render inactive image with opacity', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 1, title: 'Inaktiv', image: 'i.jpg', active: false, order: 1, type: 'galleri' }
            ]);

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null);

            const container = document.getElementById('galleri-liste-container');
            expect(container.innerHTML).toContain('opacity-60');
            expect(container.innerHTML).toContain('Inaktiv');
        });

        it('should show empty message when no images found', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([]);
            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null);
            expect(document.getElementById('galleri-liste-container').textContent).toContain('Ingen galleribilder funnet');
        });

        it('should handle API errors', async () => {
            adminClient.getGalleriRaw.mockRejectedValue(new Error('fail'));
            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null);
            expect(document.getElementById('galleri-liste-container').textContent).toContain('Kunne ikke laste galleribilder');
        });

        it('should return early when container is missing from DOM', async () => {
            document.getElementById('galleri-liste-container')?.remove();
            await loadGalleriListeModule('id', vi.fn(), vi.fn(), vi.fn(), null);
            expect(adminClient.getGalleriRaw).not.toHaveBeenCalled();
        });

        it('should trigger edit callback on edit button click', async () => {
            const mockImages = [
                { rowIndex: 2, title: 'Venterom', image: 'v.jpg', active: true, order: 1, type: 'galleri' }
            ];
            adminClient.getGalleriRaw.mockResolvedValue(mockImages);

            const onEdit = vi.fn();
            await loadGalleriListeModule('sheet-id', onEdit, vi.fn(), vi.fn(), null);

            const editBtn = document.querySelector('.edit-galleri-btn');
            editBtn.click();

            expect(onEdit).toHaveBeenCalledWith(2, expect.objectContaining({ title: 'Venterom' }));
        });

        it('should trigger delete callback on delete button click', async () => {
            const mockImages = [
                { rowIndex: 2, title: 'Venterom', image: 'v.jpg', active: true, order: 1, type: 'galleri' }
            ];
            adminClient.getGalleriRaw.mockResolvedValue(mockImages);

            const onDelete = vi.fn();
            await loadGalleriListeModule('sheet-id', vi.fn(), onDelete, vi.fn(), null);

            const deleteBtn = document.querySelector('.delete-galleri-btn');
            deleteBtn.click();

            expect(onDelete).toHaveBeenCalledWith(2, 'Venterom');
        });

        it('should trigger reorder callback on reorder button click', async () => {
            const mockImages = [
                { rowIndex: 2, title: 'Bilde1', image: 'b1.jpg', active: true, order: 1, type: 'galleri' },
                { rowIndex: 3, title: 'Bilde2', image: 'b2.jpg', active: true, order: 2, type: 'galleri' }
            ];
            adminClient.getGalleriRaw.mockResolvedValue(mockImages);

            const onReorder = vi.fn();
            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), onReorder, null);

            const reorderBtns = document.querySelectorAll('.reorder-btn');
            // Find the visible down-button for first item
            const downBtn = Array.from(reorderBtns).find(btn => btn.dataset.dir === '1' && !btn.classList.contains('invisible'));
            if (downBtn) {
                downBtn.click();
                expect(onReorder).toHaveBeenCalledWith(2, 1);
            }
        });

        it('should make reorder buttons invisible for forsidebilde rows', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Forside', image: 'f.jpg', active: true, order: 0, type: 'forsidebilde' },
                { rowIndex: 3, title: 'Bilde', image: 'b.jpg', active: true, order: 1, type: 'galleri' }
            ]);

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null);

            const container = document.getElementById('galleri-liste-container');
            const cards = container.querySelectorAll('.admin-card-interactive');
            // First card (forsidebilde) should have invisible reorder buttons
            const forsideReorderBtns = cards[0].querySelectorAll('.reorder-btn');
            forsideReorderBtns.forEach(btn => {
                expect(btn.classList.contains('invisible')).toBe(true);
            });
        });

        it('should use fallback title when image has no title', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: '', image: 'bilde.jpg', active: true, order: 1, type: 'galleri' }
            ]);

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null);

            const container = document.getElementById('galleri-liste-container');
            expect(container.innerHTML).toContain('bilde.jpg');
        });

        it('should load thumbnails when parentFolderId is provided', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Bilde', image: 'bilde.jpg', active: true, order: 1, type: 'galleri' }
            ]);
            adminClient.findFileByName.mockResolvedValue({ id: 'file-123' });
            adminClient.getDriveImageBlob.mockResolvedValue('blob:thumb-url');

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), 'parent-folder-id');

            // Wait for async thumbnail loading
            await vi.waitFor(() => {
                expect(adminClient.findFileByName).toHaveBeenCalledWith('bilde.jpg', 'parent-folder-id');
            });
        });

        it('should trigger edit via card click delegation', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Bilde', image: 'b.jpg', active: true, order: 1, type: 'galleri' }
            ]);

            const onEdit = vi.fn();
            await loadGalleriListeModule('sheet-id', onEdit, vi.fn(), vi.fn(), null);

            const container = document.getElementById('galleri-liste-container');
            const card = container.querySelector('.admin-card-interactive');
            card.click();

            expect(onEdit).toHaveBeenCalledWith(2, expect.objectContaining({ title: 'Bilde' }));
        });
    });

    describe('reorderGalleriItem', () => {
        it('should swap order values between current and neighbor (down)', async () => {
            const items = [
                { rowIndex: 2, title: 'A', order: 1, type: 'galleri' },
                { rowIndex: 3, title: 'B', order: 2, type: 'galleri' }
            ];
            adminClient.updateGalleriRow.mockResolvedValue(true);

            const result = await reorderGalleriItem('sheet-id', items, 2, 1);

            expect(result).toBe(true);
            expect(items[0].order).toBe(2);
            expect(items[1].order).toBe(1);
            expect(adminClient.updateGalleriRow).toHaveBeenCalledTimes(2);
        });

        it('should swap order values between current and neighbor (up)', async () => {
            const items = [
                { rowIndex: 2, title: 'A', order: 1, type: 'galleri' },
                { rowIndex: 3, title: 'B', order: 2, type: 'galleri' }
            ];
            adminClient.updateGalleriRow.mockResolvedValue(true);

            const result = await reorderGalleriItem('sheet-id', items, 3, -1);

            expect(result).toBe(true);
            expect(items[0].order).toBe(2);
            expect(items[1].order).toBe(1);
        });

        it('should return false if neighbor is out of bounds (move first up)', async () => {
            const items = [
                { rowIndex: 2, title: 'A', order: 1, type: 'galleri' }
            ];

            const result = await reorderGalleriItem('sheet-id', items, 2, -1);

            expect(result).toBe(false);
            expect(adminClient.updateGalleriRow).not.toHaveBeenCalled();
        });

        it('should return false if neighbor is out of bounds (move last down)', async () => {
            const items = [
                { rowIndex: 2, title: 'A', order: 1, type: 'galleri' }
            ];

            const result = await reorderGalleriItem('sheet-id', items, 2, 1);

            expect(result).toBe(false);
            expect(adminClient.updateGalleriRow).not.toHaveBeenCalled();
        });

        it('should force different order values when both have same order', async () => {
            const items = [
                { rowIndex: 2, title: 'A', order: 5, type: 'galleri' },
                { rowIndex: 3, title: 'B', order: 5, type: 'galleri' }
            ];
            adminClient.updateGalleriRow.mockResolvedValue(true);

            await reorderGalleriItem('sheet-id', items, 2, 1);

            // After swap both are 5, so force different: current.order = 0+1=1, neighbor.order = 0
            expect(items[0].order).not.toBe(items[1].order);
        });
    });

    describe('mergeSettingsWithDefaults', () => {
        it('should add missing defaults as virtual settings', () => {
            const sheetSettings = [
                { id: 'phone1', value: '12345', description: 'Telefon' }
            ];
            const defaults = { phone1: 'default1', email: 'default@test.no' };

            const result = mergeSettingsWithDefaults(sheetSettings, defaults);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 'phone1', value: '12345', description: 'Telefon' });
            expect(result[1]).toEqual({ id: 'email', value: 'default@test.no', description: '', isVirtual: true });
        });

        it('should return all defaults as virtual when sheet is empty', () => {
            const defaults = { phone1: '111', email: 'e@e.no' };
            const result = mergeSettingsWithDefaults([], defaults);

            expect(result).toHaveLength(2);
            result.forEach(s => expect(s.isVirtual).toBe(true));
        });

        it('should not duplicate existing keys', () => {
            const sheetSettings = [
                { id: 'phone1', value: '12345', description: '' }
            ];
            const defaults = { phone1: 'default1' };

            const result = mergeSettingsWithDefaults(sheetSettings, defaults);

            expect(result).toHaveLength(1);
            expect(result[0].value).toBe('12345');
            expect(result[0].isVirtual).toBeUndefined();
        });

        it('should preserve order of sheet settings before virtual ones', () => {
            const sheetSettings = [
                { id: 'b', value: 'B', description: '' },
                { id: 'a', value: 'A', description: '' }
            ];
            const defaults = { a: 'dA', b: 'dB', c: 'dC' };

            const result = mergeSettingsWithDefaults(sheetSettings, defaults);

            expect(result[0].id).toBe('b');
            expect(result[1].id).toBe('a');
            expect(result[2].id).toBe('c');
            expect(result[2].isVirtual).toBe(true);
        });
    });

    describe('saveSingleSetting (virtual rows)', () => {
        it('should call updateSettingByKey for virtual setting and clear isVirtual', async () => {
            const settings = [
                { id: 'phone1', value: 'Old', isVirtual: false },
                { id: 'kontaktTittel', value: 'Kontakt oss', isVirtual: true }
            ];
            const input = document.createElement('input');
            input.value = 'Ny Kontakt';
            const status = document.createElement('div');
            status.id = 'status-1';
            document.body.appendChild(status);

            adminClient.updateSettingByKey.mockResolvedValue(true);

            await saveSingleSetting(1, input, settings, 'sheet-123');

            expect(adminClient.updateSettingByKey).toHaveBeenCalledWith('sheet-123', 'kontaktTittel', 'Ny Kontakt');
            expect(adminClient.updateSettings).not.toHaveBeenCalled();
            expect(settings[1].isVirtual).toBe(false);
            expect(settings[1].value).toBe('Ny Kontakt');
        });

        it('should filter out virtual rows when saving non-virtual setting', async () => {
            const settings = [
                { id: 'phone1', value: 'Old' },
                { id: 'kontaktTittel', value: 'Kontakt oss', isVirtual: true }
            ];
            const input = document.createElement('input');
            input.value = 'New';
            const status = document.createElement('div');
            status.id = 'status-0';
            document.body.appendChild(status);

            adminClient.updateSettings.mockResolvedValue(true);

            await saveSingleSetting(0, input, settings, 'sheet-123');

            expect(adminClient.updateSettings).toHaveBeenCalled();
            const callArg = adminClient.updateSettings.mock.calls[0][1];
            expect(callArg.every(s => !s.isVirtual)).toBe(true);
            expect(adminClient.updateSettingByKey).not.toHaveBeenCalled();
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

        it('should show bilder card when user has access to sheet', async () => {
            adminClient.checkMultipleAccess.mockResolvedValue({ 's': true });

            await enforceAccessControl({ SHEET_ID: 's' });

            const cardBilder = document.getElementById('btn-open-bilder').closest('.admin-card-interactive');
            expect(cardBilder.style.display).not.toBe('none');
        });

        it('should hide bilder card when user lacks sheet access', async () => {
            adminClient.checkMultipleAccess.mockResolvedValue({ 's': false });

            await enforceAccessControl({ SHEET_ID: 's' });

            const cardBilder = document.getElementById('btn-open-bilder').closest('.admin-card-interactive');
            expect(cardBilder.style.display).toBe('none');
        });
    });
});
