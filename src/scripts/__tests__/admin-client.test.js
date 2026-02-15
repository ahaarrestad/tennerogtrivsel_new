/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { 
    initGapi, 
    initGis, 
    login, 
    silentLogin, 
    logout, 
    tryRestoreSession, 
    checkAccess 
} from '../admin-client';

describe('admin-client.js', () => {
    beforeEach(() => {
        vi.stubEnv('PUBLIC_GOOGLE_API_KEY', 'test-api-key');
        vi.stubEnv('PUBLIC_GOOGLE_CLIENT_ID', 'test-client-id');

        vi.stubGlobal('gapi', {
            load: vi.fn((name, callback) => callback()),
            client: {
                init: vi.fn().mockResolvedValue({}),
                getToken: vi.fn().mockReturnValue({ access_token: 'valid-token' }),
                setToken: vi.fn(),
                drive: {
                    files: {
                        get: vi.fn()
                    }
                }
            }
        });

        vi.stubGlobal('google', {
            accounts: {
                oauth2: {
                    initTokenClient: vi.fn(() => ({
                        requestAccessToken: vi.fn()
                    })),
                    revoke: vi.fn()
                }
            }
        });

        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('initGapi', () => {
        it('skal initialisere gapi client', async () => {
            await initGapi();
            expect(gapi.load).toHaveBeenCalledWith('client', expect.any(Function));
            expect(gapi.client.init).toHaveBeenCalledWith(expect.objectContaining({
                apiKey: expect.any(String),
                discoveryDocs: expect.arrayContaining([expect.stringContaining('discovery')])
            }));
        });

        it('skal kaste feil hvis gapi mangler', async () => {
            vi.stubGlobal('gapi', undefined);
            await expect(initGapi()).rejects.toThrow('Google API (gapi) script ikke lastet');
        });
    });

    describe('initGis', () => {
        it('skal initialisere GIS token client', () => {
            const callback = vi.fn();
            initGis(callback);
            expect(google.accounts.oauth2.initTokenClient).toHaveBeenCalledWith(expect.objectContaining({
                client_id: expect.any(String),
                callback: expect.any(Function)
            }));
        });
    });

    describe('Session Management', () => {
        it('tryRestoreSession skal returnere false hvis ingenting er lagret', () => {
            expect(tryRestoreSession()).toBe(false);
        });

        it('tryRestoreSession skal returnere true hvis gyldig token finnes', () => {
            const future = Date.now() + 3600000;
            localStorage.setItem('admin_google_token', JSON.stringify({
                access_token: 'test-token',
                expiry: future
            }));

            expect(tryRestoreSession()).toBe(true);
            expect(gapi.client.setToken).toHaveBeenCalledWith({ access_token: 'test-token' });
        });

        it('tryRestoreSession skal returnere false og rense opp hvis token er utløpt', () => {
            const past = Date.now() - 1000;
            localStorage.setItem('admin_google_token', JSON.stringify({
                access_token: 'old-token',
                expiry: past
            }));

            expect(tryRestoreSession()).toBe(false);
            expect(localStorage.getItem('admin_google_token')).toBeNull();
        });

        it('logout skal fjerne token fra gapi og localStorage', () => {
            localStorage.setItem('admin_google_token', 'some-data');
            logout();
            expect(google.accounts.oauth2.revoke).toHaveBeenCalled();
            expect(gapi.client.setToken).toHaveBeenCalledWith('');
            expect(localStorage.getItem('admin_google_token')).toBeNull();
        });
    });

    describe('login and silentLogin', () => {
        it('login skal be om select_account', () => {
            const requestSpy = vi.fn();
            google.accounts.oauth2.initTokenClient.mockReturnValue({ requestAccessToken: requestSpy });
            initGis(() => {});
            login();
            expect(requestSpy).toHaveBeenCalledWith({ prompt: 'select_account' });
        });

        it('silentLogin skal prøve å gjenbruke sesjon', () => {
            const requestSpy = vi.fn();
            google.accounts.oauth2.initTokenClient.mockReturnValue({ requestAccessToken: requestSpy });
            initGis(() => {});
            silentLogin();
            expect(requestSpy).toHaveBeenCalledWith({ prompt: '' });
        });

        it('silentLogin skal ikke gjøre noe hvis tokenClient ikke er inited', () => {
            silentLogin(); // Bør ikke krasje
        });
    });

    describe('Detailed Error Handling', () => {
        it('initGapi skal kaste feil hvis API-nøkkel mangler', async () => {
            vi.stubEnv('PUBLIC_GOOGLE_API_KEY', '');
            await expect(initGapi()).rejects.toThrow('PUBLIC_GOOGLE_API_KEY mangler');
        });

        it('initGis callback skal lagre token i localStorage', () => {
            let capturedCallback;
            google.accounts.oauth2.initTokenClient.mockImplementation(({ callback }) => {
                capturedCallback = callback;
                return { requestAccessToken: vi.fn() };
            });

            initGis(() => {});
            capturedCallback({ access_token: 'new-token', expires_in: 3600 });

            const stored = JSON.parse(localStorage.getItem('admin_google_token'));
            expect(stored.access_token).toBe('new-token');
            expect(stored.expiry).toBeGreaterThan(Date.now());
        });

        it('initGis callback skal kaste feil hvis resp inneholder error', async () => {
            let capturedCallback;
            google.accounts.oauth2.initTokenClient.mockImplementation(({ callback }) => {
                capturedCallback = callback;
                return { requestAccessToken: vi.fn() };
            });

            initGis(() => {});
            await expect(capturedCallback({ error: 'access_denied' })).rejects.toEqual({ error: 'access_denied' });
        });

        it('logout skal ikke krasje hvis token er null', () => {
            gapi.client.getToken.mockReturnValue(null);
            logout();
            expect(google.accounts.oauth2.revoke).not.toHaveBeenCalled();
        });

        it('checkAccess skal håndtere feil uten detaljert result-objekt', async () => {
            gapi.client.drive.files.get.mockRejectedValue(new Error('Generic Error'));
            const result = await checkAccess('123');
            expect(result).toBe(false);
        });
    });
});
