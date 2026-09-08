import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('node:child_process');
vi.mock('node:fs');

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import {
    CARTO_KEY_PLACEHOLDER,
    injectCartoKey,
    deployFunction,
    assertCartoKeyAvailable,
} from '../setup-cloudfront-functions.mjs';

describe('injectCartoKey', () => {
    it('bytter ut placeholderen med nøkkelen', () => {
        const code = `var k = '${CARTO_KEY_PLACEHOLDER}';`;
        expect(injectCartoKey(code, 'hemmelig')).toBe("var k = 'hemmelig';");
    });

    it('bytter ut alle forekomster', () => {
        const code = `${CARTO_KEY_PLACEHOLDER}/${CARTO_KEY_PLACEHOLDER}`;
        expect(injectCartoKey(code, 'x')).toBe('x/x');
    });

    it.each([
        ['undefined', undefined],
        ['tom streng', ''],
    ])('kaster når placeholder finnes men nøkkelen er %s', (_label, apiKey) => {
        const code = `var k = '${CARTO_KEY_PLACEHOLDER}';`;
        expect(() => injectCartoKey(code, apiKey)).toThrow(/CARTO_API_KEY/);
    });

    it.each([
        ['etterfølgende linjeskift', 'cb1_abc123\n'],
        ['ledende mellomrom', ' cb1_abc123'],
        ['mellomrom inni', 'cb1_abc 123'],
        ['enkeltfnutt som bryter ut av streng-literalen', "cb1_abc'"],
        ['backslash', 'cb1_abc\\'],
        ['tabulator', 'cb1_abc\t'],
    ])('kaster når nøkkelen har %s', (_label, apiKey) => {
        const code = `var k = '${CARTO_KEY_PLACEHOLDER}';`;
        expect(() => injectCartoKey(code, apiKey)).toThrow(/uventet format/);
    });

    it('godtar en nøkkel på CARTOs faktiske format', () => {
        const code = `var k = '${CARTO_KEY_PLACEHOLDER}';`;
        expect(injectCartoKey(code, 'cb1_test_1_abcdef0123456789')).toBe("var k = 'cb1_test_1_abcdef0123456789';");
    });

    it('lar kode uten placeholder stå urørt, også uten nøkkel', () => {
        const code = 'function handler(event) { return event.request; }';
        expect(injectCartoKey(code, undefined)).toBe(code);
    });
});

describe('deployFunction', () => {
    const fn = {
        name: 'strip-tiles-prefix',
        codePath: '/tmp/kode.js',
        comment: 'test-kommentar',
        runtime: 'cloudfront-js-2.0',
    };

    const TMP_DIR = '/tmp/cf-a1b2c3';

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        readFileSync.mockReturnValue(`var k = '${CARTO_KEY_PLACEHOLDER}';`);
        mkdtempSync.mockReturnValue(TMP_DIR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('oppdaterer eksisterende funksjon og skriver injisert kode til tmp-fil', () => {
        execSync.mockImplementation((cmd) => {
            if (cmd.includes('describe-function')) return JSON.stringify({ ETag: 'E1' });
            if (cmd.includes('update-function')) return JSON.stringify({ ETag: 'E2' });
            return '';
        });

        deployFunction(fn, 'hemmelig');

        expect(mkdtempSync).toHaveBeenCalled();
        expect(writeFileSync).toHaveBeenCalledWith(`${TMP_DIR}/strip-tiles-prefix.js`, "var k = 'hemmelig';", {
            mode: 0o600,
        });
        const kommandoer = execSync.mock.calls.map(([cmd]) => cmd);
        expect(kommandoer.some((c) => c.includes('update-function') && c.includes('--if-match "E1"'))).toBe(true);
        expect(kommandoer.some((c) => c.includes('publish-function') && c.includes('--if-match "E2"'))).toBe(true);
        expect(kommandoer.some((c) => c.includes('create-function'))).toBe(false);
    });

    it('oppretter funksjonen når den ikke finnes fra før', () => {
        execSync.mockImplementation((cmd) => {
            if (cmd.includes('describe-function')) throw new Error('NoSuchFunctionExists: ingen slik funksjon');
            if (cmd.includes('create-function')) return JSON.stringify({ ETag: 'E9' });
            return '';
        });

        deployFunction(fn, 'hemmelig');

        const kommandoer = execSync.mock.calls.map(([cmd]) => cmd);
        expect(kommandoer.some((c) => c.includes('create-function'))).toBe(true);
        expect(kommandoer.some((c) => c.includes('publish-function') && c.includes('--if-match "E9"'))).toBe(true);
    });

    it('lar andre AWS-feil boble opp', () => {
        execSync.mockImplementation(() => {
            throw new Error('AccessDenied: mangler rettigheter');
        });

        expect(() => deployFunction(fn, 'hemmelig')).toThrow(/AccessDenied/);
    });

    it('sletter tmp-katalogen med nøkkelen etter vellykket deploy', () => {
        execSync.mockImplementation((cmd) => {
            if (cmd.includes('describe-function')) return JSON.stringify({ ETag: 'E1' });
            if (cmd.includes('update-function')) return JSON.stringify({ ETag: 'E2' });
            return '';
        });

        deployFunction(fn, 'hemmelig');

        expect(rmSync).toHaveBeenCalledWith(TMP_DIR, { recursive: true, force: true });
    });

    it('sletter tmp-katalogen også når AWS-kallet feiler', () => {
        execSync.mockImplementation(() => {
            throw new Error('AccessDenied: mangler rettigheter');
        });

        expect(() => deployFunction(fn, 'hemmelig')).toThrow(/AccessDenied/);
        expect(rmSync).toHaveBeenCalledWith(TMP_DIR, { recursive: true, force: true });
    });

    it('stopper deployen når nøkkelen mangler', () => {
        execSync.mockReturnValue('');

        expect(() => deployFunction(fn, undefined)).toThrow(/CARTO_API_KEY/);
        expect(execSync).not.toHaveBeenCalled();
        expect(writeFileSync).not.toHaveBeenCalled();
    });
});

describe('assertCartoKeyAvailable', () => {
    const functions = [{ codePath: '/a.js' }, { codePath: '/b.js' }];

    it('kaster før noe deployes når en funksjon trenger nøkkelen og den mangler', () => {
        readFileSync.mockImplementation((p) => (p === '/b.js' ? `k='${CARTO_KEY_PLACEHOLDER}'` : 'k=1'));

        expect(() => assertCartoKeyAvailable(functions, undefined)).toThrow(/CARTO_API_KEY/);
    });

    it('slipper gjennom når nøkkelen finnes', () => {
        readFileSync.mockImplementation((p) => (p === '/b.js' ? `k='${CARTO_KEY_PLACEHOLDER}'` : 'k=1'));

        expect(() => assertCartoKeyAvailable(functions, 'hemmelig')).not.toThrow();
    });

    it('slipper gjennom uten nøkkel når ingen funksjon trenger den', () => {
        readFileSync.mockReturnValue('k=1');

        expect(() => assertCartoKeyAvailable(functions, undefined)).not.toThrow();
    });
});

describe('placeholder i faktisk funksjonskode', () => {
    // Vaktpost mot drift: injectCartoKey er en ren streng-erstatning, så en placeholder som
    // omdøpes eller fjernes i CF-funksjonen gir ingen feil — deployen går grønn og CARTO
    // svarer med vannmerkede tiles som blir cachet i 24 t.
    it('cloudfront-strip-tiles-prefix.js inneholder placeholderen', async () => {
        const { readFileSync: lesEkte } = await vi.importActual('node:fs');
        const { fileURLToPath } = await import('node:url');
        const sti = fileURLToPath(new URL('../cloudfront-strip-tiles-prefix.js', import.meta.url));

        expect(lesEkte(sti, 'utf8')).toContain(CARTO_KEY_PLACEHOLDER);
    });
});
