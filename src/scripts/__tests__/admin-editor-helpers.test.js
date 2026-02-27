/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
vi.mock('marked', () => ({ marked: { parse: vi.fn(text => `<p>${text}</p>`) } }));
vi.mock('../admin-api-retry.js', () => ({
    createAuthRefresher: vi.fn(() => 'mock-refresher')
}));
vi.mock('../admin-client.js', () => ({
    silentLogin: vi.fn(),
    findFileByName: vi.fn(),
    getDriveImageBlob: vi.fn(),
}));
vi.mock('../admin-dashboard.js', () => ({
    formatTimestamp: vi.fn((date) => '27. feb kl. 23:00')
}));

import {
    getAdminConfig, getRefreshAuth, setToggleState, renderToggleHtml,
    attachToggleClick, showDeletionToast, initMarkdownEditor, initEditors,
    renderImageCropSliders, createAutoSaver, bindSliderStepButtons, bindWheelPrevent,
    showSaveBar, hideSaveBar, resolveImagePreview, handleImageSelected, verifySave,
    escapeHtml, validateSheetInput
} from '../admin-editor-helpers.js';
import { findFileByName, getDriveImageBlob } from '../admin-client.js';
import { createAuthRefresher } from '../admin-api-retry.js';

beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
});

describe('getAdminConfig', () => {
    it('should read config from #admin-config element', () => {
        document.body.innerHTML = `<div id="admin-config"
            data-tjenester-folder="tf"
            data-tannleger-folder="taf"
            data-meldinger-folder="mf"
            data-sheet-id="sid"
            data-defaults='{"key":"val"}'></div>`;
        const config = getAdminConfig();
        expect(config.TJENESTER_FOLDER).toBe('tf');
        expect(config.TANNLEGER_FOLDER).toBe('taf');
        expect(config.MELDINGER_FOLDER).toBe('mf');
        expect(config.SHEET_ID).toBe('sid');
        expect(config.HARD_DEFAULTS).toEqual({ key: 'val' });
    });

    it('should return undefined values when element is missing', () => {
        const config = getAdminConfig();
        expect(config.TJENESTER_FOLDER).toBeUndefined();
        expect(config.SHEET_ID).toBeUndefined();
        expect(config.HARD_DEFAULTS).toEqual({});
    });
});

describe('getRefreshAuth', () => {
    it('should create a refresher on first call', async () => {
        vi.resetModules();
        const { getRefreshAuth } = await import('../admin-editor-helpers.js');
        const result = getRefreshAuth();
        expect(createAuthRefresher).toHaveBeenCalledTimes(1);
        expect(result).toBe('mock-refresher');
    });

    it('should return cached refresher on subsequent calls', async () => {
        vi.resetModules();
        const { getRefreshAuth } = await import('../admin-editor-helpers.js');
        const first = getRefreshAuth();
        const second = getRefreshAuth();
        expect(createAuthRefresher).toHaveBeenCalledTimes(1);
        expect(first).toBe(second);
    });
});

describe('setToggleState', () => {
    it('should set active state on toggle button', () => {
        document.body.innerHTML = '<button id="t"><span class="toggle-label"></span></button>';
        const btn = document.getElementById('t');
        setToggleState(btn, true);
        expect(btn.dataset.active).toBe('true');
        expect(btn.getAttribute('aria-checked')).toBe('true');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Aktiv');
    });

    it('should set inactive state', () => {
        document.body.innerHTML = '<button id="t"><span class="toggle-label"></span></button>';
        const btn = document.getElementById('t');
        setToggleState(btn, false);
        expect(btn.dataset.active).toBe('false');
        expect(btn.getAttribute('aria-checked')).toBe('false');
        expect(btn.querySelector('.toggle-label').textContent).toBe('Inaktiv');
    });

    it('should not throw when toggleBtn is null', () => {
        expect(() => setToggleState(null, true)).not.toThrow();
    });

    it('should work without toggle-label child', () => {
        document.body.innerHTML = '<button id="t"></button>';
        const btn = document.getElementById('t');
        setToggleState(btn, true);
        expect(btn.dataset.active).toBe('true');
    });
});

describe('renderToggleHtml', () => {
    it('should render active toggle', () => {
        const html = renderToggleHtml('my-toggle', true);
        expect(html).toContain('id="my-toggle"');
        expect(html).toContain('aria-checked="true"');
        expect(html).toContain('data-active="true"');
        expect(html).toContain('Aktiv');
    });

    it('should render inactive toggle', () => {
        const html = renderToggleHtml('my-toggle', false);
        expect(html).toContain('aria-checked="false"');
        expect(html).toContain('data-active="false"');
        expect(html).toContain('Inaktiv');
    });
});

describe('attachToggleClick', () => {
    it('should toggle state on click', () => {
        document.body.innerHTML = '<button id="t" data-active="true"><span class="toggle-label">Aktiv</span></button>';
        attachToggleClick('t');
        document.getElementById('t').click();
        expect(document.getElementById('t').dataset.active).toBe('false');
    });

    it('should call onChange callback', () => {
        document.body.innerHTML = '<button id="t" data-active="false"><span class="toggle-label">Inaktiv</span></button>';
        const onChange = vi.fn();
        attachToggleClick('t', onChange);
        document.getElementById('t').click();
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('should not throw when element is missing', () => {
        expect(() => attachToggleClick('nonexistent')).not.toThrow();
    });

    it('should work without onChange callback', () => {
        document.body.innerHTML = '<button id="t" data-active="true"><span class="toggle-label">Aktiv</span></button>';
        attachToggleClick('t');
        document.getElementById('t').click();
        expect(document.getElementById('t').dataset.active).toBe('false');
    });
});

describe('showDeletionToast', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('should create a toast with correct text', () => {
        showDeletionToast('Test Item', 'Recovery instructions here');
        const toast = document.getElementById('deletion-toast');
        expect(toast).not.toBeNull();
        expect(toast.querySelector('#toast-deleted-name').textContent).toBe('«Test Item» ble slettet');
        expect(toast.querySelector('#toast-recovery-text').textContent).toBe('Recovery instructions here');
    });

    it('should remove existing toast before creating new one', () => {
        showDeletionToast('First', 'text');
        showDeletionToast('Second', 'text');
        const toasts = document.querySelectorAll('#deletion-toast');
        expect(toasts.length).toBe(1);
        expect(toasts[0].querySelector('#toast-deleted-name').textContent).toContain('Second');
    });

    it('should remove toast on close button click', () => {
        showDeletionToast('Item', 'text');
        document.querySelector('.toast-close').click();
        expect(document.getElementById('deletion-toast')).toBeNull();
    });

    it('should auto-remove toast after 30 seconds', () => {
        showDeletionToast('Item', 'text');
        expect(document.getElementById('deletion-toast')).not.toBeNull();
        vi.advanceTimersByTime(30000);
        expect(document.getElementById('deletion-toast')).toBeNull();
    });
});

describe('initMarkdownEditor', () => {
    it('should create EasyMDE when available on window', () => {
        const mockInstance = { value: vi.fn(() => 'content') };
        window.EasyMDE = vi.fn(function() { return mockInstance; });
        document.body.innerHTML = '<textarea id="edit-content"></textarea>';

        const result = initMarkdownEditor();
        expect(window.EasyMDE).toHaveBeenCalled();
        expect(result).toBe(mockInstance);
        delete window.EasyMDE;
    });

    it('should return null when EasyMDE is not available', () => {
        document.body.innerHTML = '<textarea id="edit-content"></textarea>';
        const result = initMarkdownEditor();
        expect(result).toBeNull();
    });
});

describe('initEditors', () => {
    it('should create flatpickr instances when available', () => {
        const mockInstance = { value: vi.fn(() => '') };
        window.EasyMDE = vi.fn(function() { return mockInstance; });
        const mockFpInstance = { destroy: vi.fn() };
        const mockFp = vi.fn(() => mockFpInstance);
        mockFp.l10ns = null;
        window.flatpickr = mockFp;
        document.body.innerHTML = '<textarea id="edit-content"></textarea><input id="edit-start"><input id="edit-end">';

        const result = initEditors(vi.fn());
        expect(mockFp).toHaveBeenCalledTimes(2);
        expect(mockFp).toHaveBeenCalledWith('#edit-start', expect.any(Object));
        expect(mockFp).toHaveBeenCalledWith('#edit-end', expect.any(Object));
        expect(result.easyMDE).toBe(mockInstance);
        expect(result.flatpickrInstances).toHaveLength(2);
        delete window.flatpickr;
        delete window.EasyMDE;
    });

    it('should use Norwegian locale when available', () => {
        const mockFp = vi.fn();
        mockFp.l10ns = { no: { firstDayOfWeek: 1 } };
        window.flatpickr = mockFp;
        document.body.innerHTML = '<textarea id="edit-content"></textarea><input id="edit-start"><input id="edit-end">';

        initEditors(vi.fn());
        expect(mockFp).toHaveBeenCalledWith('#edit-start', expect.objectContaining({ locale: { firstDayOfWeek: 1 } }));
        delete window.flatpickr;
    });

    it('should try nb locale as fallback', () => {
        const mockFp = vi.fn();
        mockFp.l10ns = { nb: { firstDayOfWeek: 1 } };
        window.flatpickr = mockFp;
        document.body.innerHTML = '<textarea id="edit-content"></textarea><input id="edit-start"><input id="edit-end">';

        initEditors(vi.fn());
        expect(mockFp).toHaveBeenCalledWith('#edit-start', expect.objectContaining({ locale: { firstDayOfWeek: 1 } }));
        delete window.flatpickr;
    });

    it('should return easyMDE null and empty flatpickr when nothing available', () => {
        document.body.innerHTML = '<textarea id="edit-content"></textarea>';
        const result = initEditors(vi.fn());
        expect(result.easyMDE).toBeNull();
        expect(result.flatpickrInstances).toHaveLength(0);
    });
});

describe('renderImageCropSliders', () => {
    it('should render sliders with given prefix and valPrefix', () => {
        const html = renderImageCropSliders({ prefix: 'test', valPrefix: 'test-val' });
        expect(html).toContain('id="test-scale"');
        expect(html).toContain('id="test-x"');
        expect(html).toContain('id="test-y"');
        expect(html).toContain('id="test-val-scale"');
        expect(html).toContain('id="test-val-x"');
        expect(html).toContain('id="test-val-y"');
    });

    it('should use default values (1, 50, 50) when not provided', () => {
        const html = renderImageCropSliders({ prefix: 'p', valPrefix: 'v' });
        expect(html).toContain('value="1"');
        expect(html).toContain('value="50"');
        expect(html).toContain('1x');
        expect(html).toContain('50%');
    });

    it('should use custom values when provided', () => {
        const html = renderImageCropSliders({ prefix: 'p', valPrefix: 'v', scale: 2.5, posX: 30, posY: 70 });
        expect(html).toContain('value="2.5"');
        expect(html).toContain('value="30"');
        expect(html).toContain('value="70"');
        expect(html).toContain('2.5x');
        expect(html).toContain('30%');
        expect(html).toContain('70%');
    });

    it('should include step buttons with correct data-target', () => {
        const html = renderImageCropSliders({ prefix: 'edit-t', valPrefix: 'val' });
        expect(html).toContain('data-target="edit-t-scale"');
        expect(html).toContain('data-target="edit-t-x"');
        expect(html).toContain('data-target="edit-t-y"');
    });

    it('should include heading text', () => {
        const html = renderImageCropSliders({ prefix: 'p', valPrefix: 'v' });
        expect(html).toContain('Bildeutsnitt (Zoom og posisjon)');
    });
});

describe('createAutoSaver', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('should debounce and call saveFn after delay', async () => {
        const saveFn = vi.fn().mockResolvedValue(undefined);
        const { trigger } = createAutoSaver(saveFn, 1000);
        trigger();
        expect(saveFn).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1000);
        expect(saveFn).toHaveBeenCalledTimes(1);
    });

    it('should show changed state on trigger', () => {
        const saveFn = vi.fn().mockResolvedValue(undefined);
        const { trigger } = createAutoSaver(saveFn);
        trigger();
        const bar = document.getElementById('admin-save-bar');
        expect(bar).not.toBeNull();
        expect(bar.className).toContain('admin-save-bar-changed');
    });

    it('should show saved state after successful save', async () => {
        const saveFn = vi.fn().mockResolvedValue(undefined);
        const { trigger } = createAutoSaver(saveFn, 500);
        trigger();
        await vi.advanceTimersByTimeAsync(500);
        const bar = document.getElementById('admin-save-bar');
        expect(bar.className).toContain('admin-save-bar-saved');
    });

    it('should show error state when saveFn throws', async () => {
        const saveFn = vi.fn().mockRejectedValue(new Error('fail'));
        const { trigger } = createAutoSaver(saveFn, 500);
        trigger();
        await vi.advanceTimersByTimeAsync(500);
        const bar = document.getElementById('admin-save-bar');
        expect(bar.className).toContain('admin-save-bar-error');
    });

    it('should cancel pending save on cancel()', async () => {
        const saveFn = vi.fn().mockResolvedValue(undefined);
        const { trigger, cancel } = createAutoSaver(saveFn, 1000);
        trigger();
        cancel();
        await vi.advanceTimersByTimeAsync(1000);
        expect(saveFn).not.toHaveBeenCalled();
    });

    it('should reset debounce on repeated trigger calls', async () => {
        const saveFn = vi.fn().mockResolvedValue(undefined);
        const { trigger } = createAutoSaver(saveFn, 1000);
        trigger();
        await vi.advanceTimersByTimeAsync(500);
        trigger(); // resets timer
        await vi.advanceTimersByTimeAsync(500);
        expect(saveFn).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(500);
        expect(saveFn).toHaveBeenCalledTimes(1);
    });
});

describe('bindSliderStepButtons', () => {
    it('should increment value on click', () => {
        document.body.innerHTML = `
            <div id="container">
                <input type="range" id="slider" min="0" max="100" value="50">
                <button class="slider-step-btn" data-target="slider" data-step="1">+</button>
            </div>`;
        bindSliderStepButtons(document.getElementById('container'));
        document.querySelector('.slider-step-btn').click();
        expect(document.getElementById('slider').value).toBe('51');
    });

    it('should decrement value on click', () => {
        document.body.innerHTML = `
            <div id="container">
                <input type="range" id="slider" min="0" max="100" value="50">
                <button class="slider-step-btn" data-target="slider" data-step="-1">&minus;</button>
            </div>`;
        bindSliderStepButtons(document.getElementById('container'));
        document.querySelector('.slider-step-btn').click();
        expect(document.getElementById('slider').value).toBe('49');
    });

    it('should clamp to max', () => {
        document.body.innerHTML = `
            <div id="container">
                <input type="range" id="slider" min="0" max="100" value="100">
                <button class="slider-step-btn" data-target="slider" data-step="1">+</button>
            </div>`;
        bindSliderStepButtons(document.getElementById('container'));
        document.querySelector('.slider-step-btn').click();
        expect(document.getElementById('slider').value).toBe('100');
    });

    it('should clamp to min', () => {
        document.body.innerHTML = `
            <div id="container">
                <input type="range" id="slider" min="0" max="100" value="0">
                <button class="slider-step-btn" data-target="slider" data-step="-1">&minus;</button>
            </div>`;
        bindSliderStepButtons(document.getElementById('container'));
        document.querySelector('.slider-step-btn').click();
        expect(document.getElementById('slider').value).toBe('0');
    });

    it('should dispatch input event after changing value', () => {
        document.body.innerHTML = `
            <div id="container">
                <input type="range" id="slider" min="0" max="100" value="50">
                <button class="slider-step-btn" data-target="slider" data-step="1">+</button>
            </div>`;
        bindSliderStepButtons(document.getElementById('container'));
        const handler = vi.fn();
        document.getElementById('slider').addEventListener('input', handler);
        document.querySelector('.slider-step-btn').click();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle missing target gracefully', () => {
        document.body.innerHTML = `
            <div id="container">
                <button class="slider-step-btn" data-target="nonexistent" data-step="1">+</button>
            </div>`;
        bindSliderStepButtons(document.getElementById('container'));
        expect(() => document.querySelector('.slider-step-btn').click()).not.toThrow();
    });
});

describe('bindWheelPrevent', () => {
    it('should prevent wheel default on range inputs', () => {
        document.body.innerHTML = '<div id="c"><input type="range"></div>';
        bindWheelPrevent(document.getElementById('c'));
        const event = new Event('wheel', { cancelable: true });
        document.querySelector('input[type="range"]').dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });
});

describe('showSaveBar', () => {
    afterEach(() => {
        document.getElementById('admin-save-bar')?.remove();
    });

    it('should create a save bar with correct class and text', () => {
        showSaveBar('saving', '💾 Lagrer...');
        const bar = document.getElementById('admin-save-bar');
        expect(bar).not.toBeNull();
        expect(bar.className).toContain('admin-save-bar-saving');
        expect(bar.textContent).toBe('💾 Lagrer...');
    });

    it('should update existing bar without creating a new one', () => {
        showSaveBar('saving', '💾 Lagrer...');
        showSaveBar('saved', '✅ Lagret');
        const bars = document.querySelectorAll('#admin-save-bar');
        expect(bars.length).toBe(1);
        expect(bars[0].textContent).toBe('✅ Lagret');
    });

    it('should set correct class for each state', () => {
        for (const state of ['changed', 'saving', 'saved', 'error']) {
            showSaveBar(state, 'test');
            const bar = document.getElementById('admin-save-bar');
            expect(bar.className).toContain(`admin-save-bar-${state}`);
        }
    });
});

describe('hideSaveBar', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => {
        vi.useRealTimers();
        document.getElementById('admin-save-bar')?.remove();
    });

    it('should remove bar immediately when no delay', () => {
        showSaveBar('saved', '✅');
        hideSaveBar();
        expect(document.getElementById('admin-save-bar')).toBeNull();
    });

    it('should remove bar after delay', () => {
        showSaveBar('saved', '✅');
        hideSaveBar(5000);
        expect(document.getElementById('admin-save-bar')).not.toBeNull();
        vi.advanceTimersByTime(5000);
        expect(document.getElementById('admin-save-bar')).toBeNull();
    });

    it('should cancel pending hide on new showSaveBar call', () => {
        showSaveBar('saved', '✅');
        hideSaveBar(5000);
        showSaveBar('saving', '💾');
        vi.advanceTimersByTime(5000);
        expect(document.getElementById('admin-save-bar')).not.toBeNull();
    });

    it('should not throw when bar does not exist', () => {
        expect(() => hideSaveBar()).not.toThrow();
    });
});

describe('showDeletionToast — parentNode check on auto-removal', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('should not throw when toast is already removed before 30s timer fires', () => {
        showDeletionToast('Item', 'Recovery text');
        const toast = document.getElementById('deletion-toast');
        expect(toast).not.toBeNull();

        // Manually remove the toast before the 30s timer fires (simulates close button click)
        toast.remove();
        expect(document.getElementById('deletion-toast')).toBeNull();

        // Timer fires — toast.parentNode is null, so remove() should be skipped
        expect(() => vi.advanceTimersByTime(30000)).not.toThrow();
    });
});

describe('initMarkdownEditor — previewRender callback', () => {
    afterEach(() => {
        delete window.EasyMDE;
    });

    it('should invoke previewRender callback that sanitizes and parses markdown', () => {
        let capturedConfig = null;
        const mockInstance = { value: vi.fn(() => 'content') };
        window.EasyMDE = vi.fn(function(config) {
            capturedConfig = config;
            return mockInstance;
        });
        document.body.innerHTML = '<textarea id="edit-content"></textarea>';

        initMarkdownEditor();

        expect(capturedConfig).not.toBeNull();
        expect(typeof capturedConfig.previewRender).toBe('function');

        // Call the previewRender callback
        const result = capturedConfig.previewRender('**bold text**');
        expect(result).toContain('markdown-content');
        expect(result).toContain('prose');
        // DOMPurify.sanitize and marked.parse are mocked, so the result includes the mock output
        expect(result).toContain('<p>**bold text**</p>');
    });
});

describe('initEditors — previewRender and flatpickr callbacks', () => {
    afterEach(() => {
        delete window.EasyMDE;
        delete window.flatpickr;
    });

    it('should invoke initEditors previewRender callback', () => {
        let capturedConfig = null;
        const mockInstance = { value: vi.fn(() => '') };
        window.EasyMDE = vi.fn(function(config) {
            capturedConfig = config;
            return mockInstance;
        });
        document.body.innerHTML = '<textarea id="edit-content"></textarea>';

        initEditors(vi.fn());

        expect(capturedConfig).not.toBeNull();
        expect(typeof capturedConfig.previewRender).toBe('function');

        const result = capturedConfig.previewRender('# heading');
        expect(result).toContain('markdown-content');
        expect(result).toContain('<p># heading</p>');
    });

    it('should call onDateChange callback from flatpickr onChange when provided', () => {
        const mockFpInstance = { destroy: vi.fn() };
        let capturedFpConfig = null;
        const mockFp = vi.fn((selector, config) => {
            capturedFpConfig = config;
            return mockFpInstance;
        });
        mockFp.l10ns = null;
        window.flatpickr = mockFp;
        document.body.innerHTML = '<textarea id="edit-content"></textarea><input id="edit-start"><input id="edit-end">';

        const onDateChange = vi.fn();
        initEditors(onDateChange);

        expect(capturedFpConfig).not.toBeNull();
        expect(typeof capturedFpConfig.onChange).toBe('function');

        // Simulate flatpickr calling onChange
        const mockElement = { value: '' };
        const mockFpInst = { element: mockElement };
        capturedFpConfig.onChange([new Date('2025-01-15')], '2025-01-15', mockFpInst);

        expect(mockElement.value).toBe('2025-01-15');
        expect(onDateChange).toHaveBeenCalledWith(
            [expect.any(Date)],
            '2025-01-15',
            mockFpInst
        );
    });

    it('should not call onDateChange when it is null/undefined', () => {
        const mockFpInstance = { destroy: vi.fn() };
        let capturedFpConfig = null;
        const mockFp = vi.fn((selector, config) => {
            capturedFpConfig = config;
            return mockFpInstance;
        });
        mockFp.l10ns = null;
        window.flatpickr = mockFp;
        document.body.innerHTML = '<textarea id="edit-content"></textarea><input id="edit-start"><input id="edit-end">';

        initEditors(null);

        const mockElement = { value: '' };
        const mockFpInst = { element: mockElement };

        // Should not throw when onDateChange is null
        expect(() => capturedFpConfig.onChange([new Date()], '2025-01-15', mockFpInst)).not.toThrow();
        expect(mockElement.value).toBe('2025-01-15');
    });

    it('should try Norwegian locale fallback chain', () => {
        const mockFp = vi.fn();
        // l10ns exists but has 'Norwegian' key instead of 'no' or 'nb'
        mockFp.l10ns = { Norwegian: { firstDayOfWeek: 1 } };
        window.flatpickr = mockFp;
        document.body.innerHTML = '<textarea id="edit-content"></textarea><input id="edit-start"><input id="edit-end">';

        initEditors(vi.fn());
        expect(mockFp).toHaveBeenCalledWith('#edit-start', expect.objectContaining({ locale: { firstDayOfWeek: 1 } }));
    });

    it('should not set locale when l10ns has no matching Norwegian key', () => {
        const mockFp = vi.fn();
        mockFp.l10ns = { sv: { firstDayOfWeek: 1 } }; // Swedish only, no Norwegian
        window.flatpickr = mockFp;
        document.body.innerHTML = '<textarea id="edit-content"></textarea><input id="edit-start"><input id="edit-end">';

        initEditors(vi.fn());
        expect(mockFp).toHaveBeenCalledWith('#edit-start', expect.not.objectContaining({ locale: expect.anything() }));
    });
});

describe('escapeHtml', () => {
    it('should escape < and >', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should escape &', () => {
        expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape double quotes', () => {
        expect(escapeHtml('value="injected"')).toBe('value=&quot;injected&quot;');
    });

    it('should handle null and undefined', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('should handle numbers', () => {
        expect(escapeHtml(42)).toBe('42');
    });

    it('should return empty string as-is', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('should not modify safe text', () => {
        expect(escapeHtml('Dr. Hansen')).toBe('Dr. Hansen');
    });
});

describe('validateSheetInput', () => {
    it('should return null for valid text', () => {
        expect(validateSheetInput('hello')).toBeNull();
    });

    it('should reject text exceeding maxLength', () => {
        const result = validateSheetInput('a'.repeat(501));
        expect(result).toContain('Maks');
        expect(result).toContain('501');
    });

    it('should use custom maxLength', () => {
        expect(validateSheetInput('ab', { maxLength: 1 })).toContain('Maks');
        expect(validateSheetInput('a', { maxLength: 1 })).toBeNull();
    });

    it('should validate numbers', () => {
        expect(validateSheetInput('42', { type: 'number' })).toBeNull();
        expect(validateSheetInput('abc', { type: 'number' })).toContain('tall');
    });

    it('should accept empty strings', () => {
        expect(validateSheetInput('')).toBeNull();
    });
});

describe('resolveImagePreview', () => {
    beforeEach(() => {
        findFileByName.mockReset();
        getDriveImageBlob.mockReset();
    });

    it('should return empty result when imageName is empty', async () => {
        const result = await resolveImagePreview('', 'folder-id');
        expect(result).toEqual({ src: '', imageId: null });
        expect(findFileByName).not.toHaveBeenCalled();
    });

    it('should return empty result when imageName is falsy', async () => {
        const result = await resolveImagePreview(null, 'folder-id');
        expect(result).toEqual({ src: '', imageId: null });
    });

    it('should use imageName as Drive ID when long and no dot', async () => {
        getDriveImageBlob.mockResolvedValue('blob:drive-url');
        const longId = 'abcdefghijklmnopqrstuv'; // >20 chars, no dot
        const result = await resolveImagePreview(longId, 'folder-id');
        expect(findFileByName).not.toHaveBeenCalled();
        expect(getDriveImageBlob).toHaveBeenCalledWith(longId);
        expect(result).toEqual({ src: 'blob:drive-url', imageId: longId });
    });

    it('should look up file by name when imageName has a dot', async () => {
        findFileByName.mockResolvedValue({ id: 'file-123' });
        getDriveImageBlob.mockResolvedValue('blob:found');
        const result = await resolveImagePreview('photo.jpg', 'folder-id');
        expect(findFileByName).toHaveBeenCalledWith('photo.jpg', 'folder-id');
        expect(getDriveImageBlob).toHaveBeenCalledWith('file-123');
        expect(result).toEqual({ src: 'blob:found', imageId: 'file-123' });
    });

    it('should use local fallback when Drive lookup fails', async () => {
        findFileByName.mockResolvedValue(null);
        const result = await resolveImagePreview('photo.jpg', 'folder-id', { localFallbackDir: '/images/' });
        expect(result).toEqual({ src: '/images/photo.jpg', imageId: null });
    });

    it('should use local fallback when getDriveImageBlob returns null', async () => {
        findFileByName.mockResolvedValue({ id: 'file-123' });
        getDriveImageBlob.mockResolvedValue(null);
        const result = await resolveImagePreview('photo.jpg', 'folder-id', { localFallbackDir: '/images/' });
        expect(result).toEqual({ src: '/images/photo.jpg', imageId: 'file-123' });
    });

    it('should not use local fallback for Drive IDs (no dot)', async () => {
        getDriveImageBlob.mockResolvedValue(null);
        const longId = 'abcdefghijklmnopqrstuv';
        const result = await resolveImagePreview(longId, 'folder-id', { localFallbackDir: '/images/' });
        expect(result).toEqual({ src: '', imageId: longId });
    });

    it('should handle Drive API error gracefully', async () => {
        findFileByName.mockRejectedValue(new Error('Network error'));
        const result = await resolveImagePreview('photo.jpg', 'folder-id', { localFallbackDir: '/images/' });
        expect(result).toEqual({ src: '/images/photo.jpg', imageId: null });
    });

    it('should return empty src when no fallback and Drive fails', async () => {
        findFileByName.mockRejectedValue(new Error('Network error'));
        const result = await resolveImagePreview('photo.jpg', 'folder-id');
        expect(result).toEqual({ src: '', imageId: null });
    });
});

describe('handleImageSelected', () => {
    beforeEach(() => {
        getDriveImageBlob.mockReset();
    });

    it('should set input value and fetch blob preview', async () => {
        document.body.innerHTML = '<input id="img"><img id="preview" class="hidden"><div id="placeholder"></div>';
        getDriveImageBlob.mockResolvedValue('blob:test');

        await handleImageSelected({
            fileId: 'file-123', fileName: 'photo.jpg',
            inputEl: document.getElementById('img'),
            previewImgEl: document.getElementById('preview'),
            placeholderEl: document.getElementById('placeholder')
        });

        expect(document.getElementById('img').value).toBe('photo.jpg');
        expect(getDriveImageBlob).toHaveBeenCalledWith('file-123');
        expect(document.getElementById('preview').src).toContain('blob:test');
        expect(document.getElementById('preview').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('placeholder').classList.contains('hidden')).toBe(true);
    });

    it('should dispatch input event on inputEl', async () => {
        document.body.innerHTML = '<input id="img">';
        getDriveImageBlob.mockResolvedValue(null);
        const handler = vi.fn();
        document.getElementById('img').addEventListener('input', handler);

        await handleImageSelected({
            fileId: 'f', fileName: 'n',
            inputEl: document.getElementById('img'),
            previewImgEl: null, placeholderEl: null
        });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not show preview when blob is null', async () => {
        document.body.innerHTML = '<input id="img"><img id="preview" class="hidden">';
        getDriveImageBlob.mockResolvedValue(null);

        await handleImageSelected({
            fileId: 'f', fileName: 'n',
            inputEl: document.getElementById('img'),
            previewImgEl: document.getElementById('preview'),
            placeholderEl: null
        });

        expect(document.getElementById('preview').classList.contains('hidden')).toBe(true);
    });

    it('should do nothing when inputEl is null', async () => {
        await handleImageSelected({
            fileId: 'f', fileName: 'n',
            inputEl: null,
            previewImgEl: null, placeholderEl: null
        });

        expect(getDriveImageBlob).not.toHaveBeenCalled();
    });

    it('should work without placeholderEl', async () => {
        document.body.innerHTML = '<input id="img"><img id="preview" class="hidden">';
        getDriveImageBlob.mockResolvedValue('blob:ok');

        await handleImageSelected({
            fileId: 'f', fileName: 'n',
            inputEl: document.getElementById('img'),
            previewImgEl: document.getElementById('preview'),
            placeholderEl: null
        });

        expect(document.getElementById('preview').classList.contains('hidden')).toBe(false);
    });
});

describe('verifySave', () => {
    it('should update timestamp and pass when data matches', async () => {
        document.body.innerHTML = '<span id="ts"></span>';
        const fetchFn = vi.fn().mockResolvedValue([{ rowIndex: 2, name: 'Test' }]);
        const reloadFn = vi.fn();

        await verifySave({
            fetchFn, rowIndex: 2, compareField: 'name',
            expectedValue: 'Test', timestampElId: 'ts', reloadFn
        });

        expect(document.getElementById('ts').textContent).toContain('27. feb');
        expect(reloadFn).not.toHaveBeenCalled();
    });

    it('should throw Mismatch and call reloadFn when data differs', async () => {
        const fetchFn = vi.fn().mockResolvedValue([{ rowIndex: 2, name: 'Different' }]);
        const reloadFn = vi.fn();

        await expect(verifySave({
            fetchFn, rowIndex: 2, compareField: 'name',
            expectedValue: 'Expected', timestampElId: 'ts', reloadFn
        })).rejects.toThrow('Mismatch');

        expect(reloadFn).toHaveBeenCalled();
    });

    it('should handle fetch error gracefully (non-mismatch)', async () => {
        const fetchFn = vi.fn().mockRejectedValue(new Error('Network'));
        const reloadFn = vi.fn();

        await expect(verifySave({
            fetchFn, rowIndex: 2, compareField: 'name',
            expectedValue: 'V', timestampElId: 'ts', reloadFn
        })).resolves.toBeUndefined();

        expect(reloadFn).not.toHaveBeenCalled();
    });

    it('should pass when row is not found in fresh data', async () => {
        const fetchFn = vi.fn().mockResolvedValue([{ rowIndex: 99, name: 'Other' }]);
        const reloadFn = vi.fn();

        await expect(verifySave({
            fetchFn, rowIndex: 2, compareField: 'name',
            expectedValue: 'V', timestampElId: 'ts', reloadFn
        })).resolves.toBeUndefined();

        expect(reloadFn).not.toHaveBeenCalled();
    });

    it('should work without timestamp element', async () => {
        const fetchFn = vi.fn().mockResolvedValue([{ rowIndex: 2, name: 'OK' }]);

        await expect(verifySave({
            fetchFn, rowIndex: 2, compareField: 'name',
            expectedValue: 'OK', timestampElId: 'nonexistent', reloadFn: vi.fn()
        })).resolves.toBeUndefined();
    });
});
