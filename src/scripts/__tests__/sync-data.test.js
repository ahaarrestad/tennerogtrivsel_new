import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { google } from 'googleapis';

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
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        createWriteStream: vi.fn().mockReturnValue({
            on: vi.fn((event, cb) => {
                if (event === 'finish') cb();
            }),
        }),
    },
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    createWriteStream: vi.fn().mockReturnValue({
        on: vi.fn((event, cb) => {
            if (event === 'finish') cb();
        }),
    }),
}));

vi.mock('stream/promises', () => ({
    pipeline: vi.fn().mockResolvedValue(undefined),
}));

// Importer etter mocks
const { syncTannleger, syncMarkdownCollection, runSync } = await import('../sync-data.js');

describe('sync-data.js', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
        process.env.GOOGLE_DRIVE_TJENESTER_FOLDER_ID = 'test-folder-id';
        process.env.GOOGLE_DRIVE_MELDINGER_FOLDER_ID = 'test-folder-id';
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.com';
        process.env.GOOGLE_PRIVATE_KEY = 'test-key';
        process.env.NODE_ENV = 'test';
        delete process.env.GITHUB_ACTIONS;
        
        // Mock console methods to keep test output clean
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        
        // Default mocks
        mockSheets.spreadsheets.values.get.mockResolvedValue({ data: { values: [] } });
        mockDrive.files.list.mockResolvedValue({ data: { files: [] } });
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
            mockDrive.files.list.mockResolvedValue({ data: { files: [{ id: 'file-id-123' }] } });
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

            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Feil ved nedlasting av bilde'), expect.any(String));
        });

        it('bør kaste feil hvis Sheets API feiler', async () => {
            mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('API Error'));
            await expect(syncTannleger()).rejects.toThrow('API Error');
        });
    });

    describe('syncMarkdownCollection', () => {
        it('bør laste ned .md filer fra Drive', async () => {
            const mockFiles = {
                data: {
                    files: [
                        { id: 'file-1', name: 'tjeneste1.md' },
                        { id: 'file-2', name: 'bilde.png' },
                    ],
                },
            };

            mockDrive.files.list.mockResolvedValue(mockFiles);
            mockDrive.files.get.mockResolvedValue({ data: { on: vi.fn() } });

            await syncMarkdownCollection({ name: 'test', folderId: '123', dest: '/tmp' });

            expect(mockDrive.files.get).toHaveBeenCalledTimes(1);
        });

        it('bør advare hvis ingen filer blir funnet', async () => {
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });
            await syncMarkdownCollection({ name: 'tom', folderId: '123', dest: '/tmp' });
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Ingen filer funnet'));
        });
    });

    describe('runSync', () => {
        it('bør kjøre alle synkroniseringer suksessfullt', async () => {
            await runSync();
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Alt er synkronisert'));
        });

        it('bør logge feil hvis en synkronisering feiler', async () => {
            mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('Fatal Error'));
            await expect(runSync()).rejects.toThrow('Fatal Error');
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Synkronisering feilet'), expect.any(String));
        });

        it('bør håndtere manglende miljøvariabler', async () => {
            const originalEnvValue = process.env.GOOGLE_SHEET_ID;
            delete process.env.GOOGLE_SHEET_ID;
            
            await runSync();

            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Manglende miljøvariabler'));
            
            process.env.GOOGLE_SHEET_ID = originalEnvValue;
        });

        it('bør simulere Dependabot oppførsel ved manglende secrets', async () => {
            const originalEnvValue = process.env.GOOGLE_SHEET_ID;
            delete process.env.GOOGLE_SHEET_ID;
            process.env.GITHUB_ACTIONS = 'true';
            
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
            
            await runSync();

            expect(exitSpy).toHaveBeenCalledWith(0);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Dependabot-bygg'));
            
            exitSpy.mockRestore();
            process.env.GOOGLE_SHEET_ID = originalEnvValue;
            delete process.env.GITHUB_ACTIONS;
        });

        it('bør avslutte med feilkode ved manglende variabler utenfor test/CI', async () => {
            const originalEnvValue = process.env.GOOGLE_SHEET_ID;
            const originalNodeEnv = process.env.NODE_ENV;
            delete process.env.GOOGLE_SHEET_ID;
            process.env.NODE_ENV = 'production';
            
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
            
            await runSync();

            expect(exitSpy).toHaveBeenCalledWith(1);
            
            exitSpy.mockRestore();
            process.env.GOOGLE_SHEET_ID = originalEnvValue;
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
