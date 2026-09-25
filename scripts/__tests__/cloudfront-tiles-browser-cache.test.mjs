import { describe, it, expect } from 'vitest';
import { handler } from '../cloudfront-tiles-browser-cache.js';

const CARTO_CACHE_CONTROL = { value: 'public,max-age=15552000' };
const BROWSER_CACHE_CONTROL = { value: 'public, max-age=86400' };

function makeEvent(statusCode, headers = {}) {
    return {
        request: { uri: '/rastertiles/voyager/17/67625/38817.png' },
        response: { statusCode, headers: { ...headers } },
    };
}

describe('cloudfront-tiles-browser-cache', () => {
    describe('overstyrer Cache-Control mot nettleseren på vellykkede svar', () => {
        it.each([200, 304])('%i med CARTOs 180-dagers max-age', (status) => {
            const result = handler(makeEvent(status, { 'cache-control': CARTO_CACHE_CONTROL }));
            expect(result.headers['cache-control']).toEqual(BROWSER_CACHE_CONTROL);
        });

        it.each([200, 304])('%i uten Cache-Control fra origin', (status) => {
            const result = handler(makeEvent(status));
            expect(result.headers['cache-control']).toEqual(BROWSER_CACHE_CONTROL);
        });
    });

    describe('lar feilsvar være urørt', () => {
        it.each([400, 403, 404, 500, 502])('%i beholder eksisterende Cache-Control', (status) => {
            const result = handler(makeEvent(status, { 'cache-control': { value: 'no-cache' } }));
            expect(result.headers['cache-control']).toEqual({ value: 'no-cache' });
        });

        it.each([400, 403, 404, 500, 502])('%i uten Cache-Control får ingen', (status) => {
            const result = handler(makeEvent(status));
            expect(result.headers['cache-control']).toBeUndefined();
        });
    });

    describe('lar andre ikke-feil-statuser være urørt', () => {
        it.each([206, 301, 302])('%i beholder eksisterende Cache-Control', (status) => {
            const result = handler(makeEvent(status, { 'cache-control': CARTO_CACHE_CONTROL }));
            expect(result.headers['cache-control']).toEqual(CARTO_CACHE_CONTROL);
        });
    });

    it('bevarer øvrige headere', () => {
        const headers = {
            'cache-control': CARTO_CACHE_CONTROL,
            etag: { value: 'W/"2b92-abc"' },
            'content-type': { value: 'image/png' },
        };
        const result = handler(makeEvent(200, headers));
        expect(result.headers.etag).toEqual(headers.etag);
        expect(result.headers['content-type']).toEqual(headers['content-type']);
    });
});
