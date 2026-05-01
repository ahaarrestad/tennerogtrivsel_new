/**
 * Sannhetskilde for HTTP-sikkerhetsheadere.
 *
 * Brukes av:
 * - `src/middleware.ts` (Astro dev-server + SSR)
 * - CloudFront Response Headers Policy i prod (manuelt konfigurert via AWS Console)
 *
 * Verdiene må holdes synkronisert mellom de to. Se
 * `docs/architecture/sikkerhet.md` for AWS Console-prosedyre.
 */

export const CSP = [
    "default-src 'self'",
    // Scripts: eget domene + Google APIs + CDN-er brukt i admin-panel
    "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://cdn.jsdelivr.net https://unpkg.com",
    // Stiler: eget domene + CDN-er brukt i admin-panel
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
    // Fonter: eget domene + Font Awesome (cdnjs) + CDN-er brukt i admin-panel
    "font-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    // Bilder: eget domene + Google Drive-preview + data: URI + blob: (preview-bilder i admin)
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com",
    // Iframes: Google Drive + Google OAuth + GAPI iframe-kanaler (content-*.googleapis.com)
    "frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com",
    // API-kall: Google APIs + OAuth + telemetri fra Google-skript (gen_204)
    "connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com",
].join('; ');

export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
    'Content-Security-Policy': CSP,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // COOP: same-origin-allow-popups kreves fordi admin åpner Google OAuth-popup
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
});
