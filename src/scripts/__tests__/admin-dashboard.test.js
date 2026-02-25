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
    updateSettingOrder: vi.fn(),
    getSettingsWithNotes: vi.fn(),
    checkMultipleAccess: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    silentLogin: vi.fn(),
    getTannlegerRaw: vi.fn(),
    updateTannlegeRow: vi.fn(),
    addTannlegeRow: vi.fn(),
    deleteTannlegeRow: vi.fn(),
    getGalleriRaw: vi.fn(),
    updateGalleriRow: vi.fn(),
    findFileByName: vi.fn(),
    getDriveImageBlob: vi.fn()
}));

// Mock admin-api-retry
vi.mock('../admin-api-retry.js', () => ({
    withRetry: vi.fn((fn) => fn()),
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
    classifyError: vi.fn(() => 'non-retryable')
}));

// Mock admin-dialog
vi.mock('../admin-dialog.js', () => ({
    showAuthExpired: vi.fn(),
    showToast: vi.fn(),
    showConfirm: vi.fn(),
    showBanner: vi.fn(),
}));

// Mock textFormatter
vi.mock('../textFormatter.js', () => ({
    formatDate: vi.fn(d => d),
    stripStackEditData: vi.fn(s => s),
    sortMessages: vi.fn(m => m),
    slugify: vi.fn(s => s)
}));

import { showAuthExpired } from '../admin-dialog.js';
import { classifyError } from '../admin-api-retry.js';

const {
    enforceAccessControl, updateUIWithUser, autoResizeTextarea,
    saveSingleSetting, loadMeldingerModule, loadTjenesterModule,
    loadTannlegerModule, loadGalleriListeModule, reorderGalleriItem,
    reorderSettingItem, mergeSettingsWithDefaults, formatTimestamp,
    updateLastFetchedTime, updateBreadcrumbCount, renderSkeletonCards,
    handleModuleError, loadDashboardCounts
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
            <span id="breadcrumb-count" class="hidden"></span>
            <div id="card-settings" class="admin-card-interactive"></div>
            <div id="card-tjenester" class="admin-card-interactive">
                <span id="card-tjenester-count" class="admin-card-count hidden"></span>
            </div>
            <div id="card-meldinger" class="admin-card-interactive">
                <span id="card-meldinger-count" class="admin-card-count hidden"></span>
            </div>
            <div id="card-tannleger" class="admin-card-interactive">
                <span id="card-tannleger-count" class="admin-card-count hidden"></span>
            </div>
            <div id="card-bilder" class="admin-card-interactive">
                <span id="card-bilder-count" class="admin-card-count hidden"></span>
            </div>
        `;
        vi.clearAllMocks();
    });

    describe('renderSkeletonCards', () => {
        it('should render correct number of skeleton cards', () => {
            const html = renderSkeletonCards(3);
            const el = document.createElement('div');
            el.innerHTML = html;
            expect(el.querySelectorAll('.admin-skeleton-card').length).toBe(3);
        });

        it('should include thumbnail placeholder when withThumbnail is true', () => {
            const html = renderSkeletonCards(2, { withThumbnail: true });
            const el = document.createElement('div');
            el.innerHTML = html;
            const thumbs = el.querySelectorAll('.admin-skeleton-card .admin-skeleton');
            // Each card has 1 thumb + 2 button skeletons = 3 per card
            expect(thumbs.length).toBe(6);
        });

        it('should not include thumbnail placeholder by default', () => {
            const html = renderSkeletonCards(1);
            const el = document.createElement('div');
            el.innerHTML = html;
            const skeletons = el.querySelectorAll('.admin-skeleton-card .admin-skeleton');
            // Only 2 button skeletons, no thumb
            expect(skeletons.length).toBe(2);
        });

        it('should include aria-hidden on wrapper', () => {
            const html = renderSkeletonCards(1);
            expect(html).toContain('aria-hidden="true"');
        });
    });

    describe('updateBreadcrumbCount', () => {
        it('should set text content and remove hidden class', () => {
            updateBreadcrumbCount(5);
            const el = document.getElementById('breadcrumb-count');
            expect(el.textContent).toBe('(5)');
            expect(el.classList.contains('hidden')).toBe(false);
        });

        it('should show (0) when count is zero', () => {
            updateBreadcrumbCount(0);
            const el = document.getElementById('breadcrumb-count');
            expect(el.textContent).toBe('(0)');
            expect(el.classList.contains('hidden')).toBe(false);
        });

        it('should do nothing when element is missing', () => {
            document.getElementById('breadcrumb-count').remove();
            expect(() => updateBreadcrumbCount(3)).not.toThrow();
        });
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
        it('should call updateSettings if value changed and verify against Sheets', async () => {
            const settings = [{ id: 'siteTitle', value: 'Old' }];
            const input = document.createElement('input');
            input.value = 'New';
            const status = document.createElement('div');
            status.id = 'status-0';
            document.body.appendChild(status);

            adminClient.updateSettings.mockResolvedValue(true);
            adminClient.getSettingsWithNotes.mockResolvedValue([{ id: 'siteTitle', value: 'New' }]);

            await saveSingleSetting(0, input, settings, 'sheet-123');

            expect(adminClient.updateSettings).toHaveBeenCalled();
            expect(adminClient.getSettingsWithNotes).toHaveBeenCalledWith('sheet-123');
            expect(settings[0].value).toBe('New');
            expect(status.innerHTML).toContain('✅');
        });

        it('should reload module on mismatch after verification', async () => {
            const settings = [{ id: 'siteTitle', value: 'Old' }];
            const input = document.createElement('input');
            input.value = 'New';
            const status = document.createElement('div');
            status.id = 'status-0';
            document.body.appendChild(status);

            adminClient.updateSettings.mockResolvedValue(true);
            adminClient.getSettingsWithNotes.mockResolvedValue([{ id: 'siteTitle', value: 'SomethingElse' }]);
            const onReload = vi.fn();
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await saveSingleSetting(0, input, settings, 'sheet-123', onReload);

            expect(onReload).toHaveBeenCalled();
            expect(status.innerHTML).toContain('⚠️');
            warnSpy.mockRestore();
        });

        it('should still show success if verification fetch fails', async () => {
            const settings = [{ id: 'siteTitle', value: 'Old' }];
            const input = document.createElement('input');
            input.value = 'New';
            const status = document.createElement('div');
            status.id = 'status-0';
            document.body.appendChild(status);

            adminClient.updateSettings.mockResolvedValue(true);
            adminClient.getSettingsWithNotes.mockRejectedValue(new Error('network'));
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await saveSingleSetting(0, input, settings, 'sheet-123');

            expect(settings[0].value).toBe('New');
            expect(status.innerHTML).toContain('✅');
            warnSpy.mockRestore();
        });

        it('should include timestamp in success message', async () => {
            const settings = [{ id: 'siteTitle', value: 'Old' }];
            const input = document.createElement('input');
            input.value = 'New';
            const status = document.createElement('div');
            status.id = 'status-0';
            document.body.appendChild(status);

            adminClient.updateSettings.mockResolvedValue(true);
            adminClient.getSettingsWithNotes.mockResolvedValue([{ id: 'siteTitle', value: 'New' }]);

            await saveSingleSetting(0, input, settings, 'sheet-123');

            expect(status.innerHTML).toMatch(/kl\. \d{2}:\d{2}/);
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
        it('should show skeleton cards while loading', () => {
            adminClient.listFiles.mockReturnValue(new Promise(() => {}));
            loadMeldingerModule('folder-id', vi.fn(), vi.fn());
            expect(document.getElementById('module-inner').innerHTML).toContain('admin-skeleton');
        });

        it('should update breadcrumb count after loading', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: '1', name: 'a.md' }, { id: '2', name: 'b.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: T\nstartDate: 2026-01-01\n---');
            await loadMeldingerModule('folder-id', vi.fn(), vi.fn());
            const el = document.getElementById('breadcrumb-count');
            expect(el.textContent).toBe('(2)');
            expect(el.classList.contains('hidden')).toBe(false);
        });

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
            expect(document.getElementById('module-inner').textContent).toContain('Noe gikk galt med oppslag');
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
        it('should update breadcrumb count after loading', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: '1', name: 'a.md' }, { id: '2', name: 'b.md' }, { id: '3', name: 'c.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: T\n---');
            await loadTjenesterModule('folder-id', vi.fn(), vi.fn(), vi.fn());
            const el = document.getElementById('breadcrumb-count');
            expect(el.textContent).toBe('(3)');
            expect(el.classList.contains('hidden')).toBe(false);
        });

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
            expect(document.getElementById('module-inner').textContent).toContain('Noe gikk galt med behandlinger');
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

        it('should render toggle-switch with correct state for active service', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: 's1', name: 'a.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: A\n---');
            adminClient.parseMarkdown.mockReturnValueOnce({ data: { title: 'A', active: true }, body: '' });

            const onToggleActive = vi.fn();
            await loadTjenesterModule('folder-id', vi.fn(), vi.fn(), onToggleActive);

            const toggleBtn = document.querySelector('.toggle-active-btn');
            expect(toggleBtn).not.toBeNull();
            expect(toggleBtn.dataset.active).toBe('true');
            expect(toggleBtn.querySelector('.toggle-label').textContent).toBe('Aktiv');
        });

        it('should render toggle-switch correctly for inactive service', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: 's1', name: 'a.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: A\nactive: false\n---');
            adminClient.parseMarkdown.mockReturnValueOnce({ data: { title: 'A', active: false }, body: '' });

            await loadTjenesterModule('folder-id', vi.fn(), vi.fn(), vi.fn());

            const toggleBtn = document.querySelector('.toggle-active-btn');
            expect(toggleBtn.dataset.active).toBe('false');
            expect(toggleBtn.querySelector('.toggle-label').textContent).toBe('Inaktiv');
        });

        it('should call onToggleActive with correct arguments on toggle click', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: 's1', name: 'tjeneste.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: A\n---');
            adminClient.parseMarkdown.mockReturnValueOnce({ data: { title: 'A', active: true }, body: '' });

            const onToggleActive = vi.fn();
            await loadTjenesterModule('folder-id', vi.fn(), vi.fn(), onToggleActive);

            document.querySelector('.toggle-active-btn').click();

            expect(onToggleActive).toHaveBeenCalledWith('s1', 'tjeneste.md', expect.objectContaining({ title: 'A' }));
        });

        it('should not trigger edit when toggle is clicked', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: 's1', name: 'a.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: A\n---');

            const onEdit = vi.fn();
            const onToggleActive = vi.fn();
            await loadTjenesterModule('folder-id', onEdit, vi.fn(), onToggleActive);

            document.querySelector('.toggle-active-btn').click();

            expect(onToggleActive).toHaveBeenCalled();
            expect(onEdit).not.toHaveBeenCalled();
        });

        it('should treat services without active field as active (default true)', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: 's1', name: 'a.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: A\n---');
            adminClient.parseMarkdown.mockReturnValueOnce({ data: { title: 'A' }, body: '' });

            await loadTjenesterModule('folder-id', vi.fn(), vi.fn(), vi.fn());

            const toggleBtn = document.querySelector('.toggle-active-btn');
            expect(toggleBtn.querySelector('.toggle-label').textContent).toBe('Aktiv');
            expect(toggleBtn.dataset.active).toBe('true');

            const card = document.querySelector('.admin-card-interactive');
            expect(card.classList.contains('opacity-60')).toBe(false);
        });

        it('should apply opacity-60 on card for inactive service', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: 's1', name: 'a.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: A\nactive: false\n---');
            adminClient.parseMarkdown.mockReturnValueOnce({ data: { title: 'A', active: false }, body: '' });

            await loadTjenesterModule('folder-id', vi.fn(), vi.fn(), vi.fn());

            const card = document.querySelector('.admin-card-interactive');
            expect(card.classList.contains('opacity-60')).toBe(true);
        });

        it('should not throw when onToggleActive is not provided', async () => {
            adminClient.listFiles.mockResolvedValue([{ id: 's1', name: 'a.md' }]);
            adminClient.getFileContent.mockResolvedValue('---\ntitle: A\n---');

            await loadTjenesterModule('folder-id', vi.fn(), vi.fn(), null);

            const toggleBtn = document.querySelector('.toggle-active-btn');
            expect(() => toggleBtn.click()).not.toThrow();
        });

        it('should pass onToggleActive to retry on error', async () => {
            adminClient.listFiles.mockRejectedValueOnce(new Error('Fail'))
                .mockResolvedValue([]);

            const onToggleActive = vi.fn();
            await loadTjenesterModule('folder-id', vi.fn(), vi.fn(), onToggleActive);

            const inner = document.getElementById('module-inner');
            inner.querySelector('.retry-btn').click();

            await vi.waitFor(() => {
                expect(adminClient.listFiles).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('loadTannlegerModule', () => {
        it('should update breadcrumb count after loading', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 1, name: 'A', active: true },
                { rowIndex: 2, name: 'B', active: true }
            ]);
            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn(), null, vi.fn());
            const el = document.getElementById('breadcrumb-count');
            expect(el.textContent).toBe('(2)');
            expect(el.classList.contains('hidden')).toBe(false);
        });

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
            expect(document.getElementById('module-inner').textContent).toContain('Noe gikk galt med team');
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

        it('should render thumbnail container with data-thumb-row attribute', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 5, name: 'Kari', title: 'Tannlege', active: true, image: 'kari.jpg' }
            ]);

            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            const thumbContainer = inner.querySelector('[data-thumb-row="5"]');
            expect(thumbContainer).not.toBeNull();
            expect(thumbContainer.querySelector('svg')).not.toBeNull();
        });

        it('should load thumbnails with crop parameters when parentFolderId is provided', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 2, name: 'Ola', title: 'Tannlege', active: true, image: 'ola.jpg', scale: 1.5, positionX: 30, positionY: 20 }
            ]);
            adminClient.findFileByName.mockResolvedValue({ id: 'file-abc' });
            adminClient.getDriveImageBlob.mockResolvedValue('blob:thumb-url');

            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn(), 'parent-folder-id');

            await vi.waitFor(() => {
                expect(adminClient.findFileByName).toHaveBeenCalledWith('ola.jpg', 'parent-folder-id');
            });
            await vi.waitFor(() => {
                expect(adminClient.getDriveImageBlob).toHaveBeenCalledWith('file-abc');
            });
            await vi.waitFor(() => {
                const inner = document.getElementById('module-inner');
                const img = inner.querySelector('[data-thumb-row="2"] img');
                expect(img).not.toBeNull();
                expect(img.style.objectPosition).toBe('30% 20%');
                expect(img.style.transform).toBe('scale(1.5)');
                expect(img.style.transformOrigin).toBe('30% 20%');
            });
        });

        it('should not load thumbnails when parentFolderId is not provided', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 2, name: 'Ola', title: 'Tannlege', active: true, image: 'ola.jpg' }
            ]);

            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn());

            expect(adminClient.findFileByName).not.toHaveBeenCalled();
        });

        it('should handle thumbnail loading errors gracefully', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 2, name: 'Ola', title: 'Tannlege', active: true, image: 'ola.jpg' }
            ]);
            adminClient.findFileByName.mockRejectedValue(new Error('Drive error'));

            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn(), 'parent-folder-id');

            await vi.waitFor(() => {
                expect(adminClient.findFileByName).toHaveBeenCalled();
            });
            // List should still be rendered despite thumbnail error
            const inner = document.getElementById('module-inner');
            expect(inner.innerHTML).toContain('Ola');
        });

        it('should skip thumbnail loading for dentists without image', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 2, name: 'Ola', title: 'Tannlege', active: true }
            ]);

            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn(), 'parent-folder-id');

            expect(adminClient.findFileByName).not.toHaveBeenCalled();
        });

        it('should render toggle-button with correct structure for active dentist', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 2, name: 'Anna', title: 'Tannlege', active: true }
            ]);

            const onToggleActive = vi.fn();
            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn(), null, onToggleActive);

            const toggleBtn = document.querySelector('.toggle-active-btn');
            expect(toggleBtn).not.toBeNull();
            expect(toggleBtn.querySelector('.toggle-track')).not.toBeNull();
            expect(toggleBtn.querySelector('.toggle-dot')).not.toBeNull();
            expect(toggleBtn.querySelector('.toggle-label').textContent).toBe('Aktiv');
            expect(toggleBtn.dataset.active).toBe('true');
        });

        it('should render toggle-button correctly for inactive dentist', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 2, name: 'Anna', title: 'Tannlege', active: false }
            ]);

            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn(), null, vi.fn());

            const toggleBtn = document.querySelector('.toggle-active-btn');
            expect(toggleBtn.querySelector('.toggle-label').textContent).toBe('Inaktiv');
            expect(toggleBtn.dataset.active).toBe('false');
        });

        it('should call onToggleActive with correct arguments on toggle click', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 3, name: 'Kari', title: 'Tannlege', active: true }
            ]);

            const onToggleActive = vi.fn();
            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn(), null, onToggleActive);

            document.querySelector('.toggle-active-btn').click();

            expect(onToggleActive).toHaveBeenCalledWith(3, expect.objectContaining({ name: 'Kari', active: true }));
        });

        it('should not trigger edit when toggle is clicked', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 2, name: 'Anna', title: 'Tannlege', active: true }
            ]);

            const onEdit = vi.fn();
            const onToggleActive = vi.fn();
            await loadTannlegerModule('sheet-id', onEdit, vi.fn(), null, onToggleActive);

            document.querySelector('.toggle-active-btn').click();

            expect(onToggleActive).toHaveBeenCalled();
            expect(onEdit).not.toHaveBeenCalled();
        });

        it('should pass dentist with active: false to callback for inactive dentist', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 2, name: 'Anna', title: 'Tannlege', active: false }
            ]);

            const onToggleActive = vi.fn();
            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn(), null, onToggleActive);

            document.querySelector('.toggle-active-btn').click();

            expect(onToggleActive).toHaveBeenCalledWith(2, expect.objectContaining({ active: false }));
        });

        it('should apply opacity-60 on card for inactive dentist', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 2, name: 'Anna', title: 'Tannlege', active: false }
            ]);

            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn(), null, vi.fn());

            const card = document.querySelector('.admin-card-interactive');
            expect(card.classList.contains('opacity-60')).toBe(true);
        });

        it('should not throw when onToggleActive is not provided', async () => {
            adminClient.getTannlegerRaw.mockResolvedValue([
                { rowIndex: 2, name: 'Anna', title: 'Tannlege', active: true }
            ]);

            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn(), null, null);

            const toggleBtn = document.querySelector('.toggle-active-btn');
            expect(() => toggleBtn.click()).not.toThrow();
        });
    });

    describe('loadGalleriListeModule', () => {
        beforeEach(() => {
            document.body.innerHTML += `<div id="galleri-liste-container"></div>`;
        });

        it('should update breadcrumb count after loading', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 1, image: 'a.jpg', active: true, order: 1 },
                { rowIndex: 2, image: 'b.jpg', active: true, order: 2 }
            ]);
            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null, vi.fn());
            const el = document.getElementById('breadcrumb-count');
            expect(el.textContent).toBe('(2)');
            expect(el.classList.contains('hidden')).toBe(false);
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
            expect(document.getElementById('galleri-liste-container').textContent).toContain('Noe gikk galt med galleribilder');
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

        it('should load thumbnails with crop parameters when parentFolderId is provided', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Bilde', image: 'bilde.jpg', active: true, order: 1, type: 'galleri', scale: 1.3, positionX: 40, positionY: 60 }
            ]);
            adminClient.findFileByName.mockResolvedValue({ id: 'file-123' });
            adminClient.getDriveImageBlob.mockResolvedValue('blob:thumb-url');

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), 'parent-folder-id');

            await vi.waitFor(() => {
                expect(adminClient.findFileByName).toHaveBeenCalledWith('bilde.jpg', 'parent-folder-id');
            });
            await vi.waitFor(() => {
                const container = document.getElementById('galleri-liste-container');
                const img = container.querySelector('[data-thumb-row="2"] img');
                expect(img).not.toBeNull();
                expect(img.style.objectPosition).toBe('40% 60%');
                expect(img.style.transform).toBe('scale(1.3)');
                expect(img.style.transformOrigin).toBe('40% 60%');
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

        it('should trigger toggle-active callback on toggle switch click', async () => {
            const mockImages = [
                { rowIndex: 2, title: 'Bilde', image: 'b.jpg', active: true, order: 1, type: 'galleri' }
            ];
            adminClient.getGalleriRaw.mockResolvedValue(mockImages);

            const onToggleActive = vi.fn();
            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null, onToggleActive);

            const toggleBtn = document.querySelector('.toggle-active-btn');
            expect(toggleBtn).not.toBeNull();
            // Verify toggle switch structure
            expect(toggleBtn.querySelector('.toggle-track')).not.toBeNull();
            expect(toggleBtn.querySelector('.toggle-dot')).not.toBeNull();
            expect(toggleBtn.querySelector('.toggle-label').textContent).toBe('Aktiv');
            // Active state: data-active on button
            expect(toggleBtn.dataset.active).toBe('true');
            toggleBtn.click();

            expect(onToggleActive).toHaveBeenCalledWith(2, expect.objectContaining({ title: 'Bilde', active: true }));
        });

        it('should render inactive toggle switch correctly', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Bilde', image: 'b.jpg', active: false, order: 1, type: 'galleri' }
            ]);

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null, vi.fn());

            const toggleBtn = document.querySelector('.toggle-active-btn');
            expect(toggleBtn.querySelector('.toggle-label').textContent).toBe('Inaktiv');
            expect(toggleBtn.dataset.active).toBe('false');
        });

        it('should not trigger edit when toggle switch is clicked', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Bilde', image: 'b.jpg', active: true, order: 1, type: 'galleri' }
            ]);

            const onEdit = vi.fn();
            const onToggleActive = vi.fn();
            await loadGalleriListeModule('sheet-id', onEdit, vi.fn(), vi.fn(), null, onToggleActive);

            const toggleBtn = document.querySelector('.toggle-active-btn');
            toggleBtn.click();

            expect(onToggleActive).toHaveBeenCalled();
            expect(onEdit).not.toHaveBeenCalled();
        });

        it('should not show toggle switch for forsidebilde', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Forside', image: 'f.jpg', active: true, order: 1, type: 'forsidebilde' }
            ]);

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null, vi.fn());

            const toggleBtn = document.querySelector('.toggle-active-btn');
            expect(toggleBtn).toBeNull();
            // Should still show the forsidebilde badge
            expect(document.querySelector('.admin-status-pill').textContent).toBe('Forsidebilde');
        });

        it('should pass img object with current active value to callback', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Inaktivt', image: 'b.jpg', active: false, order: 1, type: 'galleri' }
            ]);

            const onToggleActive = vi.fn();
            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null, onToggleActive);

            document.querySelector('.toggle-active-btn').click();

            expect(onToggleActive).toHaveBeenCalledWith(2, expect.objectContaining({ active: false }));
        });

        it('should apply opacity-60 to card when image is inactive', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Bilde', image: 'b.jpg', active: false, order: 1, type: 'galleri' }
            ]);

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null, vi.fn());

            const container = document.getElementById('galleri-liste-container');
            const card = container.querySelector('.admin-card-interactive');
            expect(card.classList.contains('opacity-60')).toBe(true);
        });

        it('should not apply opacity-60 to card when image is active', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Bilde', image: 'b.jpg', active: true, order: 1, type: 'galleri' }
            ]);

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null, vi.fn());

            const container = document.getElementById('galleri-liste-container');
            const card = container.querySelector('.admin-card-interactive');
            expect(card.classList.contains('opacity-60')).toBe(false);
        });

        it('should show toggle for gallery items alongside forsidebilde', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Forside', image: 'f.jpg', active: true, order: 1, type: 'forsidebilde' },
                { rowIndex: 3, title: 'Galleri', image: 'g.jpg', active: true, order: 2, type: 'galleri' }
            ]);

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null, vi.fn());

            const toggleBtns = document.querySelectorAll('.toggle-active-btn');
            expect(toggleBtns.length).toBe(1);
            expect(toggleBtns[0].dataset.row).toBe('3');
        });

        it('should not call onToggleActive when callback is not provided', async () => {
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 2, title: 'Bilde', image: 'b.jpg', active: true, order: 1, type: 'galleri' }
            ]);

            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null, null);

            const toggleBtn = document.querySelector('.toggle-active-btn');
            expect(() => toggleBtn.click()).not.toThrow();
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

    describe('reorderSettingItem', () => {
        it('should swap order values between current and neighbor (down)', async () => {
            const items = [
                { row: 2, id: 'phone1', order: 1 },
                { row: 3, id: 'email', order: 2 }
            ];
            adminClient.updateSettingOrder.mockResolvedValue(true);

            const result = await reorderSettingItem('sheet-id', items, 0, 1);

            expect(result).toBe(true);
            expect(items[0].order).toBe(2);
            expect(items[1].order).toBe(1);
            expect(adminClient.updateSettingOrder).toHaveBeenCalledTimes(2);
        });

        it('should swap order values between current and neighbor (up)', async () => {
            const items = [
                { row: 2, id: 'phone1', order: 1 },
                { row: 3, id: 'email', order: 2 }
            ];
            adminClient.updateSettingOrder.mockResolvedValue(true);

            const result = await reorderSettingItem('sheet-id', items, 1, -1);

            expect(result).toBe(true);
            expect(items[0].order).toBe(2);
            expect(items[1].order).toBe(1);
        });

        it('should return false when trying to move first item up', async () => {
            const items = [{ row: 2, id: 'phone1', order: 1 }];

            const result = await reorderSettingItem('sheet-id', items, 0, -1);

            expect(result).toBe(false);
            expect(adminClient.updateSettingOrder).not.toHaveBeenCalled();
        });

        it('should return false when trying to move last item down', async () => {
            const items = [{ row: 2, id: 'phone1', order: 1 }];

            const result = await reorderSettingItem('sheet-id', items, 0, 1);

            expect(result).toBe(false);
            expect(adminClient.updateSettingOrder).not.toHaveBeenCalled();
        });

        it('should force different order values when both have same order', async () => {
            const items = [
                { row: 2, id: 'a', order: 5 },
                { row: 3, id: 'b', order: 5 }
            ];
            adminClient.updateSettingOrder.mockResolvedValue(true);

            await reorderSettingItem('sheet-id', items, 0, 1);

            expect(items[0].order).not.toBe(items[1].order);
        });

        it('should call updateSettingOrder with correct row and order values', async () => {
            const items = [
                { row: 4, id: 'a', order: 10 },
                { row: 7, id: 'b', order: 20 }
            ];
            adminClient.updateSettingOrder.mockResolvedValue(true);

            await reorderSettingItem('sheet-id', items, 0, 1);

            expect(adminClient.updateSettingOrder).toHaveBeenCalledWith('sheet-id', 4, 20);
            expect(adminClient.updateSettingOrder).toHaveBeenCalledWith('sheet-id', 7, 10);
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
            adminClient.getSettingsWithNotes.mockResolvedValue([
                { id: 'phone1', value: 'Old' },
                { id: 'kontaktTittel', value: 'Ny Kontakt' }
            ]);

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
            adminClient.getSettingsWithNotes.mockResolvedValue([{ id: 'phone1', value: 'New' }]);

            await saveSingleSetting(0, input, settings, 'sheet-123');

            expect(adminClient.updateSettings).toHaveBeenCalled();
            const callArg = adminClient.updateSettings.mock.calls[0][1];
            expect(callArg.every(s => !s.isVirtual)).toBe(true);
            expect(adminClient.updateSettingByKey).not.toHaveBeenCalled();
        });
    });

    describe('formatTimestamp', () => {
        it('should format date in Norwegian short format', () => {
            const date = new Date(2026, 1, 22, 14, 5); // 22. feb 2026 14:05
            expect(formatTimestamp(date)).toBe('22. feb kl. 14:05');
        });

        it('should pad single-digit hours and minutes', () => {
            const date = new Date(2026, 0, 3, 8, 7); // 3. jan 2026 08:07
            expect(formatTimestamp(date)).toBe('3. jan kl. 08:07');
        });
    });

    describe('updateLastFetchedTime', () => {
        it('should update the settings-last-fetched element', () => {
            const el = document.createElement('span');
            el.id = 'settings-last-fetched';
            document.body.appendChild(el);

            updateLastFetchedTime(new Date(2026, 1, 22, 14, 32));

            expect(el.textContent).toBe('22. feb kl. 14:32');
        });

        it('should do nothing if element does not exist', () => {
            // No element in DOM — should not throw
            expect(() => updateLastFetchedTime(new Date())).not.toThrow();
        });
    });

    describe('retry buttons', () => {
        it('should render retry button when loadMeldingerModule fails', async () => {
            adminClient.listFiles.mockRejectedValue(new Error('Fail'));
            await loadMeldingerModule('folder-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            const retryBtn = inner.querySelector('.retry-btn');
            expect(retryBtn).not.toBeNull();
            expect(retryBtn.textContent).toContain('Prøv igjen');
        });

        it('should re-call loadMeldingerModule when retry button is clicked', async () => {
            adminClient.listFiles.mockRejectedValueOnce(new Error('Fail'))
                .mockResolvedValue([]);
            await loadMeldingerModule('folder-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            inner.querySelector('.retry-btn').click();

            await vi.waitFor(() => {
                expect(adminClient.listFiles).toHaveBeenCalledTimes(2);
            });
        });

        it('should render retry button when loadTjenesterModule fails', async () => {
            adminClient.listFiles.mockRejectedValue(new Error('Fail'));
            await loadTjenesterModule('folder-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            const retryBtn = inner.querySelector('.retry-btn');
            expect(retryBtn).not.toBeNull();
        });

        it('should re-call loadTjenesterModule when retry button is clicked', async () => {
            adminClient.listFiles.mockRejectedValueOnce(new Error('Fail'))
                .mockResolvedValue([]);
            await loadTjenesterModule('folder-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            inner.querySelector('.retry-btn').click();

            await vi.waitFor(() => {
                expect(adminClient.listFiles).toHaveBeenCalledTimes(2);
            });
        });

        it('should render retry button when loadTannlegerModule fails', async () => {
            adminClient.getTannlegerRaw.mockRejectedValue(new Error('Fail'));
            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            const retryBtn = inner.querySelector('.retry-btn');
            expect(retryBtn).not.toBeNull();
        });

        it('should re-call loadTannlegerModule when retry button is clicked', async () => {
            adminClient.getTannlegerRaw.mockRejectedValueOnce(new Error('Fail'))
                .mockResolvedValue([]);
            await loadTannlegerModule('sheet-id', vi.fn(), vi.fn());

            const inner = document.getElementById('module-inner');
            inner.querySelector('.retry-btn').click();

            await vi.waitFor(() => {
                expect(adminClient.getTannlegerRaw).toHaveBeenCalledTimes(2);
            });
        });

        it('should render retry button when loadGalleriListeModule fails', async () => {
            document.body.innerHTML += `<div id="galleri-liste-container"></div>`;
            adminClient.getGalleriRaw.mockRejectedValue(new Error('Fail'));
            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null);

            const container = document.getElementById('galleri-liste-container');
            const retryBtn = container.querySelector('.retry-btn');
            expect(retryBtn).not.toBeNull();
        });

        it('should re-call loadGalleriListeModule when retry button is clicked', async () => {
            document.body.innerHTML += `<div id="galleri-liste-container"></div>`;
            adminClient.getGalleriRaw.mockRejectedValueOnce(new Error('Fail'))
                .mockResolvedValue([]);
            await loadGalleriListeModule('sheet-id', vi.fn(), vi.fn(), vi.fn(), null);

            const container = document.getElementById('galleri-liste-container');
            container.querySelector('.retry-btn').click();

            await vi.waitFor(() => {
                expect(adminClient.getGalleriRaw).toHaveBeenCalledTimes(2);
            });
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
            
            const cardSettings = document.getElementById('card-settings');
            const cardTjenester = document.getElementById('card-tjenester');
            const cardMeldinger = document.getElementById('card-meldinger');
            const cardTannleger = document.getElementById('card-tannleger');

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
            const cardTannleger = document.getElementById('card-tannleger');
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

            const cardBilder = document.getElementById('card-bilder');
            expect(cardBilder.style.display).not.toBe('none');
        });

        it('should hide bilder card when user lacks sheet access', async () => {
            adminClient.checkMultipleAccess.mockResolvedValue({ 's': false });

            await enforceAccessControl({ SHEET_ID: 's' });

            const cardBilder = document.getElementById('card-bilder');
            expect(cardBilder.style.display).toBe('none');
        });
    });

    describe('handleModuleError', () => {
        let container;

        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
            vi.clearAllMocks();
        });

        it('should show contextual non-retryable error message', () => {
            classifyError.mockReturnValue('non-retryable');
            const err = new Error('fail');
            handleModuleError(err, 'oppslag', container, vi.fn());
            expect(container.textContent).toContain('Noe gikk galt med oppslag');
        });

        it('should show network error message for retryable errors', () => {
            classifyError.mockReturnValue('retryable');
            handleModuleError(new Error('net'), 'test', container, vi.fn());
            expect(container.textContent).toContain('Nettverksfeil');
        });

        it('should call showAuthExpired and clear container for auth errors', () => {
            classifyError.mockReturnValue('auth');
            container.innerHTML = '<p>skeleton</p>';
            handleModuleError(new Error('401'), 'test', container, vi.fn());
            expect(container.innerHTML).not.toContain('skeleton');
            expect(showAuthExpired).toHaveBeenCalledWith(container, expect.any(Function));
        });

        it('should render retry button for retryable errors', () => {
            classifyError.mockReturnValue('retryable');
            handleModuleError(new Error('net'), 'test', container, vi.fn());
            expect(container.querySelector('.retry-btn')).not.toBeNull();
        });

        it('should call onRetry when retry button is clicked', () => {
            classifyError.mockReturnValue('non-retryable');
            const onRetry = vi.fn();
            handleModuleError(new Error('fail'), 'test', container, onRetry);
            container.querySelector('.retry-btn').click();
            expect(onRetry).toHaveBeenCalled();
        });
    });

    describe('loadDashboardCounts', () => {
        const mockConfig = {
            SHEET_ID: 'sheet-1',
            TJENESTER_FOLDER: 'folder-tjenester',
            MELDINGER_FOLDER: 'folder-meldinger',
        };

        it('should show tjenester count with active count', async () => {
            adminClient.listFiles
                .mockResolvedValueOnce([{ id: '1' }, { id: '2' }, { id: '3' }])  // tjenester
                .mockResolvedValueOnce([]);  // meldinger (empty, no file fetches)
            adminClient.getFileContent.mockResolvedValue('content');
            adminClient.parseMarkdown
                .mockReturnValueOnce({ data: { active: true }, body: '' })
                .mockReturnValueOnce({ data: { active: false }, body: '' })
                .mockReturnValueOnce({ data: { active: true }, body: '' });
            adminClient.getTannlegerRaw.mockResolvedValue([]);
            adminClient.getGalleriRaw.mockResolvedValue([]);

            await loadDashboardCounts(mockConfig);

            const el = document.getElementById('card-tjenester-count');
            expect(el.textContent).toBe('3 behandlinger, 2 aktive');
            expect(el.classList.contains('hidden')).toBe(false);
        });

        it('should show singular form for 1 behandling', async () => {
            adminClient.listFiles
                .mockResolvedValueOnce([{ id: '1' }])
                .mockResolvedValueOnce([]);
            adminClient.getFileContent.mockResolvedValue('content');
            adminClient.parseMarkdown.mockReturnValueOnce({ data: { active: true }, body: '' });
            adminClient.getTannlegerRaw.mockResolvedValue([]);
            adminClient.getGalleriRaw.mockResolvedValue([]);

            await loadDashboardCounts(mockConfig);

            expect(document.getElementById('card-tjenester-count').textContent).toBe('1 behandling, 1 aktive');
        });

        it('should treat active: false as inactive tjeneste', async () => {
            adminClient.listFiles
                .mockResolvedValueOnce([{ id: '1' }, { id: '2' }])
                .mockResolvedValueOnce([]);
            adminClient.getFileContent.mockResolvedValue('content');
            adminClient.parseMarkdown
                .mockReturnValueOnce({ data: { active: false }, body: '' })
                .mockReturnValueOnce({ data: { active: 'false' }, body: '' });
            adminClient.getTannlegerRaw.mockResolvedValue([]);
            adminClient.getGalleriRaw.mockResolvedValue([]);

            await loadDashboardCounts(mockConfig);

            expect(document.getElementById('card-tjenester-count').textContent).toBe('2 behandlinger, 0 aktive');
        });

        it('should count active meldinger based on current date', async () => {
            adminClient.listFiles
                .mockResolvedValueOnce([])  // tjenester (empty)
                .mockResolvedValueOnce([{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]);  // meldinger
            adminClient.getFileContent.mockResolvedValue('content');
            // Active: started, not ended. Planned: future. Expired: past.
            adminClient.parseMarkdown
                .mockReturnValueOnce({ data: { startDate: '2020-01-01', endDate: '2099-12-31' }, body: '' })  // active
                .mockReturnValueOnce({ data: { startDate: '2099-01-01', endDate: '2099-12-31' }, body: '' })  // planned
                .mockReturnValueOnce({ data: { startDate: '2020-01-01', endDate: '2020-12-31' }, body: '' }); // expired
            adminClient.getTannlegerRaw.mockResolvedValue([]);
            adminClient.getGalleriRaw.mockResolvedValue([]);

            await loadDashboardCounts(mockConfig);

            expect(document.getElementById('card-meldinger-count').textContent).toBe('3 oppslag, 1 aktive');
        });

        it('should count melding with no endDate as active (defaults to 2099)', async () => {
            adminClient.listFiles
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ id: 'm1' }]);
            adminClient.getFileContent.mockResolvedValue('content');
            adminClient.parseMarkdown.mockReturnValueOnce({ data: { startDate: '2020-01-01' }, body: '' });
            adminClient.getTannlegerRaw.mockResolvedValue([]);
            adminClient.getGalleriRaw.mockResolvedValue([]);

            await loadDashboardCounts(mockConfig);

            expect(document.getElementById('card-meldinger-count').textContent).toBe('1 oppslag, 1 aktive');
        });

        it('should not count melding with invalid dates as active', async () => {
            adminClient.listFiles
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ id: 'm1' }]);
            adminClient.getFileContent.mockResolvedValue('content');
            adminClient.parseMarkdown.mockReturnValueOnce({ data: { startDate: 'invalid', endDate: 'invalid' }, body: '' });
            adminClient.getTannlegerRaw.mockResolvedValue([]);
            adminClient.getGalleriRaw.mockResolvedValue([]);

            await loadDashboardCounts(mockConfig);

            expect(document.getElementById('card-meldinger-count').textContent).toBe('1 oppslag, 0 aktive');
        });

        it('should show tannleger count with active count', async () => {
            adminClient.listFiles.mockResolvedValue([]);
            adminClient.getTannlegerRaw.mockResolvedValue([
                { name: 'Alice', active: true },
                { name: 'Bob', active: false },
                { name: 'Charlie', active: true },
            ]);
            adminClient.getGalleriRaw.mockResolvedValue([]);

            await loadDashboardCounts(mockConfig);

            expect(document.getElementById('card-tannleger-count').textContent).toBe('3 personer, 2 aktive');
        });

        it('should show singular form for 1 tannlege', async () => {
            adminClient.listFiles.mockResolvedValue([]);
            adminClient.getTannlegerRaw.mockResolvedValue([{ name: 'Alice', active: true }]);
            adminClient.getGalleriRaw.mockResolvedValue([]);

            await loadDashboardCounts(mockConfig);

            expect(document.getElementById('card-tannleger-count').textContent).toBe('1 person, 1 aktive');
        });

        it('should show bilder count excluding forsidebilde', async () => {
            adminClient.listFiles.mockResolvedValue([]);
            adminClient.getTannlegerRaw.mockResolvedValue([]);
            adminClient.getGalleriRaw.mockResolvedValue([
                { rowIndex: 1, type: 'forsidebilde', active: true },
                { rowIndex: 2, active: true },
                { rowIndex: 3, active: true },
                { rowIndex: 4, active: false },
            ]);

            await loadDashboardCounts(mockConfig);

            expect(document.getElementById('card-bilder-count').textContent).toBe('3 bilder, 2 aktive');
        });

        it('should show singular form for 1 bilde', async () => {
            adminClient.listFiles.mockResolvedValue([]);
            adminClient.getTannlegerRaw.mockResolvedValue([]);
            adminClient.getGalleriRaw.mockResolvedValue([{ rowIndex: 2, active: true }]);

            await loadDashboardCounts(mockConfig);

            expect(document.getElementById('card-bilder-count').textContent).toBe('1 bilde, 1 aktive');
        });

        it('should not throw when any fetch fails (Promise.allSettled)', async () => {
            adminClient.listFiles.mockRejectedValue(new Error('network'));
            adminClient.getTannlegerRaw.mockRejectedValue(new Error('network'));
            adminClient.getGalleriRaw.mockRejectedValue(new Error('network'));

            await expect(loadDashboardCounts(mockConfig)).resolves.not.toThrow();
        });

        it('should not update DOM when config has no folder IDs', async () => {
            await loadDashboardCounts({});

            expect(document.getElementById('card-tjenester-count').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('card-meldinger-count').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('card-tannleger-count').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('card-bilder-count').classList.contains('hidden')).toBe(true);
        });

        it('should not throw when count elements are missing from DOM', async () => {
            document.body.innerHTML = '';
            adminClient.listFiles.mockResolvedValue([]);
            adminClient.getTannlegerRaw.mockResolvedValue([{ name: 'X', active: true }]);
            adminClient.getGalleriRaw.mockResolvedValue([{ rowIndex: 1, active: true }]);

            await expect(loadDashboardCounts(mockConfig)).resolves.not.toThrow();
        });
    });
});
