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
    getStoredUser,
    getSettingsWithNotes,
    updateSettings,
    checkAccess 
} from '../admin-client';

describe('admin-client.js', () => {
    beforeEach(() => {
        vi.stubEnv('PUBLIC_GOOGLE_API_KEY', 'test-api-key');
        vi.stubEnv('PUBLIC_GOOGLE_CLIENT_ID', 'test-client-id');

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({ name: 'Test User', email: 'test@example.com' })
        }));

        vi.stubGlobal('gapi', {
            load: vi.fn((name, callback) => callback()),
            client: {
                init: vi.fn().mockResolvedValue({}),
                load: vi.fn().mockResolvedValue({}),
                getToken: vi.fn().mockReturnValue({ access_token: 'valid-token' }),
                setToken: vi.fn(),
                sheets: {
                    spreadsheets: {
                        get: vi.fn(),
                        values: {
                            get: vi.fn(),
                            update: vi.fn()
                        }
                    }
                },
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
                    initTokenClient: vi.fn(({ callback }) => ({
                        requestAccessToken: vi.fn(({ prompt }) => {
                            if (prompt !== 'none') { // Simulate user selection
                                callback({ access_token: 'new-token', expires_in: 3600 });
                            }
                        })
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

    describe('getStoredUser', () => {
        it('skal returnere null hvis ingenting er lagret', () => {
            expect(getStoredUser()).toBeNull();
        });

        it('skal returnere brukerinfo hvis gyldig sesjon finnes', () => {
            const future = Date.now() + 3600000;
            const mockUser = { name: 'Ola' };
            localStorage.setItem('admin_google_token', JSON.stringify({
                expiry: future,
                user: mockUser
            }));
            expect(getStoredUser()).toEqual(mockUser);
        });
    });

    describe('initGapi', () => {
        it('skal initialisere gapi client og laste Drive og Sheets APIer', async () => {
            const result = await initGapi();
            expect(result).toBe(true);
            expect(gapi.load).toHaveBeenCalledWith('client', expect.any(Function));
            expect(gapi.client.init).toHaveBeenCalledWith(expect.objectContaining({
                apiKey: expect.any(String)
            }));
            expect(gapi.client.load).toHaveBeenCalledWith('drive', 'v3');
            expect(gapi.client.load).toHaveBeenCalledWith('sheets', 'v4');
        });

        it('skal returnere false hvis gapi mangler', async () => {
            vi.stubGlobal('gapi', undefined);
            const result = await initGapi();
            expect(result).toBe(false);
        });
    });

    describe('Session Management', () => {
        it('tryRestoreSession skal returnere false hvis ingenting er lagret', () => {
            expect(tryRestoreSession()).toBe(false);
        });

        it('tryRestoreSession skal sette token i GAPI hvis gyldig', () => {
            const future = Date.now() + 3600000;
            localStorage.setItem('admin_google_token', JSON.stringify({
                access_token: 'test-token',
                expiry: future
            }));

            expect(tryRestoreSession()).toBe(true);
            expect(gapi.client.setToken).toHaveBeenCalledWith({ access_token: 'test-token' });
        });

        it('logout skal fjerne token hvis gapi.client finnes', () => {
            localStorage.setItem('admin_google_token', 'some-data');
            logout();
            expect(google.accounts.oauth2.revoke).toHaveBeenCalled();
            expect(localStorage.getItem('admin_google_token')).toBeNull();
        });
    });

    describe('GIS Auth', () => {
        it('initGis skal sette opp token client', () => {
            const cb = vi.fn();
            initGis(cb);
            expect(google.accounts.oauth2.initTokenClient).toHaveBeenCalled();
        });

        it('login skal be om select_account og trigge callback', async () => {
            const cb = vi.fn();
            initGis(cb);
            login();
            await vi.waitFor(() => expect(cb).toHaveBeenCalled());
            expect(cb).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test User' }));
        });

        it('silentLogin skal be om prompt none', () => {
            const requestSpy = vi.fn();
            google.accounts.oauth2.initTokenClient.mockReturnValue({ requestAccessToken: requestSpy });
            initGis(() => {});
            silentLogin();
            expect(requestSpy).toHaveBeenCalledWith({ prompt: 'none' });
        });
    });

    describe('Google Sheets Module', () => {
        it('getSettingsWithNotes skal mappe rader fra A, B og C korrekt', async () => {
            const mockValues = [
                ['ID', 'Verdi', 'Beskrivelse'], // Header
                ['tel', '123', 'Telefonnummer']
            ];
            gapi.client.sheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: mockValues }
            });

            const settings = await getSettingsWithNotes('sheet-123');
            expect(settings).toHaveLength(1);
            expect(settings[0]).toEqual({
                row: 2,
                id: 'tel',
                value: '123',
                description: 'Telefonnummer'
            });
        });

        it('updateSettings skal sende korrekte verdier til APIet', async () => {
            const settings = [{ value: 'new-val' }];
            gapi.client.sheets.spreadsheets.values.update.mockResolvedValue({ result: {} });

            await updateSettings('sheet-123', settings);

            expect(gapi.client.sheets.spreadsheets.values.update).toHaveBeenCalledWith(expect.objectContaining({
                range: 'Innstillinger!B2:B2',
                resource: { values: [['new-val']] }
            }));
        });

        it('getSettingsWithNotes skal håndtere API-feil', async () => {
            gapi.client.sheets.spreadsheets.values.get.mockRejectedValue(new Error('fail'));
            await expect(getSettingsWithNotes('123')).rejects.toThrow('fail');
        });

        it('updateSettings skal håndtere API-feil', async () => {
            gapi.client.sheets.spreadsheets.values.update.mockRejectedValue(new Error('fail'));
            await expect(updateSettings('123', [])).rejects.toThrow('fail');
        });
    });

    describe('Detailed Error Handling', () => {
        it('initGis callback skal håndtere error-respons', async () => {
            let capturedCallback;
            google.accounts.oauth2.initTokenClient.mockImplementation(({ callback }) => {
                capturedCallback = callback;
                return { requestAccessToken: vi.fn() };
            });
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            initGis(() => {});
            await capturedCallback({ error: 'denied' });
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('fetchUserInfo skal håndtere feil', async () => {
            global.fetch.mockRejectedValue(new Error('fail'));
            const successCb = vi.fn();
            initGis(successCb);
            const callback = google.accounts.oauth2.initTokenClient.mock.calls[0][0].callback;
            await callback({ access_token: 'abc', expires_in: 3600 });
            expect(successCb).toHaveBeenCalled();
            const stored = JSON.parse(localStorage.getItem('admin_google_token'));
            expect(stored.user).toBeNull();
        });

        it('tryRestoreSession skal rense opp utløpt token', () => {
            localStorage.setItem('admin_google_token', JSON.stringify({ expiry: Date.now() - 1000 }));
            expect(tryRestoreSession()).toBe(false);
            expect(localStorage.getItem('admin_google_token')).toBeNull();
        });

        it('initGapi skal håndtere kritiske feil under initialisering', async () => {
            gapi.client.init.mockRejectedValue(new Error('Fatal'));
            const result = await initGapi();
            expect(result).toBe(false);
        });

        it('initGapi skal håndtere at en av APIene feiler', async () => {
            gapi.client.load.mockRejectedValueOnce(new Error('Drive failed'));
            const result = await initGapi();
            expect(result).toBe(true);
        });

        it('logout skal håndtere at gapi.client mangler', () => {
            delete gapi.client;
            logout();
        });
    });

    describe('checkAccess', () => {
        it('skal returnere true hvis filen kan hentes', async () => {
            gapi.client.drive.files.get.mockResolvedValue({ result: { name: 'Test' } });
            const result = await checkAccess('folder-123');
            expect(result).toBe(true);
        });

        it('skal returnere false ved feil', async () => {
            gapi.client.drive.files.get.mockRejectedValue({ status: 403 });
            const result = await checkAccess('123');
            expect(result).toBe(false);
        });

        it('skal returnere false hvis ingen folderId er oppgitt', async () => {
            const result = await checkAccess(null);
            expect(result).toBe(false);
        });
    });
});
