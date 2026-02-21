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
    updateSettingByKey,
    checkAccess,
    listFiles,
    getFileContent,
    saveFile,
    createFile,
    deleteFile,
    parseMarkdown,
    stringifyMarkdown,
    checkMultipleAccess,
    getTannlegerRaw,
    updateTannlegeRow,
    addTannlegeRow,
    deleteTannlegeRowPermanently,
    findFileByName,
    listImages,
    uploadImage,
    getDriveImageBlob,
    ensureSlettetSheet,
    backupToSlettetSheet,
    getSheetParentFolder
} from '../admin-client';

describe('admin-client.js', () => {
    beforeEach(() => {
        vi.stubEnv('PUBLIC_GOOGLE_API_KEY', 'test-api-key');
        vi.stubEnv('PUBLIC_GOOGLE_CLIENT_ID', 'test-client-id');

        // Mock globals needed for uploads/files
        vi.stubGlobal('File', class { 
            constructor(parts, name, opts) { 
                this.name = name; 
                this.type = opts?.type || '';
                this.size = 1024;
            } 
        });
        vi.stubGlobal('Blob', class { constructor(content, opts) { this.type = opts?.type; } });
        vi.stubGlobal('FormData', class { 
            constructor() { this.data = {}; }
            append(k, v) { this.data[k] = v; } 
        });
        vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:url') });

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({ name: 'Test User', email: 'test@example.com' }),
            ok: true,
            blob: vi.fn().mockResolvedValue(new Blob())
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
                        batchUpdate: vi.fn(),
                        values: {
                            get: vi.fn(),
                            update: vi.fn(),
                            append: vi.fn()
                        }
                    }
                },
                drive: {
                    files: {
                        get: vi.fn(),
                        list: vi.fn(),
                        create: vi.fn(),
                        update: vi.fn()
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

    describe('findFileByName', () => {
        it('skal returnere fil hvis den finnes', async () => {
            const mockFile = { id: 'file-123', name: 'test.png' };
            gapi.client.drive.files.list.mockResolvedValue({ result: { files: [mockFile] } });

            const result = await findFileByName('test.png', 'folder-123');
            expect(result).toEqual(mockFile);
            expect(gapi.client.drive.files.list).toHaveBeenCalledWith(expect.objectContaining({
                q: expect.stringContaining("name = 'test.png'"),
                supportsAllDrives: true
            }));
        });

        it('skal returnere null hvis filen ikke finnes', async () => {
            gapi.client.drive.files.list.mockResolvedValue({ result: { files: [] } });
            const result = await findFileByName('ukjent.png', 'folder-123');
            expect(result).toBeNull();
        });

        it('skal returnere null og logge feil hvis API feiler', async () => {
            gapi.client.drive.files.list.mockRejectedValue(new Error('fail'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await findFileByName('test.png', 'folder-123');
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
        });
    });

    describe('listImages', () => {
        it('skal returnere filtrert liste med bilder', async () => {
            const mockFiles = [
                { id: '1', name: 'image.jpg', mimeType: 'image/jpeg' },
                { id: '2', name: 'doc.pdf', mimeType: 'application/pdf' },
                { id: '3', name: 'photo.png', mimeType: 'image/png' }
            ];
            gapi.client.drive.files.list.mockResolvedValue({ result: { files: mockFiles } });

            const images = await listImages('folder-123');
            expect(images).toHaveLength(2);
            expect(images[0].name).toBe('image.jpg');
            expect(images[1].name).toBe('photo.png');
        });

        it('skal kaste feil hvis API feiler med detaljert melding', async () => {
            const apiError = { result: { error: { message: 'Custom Google Error' } } };
            gapi.client.drive.files.list.mockRejectedValue(apiError);
            await expect(listImages('123')).rejects.toThrow('Custom Google Error');
        });

        it('skal kaste feil hvis GAPI ikke er lastet', async () => {
            const originalDrive = gapi.client.drive;
            delete gapi.client.drive;
            await expect(listImages('123')).rejects.toThrow('Drive API ikke initialisert');
            gapi.client.drive = originalDrive;
        });
    });

    describe('uploadImage', () => {
        it('skal laste opp fil med multipart request', async () => {
            global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'new-img' }) });
            const mockFile = new File([''], 'test.png', { type: 'image/png' });

            const result = await uploadImage('folder-123', mockFile);
            
            expect(result).toEqual({ id: 'new-img' });
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('uploadType=multipart'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('skal kaste feil hvis opplasting feiler (http feil)', async () => {
            global.fetch.mockResolvedValue({ ok: false, statusText: 'Bad Request' });
            const mockFile = new File([''], 'test.png');
            await expect(uploadImage('folder-123', mockFile)).rejects.toThrow('Upload failed: Bad Request');
        });

        it('skal kaste feil hvis fetch kaster feil (nettverk)', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));
            const mockFile = new File([''], 'test.png');
            await expect(uploadImage('folder-123', mockFile)).rejects.toThrow('Network error');
        });
    });

    describe('getDriveImageBlob', () => {
        it('skal returnere en blob-url for et bilde', async () => {
            const result = await getDriveImageBlob('img-123');
            expect(result).toBe('blob:url');
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('img-123'), expect.any(Object));
        });

        it('skal returnere null hvis ingen id er oppgitt', async () => {
            expect(await getDriveImageBlob(null)).toBeNull();
            expect(await getDriveImageBlob(undefined)).toBeNull();
        });

        it('skal returnere null og logge ved feil', async () => {
            global.fetch.mockRejectedValue(new Error('fetch fail'));
            const result = await getDriveImageBlob('123');
            expect(result).toBeNull();
        });

        it('skal returnere null når gapi.client.drive.files.get kaster feil', async () => {
            gapi.client.drive.files.get.mockRejectedValueOnce(new Error('Drive API feil'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await getDriveImageBlob('img-456');
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
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

        it('tryRestoreSession skal sette token i GAPI hvis gyldig', async () => {
            await initGapi(); 
            const future = Date.now() + 3600000;
            localStorage.setItem('admin_google_token', JSON.stringify({
                access_token: 'test-token',
                expiry: future
            }));

            expect(tryRestoreSession()).toBe(true);
            expect(gapi.client.setToken).toHaveBeenCalledWith({ access_token: 'test-token' });
        });

        it('tryRestoreSession skal fjerne utløpt token og returnere false', async () => {
            await initGapi();
            const past = Date.now() - 1000;
            localStorage.setItem('admin_google_token', JSON.stringify({
                access_token: 'old-token',
                expiry: past
            }));

            expect(tryRestoreSession()).toBe(false);
            expect(localStorage.getItem('admin_google_token')).toBeNull();
        });

        it('tryRestoreSession skal returnere false hvis gapi.client ikke er klar', async () => {
            const future = Date.now() + 3600000;
            localStorage.setItem('admin_google_token', JSON.stringify({
                access_token: 'test-token',
                expiry: future
            }));
            // gapi.client is null before initGapi()
            vi.stubGlobal('gapi', { client: null });

            expect(tryRestoreSession()).toBe(false);
        });

        it('logout skal fjerne token hvis gapi.client finnes', () => {
            localStorage.setItem('admin_google_token', 'some-data');
            logout();
            expect(google.accounts.oauth2.revoke).toHaveBeenCalled();
            expect(localStorage.getItem('admin_google_token')).toBeNull();
        });
    });

    describe('GIS Auth', () => {
        it('login skal returnere tidlig hvis tokenClient ikke er initialisert', () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            login();
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('login feilet'));
            spy.mockRestore();
        });

        it('silentLogin skal returnere tidlig hvis tokenClient ikke er initialisert', () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            silentLogin();
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('silentLogin avbrutt'));
            spy.mockRestore();
        });

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
                ['ID', 'Verdi', 'Beskrivelse'], 
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
        it('initGis skal kaste feil hvis google mangler', () => {
            const originalGoogle = global.google;
            delete global.google;
            expect(() => initGis(() => {})).toThrow("Google Identity Services (google) script ikke lastet.");
            global.google = originalGoogle;
        });

        it('getStoredUser skal håndtere korrupt JSON', () => {
            localStorage.setItem('admin_google_token', 'ikke-json');
            expect(getStoredUser()).toBeNull();
            expect(localStorage.getItem('admin_google_token')).toBeNull();
        });

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

        it('tryRestoreSession skal håndtere korrupt JSON', async () => {
            await initGapi(); 
            localStorage.setItem('admin_google_token', '{invalid');
            expect(tryRestoreSession()).toBe(false);
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

        it('checkMultipleAccess skal håndtere tom liste', async () => {
            const result = await checkMultipleAccess([]);
            expect(result).toEqual({});
        });

        it('checkMultipleAccess skal sjekke alle IDs parallelt', async () => {
            gapi.client.drive.files.get.mockResolvedValue({ result: { name: 'Folder' } });
            const result = await checkMultipleAccess(['folder-1', 'folder-2']);
            expect(result['folder-1']).toBe(true);
            expect(result['folder-2']).toBe(true);
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

    describe('Google Drive Operations', () => {
        it('listFiles skal returnere liste med filer', async () => {
            const mockFiles = [{ id: '1', name: 'test.md' }];
            gapi.client.drive.files.list.mockResolvedValue({ result: { files: mockFiles } });
            
            const files = await listFiles('folder-123');
            expect(files).toEqual(mockFiles);
            expect(gapi.client.drive.files.list).toHaveBeenCalledWith(expect.objectContaining({
                q: expect.stringContaining('folder-123')
            }));
        });

        it('listFiles skal håndtere feil', async () => {
            gapi.client.drive.files.list.mockRejectedValue(new Error('Drive error'));
            await expect(listFiles('123')).rejects.toThrow('Drive error');
        });

        it('getFileContent skal returnere body', async () => {
            gapi.client.drive.files.get.mockResolvedValue({ body: 'content' });
            const content = await getFileContent('file-123');
            expect(content).toBe('content');
        });

        it('getFileContent skal håndtere feil', async () => {
            gapi.client.drive.files.get.mockRejectedValue(new Error('fail'));
            await expect(getFileContent('123')).rejects.toThrow('fail');
        });

        it('saveFile skal oppdatere metadata og innhold', async () => {
            gapi.client.drive.files.update.mockResolvedValue({});
            global.fetch.mockResolvedValue({ ok: true });

            const result = await saveFile('file-123', 'new-name.md', 'new-content');
            expect(result).toBe(true);
            expect(gapi.client.drive.files.update).toHaveBeenCalledWith(expect.objectContaining({
                fileId: 'file-123',
                resource: { name: 'new-name.md' }
            }));
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('file-123'),
                expect.objectContaining({ method: 'PATCH', body: 'new-content' })
            );
        });

        it('createFile skal opprette fil og lagre innhold', async () => {
            gapi.client.drive.files.create.mockResolvedValue({ result: { id: 'new-id' } });
            gapi.client.drive.files.update.mockResolvedValue({});
            
            const id = await createFile('folder-123', 'test.md', 'content');
            expect(id).toBe('new-id');
            expect(gapi.client.drive.files.create).toHaveBeenCalled();
        });

        it('deleteFile skal sette trashed til true', async () => {
            gapi.client.drive.files.update.mockResolvedValue({});
            const result = await deleteFile('file-123');
            expect(result).toBe(true);
            expect(gapi.client.drive.files.update).toHaveBeenCalledWith(expect.objectContaining({
                resource: { trashed: true }
            }));
        });

        it('saveFile skal kaste feil hvis API feiler', async () => {
            gapi.client.drive.files.update.mockRejectedValue(new Error('fail'));
            await expect(saveFile('1', 'n', 'c')).rejects.toThrow('fail');
        });

        it('createFile skal kaste feil hvis API feiler', async () => {
            gapi.client.drive.files.create.mockRejectedValue(new Error('fail'));
            await expect(createFile('f', 'n', 'c')).rejects.toThrow('fail');
        });

        it('deleteFile skal kaste feil hvis API feiler', async () => {
            gapi.client.drive.files.update.mockRejectedValue(new Error('fail'));
            await expect(deleteFile('1')).rejects.toThrow('fail');
        });
    });

    describe('Markdown Utilities', () => {
        it('parseMarkdown skal splitte frontmatter og body', () => {
            const raw = '---\ntitle: Hei\nid: 123\n---\nInnhold her';
            const { data, body } = parseMarkdown(raw);
            expect(data).toEqual({ title: 'Hei', id: '123' });
            expect(body).toBe('Innhold her');
        });

        it('parseMarkdown skal håndtere manglende frontmatter', () => {
            const raw = 'Bare innhold';
            const { data, body } = parseMarkdown(raw);
            expect(data).toEqual({});
            expect(body).toBe('Bare innhold');
        });

        it('stringifyMarkdown skal lage korrekt streng', () => {
            const data = { title: 'Hei', id: '123' };
            const body = 'Innhold';
            const result = stringifyMarkdown(data, body);
            expect(result).toContain('title: Hei');
            expect(result).toContain('id: 123');
            expect(result).toContain('---\nInnhold');
        });
    });

    describe('Tannleger CRUD (Google Sheets)', () => {
        const spreadsheetId = 'sheet-123';

        it('getTannlegerRaw skal mappe rader korrekt', async () => {
            const mockValues = [
                ['Navn', 'Tittel', 'Beskrivelse', 'Bilde', 'Aktiv', 'Skala', 'X', 'Y'],
                ['Ola', 'T', 'B', 'o.jpg', 'ja', '1.2', '10', '20']
            ];
            gapi.client.sheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: mockValues }
            });

            const result = await getTannlegerRaw(spreadsheetId);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                rowIndex: 2,
                name: 'Ola',
                title: 'T',
                description: 'B',
                image: 'o.jpg',
                active: true,
                scale: 1.2,
                positionX: 10,
                positionY: 20
            });
        });

        it('getTannlegerRaw skal håndtere manglende verdier med defaults', async () => {
            const mockValues = [
                ['Navn', 'Tittel', 'Beskrivelse', 'Bilde', 'Aktiv', 'Skala', 'X', 'Y'],
                ['Ola', 'T', 'B', 'o.jpg', 'ja', '', '', '']
            ];
            gapi.client.sheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: mockValues }
            });

            const result = await getTannlegerRaw(spreadsheetId);
            expect(result[0].scale).toBe(1.0);
            expect(result[0].positionX).toBe(50);
            expect(result[0].positionY).toBe(50);
        });

        it('getTannlegerRaw skal sette active: false når aktiv-kolonne er tom', async () => {
            const mockValues = [
                ['Navn', 'Tittel', 'Beskrivelse', 'Bilde', 'Aktiv', 'Skala', 'X', 'Y'],
                ['Per', 'T', 'B', 'p.jpg', '', '', '', '']
            ];
            gapi.client.sheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: mockValues }
            });

            const result = await getTannlegerRaw(spreadsheetId);
            expect(result[0].active).toBe(false);
            expect(result[0].scale).toBe(1.0);
            expect(result[0].positionX).toBe(50);
            expect(result[0].positionY).toBe(50);
        });

        it('getTannlegerRaw skal bruke tomme strenger som fallback for navn/tittel/beskrivelse/bilde', async () => {
            const mockValues = [
                ['Navn', 'Tittel', 'Beskrivelse', 'Bilde', 'Aktiv', 'Skala', 'X', 'Y'],
                ['', '', '', '', 'nei', '1.5', '30', '40']
            ];
            gapi.client.sheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: mockValues }
            });

            const result = await getTannlegerRaw(spreadsheetId);
            expect(result[0].name).toBe('');
            expect(result[0].title).toBe('');
            expect(result[0].description).toBe('');
            expect(result[0].image).toBe('');
            expect(result[0].active).toBe(false);
            expect(result[0].scale).toBe(1.5);
        });

        it('getTannlegerRaw skal returnere tom liste når rader er null eller bare header', async () => {
            gapi.client.sheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: null }
            });
            expect(await getTannlegerRaw(spreadsheetId)).toEqual([]);

            gapi.client.sheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: [['Navn', 'Tittel']] }
            });
            expect(await getTannlegerRaw(spreadsheetId)).toEqual([]);
        });

        it('updateTannlegeRow skal sende korrekte verdier', async () => {
            const data = { 
                name: 'Ola', 
                title: 'T', 
                description: 'B',
                image: 'o.jpg',
                active: true, 
                scale: 1.5,
                positionX: 50,
                positionY: 50
            };
            gapi.client.sheets.spreadsheets.values.update.mockResolvedValue({});

            await updateTannlegeRow(spreadsheetId, 5, data);

            expect(gapi.client.sheets.spreadsheets.values.update).toHaveBeenCalledWith(expect.objectContaining({
                range: 'tannleger!A5:H5',
                resource: { values: [['Ola', 'T', 'B', 'o.jpg', 'ja', 1.5, 50, 50]] }
            }));
        });

        it('addTannlegeRow skal bruke append API', async () => {
            const data = { name: 'Ny' };
            gapi.client.sheets.spreadsheets.values.append.mockResolvedValue({});

            await addTannlegeRow(spreadsheetId, data);

            expect(gapi.client.sheets.spreadsheets.values.append).toHaveBeenCalled();
        });

        it('skal kaste feil hvis API feiler i CRUD', async () => {
            gapi.client.sheets.spreadsheets.values.get.mockRejectedValue(new Error('fail'));
            await expect(getTannlegerRaw('id')).rejects.toThrow('fail');
        });

        it('updateTannlegeRow skal kaste feil hvis API feiler', async () => {
            gapi.client.sheets.spreadsheets.values.update.mockRejectedValue(new Error('fail'));
            await expect(updateTannlegeRow('id', 1, {})).rejects.toThrow('fail');
        });

        it('addTannlegeRow skal kaste feil hvis API feiler', async () => {
            gapi.client.sheets.spreadsheets.values.append.mockRejectedValue(new Error('fail'));
            await expect(addTannlegeRow('id', {})).rejects.toThrow('fail');
        });
    });

    describe('deleteTannlegeRowPermanently', () => {
        const spreadsheetId = 'sheet-123';

        it('skal hente sheetId og kalle batchUpdate med deleteDimension', async () => {
            gapi.client.sheets.spreadsheets.get.mockResolvedValueOnce({
                result: {
                    sheets: [
                        { properties: { title: 'tannleger', sheetId: 42 } },
                        { properties: { title: 'Slettet', sheetId: 99 } }
                    ]
                }
            });
            gapi.client.sheets.spreadsheets.batchUpdate.mockResolvedValueOnce({});

            const result = await deleteTannlegeRowPermanently(spreadsheetId, 3);

            expect(result).toBe(true);
            expect(gapi.client.sheets.spreadsheets.get).toHaveBeenCalledWith({
                spreadsheetId,
                fields: 'sheets.properties'
            });
            expect(gapi.client.sheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
                spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: 42,
                                dimension: 'ROWS',
                                startIndex: 2,
                                endIndex: 3
                            }
                        }
                    }]
                }
            });
        });

        it("skal kaste feil hvis 'tannleger'-arket ikke finnes", async () => {
            gapi.client.sheets.spreadsheets.get.mockResolvedValueOnce({
                result: { sheets: [{ properties: { title: 'Slettet', sheetId: 99 } }] }
            });
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            await expect(deleteTannlegeRowPermanently(spreadsheetId, 3)).rejects.toThrow(
                "Fant ikke 'tannleger'-arket i regnearket."
            );
            consoleSpy.mockRestore();
        });

        it('skal kaste feil og logge ved API-feil', async () => {
            gapi.client.sheets.spreadsheets.get.mockRejectedValueOnce(new Error('api-feil'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            await expect(deleteTannlegeRowPermanently(spreadsheetId, 3)).rejects.toThrow('api-feil');
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('Backup (Slettet-ark)', () => {
        it('ensureSlettetSheet: arket finnes → kun get kalles, ikke batchUpdate', async () => {
            gapi.client.sheets.spreadsheets.get.mockResolvedValueOnce({
                result: { sheets: [{ properties: { title: 'Slettet' } }] }
            });

            await ensureSlettetSheet('sheet-id');

            expect(gapi.client.sheets.spreadsheets.get).toHaveBeenCalledWith({
                spreadsheetId: 'sheet-id',
                fields: 'sheets.properties.title'
            });
            expect(gapi.client.sheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
            expect(gapi.client.sheets.spreadsheets.values.update).not.toHaveBeenCalled();
        });

        it('ensureSlettetSheet: arket mangler → batchUpdate og values.update (headers) kalles', async () => {
            gapi.client.sheets.spreadsheets.get.mockResolvedValueOnce({
                result: { sheets: [{ properties: { title: 'tannleger' } }] }
            });
            gapi.client.sheets.spreadsheets.batchUpdate.mockResolvedValueOnce({});
            gapi.client.sheets.spreadsheets.values.update.mockResolvedValueOnce({});

            await ensureSlettetSheet('sheet-id');

            expect(gapi.client.sheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
                spreadsheetId: 'sheet-id',
                resource: { requests: [{ addSheet: { properties: { title: 'Slettet' } } }] }
            });
            expect(gapi.client.sheets.spreadsheets.values.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    spreadsheetId: 'sheet-id',
                    range: 'Slettet!A1:D1',
                    resource: { values: [['Type', 'Tittel/Navn', 'Dato slettet', 'Data']] }
                })
            );
        });

        it('ensureSlettetSheet: API-feil kaster videre', async () => {
            gapi.client.sheets.spreadsheets.get.mockRejectedValueOnce(new Error('api-error'));
            await expect(ensureSlettetSheet('sheet-id')).rejects.toThrow('api-error');
        });

        it('backupToSlettetSheet: appender korrekt rad [type, title, date, data]', async () => {
            gapi.client.sheets.spreadsheets.get.mockResolvedValueOnce({
                result: { sheets: [{ properties: { title: 'Slettet' } }] }
            });
            gapi.client.sheets.spreadsheets.values.append.mockResolvedValueOnce({});

            await backupToSlettetSheet('sheet-id', 'tjeneste', 'Bleking', 'markdown innhold');

            const appendCall = gapi.client.sheets.spreadsheets.values.append.mock.calls[0][0];
            expect(appendCall.spreadsheetId).toBe('sheet-id');
            expect(appendCall.range).toBe('Slettet!A:D');
            expect(appendCall.insertDataOption).toBe('INSERT_ROWS');
            const row = appendCall.resource.values[0];
            expect(row[0]).toBe('tjeneste');
            expect(row[1]).toBe('Bleking');
            expect(row[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(row[3]).toBe('markdown innhold');
        });

        it('backupToSlettetSheet: API-feil kaster videre', async () => {
            gapi.client.sheets.spreadsheets.get.mockResolvedValueOnce({
                result: { sheets: [{ properties: { title: 'Slettet' } }] }
            });
            gapi.client.sheets.spreadsheets.values.append.mockRejectedValueOnce(new Error('append-fail'));
            await expect(
                backupToSlettetSheet('sheet-id', 'melding', 'Jul', 'data')
            ).rejects.toThrow('append-fail');
        });
    });

    describe('getSheetParentFolder', () => {
        it('skal returnere første foreldre-mappe-ID', async () => {
            gapi.client.drive.files.get.mockResolvedValueOnce({
                result: { parents: ['folder-123', 'folder-456'] }
            });
            const result = await getSheetParentFolder('sheet-id');
            expect(result).toBe('folder-123');
            expect(gapi.client.drive.files.get).toHaveBeenCalledWith(expect.objectContaining({
                fileId: 'sheet-id',
                fields: 'parents'
            }));
        });

        it('skal returnere null hvis ingen foreldre-mapper finnes', async () => {
            gapi.client.drive.files.get.mockResolvedValueOnce({
                result: { parents: [] }
            });
            const result = await getSheetParentFolder('sheet-id');
            expect(result).toBeNull();
        });

        it('skal returnere null og logge feil hvis API feiler', async () => {
            gapi.client.drive.files.get.mockRejectedValueOnce(new Error('Drive API feil'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await getSheetParentFolder('sheet-id');
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Kunne ikke hente'), expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('updateSettingByKey', () => {
        it('skal oppdatere eksisterende nøkkel ved riktig rad', async () => {
            gapi.client.sheets.spreadsheets.values.get.mockResolvedValueOnce({
                result: {
                    values: [
                        ['header', 'header'],
                        ['forsideBilde', 'gammel.png', ''],
                        ['forsideBildeScale', '1', ''],
                    ]
                }
            });
            gapi.client.sheets.spreadsheets.values.update.mockResolvedValueOnce({});

            await updateSettingByKey('sheet-id', 'forsideBilde', 'ny.png');

            expect(gapi.client.sheets.spreadsheets.values.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    range: 'Innstillinger!B2',
                    resource: { values: [['ny.png']] }
                })
            );
        });

        it('skal legge til ny rad hvis nøkkelen ikke finnes', async () => {
            gapi.client.sheets.spreadsheets.values.get.mockResolvedValueOnce({
                result: { values: [['header', 'header']] }
            });
            gapi.client.sheets.spreadsheets.values.append.mockResolvedValueOnce({});

            await updateSettingByKey('sheet-id', 'forsideBildeScale', '1.5');

            expect(gapi.client.sheets.spreadsheets.values.append).toHaveBeenCalledWith(
                expect.objectContaining({
                    range: 'Innstillinger!A:C',
                    resource: { values: [['forsideBildeScale', '1.5', '']] }
                })
            );
        });

        it('skal kaste feil hvis API feiler', async () => {
            gapi.client.sheets.spreadsheets.values.get.mockRejectedValueOnce(new Error('API-feil'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            await expect(updateSettingByKey('sheet-id', 'key', 'val')).rejects.toThrow('API-feil');
            consoleSpy.mockRestore();
        });
    });
});
