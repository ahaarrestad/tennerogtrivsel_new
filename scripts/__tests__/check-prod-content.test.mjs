import { describe, it, expect, vi } from 'vitest';
import {
    fetchWithRetry, pngInfo, clean, checkTile, pickFreshTile, checkKeyWorks,
    extractTjenesteLinks, extractContentImages, runChecks, main,
    CLINIC_TILE, FRESH_TILE_AREA, DEFAULT_SITE, DEFAULT_CARTO_BASE,
} from '../check-prod-content.mjs';

const SITE = 'https://example.test';
const CARTO = 'https://carto.test/voyager';

function png(width = 256, height = 256, fill = 0) {
    const buf = Buffer.alloc(40, fill);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
    buf.writeUInt32BE(width, 16);
    buf.writeUInt32BE(height, 20);
    return buf;
}

function response(status = 200, body = '', headers = {}) {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    return {
        status,
        headers: new Headers(headers),
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length),
    };
}

function okResult(status = 200, body = '', headers = {}) {
    return { ok: true, status, headers: new Headers(headers), body: Buffer.from(body) };
}

const noSleep = async () => {};

// Utdrag av prod-markup (2026-10-15).
const LOGO = '<img src="/_astro/tt-logo-2026.CoibnNm__Z1nAfDc.webp" alt="Tenner og Trivsel">';
const FORSIDE = `<a href="/tjenester/">Alle</a><a href="/#tjenester">Meny</a>
<a href="/tjenester/rotbehandling/">Rot</a><a href="/tjenester/akuttbehandling/">Akutt</a>
<a href="/tjenester/rotbehandling/">Rot igjen</a>${LOGO}`;
const TANNLEGER = `${LOGO}<img src="/_astro/dyveke.BSMIrRxf_Z1JabjW.webp" alt="Dyveke Knudsen">`;
const GALLERI = `${LOGO}<img src="/_astro/IMG_7054.CUQDykxG_Z1lubmC.webp" srcset="/_astro/IMG_7054.a.webp 400w">
<img class="lightbox-img" data-lightbox-img alt="">`;
const PRISLISTE = '<table><tr><td>Undersøkelse</td></tr></table>';

const ROUTE_FRESH_TILE = /\/tiles\/17\/\d+\/\d+\.png\?v=2$/;

/** Ruter-stub for runChecks: alt friskt med mindre `overrides` sier noe annet. */
function makeFetch(overrides = {}) {
    const routes = {
        [`${SITE}/`]: () => response(200, FORSIDE),
        [`${SITE}/tannleger/`]: () => response(200, TANNLEGER),
        [`${SITE}/galleri/`]: () => response(200, GALLERI),
        [`${SITE}/prisliste/`]: () => response(200, PRISLISTE),
        [`${SITE}/tjenester/rotbehandling/`]: () => response(200, 'tjeneste'),
        [`${SITE}/_astro/dyveke.BSMIrRxf_Z1JabjW.webp`]: () => response(200, 'webp', { 'content-type': 'image/webp' }),
        clinicTile: () => response(200, png(256, 256, 1), { 'content-type': 'image/png', 'x-cache': 'Hit from cloudfront' }),
        freshTile: () => response(200, png(256, 256, 2), { 'content-type': 'image/png', 'x-cache': 'Miss from cloudfront' }),
        cartoTile: () => response(200, png(256, 256, 9), { 'content-type': 'image/png' }),
        ...overrides,
    };
    return vi.fn(async (url) => {
        const clinic = `${SITE}/tiles/${CLINIC_TILE.z}/${CLINIC_TILE.x}/${CLINIC_TILE.y}.png?v=2`;
        let key = url;
        if (url === clinic) key = 'clinicTile';
        else if (ROUTE_FRESH_TILE.test(url)) key = 'freshTile';
        else if (url.startsWith(CARTO)) key = 'cartoTile';
        const route = routes[key];
        if (!route) throw new Error(`uventet URL i test: ${url}`);
        return route();
    });
}

const run = (fetchImpl) => runChecks({ site: SITE, cartoBase: CARTO, fetchImpl, sleep: noSleep, rng: () => 0.5 });

describe('pngInfo', () => {
    it('leser bredde og høyde fra IHDR', () => {
        expect(pngInfo(png(256, 256))).toEqual({ isPng: true, width: 256, height: 256 });
        expect(pngInfo(png(512, 128))).toEqual({ isPng: true, width: 512, height: 128 });
    });

    it.each([
        ['ikke PNG', Buffer.alloc(40, 7)],
        ['for kort buffer', png().subarray(0, 20)],
    ])('%s gir isPng false', (_, buf) => {
        expect(pngInfo(buf).isPng).toBe(false);
    });
});

describe('clean', () => {
    it('fjerner @ og backticks og kutter til 80 tegn', () => {
        expect(clean('@admin `kode`')).toBe('admin kode');
        expect(clean('<b>[lenke](x)</b>\r\nny linje')).toBe('blenke(x)/bny linje');
        expect(clean('x'.repeat(200))).toHaveLength(80);
    });
});

describe('fetchWithRetry', () => {
    it('returnerer svaret ved første vellykkede forsøk og sender med timeout-signal', async () => {
        const fetchImpl = vi.fn(async () => response(200, 'ok'));
        const res = await fetchWithRetry('u', { fetchImpl, sleep: noSleep });
        expect(res).toMatchObject({ ok: true, status: 200 });
        expect(res.body.toString()).toBe('ok');
        expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it.each([503, 429])('prøver på nytt etter %i', async (status) => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(response(status))
            .mockResolvedValueOnce(response(200, 'ok'));
        const sleep = vi.fn(noSleep);
        const res = await fetchWithRetry('u', { fetchImpl, sleep });
        expect(res.status).toBe(200);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledWith(2000);
    });

    it('returnerer siste 5xx-svar når forsøkene er brukt opp', async () => {
        const fetchImpl = vi.fn(async () => response(502));
        const res = await fetchWithRetry('u', { fetchImpl, sleep: noSleep });
        expect(res).toMatchObject({ ok: true, status: 502 });
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('prøver ikke 404 på nytt', async () => {
        const fetchImpl = vi.fn(async () => response(404));
        const res = await fetchWithRetry('u', { fetchImpl, sleep: noSleep });
        expect(res.status).toBe(404);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('gir ok: false etter tre kast, uten å kaste selv', async () => {
        const fetchImpl = vi.fn(async () => { throw new Error('ECONNRESET'); });
        const res = await fetchWithRetry('u', { fetchImpl, sleep: noSleep });
        expect(res).toEqual({ ok: false, error: 'ECONNRESET' });
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('tåler kast av noe som ikke er en Error', async () => {
        const fetchImpl = vi.fn(async () => { throw 'rar feil'; });
        expect(await fetchWithRetry('u', { fetchImpl, sleep: noSleep, tries: 1 })).toEqual({ ok: false, error: 'rar feil' });
    });
});

describe('checkTile', () => {
    const tile = (status, type, body) => okResult(status, body, type ? { 'content-type': type } : {});

    it('godtar en 256×256 PNG', () => {
        expect(checkTile('T', tile(200, 'image/png', png()))).toEqual([]);
    });

    it.each([
        ['feil status', tile(403, 'image/png', png()), 'HTTP 403'],
        ['feil content-type', tile(200, 'text/html', png()), 'content-type «text/html»'],
        ['manglende content-type', tile(200, null, png()), 'content-type «»'],
        ['ikke PNG', tile(200, 'image/png', Buffer.alloc(40)), 'er ikke en PNG'],
        ['feil størrelse', tile(200, 'image/png', png(512, 512)), '512×512'],
    ])('%s gir funn', (_, res, forventet) => {
        const funn = checkTile('T', res);
        expect(funn).toHaveLength(1);
        expect(funn[0]).toContain(forventet);
    });

    it('henting som feilet gir funn', () => {
        expect(checkTile('T', { ok: false, error: 'timeout' })).toEqual(['T svarer ikke (timeout)']);
    });
});

describe('pickFreshTile', () => {
    it.each([
        [0, { x: FRESH_TILE_AREA.xMin, y: FRESH_TILE_AREA.yMin }],
        [0.999999, { x: FRESH_TILE_AREA.xMax, y: FRESH_TILE_AREA.yMax }],
    ])('rng %f gir hjørnet av utvalget', (r, forventet) => {
        expect(pickFreshTile(() => r)).toEqual({ z: 17, ...forventet });
    });

    it('bruker Math.random som standard og holder seg innenfor utvalget', () => {
        const { x, y } = pickFreshTile();
        expect(x).toBeGreaterThanOrEqual(FRESH_TILE_AREA.xMin);
        expect(x).toBeLessThanOrEqual(FRESH_TILE_AREA.xMax);
        expect(y).toBeGreaterThanOrEqual(FRESH_TILE_AREA.yMin);
        expect(y).toBeLessThanOrEqual(FRESH_TILE_AREA.yMax);
    });
});

describe('checkKeyWorks', () => {
    const tile = { z: 17, x: 1, y: 2 };
    const miss = (body) => okResult(200, body, { 'x-cache': 'Miss from cloudfront' });

    it('gir funn med runbook-lenke når proxyen leverer det samme som CARTO uten nøkkel', () => {
        const res = checkKeyWorks(tile, miss('placeholder'), okResult(200, 'placeholder'));
        expect(res.funn).toContain('CARTO-nøkkelen virker ikke');
        expect(res.funn).toContain('sikkerhet.md#cloudfront-tile-proxy-gdpr');
    });

    it('er avgjort OK når tilene er ulike', () => {
        const res = checkKeyWorks(tile, miss('ekte'), okResult(200, 'placeholder'));
        expect(res.funn).toBeUndefined();
        expect(res.avgjort).toContain('OK');
    });

    it('er ikke avgjort når proxy-tilen var cachet', () => {
        const res = checkKeyWorks(tile, okResult(200, 'x', { 'x-cache': 'Hit from cloudfront' }), okResult(200, 'x'));
        expect(res).toEqual({ ikkeAvgjort: expect.stringContaining('var cachet') });
    });

    it.each([
        ['feilet', { ok: false, error: 'ENOTFOUND' }, 'ENOTFOUND'],
        ['svarte 403', okResult(403, 'x'), 'HTTP 403'],
    ])('er ikke avgjort når CARTO direkte %s', (_, direct, grunn) => {
        const res = checkKeyWorks(tile, miss('x'), direct);
        expect(res.ikkeAvgjort).toContain(grunn);
    });

    it.each([
        ['feilet', { ok: false, error: 'x' }],
        ['ikke 200', okResult(500, 'x')],
    ])('overlater til T1 når proxy-tilen %s', (_, proxy) => {
        expect(checkKeyWorks(tile, proxy, okResult(200, 'x'))).toEqual({});
    });

    it('regner manglende x-cache som ikke cachet', () => {
        expect(checkKeyWorks(tile, okResult(200, 'p'), okResult(200, 'p')).funn).toBeDefined();
    });
});

describe('uttrekk fra HTML', () => {
    it('finner unike tjenestelenker, men ikke oversiktslenker', () => {
        expect(extractTjenesteLinks(FORSIDE)).toEqual(['/tjenester/rotbehandling/', '/tjenester/akuttbehandling/']);
        expect(extractTjenesteLinks('<a href="/tjenester/">Alle</a>')).toEqual([]);
    });

    it('finner innholdsbilder, men ikke logo, srcset eller img uten src', () => {
        expect(extractContentImages(GALLERI)).toEqual(['/_astro/IMG_7054.CUQDykxG_Z1lubmC.webp']);
        expect(extractContentImages(LOGO)).toEqual([]);
        expect(extractContentImages('<img srcset="/_astro/a.webp 400w">')).toEqual([]);
        expect(extractContentImages('')).toEqual([]);
    });
});

describe('runChecks', () => {
    it('gir ingen funn når alt er friskt, og notat om at nøkkelsjekken er OK', async () => {
        const { funn, notater } = await run(makeFetch());
        expect(funn).toEqual([]);
        expect(notater).toEqual([expect.stringContaining('Nøkkelsjekken OK')]);
    });

    it('fanger at proxyen leverer CARTOs erstatningsbilde (T3)', async () => {
        const placeholder = png(256, 256, 5);
        const { funn } = await run(makeFetch({
            freshTile: () => response(200, placeholder, { 'content-type': 'image/png', 'x-cache': 'Miss from cloudfront' }),
            cartoTile: () => response(200, placeholder, { 'content-type': 'image/png' }),
        }));
        expect(funn).toEqual([expect.stringContaining('CARTO-nøkkelen virker ikke')]);
    });

    it('gjør cachet fersk tile til notat, ikke funn', async () => {
        const { funn, notater } = await run(makeFetch({
            freshTile: () => response(200, png(256, 256, 2), { 'content-type': 'image/png', 'x-cache': 'Hit from cloudfront' }),
        }));
        expect(funn).toEqual([]);
        expect(notater[0]).toContain('ikke avgjort');
    });

    it('gjør CARTO direkte nede til notat, ikke funn', async () => {
        const { funn, notater } = await run(makeFetch({ cartoTile: () => { throw new Error('ENOTFOUND'); } }));
        expect(funn).toEqual([]);
        expect(notater[0]).toContain('ENOTFOUND');
    });

    it('krasjer ikke når prod er nede — alt blir funn', async () => {
        const fetchImpl = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
        const { funn } = await run(fetchImpl);
        expect(funn).toEqual(expect.arrayContaining([
            'Forsiden svarer ikke (ECONNREFUSED)',
            '/tannleger/ svarer ikke (ECONNREFUSED)',
            '/galleri/ svarer ikke (ECONNREFUSED)',
            '/prisliste/ svarer ikke (ECONNREFUSED)',
        ]));
        expect(funn.filter((f) => f.startsWith('Kart-tile'))).toHaveLength(2);
    });

    it.each([
        ['forsiden uten tjenester', { [`${SITE}/`]: () => response(200, LOGO) }, 'ingen tjenester'],
        ['forsiden 503', { [`${SITE}/`]: () => response(503) }, 'Forsiden gir HTTP 503'],
        ['tjenesteside 404', { [`${SITE}/tjenester/rotbehandling/`]: () => response(404) }, 'Tjenestesiden /tjenester/rotbehandling/ gir HTTP 404'],
        ['tom tannlegeside', { [`${SITE}/tannleger/`]: () => response(200, LOGO) }, 'ingen tannlegebilder'],
        ['tannleger 503', { [`${SITE}/tannleger/`]: () => response(503) }, '/tannleger/ gir HTTP 503'],
        ['tannlegebilde 404', { [`${SITE}/_astro/dyveke.BSMIrRxf_Z1JabjW.webp`]: () => response(404, 'nei', { 'content-type': 'text/html' }) }, 'gir HTTP 404 (text/html)'],
        ['tannlegebilde uten content-type', { [`${SITE}/_astro/dyveke.BSMIrRxf_Z1JabjW.webp`]: () => response(200, 'x') }, 'gir HTTP 200 ()'],
        ['tannlegebilde svarer ikke', { [`${SITE}/_astro/dyveke.BSMIrRxf_Z1JabjW.webp`]: () => { throw new Error('timeout'); } }, 'svarer ikke (timeout)'],
        ['tom galleriside', { [`${SITE}/galleri/`]: () => response(200, LOGO) }, '/galleri/ viser ingen bilder'],
        ['tom prisliste', { [`${SITE}/prisliste/`]: () => response(200, '<p>Prislisten er tom.</p>') }, 'Prislisten er tom'],
        ['klinikk-tile med feil content-type', { clinicTile: () => response(200, png(), { 'content-type': 'text/html' }) }, '(klinikken) har content-type'],
    ])('%s gir funn', async (_, overrides, forventet) => {
        const { funn } = await run(makeFetch(overrides));
        expect(funn).toEqual([expect.stringContaining(forventet)]);
    });

    it('fanger «Bilde mangler» selv om andre bilder finnes', async () => {
        const { funn } = await run(makeFetch({
            [`${SITE}/tannleger/`]: () => response(200, `${TANNLEGER}<div>Bilde mangler</div>`),
        }));
        expect(funn).toEqual([expect.stringContaining('Bilde mangler')]);
    });

    it('klinikk-tile som HTML-feilside gir funn for både type og innhold', async () => {
        const { funn } = await run(makeFetch({ clinicTile: () => response(200, '<html>', { 'content-type': 'text/html' }) }));
        expect(funn).toEqual([expect.stringContaining('content-type «text/html»'), expect.stringContaining('er ikke en PNG')]);
    });

    it('fanger «Bilde mangler» i galleriet selv om andre bilder finnes', async () => {
        const { funn } = await run(makeFetch({
            [`${SITE}/galleri/`]: () => response(200, `${GALLERI}<div>Bilde mangler</div>`),
        }));
        expect(funn).toEqual([expect.stringContaining('/galleri/ viser «Bilde mangler»')]);
    });

    it('tåler site med avsluttende skråstrek', async () => {
        const fetchImpl = makeFetch();
        const { funn } = await runChecks({ site: `${SITE}/`, cartoBase: CARTO, fetchImpl, sleep: noSleep, rng: () => 0.5 });
        expect(funn).toEqual([]);
        expect(fetchImpl).toHaveBeenCalledWith(`${SITE}/`, expect.anything());
    });
});

describe('main', () => {
    const io = () => ({ stdout: vi.fn(), stderr: vi.fn(), appendSummary: vi.fn() });

    it('skriver funn til stdout og notater til stderr og jobbsammendraget', async () => {
        const out = io();
        const checks = vi.fn(async () => ({ funn: ['funn 1', 'funn 2'], notater: ['notat'] }));
        await main({ env: { SITE: 's', CARTO_BASE: 'c', GITHUB_STEP_SUMMARY: '/sum' }, checks, ...out });
        expect(checks).toHaveBeenCalledWith({ site: 's', cartoBase: 'c' });
        expect(out.stdout.mock.calls).toEqual([['funn 1'], ['funn 2']]);
        expect(out.stderr).toHaveBeenCalledWith('notat');
        expect(out.stdout).not.toHaveBeenCalledWith('notat');
        expect(out.appendSummary).toHaveBeenCalledWith('/sum', '- notat\n');
    });

    it('bruker prod som standard og skriver ikke sammendrag uten GITHUB_STEP_SUMMARY', async () => {
        const out = io();
        const checks = vi.fn(async () => ({ funn: [], notater: ['notat'] }));
        await main({ env: {}, checks, ...out });
        expect(checks).toHaveBeenCalledWith({ site: DEFAULT_SITE, cartoBase: DEFAULT_CARTO_BASE });
        expect(out.stdout).not.toHaveBeenCalled();
        expect(out.appendSummary).not.toHaveBeenCalled();
    });
});
