import { describe, it, expect, vi } from 'vitest';

// Vi tester CSP-strengen uten å instansiere Astro middleware
// ved å importere modulen og inspisere headerne den setter.

// Mocked next-funksjon som returnerer en Response
function makeNext(status = 200) {
    return vi.fn(() =>
        Promise.resolve(new Response('<html></html>', {
            status,
            headers: { 'Content-Type': 'text/html' },
        }))
    );
}

// Lazy-import for å få fersk modul i hvert test
async function importMiddleware() {
    vi.resetModules();
    // Stub defineMiddleware slik at vi kan kalle handler direkte
    vi.doMock('astro:middleware', () => ({
        defineMiddleware: (fn: unknown) => fn,
    }));
    const mod = await import('../middleware');
    return mod.onRequest as (ctx: unknown, next: () => Promise<Response>) => Promise<Response>;
}

describe('src/middleware.ts – HTTP security headers', () => {
    it('setter Content-Security-Policy på alle responser', async () => {
        const handler = await importMiddleware();
        const next = makeNext();
        const response = await handler({}, next);

        const csp = response.headers.get('Content-Security-Policy');
        expect(csp).not.toBeNull();
        expect(csp).toContain("default-src 'self'");
    });

    it('CSP inneholder nødvendige domener for auth', async () => {
        const handler = await importMiddleware();
        const response = await handler({}, makeNext());
        const csp = response.headers.get('Content-Security-Policy')!;

        // Google OAuth og GIS
        expect(csp).toContain('https://accounts.google.com');
        // GAPI scripts
        expect(csp).toContain('https://apis.google.com');
        // Google Drive (admin)
        expect(csp).toContain('https://drive.google.com');
        // GAPI iframe-kanaler (content-*.googleapis.com – wildcard dekker alle subdomener)
        expect(csp).toContain('https://*.googleapis.com');
    });

    it('CSP inneholder IKKE fjernede tredjepartsdomener (GDPR)', async () => {
        const handler = await importMiddleware();
        const response = await handler({}, makeNext());
        const csp = response.headers.get('Content-Security-Policy')!;

        // OSM tiles proxyes via CloudFront — skal ikke være i CSP
        expect(csp).not.toContain('tile.openstreetmap.org');
        // Fonter er self-hosted — Google Fonts skal ikke være i CSP
        expect(csp).not.toContain('fonts.googleapis.com');
        expect(csp).not.toContain('fonts.gstatic.com');
    });

    it('CSP inneholder CDN-er brukt i admin-panel', async () => {
        const handler = await importMiddleware();
        const response = await handler({}, makeNext());
        const csp = response.headers.get('Content-Security-Policy')!;

        expect(csp).toContain('https://cdn.jsdelivr.net');   // Flatpickr
        expect(csp).toContain('https://unpkg.com');           // EasyMDE
        expect(csp).toContain('https://cdnjs.cloudflare.com'); // Font Awesome
    });

    it('CSP tillater blob: i img-src (preview-bilder i admin)', async () => {
        const handler = await importMiddleware();
        const response = await handler({}, makeNext());
        const csp = response.headers.get('Content-Security-Policy')!;

        expect(csp).toContain('blob:');
    });

    it('setter X-Frame-Options til DENY', async () => {
        const handler = await importMiddleware();
        const response = await handler({}, makeNext());
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('setter X-Content-Type-Options til nosniff', async () => {
        const handler = await importMiddleware();
        const response = await handler({}, makeNext());
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('setter Referrer-Policy', async () => {
        const handler = await importMiddleware();
        const response = await handler({}, makeNext());
        expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('setter Strict-Transport-Security', async () => {
        const handler = await importMiddleware();
        const response = await handler({}, makeNext());
        expect(response.headers.get('Strict-Transport-Security'))
            .toBe('max-age=63072000; includeSubDomains; preload');
    });

    it('setter Permissions-Policy som låser kamera/mikrofon/geo', async () => {
        const handler = await importMiddleware();
        const response = await handler({}, makeNext());
        const policy = response.headers.get('Permissions-Policy')!;
        expect(policy).toContain('camera=()');
        expect(policy).toContain('microphone=()');
        expect(policy).toContain('geolocation=()');
        expect(policy).toContain('interest-cohort=()');
    });

    it('setter COOP til same-origin-allow-popups (Google OAuth-popup)', async () => {
        const handler = await importMiddleware();
        const response = await handler({}, makeNext());
        expect(response.headers.get('Cross-Origin-Opener-Policy'))
            .toBe('same-origin-allow-popups');
    });

    it('setter Cross-Origin-Resource-Policy til same-origin', async () => {
        const handler = await importMiddleware();
        const response = await handler({}, makeNext());
        expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    });

    it('videresender responsen fra next uendret bortsett fra headers', async () => {
        const handler = await importMiddleware();
        const next = makeNext(404);
        const response = await handler({}, next);

        expect(next).toHaveBeenCalledOnce();
        expect(response.status).toBe(404);
    });
});
