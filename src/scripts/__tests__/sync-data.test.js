import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { google } from 'googleapis';
import crypto from 'crypto';

// Mocks
const mockSheets = {
    spreadsheets: {
        values: {
            get: vi.fn(),
        },
    },
};
const mockDrive = {
    files: {
        list: vi.fn(),
        get: vi.fn(),
    },
};

vi.mock('googleapis', () => {
    return {
        google: {
            auth: {
                GoogleAuth: vi.fn().mockImplementation(function() {
                    return {
                        authorize: vi.fn(),
                    };
                }),
            },
            sheets: vi.fn(() => mockSheets),
            drive: vi.fn(() => mockDrive),
        },
    };
});

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn(),
        readdirSync: vi.fn().mockReturnValue([]),
        unlinkSync: vi.fn(),
        createWriteStream: vi.fn().mockReturnValue({
            on: vi.fn((event, cb) => {
                if (event === 'finish') cb();
            }),
        }),
        promises: {
            copyFile: vi.fn().mockResolvedValue(undefined),
        },
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    unlinkSync: vi.fn(),
    createWriteStream: vi.fn().mockReturnValue({
        on: vi.fn((event, cb) => {
            if (event === 'finish') cb();
        }),
    }),
    promises: {
        copyFile: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('stream/promises', () => ({
    pipeline: vi.fn().mockResolvedValue(undefined),
}));

// Importer etter mocks
const { syncTannleger, syncMarkdownCollection, syncForsideBilde, runSync } = await import('../sync-data.js');

describe('sync-data.js', () => {
    let logSpy;

    beforeEach(() => {
        vi.resetAllMocks();
        process.env.PUBLIC_GOOGLE_SHEET_ID = 'test-sheet-id';
        process.env.PUBLIC_GOOGLE_DRIVE_TJENESTER_FOLDER_ID = 'test-folder-id';
        process.env.PUBLIC_GOOGLE_DRIVE_MELDINGER_FOLDER_ID = 'test-folder-id';
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.com';
        process.env.GOOGLE_PRIVATE_KEY = 'test-key';
        process.env.NODE_ENV = 'test';
        delete process.env.GITHUB_ACTIONS;
        
        // Default mock behaviors
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(Buffer.from('dummy'));
        fs.readdirSync.mockReturnValue([]);
        fs.promises.copyFile.mockResolvedValue(undefined);

        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        mockSheets.spreadsheets.values.get.mockResolvedValue({ data: { values: [] } });
        mockDrive.files.list.mockResolvedValue({ data: { files: [] } });
        // Default for drive.files.get – used by syncForsideBilde for parent-folder lookup
        mockDrive.files.get.mockResolvedValue({ data: { parents: ['parent-folder-id'] } });
    });

    describe('syncTannleger', () => {
        it('bør hente data fra Google Sheets og skrive til fil', async () => {
            const mockData = {
                data: {
                    values: [
                        ['Ola Nordmann', 'Tannlege', 'Beskrivelse', 'bilde.jpg', 'ja'],
                        ['Kari Nordmann', 'Tannpleier', 'Beskrivelse 2', '', 'ja'],
                        ['Inaktiv person', 'Tittel', 'Beskrivelse', '', 'nei'],
                    ],
                },
            };

            mockSheets.spreadsheets.values.get.mockResolvedValue(mockData);
            mockDrive.files.list.mockResolvedValue({ data: { files: [{ id: 'file-id-123', md5Checksum: 'different' }] } });
            mockDrive.files.get.mockResolvedValue({ data: { on: vi.fn() } });

            await syncTannleger();

            expect(mockSheets.spreadsheets.values.get).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData).toHaveLength(2);
        });

        it('bør håndtere at bilde mangler i Drive', async () => {
            const mockData = {
                data: {
                    values: [['Ola', 'T', 'B', 'mangler.jpg', 'ja']],
                },
            };
            mockSheets.spreadsheets.values.get.mockResolvedValue(mockData);
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

            await syncTannleger();

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Bilde ikke funnet'));
        });

        it('bør håndtere feil ved nedlasting av bilde', async () => {
            const mockData = {
                data: {
                    values: [['Ola', 'T', 'B', 'feil.jpg', 'ja']],
                },
            };
            mockSheets.spreadsheets.values.get.mockResolvedValue(mockData);
            mockDrive.files.list.mockResolvedValue({ data: { files: [{ id: '123' }] } });
            mockDrive.files.get.mockRejectedValue(new Error('Download failed'));

            await syncTannleger();

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Download Error: Feil ved behandling av bilde'));
        });

        it('bør hoppe over nedlasting hvis bilde allerede finnes og er uendret', async () => {
            const mockData = {
                data: {
                    values: [['Ola', 'T', 'B', 'eksisterer.jpg', 'ja']],
                },
            };
            mockSheets.spreadsheets.values.get.mockResolvedValue(mockData);
            
            const dummyHash = crypto.createHash('md5').update(Buffer.from('dummy')).digest('hex');
            mockDrive.files.list.mockResolvedValue({
                data: { files: [{ id: '123', md5Checksum: dummyHash }] }
            });

            fs.existsSync.mockImplementation((path) => path.includes('eksisterer.jpg'));

            await syncTannleger();

            expect(mockDrive.files.get).not.toHaveBeenCalled();
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('⏭️ Skip: eksisterer.jpg er uendret'))).toBe(true);
        });

        it('bør kaste feil hvis Sheets API feiler', async () => {
            mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('API Error'));
            await expect(syncTannleger()).rejects.toThrow('API Error');
        });

        it('bør slette bilder som ikke lenger er i bruk', async () => {
            const mockData = {
                data: {
                    values: [['Ola', 'T', 'B', 'brukt.jpg', 'ja']],
                },
            };
            mockSheets.spreadsheets.values.get.mockResolvedValue(mockData);
            mockDrive.files.list.mockResolvedValue({ data: { files: [{ id: '1', name: 'brukt.jpg' }] } });
            mockDrive.files.get.mockResolvedValue({ data: { on: vi.fn() } });
            
            fs.readdirSync.mockReturnValue(['brukt.jpg', 'ubrukt.jpg', '.gitkeep']);

            await syncTannleger();

            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringMatching(/[\/\\]ubrukt\.jpg$/));
            expect(fs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining('.gitkeep'));
            expect(fs.unlinkSync).not.toHaveBeenCalledWith(expect.stringMatching(/[\/\\]brukt\.jpg$/));
        });

        it('bør håndtere bilde-justeringer og defaults korrekt (Fase 1)', async () => {
            const mockData = {
                data: {
                    values: [
                        // Navn, Tittel, Beskrivelse, Bilde, Aktiv, Skala, X, Y
                        ['Ola', 'T', 'B', 'o.jpg', 'ja', '1.5', '20', '30'], // Fullstendig data
                        ['Kari', 'T', 'B', 'k.jpg', 'ja', '', '', ''],       // Mangler justering (skal få defaults)
                        ['Per', 'T', 'B', 'p.jpg', 'ja', '0.1', '150', '-10'] // Ugyldige verdier (skal få defaults/clamped)
                    ],
                },
            };

            mockSheets.spreadsheets.values.get.mockResolvedValue(mockData);
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

            await syncTannleger();

            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            
            // Ola: 1.5, 20, 30
            expect(writtenData[0].imageConfig).toEqual({ scale: 1.5, positionX: 20, positionY: 30 });
            
            // Kari: Defaults (1.0, 50, 50)
            expect(writtenData[1].imageConfig).toEqual({ scale: 1.0, positionX: 50, positionY: 50 });
            
            // Per: Skala clamped (0.5), X/Y fallback (50) siden 150 og -10 er utenfor 0-100
            expect(writtenData[2].imageConfig.scale).toBe(0.5); // 0.1 blir clamped til 0.5
            expect(writtenData[2].imageConfig.positionX).toBe(50); // 150 er ugyldig -> default 50
            expect(writtenData[2].imageConfig.positionY).toBe(50); // -10 er ugyldig -> default 50
        });
    });

    describe('syncMarkdownCollection', () => {
        it('bør laste ned .md filer fra Drive', async () => {
            const mockFiles = {
                data: {
                    files: [
                        { id: 'file-1', name: 'tjeneste1.md', md5Checksum: 'different' },
                        { id: 'file-2', name: 'bilde.png' },
                    ],
                },
            };

            mockDrive.files.list.mockResolvedValue(mockFiles);
            mockDrive.files.get.mockResolvedValue({ data: { on: vi.fn() } });

            await syncMarkdownCollection({ name: 'test', folderId: '123', dest: '/tmp' });

            expect(mockDrive.files.get).toHaveBeenCalledTimes(1);
        });

        it('bør hoppe over .md filer som er uendret', async () => {
            const dummyHash = crypto.createHash('md5').update(Buffer.from('dummy')).digest('hex');
            const mockFiles = {
                data: {
                    files: [
                        { id: 'file-1', name: 'uendret.md', md5Checksum: dummyHash },
                    ],
                },
            };

            mockDrive.files.list.mockResolvedValue(mockFiles);
            fs.existsSync.mockImplementation((path) => path.includes('uendret.md'));

            await syncMarkdownCollection({ name: 'test', folderId: '123', dest: '/tmp' });

            expect(mockDrive.files.get).not.toHaveBeenCalled();
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('⏭️ Skip: test/uendret.md er uendret'))).toBe(true);
        });

        it('bør advare hvis ingen filer blir funnet', async () => {
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });
            await syncMarkdownCollection({ name: 'tom', folderId: '123', dest: '/tmp' });
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Ingen filer funnet'));
        });

        it('bør slette lokale filer som ikke finnes i Drive', async () => {
            mockDrive.files.list.mockResolvedValue({ data: { files: [{ id: '1', name: 'eksisterer.md' }] } });
            mockDrive.files.get.mockResolvedValue({ data: { on: vi.fn() } });
            fs.readdirSync.mockReturnValue(['eksisterer.md', 'skal-slettes.md', '.gitkeep']);
            
            await syncMarkdownCollection({ name: 'test', folderId: '123', dest: '/tmp' });

            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('skal-slettes.md'));
            expect(fs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining('.gitkeep'));
            // Use regex to avoid "eksisterer.md" matching something else if needed, 
            // but here it's "eksisterer.md" vs "skal-slettes.md" so it's fine.
            // Actually the previous error was "ubrukt.jpg" matching "brukt.jpg".
            expect(fs.unlinkSync).not.toHaveBeenCalledWith(expect.stringMatching(/[\/\\]eksisterer\.md$/));
        });
    });

    describe('syncForsideBilde', () => {
        it('bør advare hvis ingen foreldre-mappe finnes for regnearket', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: {} }); // No parents field

            await syncForsideBilde();

            expect(mockSheets.spreadsheets.values.get).not.toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Hopper over forsidebilde'));
        });

        it('bør hoppe over hvis forsideBilde ikke er konfigurert i Sheets', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({ data: { values: [['annet', 'verdi']] } });

            await syncForsideBilde();

            expect(mockDrive.files.list).not.toHaveBeenCalled();
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Ingen forsidebilde konfigurert'))).toBe(true);
        });

        it('bør laste ned bilde hvis det har endret seg', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } }); // parent lookup
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [['forsideBilde', 'nytt-bilde.jpg']] }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f1', name: 'nytt-bilde.jpg', md5Checksum: 'different-hash' }] }
            });
            mockDrive.files.get.mockResolvedValueOnce({ data: { on: vi.fn() } }); // download stream
            fs.existsSync.mockReturnValue(false);

            await syncForsideBilde();

            expect(mockDrive.files.list).toHaveBeenCalled();
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Laster ned forsidebilde'))).toBe(true);
        });

        it('bør hoppe over nedlasting hvis bildet er uendret', async () => {
            const dummyHash = crypto.createHash('md5').update(Buffer.from('dummy')).digest('hex');
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } }); // parent lookup
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [['forsideBilde', 'uendret.jpg']] }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f2', name: 'uendret.jpg', md5Checksum: dummyHash }] }
            });
            fs.existsSync.mockReturnValue(true);

            await syncForsideBilde();

            // Only the parent-folder lookup called files.get; the download was skipped
            expect(mockDrive.files.get).toHaveBeenCalledTimes(1);
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('forsidebilde er uendret'))).toBe(true);
        });

        it('bør kopiere bildet til public/ etter nedlasting', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [['forsideBilde', 'nytt-bilde.jpg']] }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f1', name: 'nytt-bilde.jpg', md5Checksum: 'different-hash' }] }
            });
            mockDrive.files.get.mockResolvedValueOnce({ data: { on: vi.fn() } });
            fs.existsSync.mockReturnValue(false);

            await syncForsideBilde();

            expect(fs.promises.copyFile).toHaveBeenCalledWith(
                expect.stringContaining('src/assets/hovedbilde.png'),
                expect.stringContaining('public/hovedbilde.png')
            );
        });

        it('bør kopiere bildet til public/ selv om det ikke er endret', async () => {
            const dummyHash = crypto.createHash('md5').update(Buffer.from('dummy')).digest('hex');
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [['forsideBilde', 'uendret.jpg']] }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f2', name: 'uendret.jpg', md5Checksum: dummyHash }] }
            });
            fs.existsSync.mockReturnValue(true);

            await syncForsideBilde();

            expect(fs.promises.copyFile).toHaveBeenCalledWith(
                expect.stringContaining('src/assets/hovedbilde.png'),
                expect.stringContaining('public/hovedbilde.png')
            );
        });

        it('bør advare hvis bilde ikke finnes i Drive', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } }); // parent lookup
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [['forsideBilde', 'mangler.jpg']] }
            });
            mockDrive.files.list.mockResolvedValueOnce({ data: { files: [] } });

            await syncForsideBilde();

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Forsidebilde ikke funnet'));
        });

        it('bør kaste feil hvis Sheets API feiler', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } }); // parent lookup
            mockSheets.spreadsheets.values.get.mockRejectedValueOnce(new Error('Sheets API-feil'));

            await expect(syncForsideBilde()).rejects.toThrow('Sheets API-feil');
        });
    });

    describe('runSync', () => {
        it('bør kjøre alle synkroniseringer suksessfullt', async () => {
            await runSync();
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Alt er synkronisert'))).toBe(true);
        });

        it('bør logge feil hvis en synkronisering feiler', async () => {
            mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('Fatal Error'));
            await expect(runSync()).rejects.toThrow('Fatal Error');
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Synkronisering feilet'), expect.any(String));
        });

        it('bør håndtere manglende miljøvariabler', async () => {
            const originalEnvValue = process.env.PUBLIC_GOOGLE_SHEET_ID;
            delete process.env.PUBLIC_GOOGLE_SHEET_ID;
            
            await runSync();

            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Manglende miljøvariabler'));
            
            process.env.PUBLIC_GOOGLE_SHEET_ID = originalEnvValue;
        });

        it('bør simulere Dependabot oppførsel ved manglende secrets', async () => {
            const originalEnvValue = process.env.PUBLIC_GOOGLE_SHEET_ID;
            delete process.env.PUBLIC_GOOGLE_SHEET_ID;
            process.env.GITHUB_ACTIONS = 'true';
            
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
            
            await runSync();

            expect(exitSpy).toHaveBeenCalledWith(0);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Dependabot-bygg'));
            
            exitSpy.mockRestore();
            process.env.PUBLIC_GOOGLE_SHEET_ID = originalEnvValue;
            delete process.env.GITHUB_ACTIONS;
        });

        it('bør avslutte med feilkode ved manglende variabler utenfor test/CI', async () => {
            const originalEnvValue = process.env.PUBLIC_GOOGLE_SHEET_ID;
            const originalNodeEnv = process.env.NODE_ENV;
            delete process.env.PUBLIC_GOOGLE_SHEET_ID;
            process.env.NODE_ENV = 'production';
            
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
            
            await runSync();

            expect(exitSpy).toHaveBeenCalledWith(1);
            
            exitSpy.mockRestore();
            process.env.PUBLIC_GOOGLE_SHEET_ID = originalEnvValue;
            process.env.NODE_ENV = originalNodeEnv;
        });

        it('bør avslutte med feilkode ved fatal feil utenfor test', async () => {
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('Fatal'));
            
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
            
            try {
                await runSync();
            } catch (e) {
                // Expected throw
            }

            expect(exitSpy).toHaveBeenCalledWith(1);
            
            exitSpy.mockRestore();
            process.env.NODE_ENV = originalNodeEnv;
        });
    });
});
