import { defineMiddleware } from 'astro:middleware';
import { SECURITY_HEADERS } from './utils/security-headers';

const NOINDEX_PATHS = ['/admin', '/prisliste', '/api'];

export const onRequest = defineMiddleware((context, next) => {
    return next().then((response) => {
        for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
            response.headers.set(name, value);
        }
        if (NOINDEX_PATHS.some(p => context.url?.pathname?.startsWith(p))) {
            response.headers.set('X-Robots-Tag', 'noindex');
        }
        return response;
    });
});
