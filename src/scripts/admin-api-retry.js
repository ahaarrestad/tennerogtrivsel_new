// src/scripts/admin-api-retry.js

/**
 * Klassifiserer en Google API-feil.
 * @param {*} err - Feilobjekt fra gapi eller fetch
 * @returns {'auth'|'retryable'|'non-retryable'}
 */
export function classifyError(err) {
    const status = err?.status ?? err?.result?.error?.code ?? err?.code;

    if (status === 401 || status === 403) return 'auth';

    if (status === 429 || (typeof status === 'number' && status >= 500 && status <= 599)) {
        return 'retryable';
    }

    // Nettverksfeil har typisk ingen statuskode
    if (!status && err instanceof Error) return 'retryable';

    return 'non-retryable';
}

/**
 * Wrapper med eksponentiell backoff og automatisk token-refresh.
 *
 * @param {() => Promise<*>} apiCall - Funksjonen som utfører API-kallet
 * @param {object} [options]
 * @param {number} [options.maxRetries=3]
 * @param {() => Promise<boolean>} [options.refreshAuth] - Forsøker å fornye token
 * @returns {Promise<*>}
 */
export async function withRetry(apiCall, options = {}) {
    const { maxRetries = 3, refreshAuth } = options;
    let lastError;
    let authRefreshed = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (err) {
            lastError = err;
            const kind = classifyError(err);

            if (kind === 'non-retryable') throw err;

            if (kind === 'auth') {
                if (authRefreshed || !refreshAuth) throw err;
                const ok = await refreshAuth();
                if (!ok) throw err;
                authRefreshed = true;
                // Retry umiddelbart etter auth-refresh (teller ikke som vanlig retry)
                continue;
            }

            // retryable – vent med eksponentiell backoff + jitter
            if (attempt < maxRetries) {
                const base = Math.min(1000 * Math.pow(2, attempt), 30000);
                const jitter = Math.random() * base * 0.3;
                await delay(base + jitter);
            }
        }
    }
    throw lastError;
}

/**
 * Oppretter en refreshAuth-funksjon som promisifiserer silentLogin().
 *
 * @param {() => void} silentLoginFn - silentLogin-funksjonen fra admin-client
 * @param {number} [timeoutMs=10000]
 * @returns {() => Promise<boolean>}
 */
export function createAuthRefresher(silentLoginFn, timeoutMs = 10000) {
    let settled = false;

    return () => new Promise((resolve) => {
        settled = false;

        const onSuccess = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(true);
        };
        const onFail = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            window.removeEventListener('admin-auth-refreshed', onSuccess);
            window.removeEventListener('admin-auth-failed', onFail);
            clearTimeout(timer);
        };

        window.addEventListener('admin-auth-refreshed', onSuccess);
        window.addEventListener('admin-auth-failed', onFail);

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                cleanup();
                resolve(false);
            }
        }, timeoutMs);

        silentLoginFn();
    });
}

/** @param {number} ms */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
