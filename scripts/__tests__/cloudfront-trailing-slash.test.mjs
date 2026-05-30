import { describe, it, expect } from 'vitest';
import { handler } from '../cloudfront-trailing-slash.mjs';

function makeEvent(uri, host = 'www.tennerogtrivsel.no', querystring = {}) {
    return { request: { uri, headers: { host: { value: host } }, querystring } };
}

describe('www-redirect: query-string bevares', () => {
    it('enkelt UTM-parameter bevares', () => {
        const event = makeEvent('/tjenester/', 'tennerogtrivsel.no', { utm_source: { value: 'google' } });
        const response = handler(event);
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/tjenester/?utm_source=google');
    });

    it('flere parametere bevares', () => {
        const event = makeEvent('/tjenester/', 'tennerogtrivsel.no', {
            utm_source: { value: 'google' },
            utm_medium: { value: 'cpc' },
        });
        const response = handler(event);
        expect(response.statusCode).toBe(301);
        const url = response.headers.location.value;
        expect(url).toContain('utm_source=google');
        expect(url).toContain('utm_medium=cpc');
        expect(url.startsWith('https://www.tennerogtrivsel.no/tjenester/?')).toBe(true);
    });

    it('multi-verdi parameter bevares', () => {
        const event = makeEvent('/tjenester/', 'tennerogtrivsel.no', {
            tag: { multiValue: [{ value: 'a' }, { value: 'b' }] },
        });
        const response = handler(event);
        expect(response.headers.location.value).toContain('tag=a');
        expect(response.headers.location.value).toContain('tag=b');
    });

    it('ingen query-string gir ingen ?-suffiks', () => {
        const event = makeEvent('/tjenester/', 'tennerogtrivsel.no', {});
        const response = handler(event);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/tjenester/');
    });
});

describe('www-redirect: én redirect når host-fix og trailing-slash trengs', () => {
    it('path uten trailing-slash får slash lagt til i én redirect', () => {
        const event = makeEvent('/tjenester', 'tennerogtrivsel.no');
        const response = handler(event);
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/tjenester/');
    });

    it('path med fil-utvidelse får ikke slash lagt til', () => {
        const event = makeEvent('/logo.png', 'tennerogtrivsel.no');
        const response = handler(event);
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/logo.png');
    });

    it('rotstien / får ikke ekstra slash', () => {
        const event = makeEvent('/', 'tennerogtrivsel.no');
        const response = handler(event);
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/');
    });

    it('path med trailing-slash beholder slash', () => {
        const event = makeEvent('/tjenester/', 'tennerogtrivsel.no');
        const response = handler(event);
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/tjenester/');
    });

    it('kombinert: host-fix + trailing-slash + query-string i én redirect', () => {
        const event = makeEvent('/tjenester', 'tennerogtrivsel.no', { utm_source: { value: 'fb' } });
        const response = handler(event);
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/tjenester/?utm_source=fb');
    });
});

describe('www-redirect (non-kanonisk domene → www.tennerogtrivsel.no)', () => {
    it('tennerogtrivsel.no redirecter til www', () => {
        const result = makeEvent('/tjenester/bleking/', 'tennerogtrivsel.no');
        const response = handler(result);
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/tjenester/bleking/');
    });

    it('tennerogtrivsel.net redirecter til www.tennerogtrivsel.no', () => {
        const result = makeEvent('/tjenester/bleking/', 'tennerogtrivsel.net');
        const response = handler(result);
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/tjenester/bleking/');
    });

    it('tennerogtrivsel.com redirecter til www.tennerogtrivsel.no', () => {
        const result = makeEvent('/', 'tennerogtrivsel.com');
        const response = handler(result);
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/');
    });

    it('www.tennerogtrivsel.net redirecter til www.tennerogtrivsel.no', () => {
        const result = makeEvent('/tjenester/', 'www.tennerogtrivsel.net');
        const response = handler(result);
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/tjenester/');
    });

    it('www.tennerogtrivsel.com redirecter til www.tennerogtrivsel.no', () => {
        const result = makeEvent('/kontakt/', 'www.tennerogtrivsel.com');
        const response = handler(result);
        expect(response.statusCode).toBe(301);
        expect(response.headers.location.value).toBe('https://www.tennerogtrivsel.no/kontakt/');
    });

    it('www.tennerogtrivsel.no passerer gjennom (ingen redirect)', () => {
        const result = makeEvent('/tjenester/bleking/', 'www.tennerogtrivsel.no');
        const response = handler(result);
        expect(response.statusCode).toBeUndefined();
    });

    it('statusDescription er Moved Permanently', () => {
        const result = makeEvent('/tjenester/', 'tennerogtrivsel.no');
        const response = handler(result);
        expect(response.statusDescription).toBe('Moved Permanently');
    });
});

describe('cloudfront-trailing-slash', () => {
    describe('pass-through (ingen redirect, ingen reskriving)', () => {
        it('rotsti /', () => {
            expect(handler(makeEvent('/'))).toMatchObject({ uri: '/' });
        });

        it('fil med .js-utvidelse', () => {
            expect(handler(makeEvent('/_astro/bundle.abc123.js'))).toMatchObject({ uri: '/_astro/bundle.abc123.js' });
        });

        it('fil med .css-utvidelse', () => {
            expect(handler(makeEvent('/_astro/global.BMgG_RJ9.css'))).toMatchObject({ uri: '/_astro/global.BMgG_RJ9.css' });
        });

        it('fil med .webp-utvidelse', () => {
            expect(handler(makeEvent('/_astro/tt-logo-2026.webp'))).toMatchObject({ uri: '/_astro/tt-logo-2026.webp' });
        });

        it('fil med .woff2-utvidelse', () => {
            expect(handler(makeEvent('/fonts/montserrat.woff2'))).toMatchObject({ uri: '/fonts/montserrat.woff2' });
        });

        it('fil med .ico-utvidelse', () => {
            expect(handler(makeEvent('/favicon.ico'))).toMatchObject({ uri: '/favicon.ico' });
        });

        it('fil med .xml-utvidelse (sitemap-index)', () => {
            expect(handler(makeEvent('/sitemap-index.xml'))).toMatchObject({ uri: '/sitemap-index.xml' });
        });

        it('fil med .txt-utvidelse', () => {
            expect(handler(makeEvent('/robots.txt'))).toMatchObject({ uri: '/robots.txt' });
        });

        it('fil med .json-utvidelse', () => {
            expect(handler(makeEvent('/admin-manifest.json'))).toMatchObject({ uri: '/admin-manifest.json' });
        });

        it('fil med .png-utvidelse', () => {
            expect(handler(makeEvent('/android-chrome-192x192.png'))).toMatchObject({ uri: '/android-chrome-192x192.png' });
        });
    });

    describe('index.html-reskriving (avsluttende skråstrek → S3-fil)', () => {
        it('rotnivå-side med skråstrek', () => {
            const result = handler(makeEvent('/personvern/'));
            expect(result).toMatchObject({ uri: '/personvern/index.html' });
        });

        it('nestede side med skråstrek', () => {
            const result = handler(makeEvent('/tjenester/bleking/'));
            expect(result).toMatchObject({ uri: '/tjenester/bleking/index.html' });
        });

        it('tannleger med skråstrek', () => {
            const result = handler(makeEvent('/tannleger/'));
            expect(result).toMatchObject({ uri: '/tannleger/index.html' });
        });
    });

    describe('legacy ?page=-redirects (gammel jQuery SPA)', () => {
        it('?page=kontakt → /kontakt/', () => {
            const event = makeEvent('/', 'www.tennerogtrivsel.no', { page: { value: 'kontakt' } });
            const response = handler(event);
            expect(response.statusCode).toBe(301);
            expect(response.headers.location.value).toBe('/kontakt/');
        });

        it('?page=behandlingstilbud → /tjenester/', () => {
            const event = makeEvent('/', 'www.tennerogtrivsel.no', { page: { value: 'behandlingstilbud' } });
            const response = handler(event);
            expect(response.statusCode).toBe(301);
            expect(response.headers.location.value).toBe('/tjenester/');
        });

        it('?page=trygdeordninger → /tjenester/', () => {
            const event = makeEvent('/', 'www.tennerogtrivsel.no', { page: { value: 'trygdeordninger' } });
            const response = handler(event);
            expect(response.statusCode).toBe(301);
            expect(response.headers.location.value).toBe('/tjenester/');
        });

        it('?page=omoss → /tannleger/', () => {
            const event = makeEvent('/', 'www.tennerogtrivsel.no', { page: { value: 'omoss' } });
            const response = handler(event);
            expect(response.statusCode).toBe(301);
            expect(response.headers.location.value).toBe('/tannleger/');
        });

        it('path er irrelevant — /www/index.html?page=kontakt → /kontakt/', () => {
            const event = makeEvent('/www/index.html', 'www.tennerogtrivsel.no', { page: { value: 'kontakt' } });
            const response = handler(event);
            expect(response.statusCode).toBe(301);
            expect(response.headers.location.value).toBe('/kontakt/');
        });

        it('ukjent ?page=-verdi sendes gjennom (ingen redirect)', () => {
            const event = makeEvent('/', 'www.tennerogtrivsel.no', { page: { value: 'ukjent' } });
            expect(handler(event)).not.toHaveProperty('statusCode');
        });

        it('multi-value ?page= sendes gjennom (ingen redirect)', () => {
            const event = makeEvent('/', 'www.tennerogtrivsel.no',
                { page: { multiValue: [{ value: 'kontakt' }, { value: 'omoss' }] } });
            expect(handler(event)).not.toHaveProperty('statusCode');
        });

        it('statusCode er 301 og statusDescription er Moved Permanently', () => {
            const event = makeEvent('/', 'www.tennerogtrivsel.no', { page: { value: 'omoss' } });
            const response = handler(event);
            expect(response.statusCode).toBe(301);
            expect(response.statusDescription).toBe('Moved Permanently');
        });
    });

    describe('prioritet: ikke-www-host med ?page= → www-redirect vinner', () => {
        it('ikke-www-host med ?page= gir www-redirect, ikke page-redirect', () => {
            const event = makeEvent('/www/index.html', 'tennerogtrivsel.no', { page: { value: 'kontakt' } });
            const response = handler(event);
            expect(response.statusCode).toBe(301);
            expect(response.headers.location.value).toBe(
                'https://www.tennerogtrivsel.no/www/index.html?page=kontakt'
            );
        });
    });

    describe('legacy path-redirects (uten ?page=)', () => {
        it('/index.html → /', () => {
            const event = makeEvent('/index.html', 'www.tennerogtrivsel.no');
            const response = handler(event);
            expect(response.statusCode).toBe(301);
            expect(response.headers.location.value).toBe('/');
        });

        it('/www/index.html → /', () => {
            const event = makeEvent('/www/index.html', 'www.tennerogtrivsel.no');
            const response = handler(event);
            expect(response.statusCode).toBe(301);
            expect(response.headers.location.value).toBe('/');
        });
    });

    describe('sitemap.xml-redirect', () => {
        it('redirecter /sitemap.xml til /sitemap-index.xml', () => {
            const result = handler(makeEvent('/sitemap.xml'));
            expect(result.statusCode).toBe(301);
            expect(result.headers.location.value).toBe('/sitemap-index.xml');
        });
    });

    describe('301-redirect (legg til skråstrek)', () => {
        it('tjenesteside uten skråstrek', () => {
            const result = handler(makeEvent('/tjenester/bleking'));
            expect(result.statusCode).toBe(301);
            expect(result.headers.location.value).toBe('/tjenester/bleking/');
        });

        it('tjenesteside med bindestrek uten skråstrek', () => {
            const result = handler(makeEvent('/tjenester/tanngnissing-bruxisme'));
            expect(result.statusCode).toBe(301);
            expect(result.headers.location.value).toBe('/tjenester/tanngnissing-bruxisme/');
        });

        it('rotnivå-side uten skråstrek', () => {
            const result = handler(makeEvent('/personvern'));
            expect(result.statusCode).toBe(301);
            expect(result.headers.location.value).toBe('/personvern/');
        });

        it('tjenester-indeks uten skråstrek', () => {
            const result = handler(makeEvent('/tjenester'));
            expect(result.statusCode).toBe(301);
            expect(result.headers.location.value).toBe('/tjenester/');
        });

        it('tannkjottsykdom uten skråstrek', () => {
            const result = handler(makeEvent('/tjenester/tannkjottsykdom'));
            expect(result.statusCode).toBe(301);
            expect(result.headers.location.value).toBe('/tjenester/tannkjottsykdom/');
        });

        it('statusDescription er Moved Permanently', () => {
            const result = handler(makeEvent('/kontakt'));
            expect(result.statusDescription).toBe('Moved Permanently');
        });
    });
});
