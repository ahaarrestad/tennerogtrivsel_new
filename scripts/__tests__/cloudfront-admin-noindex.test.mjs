import { describe, it, expect } from 'vitest';
import { handler } from '../cloudfront-admin-noindex.js';

function makeEvent(uri) {
    return {
        request: { uri },
        response: { headers: {} },
    };
}

describe('cloudfront-admin-noindex', () => {
    describe('setter X-Robots-Tag: noindex på /admin-paths', () => {
        it('/admin', () => {
            const result = handler(makeEvent('/admin'));
            expect(result.headers['x-robots-tag']).toEqual({ value: 'noindex' });
        });

        it('/admin/settings', () => {
            const result = handler(makeEvent('/admin/settings'));
            expect(result.headers['x-robots-tag']).toEqual({ value: 'noindex' });
        });

        it('/admin/bilder', () => {
            const result = handler(makeEvent('/admin/bilder'));
            expect(result.headers['x-robots-tag']).toEqual({ value: 'noindex' });
        });
    });

    describe('setter IKKE noindex på andre paths', () => {
        it('/', () => {
            const result = handler(makeEvent('/'));
            expect(result.headers['x-robots-tag']).toBeUndefined();
        });

        it('/tjenester', () => {
            const result = handler(makeEvent('/tjenester'));
            expect(result.headers['x-robots-tag']).toBeUndefined();
        });

        it('/prisliste', () => {
            const result = handler(makeEvent('/prisliste'));
            expect(result.headers['x-robots-tag']).toBeUndefined();
        });
    });
});
