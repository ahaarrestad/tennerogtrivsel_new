// Ser etter stille degradering på prod: siden svarer 200, men kartet eller innholdet er feil.
//
// Kjøres timevis fra uptime-check.yml. Hvert funn skrives som én linje på stdout og havner i
// `uptime`-issuen; notater (f.eks. «nøkkelsjekken ikke avgjort») går til stderr og jobbsammendraget.
// Scriptet krasjer ikke fordi prod er nede — en henting som feiler, blir et funn.
//
// Spec: docs/designs/archive/2026-10-15-stille-degradering.md
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const DEFAULT_SITE = 'https://www.tennerogtrivsel.no';
export const DEFAULT_CARTO_BASE = 'https://basemaps.cartocdn.com/rastertiles/voyager';
const RUNBOOK = 'docs/architecture/sikkerhet.md#cloudfront-tile-proxy-gdpr';

// Samme suffiks som mapInit.ts. CachingOptimized ignorerer query, så det påvirker ikke cachen.
const TILE_SUFFIX = '.png?v=2';
// Klinikken på z17 — zoomnivået kartet åpner på.
export const CLINIC_TILE = { z: 17, x: 67625, y: 38817 };
// z17-tiles over Stavanger/Sandnes (~8 700). Edge-cachen holder tiles i 180 dager (CARTOs
// max-age); med én tilfeldig tile i timen er tilen i praksis aldri cachet og kommer fra CARTO.
export const FRESH_TILE_AREA = { z: 17, xMin: 67567, xMax: 67647, yMin: 38787, yMax: 38893 };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shouldRetry(status) {
    return status >= 500 || status === 429;
}

/**
 * Henter en URL med timeout og nye forsøk ved nettverksfeil, 5xx og 429. Kaster aldri.
 * @returns {Promise<{ok: true, status: number, headers: Headers, body: Buffer} | {ok: false, error: string}>}
 */
export async function fetchWithRetry(url, {
    fetchImpl = fetch, sleep = defaultSleep, tries = 3, pauseMs = 2000, timeoutMs = 15000, init = {},
} = {}) {
    let error = '';
    for (let attempt = 1; attempt <= tries; attempt++) {
        if (attempt > 1) await sleep(pauseMs);
        try {
            const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
            const body = Buffer.from(await res.arrayBuffer());
            if (shouldRetry(res.status) && attempt < tries) {
                error = `HTTP ${res.status}`;
                continue;
            }
            return { ok: true, status: res.status, headers: res.headers, body };
        } catch (e) {
            error = e?.message || String(e);
        }
    }
    return { ok: false, error };
}

/** Leser PNG-signatur og bredde/høyde fra IHDR-chunken. */
export function pngInfo(buf) {
    if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
        return { isPng: false, width: 0, height: 0 };
    }
    return { isPng: true, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Kort verdier fra prod ned og fjern tegn som kan bli mentions, markdown/HTML eller ekstra funnlinjer i issuen. */
export function clean(value) {
    return String(value).replace(/[@`<>[\]\r\n]/g, '').slice(0, 80);
}

function tileUrl(base, { z, x, y }, suffix) {
    return `${base}/${z}/${x}/${y}${suffix}`;
}

function describeFailure(name, res) {
    return `${name} svarer ikke (${clean(res.error)})`;
}

/** T1: tilen er en ekte 256×256 PNG. */
export function checkTile(name, res) {
    if (!res.ok) return [describeFailure(name, res)];
    const funn = [];
    const type = res.headers.get('content-type') || '';
    if (res.status !== 200) funn.push(`${name} gir HTTP ${res.status}, forventet 200`);
    if (!type.startsWith('image/png')) funn.push(`${name} har content-type «${clean(type)}», forventet image/png`);
    const png = pngInfo(res.body);
    if (!png.isPng) {
        funn.push(`${name} er ikke en PNG`);
    } else if (png.width !== 256 || png.height !== 256) {
        funn.push(`${name} er ${png.width}×${png.height}, forventet 256×256`);
    }
    return funn;
}

/** Velger en tilfeldig tile i FRESH_TILE_AREA. `rng` gir [0, 1). */
export function pickFreshTile(rng = Math.random) {
    const { z, xMin, xMax, yMin, yMax } = FRESH_TILE_AREA;
    const pick = (min, max) => min + Math.floor(rng() * (max - min + 1));
    return { z, x: pick(xMin, xMax), y: pick(yMin, yMax) };
}

/**
 * T3 (CARTO-spesifikk — fjernes hvis tilene selvhostes): en fersk tile fra proxyen skal ikke være
 * lik det CARTO leverer uten nøkkel. Referansen hentes hver gang, så den følger CARTOs egne
 * endringer (nye kartdata, vannmerke eller rent erstatningsbilde).
 */
export function checkKeyWorks(tile, proxyRes, directRes) {
    const navn = `${tile.z}/${tile.x}/${tile.y}`;
    if (!proxyRes.ok || proxyRes.status !== 200) return {};
    const xCache = proxyRes.headers.get('x-cache') || '';
    if (/hit/i.test(xCache)) {
        return { ikkeAvgjort: `Nøkkelsjekken ikke avgjort: tile ${navn} var cachet (${clean(xCache)})` };
    }
    if (!directRes.ok || directRes.status !== 200) {
        const grunn = directRes.ok ? `HTTP ${directRes.status}` : clean(directRes.error);
        return { ikkeAvgjort: `Nøkkelsjekken ikke avgjort: CARTO direkte svarte ikke (${grunn})` };
    }
    if (proxyRes.body.equals(directRes.body)) {
        return {
            funn: `Kart-tile ${navn} via proxyen er identisk med CARTOs svar uten nøkkel — CARTO-nøkkelen virker ikke, besøkende ser vannmerke/erstatningsbilde. Se ${RUNBOOK}`,
        };
    }
    return { avgjort: `Nøkkelsjekken OK: tile ${navn} kom fra CARTO og skiller seg fra svaret uten nøkkel` };
}

/** Lenker til enkelt-tjenester (`/tjenester/<slug>/`), uten duplikater. */
export function extractTjenesteLinks(html) {
    const links = [...html.matchAll(/href="(\/tjenester\/[a-z0-9-]+\/)"/g)].map((m) => m[1]);
    return [...new Set(links)];
}

/** Innholdsbilder fra Astro (`/_astro/…`), uten logoen. */
export function extractContentImages(html) {
    const srcs = [];
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
        const src = tag.match(/\ssrc="(\/_astro\/[^"]+)"/)?.[1];
        if (src && !src.includes('tt-logo')) srcs.push(src);
    }
    return srcs;
}

function html(res) {
    return res.body.toString('utf8');
}

/** Henter en side og gir funn hvis den ikke svarer 200. */
function pageOk(name, res) {
    if (!res.ok) return [describeFailure(name, res)];
    if (res.status !== 200) return [`${name} gir HTTP ${res.status}, forventet 200`];
    return [];
}

/**
 * Kjører alle sjekkene mot prod.
 * @returns {Promise<{funn: string[], notater: string[]}>}
 */
export async function runChecks({
    site = DEFAULT_SITE, cartoBase = DEFAULT_CARTO_BASE, fetchImpl = fetch, sleep = defaultSleep, rng = Math.random,
} = {}) {
    const base = site.replace(/\/+$/, '');
    const get = (url) => fetchWithRetry(url, { fetchImpl, sleep });
    const funn = [];
    const notater = [];

    const freshTile = pickFreshTile(rng);
    const [forside, tannleger, galleri, prisliste, fastTile, ferskTile, direkteTile] = await Promise.all([
        get(`${base}/`),
        get(`${base}/tannleger/`),
        get(`${base}/galleri/`),
        get(`${base}/prisliste/`),
        get(tileUrl(`${base}/tiles`, CLINIC_TILE, TILE_SUFFIX)),
        get(tileUrl(`${base}/tiles`, freshTile, TILE_SUFFIX)),
        get(tileUrl(cartoBase, freshTile, '.png')),
    ]);

    // Kart
    funn.push(...checkTile(`Kart-tile ${CLINIC_TILE.z}/${CLINIC_TILE.x}/${CLINIC_TILE.y} (klinikken)`, fastTile));
    funn.push(...checkTile(`Kart-tile ${freshTile.z}/${freshTile.x}/${freshTile.y} (tilfeldig)`, ferskTile));
    const nokkel = checkKeyWorks(freshTile, ferskTile, direkteTile);
    if (nokkel.funn) funn.push(nokkel.funn);
    if (nokkel.ikkeAvgjort) notater.push(nokkel.ikkeAvgjort);
    if (nokkel.avgjort) notater.push(nokkel.avgjort);

    // C1 + C6: tjenester
    const forsideFeil = pageOk('Forsiden', forside);
    funn.push(...forsideFeil);
    if (forsideFeil.length === 0) {
        const tjenester = extractTjenesteLinks(html(forside));
        if (tjenester.length === 0) {
            funn.push('Forsiden viser ingen tjenester (ingen lenker til /tjenester/<navn>/)');
        } else {
            funn.push(...pageOk(`Tjenestesiden ${tjenester[0]}`, await get(`${base}${tjenester[0]}`)));
        }
    }

    // C2 + C4 + C5: tannleger
    const tannlegerFeil = pageOk('/tannleger/', tannleger);
    funn.push(...tannlegerFeil);
    if (tannlegerFeil.length === 0) {
        const side = html(tannleger);
        const bilder = extractContentImages(side);
        if (side.includes('Bilde mangler')) funn.push('/tannleger/ viser «Bilde mangler» — et tannlegebilde ble ikke lastet ned ved bygg');
        if (bilder.length === 0) {
            funn.push('/tannleger/ viser ingen tannlegebilder');
        } else {
            const bilde = await get(`${base}${bilder[0]}`);
            const type = bilde.ok ? bilde.headers.get('content-type') || '' : '';
            if (!bilde.ok) {
                funn.push(describeFailure(`Tannlegebildet ${clean(bilder[0])}`, bilde));
            } else if (bilde.status !== 200 || !type.startsWith('image/')) {
                funn.push(`Tannlegebildet ${clean(bilder[0])} gir HTTP ${bilde.status} (${clean(type)}), forventet 200 image/*`);
            }
        }
    }

    // C3: galleri
    const galleriFeil = pageOk('/galleri/', galleri);
    funn.push(...galleriFeil);
    if (galleriFeil.length === 0) {
        const side = html(galleri);
        if (extractContentImages(side).length === 0) funn.push('/galleri/ viser ingen bilder');
        else if (side.includes('Bilde mangler')) funn.push('/galleri/ viser «Bilde mangler» — et galleribilde ble ikke lastet ned ved bygg');
    }

    // C7: prisliste
    const prislisteFeil = pageOk('/prisliste/', prisliste);
    funn.push(...prislisteFeil);
    if (prislisteFeil.length === 0 && html(prisliste).includes('Prislisten er tom')) {
        funn.push('/prisliste/ viser «Prislisten er tom»');
    }

    return { funn, notater };
}

/** Funn til stdout (blir issue-linjer), notater til stderr og jobbsammendraget. */
export async function main({
    env = process.env, stdout = console.log, stderr = console.error, appendSummary = appendFileSync, checks = runChecks,
} = {}) {
    const { funn, notater } = await checks({
        site: env.SITE || DEFAULT_SITE,
        cartoBase: env.CARTO_BASE || DEFAULT_CARTO_BASE,
    });
    funn.forEach((linje) => stdout(linje));
    notater.forEach((linje) => stderr(linje));
    if (env.GITHUB_STEP_SUMMARY && notater.length > 0) {
        appendSummary(env.GITHUB_STEP_SUMMARY, notater.map((n) => `- ${n}\n`).join(''));
    }
    stderr(`Innholdssjekk: ${funn.length} funn, ${notater.length} notater.`);
}

/* v8 ignore start */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((e) => {
        console.error('check-prod-content krasjet:', e);
        process.exit(1);
    });
}
/* v8 ignore stop */
