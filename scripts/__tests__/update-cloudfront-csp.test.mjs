import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

vi.mock('node:child_process');

import { execFileSync } from 'node:child_process';
import {
    FatalError,
    GAPI_RUNTIME_HASHES,
    buildCspString,
    buildScriptSrc,
} from '../setup-response-headers-policy.mjs';
import {
    MAX_CSP_LENGTH,
    extractScriptHashes,
    mergeHashes,
    planCspUpdate,
    cspHasAllHashes,
    waitForCsp,
    fetchPolicy,
    writePolicy,
} from '../update-cloudfront-csp.mjs';

// Gyldige sha256-hasher: 43 base64-tegn + '='
const hash = (c) => `sha256-${c.repeat(43)}=`;
const A = hash('A');
const B = hash('B');
const C = hash('C');
const GAPI = GAPI_RUNTIME_HASHES[0];

const cspFor = (hashes) => buildCspString(buildScriptSrc(hashes));

describe('extractScriptHashes', () => {
    it('henter build-hashene og GAPI fra en ekte CSP', () => {
        expect(extractScriptHashes(cspFor([A, B]))).toEqual([A, B, GAPI]);
    });

    it.each([
        ['self og URL-er', `script-src 'self' https://apis.google.com '${A}'`, [A]],
        ['unsafe-inline', `script-src 'unsafe-inline' '${A}'`, [A]],
        ['sha384', `script-src 'sha384-${'A'.repeat(64)}' '${A}'`, [A]],
        ['hash uten anførselstegn', `script-src ${B} '${A}'`, [A]],
        ['feil lengde', `script-src 'sha256-${'A'.repeat(42)}=' '${A}'`, [A]],
        ['etterfølgende linjeskift i tokenet', `script-src '${B}'\n'${A}'`, []],
        ['hash i annet direktiv', `default-src '${B}'; script-src '${A}'`, [A]],
        ['tom streng', '', []],
        ['manglende script-src', "default-src 'self'; style-src 'self'", []],
        ['to script-src — det første gjelder', `script-src '${A}'; script-src '${B}'`, [A]],
        ['store bokstaver i direktivnavn', `SCRIPT-SRC '${A}'`, [A]],
    ])('%s', (_navn, csp, forventet) => {
        expect(extractScriptHashes(csp)).toEqual(forventet);
    });
});

describe('mergeHashes', () => {
    it('gir union uten duplikater, sortert og uten GAPI', () => {
        expect(mergeHashes([C, A, GAPI], [B, A])).toEqual([A, B, C]);
    });
});

describe('planCspUpdate', () => {
    it('sluttoppdatering gir bare nye hasher pluss GAPI', () => {
        const plan = planCspUpdate({ currentCsp: cspFor([A]), buildHashes: [B], merge: false });
        expect(plan.hashes).toEqual([B]);
        expect(plan.stale).toEqual([]);
        expect(extractScriptHashes(plan.csp)).toEqual([B, GAPI]);
    });

    it('fletting gir gamle og nye hasher, og stale er de gamle', () => {
        const plan = planCspUpdate({ currentCsp: cspFor([A, C]), buildHashes: [B, C], merge: true });
        expect(plan.hashes).toEqual([A, B, C]);
        expect(plan.stale).toEqual([A]);
        expect(extractScriptHashes(plan.csp)).toEqual([A, B, C, GAPI]);
    });

    it('fletting der alle nye hasher allerede finnes gir null', () => {
        expect(planCspUpdate({ currentCsp: cspFor([A, B]), buildHashes: [B], merge: true })).toBeNull();
    });

    it.each([true, false])('tom build-liste gir FatalError (merge=%s)', (merge) => {
        expect(() => planCspUpdate({ currentCsp: cspFor([A]), buildHashes: [], merge })).toThrow(FatalError);
    });

    const mange = Array.from({ length: 40 }, (_, i) => `sha256-${String(i).padStart(43, 'x')}=`);

    it.each([true, false])('for lang CSP fra build alene gir FatalError med lengden (merge=%s)', (merge) => {
        const lengde = cspFor(mange).length;
        expect(lengde).toBeGreaterThan(MAX_CSP_LENGTH);
        expect(() => planCspUpdate({ currentCsp: '', buildHashes: mange, merge }))
            .toThrow(new RegExp(`${lengde} tegn.*${MAX_CSP_LENGTH}`));
    });

    it('fletting over grensen dropper gamle hasher i stedet for å kaste', () => {
        const plan = planCspUpdate({ currentCsp: cspFor(mange), buildHashes: [A], merge: true });
        expect(plan.droppedStale).toBe(true);
        expect(plan.hashes).toEqual([A]);
        expect(plan.stale).toHaveLength(40);
        expect(plan.csp.length).toBeLessThanOrEqual(MAX_CSP_LENGTH);
    });

    it('for lang build etter at gamle er droppet sier at de gamle er droppet', () => {
        expect(() => planCspUpdate({ currentCsp: cspFor([A]), buildHashes: mange, merge: true }))
            .toThrow(/40 hasher fra bygget \(1 gamle er allerede droppet\)/);
    });

    it('fletting under grensen beholder gamle hasher', () => {
        const plan = planCspUpdate({ currentCsp: cspFor([A]), buildHashes: [B], merge: true });
        expect(plan.droppedStale).toBe(false);
    });
});

describe('cspHasAllHashes', () => {
    it.each([
        ['alle finnes', cspFor([A, B]), [A, B], true],
        ['én mangler', cspFor([A]), [A, B], false],
        ['null-header', null, [A], false],
        ['tom header', '', [A], false],
        ['hash bare i annet direktiv', `default-src '${A}'; script-src 'self'`, [A], false],
    ])('%s → %s', (_navn, csp, hashes, forventet) => {
        expect(cspHasAllHashes(csp, hashes)).toBe(forventet);
    });
});

describe('waitForCsp', () => {
    const svar = (csp) => ({
        status: 200,
        headers: { get: (navn) => (navn === 'content-security-policy' ? csp : null) },
    });

    function kjør(fetchFn, { timeoutMs = 60_000 } = {}) {
        let klokke = 0;
        const sleep = vi.fn(async (ms) => { klokke += ms; });
        const promise = waitForCsp({
            fetchFn,
            url: 'https://example.test/',
            hashes: [A, B],
            intervalMs: 15_000,
            timeoutMs,
            requestTimeoutMs: 10_000,
            sleep,
            now: () => klokke,
        });
        return { promise, sleep };
    }

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('lykkes på første forsøk og sender HEAD med signal', async () => {
        const fetchFn = vi.fn().mockResolvedValue(svar(cspFor([A, B])));
        const { promise, sleep } = kjør(fetchFn);
        await expect(promise).resolves.toEqual({ ok: true });
        expect(sleep).not.toHaveBeenCalled();
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('https://example.test/');
        expect(init.method).toBe('HEAD');
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('lykkes etter to forsøk', async () => {
        const fetchFn = vi.fn()
            .mockResolvedValueOnce(svar(cspFor([A])))
            .mockResolvedValueOnce(svar(cspFor([A, B])));
        const { promise, sleep } = kjør(fetchFn);
        await expect(promise).resolves.toEqual({ ok: true });
        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledTimes(1);
    });

    it('gir timeout når nye hasher aldri kommer', async () => {
        const fetchFn = vi.fn().mockResolvedValue(svar(cspFor([A])));
        const { promise } = kjør(fetchFn, { timeoutMs: 60_000 });
        await expect(promise).resolves.toEqual({ ok: false, reason: 'timeout' });
        expect(fetchFn).toHaveBeenCalledTimes(5); // t = 0, 15, 30, 45, 60 s
    });

    it('gir missing-header når siste forsøk mangler CSP-headeren', async () => {
        const fetchFn = vi.fn().mockResolvedValue(svar(null));
        const { promise } = kjør(fetchFn, { timeoutMs: 20_000 });
        await expect(promise).resolves.toEqual({ ok: false, reason: 'missing-header' });
    });

    it('regner fetch-feil og avbrutt forespørsel som mislykkede forsøk uten å krasje', async () => {
        const avbrutt = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
        const fetchFn = vi.fn()
            .mockRejectedValueOnce(new Error('ECONNRESET'))
            .mockRejectedValueOnce(avbrutt)
            .mockResolvedValueOnce(svar(cspFor([A, B])));
        const { promise } = kjør(fetchFn);
        await expect(promise).resolves.toEqual({ ok: true });
        expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it('gir timeout (ikke missing-header) når siste forsøk var en fetch-feil', async () => {
        const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
        const { promise } = kjør(fetchFn, { timeoutMs: 20_000 });
        await expect(promise).resolves.toEqual({ ok: false, reason: 'timeout' });
    });
});

function makeExecError({ stderr = '', stdout = '', message = 'AWS error' } = {}) {
    return Object.assign(new Error(message), { stderr, stdout, status: 1 });
}

describe('fetchPolicy', () => {
    beforeEach(() => { vi.mocked(execFileSync).mockReset(); });

    it('returnerer etag og hele config', () => {
        const config = { Name: 'p', SecurityHeadersConfig: { ContentSecurityPolicy: { Override: true, ContentSecurityPolicy: cspFor([A]) } } };
        vi.mocked(execFileSync).mockReturnValue(JSON.stringify({ ETag: 'E1', ResponseHeadersPolicy: { ResponseHeadersPolicyConfig: config } }));
        expect(fetchPolicy('pid')).toEqual({ etag: 'E1', config });
        expect(vi.mocked(execFileSync).mock.calls[0][1]).toEqual(expect.arrayContaining(['get-response-headers-policy', '--id', 'pid']));
    });

    it('kaster FatalError når CSP mangler i policyen', () => {
        vi.mocked(execFileSync).mockReturnValue(JSON.stringify({ ETag: 'E1', ResponseHeadersPolicy: { ResponseHeadersPolicyConfig: { Name: 'p' } } }));
        expect(() => fetchPolicy('pid')).toThrow(/ContentSecurityPolicy finnes ikke/);
    });

    it.each([
        ['stderr', makeExecError({ stderr: 'AccessDenied' }), /AccessDenied/],
        ['uten output', makeExecError({ message: 'spawn aws ENOENT' }), /spawn aws ENOENT/],
    ])('kaster FatalError når aws feiler (%s)', (_navn, feil, melding) => {
        vi.mocked(execFileSync).mockImplementation(() => { throw feil; });
        expect(() => fetchPolicy('pid')).toThrow(FatalError);
        expect(() => fetchPolicy('pid')).toThrow(melding);
    });
});

describe('writePolicy', () => {
    beforeEach(() => { vi.mocked(execFileSync).mockReset(); });

    it('sender config via tempfil med if-match og rydder opp etterpå', () => {
        let configPath;
        let innhold;
        vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
            configPath = args[args.indexOf('--response-headers-policy-config') + 1].replace('file://', '');
            innhold = JSON.parse(readFileSync(configPath, 'utf-8'));
            return '{}';
        });
        writePolicy('pid', 'E1', { Name: 'p' });
        const args = vi.mocked(execFileSync).mock.calls[0][1];
        expect(args).toEqual(expect.arrayContaining(['update-response-headers-policy', '--id', 'pid', '--if-match', 'E1']));
        expect(innhold).toEqual({ Name: 'p' });
        expect(existsSync(configPath)).toBe(false);
    });

    it('kaster FatalError og rydder opp når aws feiler', () => {
        let configPath;
        vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
            configPath = args[args.indexOf('--response-headers-policy-config') + 1].replace('file://', '');
            throw makeExecError({ stdout: 'PreconditionFailed' });
        });
        expect(() => writePolicy('pid', 'E1', { Name: 'p' })).toThrow(/PreconditionFailed/);
        expect(existsSync(configPath)).toBe(false);
    });
});
