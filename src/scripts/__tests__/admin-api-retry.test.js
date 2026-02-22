/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyError, withRetry, createAuthRefresher } from '../admin-api-retry.js';

describe('admin-api-retry.js', () => {

    describe('classifyError', () => {
        it('skal returnere auth for status 401', () => {
            expect(classifyError({ status: 401 })).toBe('auth');
        });

        it('skal returnere auth for status 403', () => {
            expect(classifyError({ status: 403 })).toBe('auth');
        });

        it('skal returnere auth for result.error.code 401', () => {
            expect(classifyError({ result: { error: { code: 401 } } })).toBe('auth');
        });

        it('skal returnere auth for result.error.code 403', () => {
            expect(classifyError({ result: { error: { code: 403 } } })).toBe('auth');
        });

        it('skal returnere retryable for status 429', () => {
            expect(classifyError({ status: 429 })).toBe('retryable');
        });

        it('skal returnere retryable for status 500', () => {
            expect(classifyError({ status: 500 })).toBe('retryable');
        });

        it('skal returnere retryable for status 502', () => {
            expect(classifyError({ status: 502 })).toBe('retryable');
        });

        it('skal returnere retryable for status 503', () => {
            expect(classifyError({ status: 503 })).toBe('retryable');
        });

        it('skal returnere retryable for status 599', () => {
            expect(classifyError({ status: 599 })).toBe('retryable');
        });

        it('skal returnere retryable for nettverksfeil (Error uten status)', () => {
            expect(classifyError(new Error('network failure'))).toBe('retryable');
        });

        it('skal returnere non-retryable for status 400', () => {
            expect(classifyError({ status: 400 })).toBe('non-retryable');
        });

        it('skal returnere non-retryable for status 404', () => {
            expect(classifyError({ status: 404 })).toBe('non-retryable');
        });

        it('skal returnere non-retryable for null/undefined', () => {
            expect(classifyError(null)).toBe('non-retryable');
            expect(classifyError(undefined)).toBe('non-retryable');
        });

        it('skal returnere non-retryable for objekt uten status eller code', () => {
            expect(classifyError({ message: 'noe gikk galt' })).toBe('non-retryable');
        });

        it('skal prioritere status over result.error.code', () => {
            expect(classifyError({ status: 401, result: { error: { code: 500 } } })).toBe('auth');
        });

        it('skal bruke err.code som fallback', () => {
            expect(classifyError({ code: 429 })).toBe('retryable');
        });
    });

    describe('withRetry', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('skal returnere resultat ved suksess på første forsøk', async () => {
            const apiCall = vi.fn().mockResolvedValue('data');
            const result = await withRetry(apiCall);
            expect(result).toBe('data');
            expect(apiCall).toHaveBeenCalledTimes(1);
        });

        it('skal kaste umiddelbart ved non-retryable feil', async () => {
            const apiCall = vi.fn().mockRejectedValue({ status: 404 });
            await expect(withRetry(apiCall)).rejects.toEqual({ status: 404 });
            expect(apiCall).toHaveBeenCalledTimes(1);
        });

        it('skal retry ved retryable feil og lykkes', async () => {
            const apiCall = vi.fn()
                .mockRejectedValueOnce(new Error('network'))
                .mockResolvedValue('ok');

            const promise = withRetry(apiCall, { maxRetries: 3 });
            // Vent på at timeren fyrer (backoff)
            await vi.advanceTimersByTimeAsync(5000);
            const result = await promise;
            expect(result).toBe('ok');
            expect(apiCall).toHaveBeenCalledTimes(2);
        });

        it('skal kaste etter maks antall retries', async () => {
            const err = new Error('persistent failure');
            const apiCall = vi.fn().mockRejectedValue(err);

            const promise = withRetry(apiCall, { maxRetries: 2 }).catch(e => e);
            // Avancer nok tid for alle retries
            await vi.advanceTimersByTimeAsync(60000);
            const result = await promise;
            expect(result).toBe(err);
            expect(apiCall).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
        });

        it('skal forsøke auth-refresh ved 401 og retry ved suksess', async () => {
            const apiCall = vi.fn()
                .mockRejectedValueOnce({ status: 401 })
                .mockResolvedValue('refreshed-data');
            const refreshAuth = vi.fn().mockResolvedValue(true);

            const result = await withRetry(apiCall, { refreshAuth });
            expect(result).toBe('refreshed-data');
            expect(refreshAuth).toHaveBeenCalledTimes(1);
            expect(apiCall).toHaveBeenCalledTimes(2);
        });

        it('skal kaste ved 401 når auth-refresh feiler', async () => {
            const apiCall = vi.fn().mockRejectedValue({ status: 401 });
            const refreshAuth = vi.fn().mockResolvedValue(false);

            await expect(withRetry(apiCall, { refreshAuth })).rejects.toEqual({ status: 401 });
            expect(refreshAuth).toHaveBeenCalledTimes(1);
            expect(apiCall).toHaveBeenCalledTimes(1);
        });

        it('skal kaste ved 403 uten refreshAuth', async () => {
            const apiCall = vi.fn().mockRejectedValue({ status: 403 });

            await expect(withRetry(apiCall)).rejects.toEqual({ status: 403 });
            expect(apiCall).toHaveBeenCalledTimes(1);
        });

        it('skal kun forsøke auth-refresh én gang', async () => {
            const apiCall = vi.fn().mockRejectedValue({ status: 401 });
            const refreshAuth = vi.fn().mockResolvedValue(true);

            await expect(withRetry(apiCall, { refreshAuth, maxRetries: 3 })).rejects.toEqual({ status: 401 });
            expect(refreshAuth).toHaveBeenCalledTimes(1);
            // Initial + 1 retry etter refresh = 2 kall
            expect(apiCall).toHaveBeenCalledTimes(2);
        });

        it('skal respektere custom maxRetries', async () => {
            const err = new Error('fail');
            const apiCall = vi.fn().mockRejectedValue(err);

            const promise = withRetry(apiCall, { maxRetries: 1 }).catch(e => e);
            await vi.advanceTimersByTimeAsync(60000);
            const result = await promise;
            expect(result).toBe(err);
            expect(apiCall).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
        });

        it('skal bruke eksponentiell backoff mellom retries', async () => {
            const apiCall = vi.fn()
                .mockRejectedValueOnce(new Error('fail1'))
                .mockRejectedValueOnce(new Error('fail2'))
                .mockResolvedValue('ok');

            const promise = withRetry(apiCall, { maxRetries: 3 });

            // Første retry: ~1s base + jitter
            await vi.advanceTimersByTimeAsync(2000);
            expect(apiCall).toHaveBeenCalledTimes(2);

            // Andre retry: ~2s base + jitter
            await vi.advanceTimersByTimeAsync(3000);
            const result = await promise;
            expect(result).toBe('ok');
            expect(apiCall).toHaveBeenCalledTimes(3);
        });
    });

    describe('createAuthRefresher', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('skal returnere true når admin-auth-refreshed event fires', async () => {
            const silentLoginFn = vi.fn(() => {
                setTimeout(() => window.dispatchEvent(new Event('admin-auth-refreshed')), 100);
            });

            const refreshAuth = createAuthRefresher(silentLoginFn);
            const promise = refreshAuth();

            await vi.advanceTimersByTimeAsync(200);
            const result = await promise;

            expect(result).toBe(true);
            expect(silentLoginFn).toHaveBeenCalledTimes(1);
        });

        it('skal returnere false når admin-auth-failed event fires', async () => {
            const silentLoginFn = vi.fn(() => {
                setTimeout(() => window.dispatchEvent(new Event('admin-auth-failed')), 100);
            });

            const refreshAuth = createAuthRefresher(silentLoginFn);
            const promise = refreshAuth();

            await vi.advanceTimersByTimeAsync(200);
            const result = await promise;

            expect(result).toBe(false);
            expect(silentLoginFn).toHaveBeenCalledTimes(1);
        });

        it('skal returnere false ved timeout', async () => {
            const silentLoginFn = vi.fn(); // Ingen event dispatches

            const refreshAuth = createAuthRefresher(silentLoginFn, 5000);
            const promise = refreshAuth();

            await vi.advanceTimersByTimeAsync(5100);
            const result = await promise;

            expect(result).toBe(false);
        });

        it('skal ignorere events etter at promise er settled', async () => {
            const silentLoginFn = vi.fn(() => {
                setTimeout(() => window.dispatchEvent(new Event('admin-auth-refreshed')), 100);
                setTimeout(() => window.dispatchEvent(new Event('admin-auth-failed')), 200);
            });

            const refreshAuth = createAuthRefresher(silentLoginFn);
            const promise = refreshAuth();

            await vi.advanceTimersByTimeAsync(300);
            const result = await promise;

            // Bare den første event (refreshed) teller
            expect(result).toBe(true);
        });

        it('skal ignorere events etter timeout', async () => {
            const silentLoginFn = vi.fn(() => {
                // Event kommer etter timeout
                setTimeout(() => window.dispatchEvent(new Event('admin-auth-refreshed')), 6000);
            });

            const refreshAuth = createAuthRefresher(silentLoginFn, 5000);
            const promise = refreshAuth();

            await vi.advanceTimersByTimeAsync(5100);
            const result = await promise;
            expect(result).toBe(false);

            // Sørg for at den sene eventen ikke kaster
            await vi.advanceTimersByTimeAsync(2000);
        });

        it('skal kalle silentLoginFn ved hvert refresh-forsøk', async () => {
            const silentLoginFn = vi.fn(() => {
                setTimeout(() => window.dispatchEvent(new Event('admin-auth-refreshed')), 50);
            });

            const refreshAuth = createAuthRefresher(silentLoginFn);

            const p1 = refreshAuth();
            await vi.advanceTimersByTimeAsync(100);
            await p1;

            const p2 = refreshAuth();
            await vi.advanceTimersByTimeAsync(100);
            await p2;

            expect(silentLoginFn).toHaveBeenCalledTimes(2);
        });

        it('skal bruke custom timeout', async () => {
            const silentLoginFn = vi.fn();

            const refreshAuth = createAuthRefresher(silentLoginFn, 2000);
            const promise = refreshAuth();

            await vi.advanceTimersByTimeAsync(2100);
            const result = await promise;

            expect(result).toBe(false);
        });

        it('skal rydde opp event listeners etter suksess', async () => {
            const removeSpy = vi.spyOn(window, 'removeEventListener');
            const silentLoginFn = vi.fn(() => {
                setTimeout(() => window.dispatchEvent(new Event('admin-auth-refreshed')), 50);
            });

            const refreshAuth = createAuthRefresher(silentLoginFn);
            const promise = refreshAuth();

            await vi.advanceTimersByTimeAsync(100);
            await promise;

            expect(removeSpy).toHaveBeenCalledWith('admin-auth-refreshed', expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith('admin-auth-failed', expect.any(Function));
            removeSpy.mockRestore();
        });
    });
});
