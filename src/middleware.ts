import { defineMiddleware } from 'astro:middleware';

const CSP = [
    "default-src 'self'",
    // Scripts: eget domene + Google APIs + CDN-er brukt i admin-panel
    "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://cdn.jsdelivr.net https://unpkg.com",
    // Stiler: eget domene + Google Fonts + CDN-er brukt i admin-panel
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
    // Fonter: eget domene + Google Fonts + Font Awesome (cdnjs)
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    // Bilder: eget domene + Google Drive-preview + Google Maps + data: URI + blob: (preview-bilder i admin)
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com https://maps.gstatic.com",
    // Iframes: Google Drive + Google OAuth + Google Maps embed + GAPI iframe-kanaler (content-*.googleapis.com)
    "frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com",
    // API-kall: Google APIs + OAuth + telemetri fra Google-skript (gen_204)
    "connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com",
].join('; ');

export const onRequest = defineMiddleware((_context, next) => {
    return next().then((response) => {
        const headers = response.headers;
        headers.set('Content-Security-Policy', CSP);
        headers.set('X-Frame-Options', 'DENY');
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        return response;
    });
});
