import hashData from '../generated/csp-hashes.json';

// Runtime-injisert av apis.google.com/js/api.js (GAPI relay-script). Kan ikke
// fanges av build-time hash-generatoren — må vedlikeholdes manuelt ved GAPI-oppdatering.
const GAPI_RUNTIME_HASHES = ["sha256-Ck+oGpSYXC+PJqw/YXnosEZnlS+j6SnLwb3GZZzgTr8="];

const allScriptHashes = [...hashData.scriptHashes, ...GAPI_RUNTIME_HASHES];

const scriptSrcDirective = hashData.scriptHashes.length > 0
    ? `script-src 'self' ${allScriptHashes.map(h => `'${h}'`).join(' ')} https://apis.google.com https://accounts.google.com`
    : `script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com`;

export const CSP = [
    "default-src 'self'",
    scriptSrcDirective,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com",
    // accounts.google.com: GSI sign-in button/One Tap UI — skjulte iframes
    // *.googleapis.com: GAPI cross-origin relay — testad med content.googleapis.com alene;
    //   content-sheets.googleapis.com ble blokkert → wildcard er nødvendig
    // drive.google.com: GAPI intern iframe ved Drive-operasjoner
    "frame-src https://drive.google.com https://accounts.google.com https://*.googleapis.com",
    "connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com",
].join('; ');

export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
    'Content-Security-Policy': CSP,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
});
