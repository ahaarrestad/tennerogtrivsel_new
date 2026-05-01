import { defineMiddleware } from 'astro:middleware';
import { SECURITY_HEADERS } from './utils/security-headers';

export const onRequest = defineMiddleware((_context, next) => {
    return next().then((response) => {
        for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
            response.headers.set(name, value);
        }
        return response;
    });
});
