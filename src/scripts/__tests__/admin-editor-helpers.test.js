/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
vi.mock('snarkdown', () => ({ default: vi.fn(text => `<p>${text}</p>`) }));
vi.mock('../admin-api-retry.js', () => ({
    createAuthRefresher: vi.fn(() => 'mock-refresher')
}));
vi.mock('../admin-client.js', () => ({
    silentLogin: vi.fn()
}));

import {
    getAdminConfig, getRefreshAuth, setToggleState, renderToggleHtml,
    attachToggleClick, showDeletionToast, initMarkdownEditor, initEditors,
    bindSliderStepButtons, bindWheelPrevent, showSaveBar, hideSaveBar
} from '../admin-editor-helpers.js';
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
