/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockAutoSaver, mockAdminDialog, setupModuleDOM } from './test-helpers.js';

vi.mock('../admin-dialog.js', () => mockAdminDialog());
vi.mock('../admin-reorder.js', () => ({
    animateSwap: vi.fn(),
    disableReorderButtons: vi.fn(),
    enableReorderButtons: vi.fn(),
    updateReorderButtonVisibility: vi.fn(),
}));
vi.mock('../admin-editor-helpers.js', () => ({
    getAdminConfig: vi.fn(() => ({ SHEET_ID: 'test-sheet' })),
    escapeHtml: vi.fn(s => String(s || '')),
    createAutoSaver: createMockAutoSaver(),
    renderToggleHtml: vi.fn((id, active) =>
        `<button id="${id}" data-active="${active}"><span class="toggle-label">${active ? 'Aktiv' : 'Inaktiv'}</span></button>`),
    attachToggleClick: vi.fn(),
    setToggleState: vi.fn(),
    handleSaveError: vi.fn(),
    getRefreshAuth: vi.fn(() => () => Promise.resolve(true)),
}));
vi.mock('../admin-sheets.js', () => ({
    getKontaktSkjemaRaw: vi.fn(),
    updateKontaktSkjemaField: vi.fn(),
    addKontaktTemaRow: vi.fn(),
    ensureKontaktSkjemaSheet: vi.fn(),
    deleteSheetRow: vi.fn(),
}));
vi.mock('../admin-api-retry.js', () => ({
    withRetry: vi.fn((fn) => fn()),
}));
vi.mock('../admin-dashboard.js', () => ({
    ICON_ADD:    '<span>+</span>',
    ICON_UP:     '<span>▲</span>',
    ICON_DOWN:   '<span>▼</span>',
    ICON_DELETE: '<span>🗑</span>',
}));

import { showToast, showConfirm } from '../admin-dialog.js';
import {
    getKontaktSkjemaRaw, updateKontaktSkjemaField,
    addKontaktTemaRow, ensureKontaktSkjemaSheet, deleteSheetRow,
} from '../admin-sheets.js';
import { createAutoSaver, handleSaveError, attachToggleClick } from '../admin-editor-helpers.js';
import { animateSwap, enableReorderButtons } from '../admin-reorder.js';
import { initKontaktSkjemaModule, reloadKontaktSkjema } from '../admin-module-kontaktskjema.js';

const defaultRaw = {
    aktiv:        { rowIndex: 2, value: 'nei' },
    tittel:       { rowIndex: 3, value: 'Ta kontakt' },
    tekst:        { rowIndex: 4, value: 'Vi svarer raskt.' },
    kontaktEpost: { rowIndex: 5, value: 'test@example.com' },
    tema:         [{ rowIndex: 6, value: 'Timebooking' }, { rowIndex: 7, value: 'Priser' }],
};

beforeEach(() => {
    setupModuleDOM({ configAttrs: 'data-sheet-id="test-sheet"' });
    vi.clearAllMocks();
    vi.useFakeTimers();
    getKontaktSkjemaRaw.mockResolvedValue(defaultRaw);
    ensureKontaktSkjemaSheet.mockResolvedValue();
    updateKontaktSkjemaField.mockResolvedValue(true);
    addKontaktTemaRow.mockResolvedValue(true);
    deleteSheetRow.mockResolvedValue(true);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('reloadKontaktSkjema', () => {
    it('kaller ensureKontaktSkjemaSheet og getKontaktSkjemaRaw', async () => {
        await reloadKontaktSkjema();
        expect(ensureKontaktSkjemaSheet).toHaveBeenCalledWith('test-sheet');
        expect(getKontaktSkjemaRaw).toHaveBeenCalledWith('test-sheet');
    });

    it('rendrer tittel og tekst-felter i module-inner', async () => {
        await reloadKontaktSkjema();
        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('Ta kontakt');
        expect(inner.innerHTML).toContain('Vi svarer raskt.');
    });

    it('rendrer tema-listen med to rader', async () => {
        await reloadKontaktSkjema();
        const rows = document.querySelectorAll('[data-tema-row]');
        expect(rows).toHaveLength(2);
    });

    it('viser feilmelding ved API-feil', async () => {
        getKontaktSkjemaRaw.mockRejectedValue(new Error('Nettverksfeil'));
        await reloadKontaktSkjema();
        expect(document.getElementById('module-inner').innerHTML).toContain('Feil');
    });
});

describe('tema-liste interaksjon', () => {
    it('legger til ny tema-rad ved klikk på legg-til-knapp og bekreftelsesskjema', async () => {
        await reloadKontaktSkjema();
        const addBtn = document.getElementById('btn-add-tema');
        addBtn.click();
        const input = document.getElementById('new-tema-input');
        input.value = 'Nytt tema';
        const saveBtn = document.getElementById('btn-save-new-tema');
        saveBtn.click();
        await vi.runAllTimersAsync();
        expect(addKontaktTemaRow).toHaveBeenCalledWith('test-sheet', 'Nytt tema');
    });

    it('sletter tema etter bekreftelse', async () => {
        showConfirm.mockResolvedValue(true);
        await reloadKontaktSkjema();
        const deleteBtn = document.querySelector('[data-delete-tema]');
        deleteBtn.click();
        await vi.runAllTimersAsync();
        expect(deleteSheetRow).toHaveBeenCalledWith('test-sheet', 'KontaktSkjema', 6);
    });

    it('sletter ikke tema ved avbryt', async () => {
        showConfirm.mockResolvedValue(false);
        await reloadKontaktSkjema();
        document.querySelector('[data-delete-tema]').click();
        await vi.runAllTimersAsync();
        expect(deleteSheetRow).not.toHaveBeenCalled();
    });
});

describe('autosave på tekstfelt', () => {
    it('trigger autosaver ved input på tittel-felt', async () => {
        await reloadKontaktSkjema();
        // createAutoSaver is called 3 times for text fields + 2 for tema inputs
        const tittelSaver = createAutoSaver.mock.results[0].value;
        document.getElementById('ks-tittel').dispatchEvent(new Event('input'));
        expect(tittelSaver.trigger).toHaveBeenCalled();
    });

    it('trigger autosaver ved blur på tekst-felt', async () => {
        await reloadKontaktSkjema();
        const tekstSaver = createAutoSaver.mock.results[1].value;
        document.getElementById('ks-tekst').dispatchEvent(new Event('blur'));
        expect(tekstSaver.trigger).toHaveBeenCalled();
    });

    it('trigger autosaver ved input på tema-input-felt', async () => {
        await reloadKontaktSkjema();
        // tema inputs come after the 3 text fields: indices 3 and 4
        const temaSaver = createAutoSaver.mock.results[3].value;
        document.querySelectorAll('[data-tema-input]')[0].dispatchEvent(new Event('input'));
        expect(temaSaver.trigger).toHaveBeenCalled();
    });

    it('utfører lagring av tittel via _saveFn', async () => {
        await reloadKontaktSkjema();
        const tittelSaver = createAutoSaver.mock.results[0].value;
        await tittelSaver._saveFn();
        expect(updateKontaktSkjemaField).toHaveBeenCalledWith('test-sheet', 3, expect.any(String));
        expect(showToast).toHaveBeenCalledWith('Tittel lagret');
    });

    it('utfører lagring av tema via _saveFn', async () => {
        await reloadKontaktSkjema();
        // tema saver is at index 3 (after 3 text fields)
        const temaSaver = createAutoSaver.mock.results[3].value;
        await temaSaver._saveFn();
        expect(updateKontaktSkjemaField).toHaveBeenCalledWith('test-sheet', 6, expect.any(String));
        expect(showToast).toHaveBeenCalledWith('Tema lagret');
    });
});

describe('ny tema-form', () => {
    it('avbryt-knapp skjuler skjema og viser legg-til-knapp igjen', async () => {
        await reloadKontaktSkjema();
        document.getElementById('btn-add-tema').click();
        expect(document.getElementById('new-tema-form').hidden).toBe(false);
        document.getElementById('btn-cancel-new-tema').click();
        expect(document.getElementById('new-tema-form').hidden).toBe(true);
        expect(document.getElementById('btn-add-tema').hidden).toBe(false);
    });

    it('lagrer ikke tomt tema-navn', async () => {
        await reloadKontaktSkjema();
        document.getElementById('btn-add-tema').click();
        document.getElementById('new-tema-input').value = '   ';
        document.getElementById('btn-save-new-tema').click();
        await vi.runAllTimersAsync();
        expect(addKontaktTemaRow).not.toHaveBeenCalled();
    });
});

describe('reorder-knapper', () => {
    it('flytter tema ned ved klikk på ned-knapp', async () => {
        animateSwap.mockResolvedValue(undefined);
        await reloadKontaktSkjema();
        // first row's "down" button (index 0, not last)
        const firstRow = document.querySelectorAll('[data-tema-row]')[0];
        const downBtn = firstRow.querySelector('[data-direction="down"]');
        downBtn.click();
        await vi.runAllTimersAsync();
        expect(animateSwap).toHaveBeenCalled();
        expect(updateKontaktSkjemaField).toHaveBeenCalled();
    });

    it('gjør ingenting ved klikk på opp-knapp på første rad (ingen nabo)', async () => {
        await reloadKontaktSkjema();
        // first row's "up" button is hidden, but we can test the guard by clicking last row's "down"
        const rows = document.querySelectorAll('[data-tema-row]');
        const lastRow = rows[rows.length - 1];
        const downBtn = lastRow.querySelector('[data-direction="down"]');
        // down button on last row is hidden — neighborRow will be null, should return early
        downBtn.removeAttribute('hidden');
        downBtn.click();
        await vi.runAllTimersAsync();
        expect(animateSwap).not.toHaveBeenCalled();
    });
});

describe('initKontaktSkjemaModule', () => {
    it('kjøres uten feil', () => {
        expect(() => initKontaktSkjemaModule()).not.toThrow();
    });
});

describe('reloadKontaktSkjema uten DOM', () => {
    it('returnerer tidlig hvis module-inner ikke finnes', async () => {
        document.body.innerHTML = '';
        await reloadKontaktSkjema();
        expect(ensureKontaktSkjemaSheet).not.toHaveBeenCalled();
    });
});

describe('toggle aktiv', () => {
    it('kaller updateKontaktSkjemaField med "nei" når toggle er inaktiv', async () => {
        await reloadKontaktSkjema();
        // attachToggleClick was called with (id, callback) — invoke the callback
        const toggleCallback = attachToggleClick.mock.calls[0][1];
        await toggleCallback();
        expect(updateKontaktSkjemaField).toHaveBeenCalledWith('test-sheet', 2, 'nei');
        expect(showToast).toHaveBeenCalledWith('Kontaktskjema deaktivert');
    });

    it('kaller updateKontaktSkjemaField med "ja" når toggle er aktiv', async () => {
        getKontaktSkjemaRaw.mockResolvedValue({
            ...defaultRaw,
            aktiv: { rowIndex: 2, value: 'ja' },
        });
        await reloadKontaktSkjema();
        const btn = document.getElementById('toggle-kontaktskjema-aktiv');
        btn.dataset.active = 'true';
        const toggleCallback = attachToggleClick.mock.calls[0][1];
        await toggleCallback();
        expect(updateKontaktSkjemaField).toHaveBeenCalledWith('test-sheet', 2, 'ja');
        expect(showToast).toHaveBeenCalledWith('Kontaktskjema aktivert');
    });

    it('kaller handleSaveError ved feil i toggle', async () => {
        updateKontaktSkjemaField.mockRejectedValue(new Error('Toggle-feil'));
        await reloadKontaktSkjema();
        const toggleCallback = attachToggleClick.mock.calls[0][1];
        await toggleCallback();
        expect(handleSaveError).toHaveBeenCalledWith(expect.any(Error), 'aktiv');
    });
});

describe('feil-håndtering i tema-operasjoner', () => {
    it('kaller handleSaveError ved feil i slett-tema', async () => {
        showConfirm.mockResolvedValue(true);
        deleteSheetRow.mockRejectedValue(new Error('Nettverksfeil'));
        await reloadKontaktSkjema();
        document.querySelector('[data-delete-tema]').click();
        await vi.runAllTimersAsync();
        expect(handleSaveError).toHaveBeenCalledWith(expect.any(Error), 'temaet');
    });

    it('kaller handleSaveError ved feil i reorder', async () => {
        animateSwap.mockRejectedValue(new Error('Swap-feil'));
        await reloadKontaktSkjema();
        const firstRow = document.querySelectorAll('[data-tema-row]')[0];
        const downBtn = firstRow.querySelector('[data-direction="down"]');
        downBtn.click();
        await vi.runAllTimersAsync();
        expect(handleSaveError).toHaveBeenCalledWith(expect.any(Error), 'rekkefølge');
        expect(enableReorderButtons).toHaveBeenCalled();
    });

    it('kaller handleSaveError ved feil i legg-til-tema', async () => {
        addKontaktTemaRow.mockRejectedValue(new Error('API-feil'));
        await reloadKontaktSkjema();
        document.getElementById('btn-add-tema').click();
        document.getElementById('new-tema-input').value = 'Nytt tema';
        document.getElementById('btn-save-new-tema').click();
        await vi.runAllTimersAsync();
        expect(handleSaveError).toHaveBeenCalledWith(expect.any(Error), 'tema');
    });
});
