import { describe, it, expect } from 'vitest';
import { handler } from '../cloudfront-trailing-slash.mjs';

function makeEvent(uri) {
    return { request: { uri } };
}

describe('cloudfront-trailing-slash', () => {
    describe('pass-through (ingen redirect, ingen reskriving)', () => {
        it('rotsti /', () => {
            expect(handler(makeEvent('/'))).toEqual({ uri: '/' });
        });

        it('fil med .js-utvidelse', () => {
            expect(handler(makeEvent('/_astro/bundle.abc123.js'))).toEqual({ uri: '/_astro/bundle.abc123.js' });
        });

        it('fil med .css-utvidelse', () => {
            expect(handler(makeEvent('/_astro/global.BMgG_RJ9.css'))).toEqual({ uri: '/_astro/global.BMgG_RJ9.css' });
        });

        it('fil med .webp-utvidelse', () => {
            expect(handler(makeEvent('/_astro/tt-logo-2026.webp'))).toEqual({ uri: '/_astro/tt-logo-2026.webp' });
        });

        it('fil med .woff2-utvidelse', () => {
            expect(handler(makeEvent('/fonts/montserrat.woff2'))).toEqual({ uri: '/fonts/montserrat.woff2' });
        });

        it('fil med .ico-utvidelse', () => {
            expect(handler(makeEvent('/favicon.ico'))).toEqual({ uri: '/favicon.ico' });
        });

        it('fil med .xml-utvidelse (sitemap-index)', () => {
            expect(handler(makeEvent('/sitemap-index.xml'))).toEqual({ uri: '/sitemap-index.xml' });
        });

        it('fil med .txt-utvidelse', () => {
            expect(handler(makeEvent('/robots.txt'))).toEqual({ uri: '/robots.txt' });
        });

        it('fil med .json-utvidelse', () => {
            expect(handler(makeEvent('/admin-manifest.json'))).toEqual({ uri: '/admin-manifest.json' });
        });

        it('fil med .png-utvidelse', () => {
            expect(handler(makeEvent('/android-chrome-192x192.png'))).toEqual({ uri: '/android-chrome-192x192.png' });
        });
    });

    describe('index.html-reskriving (avsluttende skråstrek → S3-fil)', () => {
        it('rotnivå-side med skråstrek', () => {
            const result = handler(makeEvent('/personvern/'));
            expect(result).toEqual({ uri: '/personvern/index.html' });
        });

        it('nestede side med skråstrek', () => {
            const result = handler(makeEvent('/tjenester/bleking/'));
            expect(result).toEqual({ uri: '/tjenester/bleking/index.html' });
        });

        it('tannleger med skråstrek', () => {
            const result = handler(makeEvent('/tannleger/'));
            expect(result).toEqual({ uri: '/tannleger/index.html' });
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
