import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import crypto from 'crypto';

// sharp-mock – hoisted så factory-funksjonen kan referere til den
const { mockSharp, mockSharpInstance } = vi.hoisted(() => {
    const inst = {
        metadata: vi.fn(),
        resize: vi.fn(),
        extract: vi.fn(),
        png: vi.fn(),
        toFile: vi.fn(),
    };
    // Gjør chain-kallene returnere this som standard
    inst.resize.mockReturnValue(inst);
    inst.extract.mockReturnValue(inst);
    inst.png.mockReturnValue(inst);
    return { mockSharp: vi.fn().mockReturnValue(inst), mockSharpInstance: inst };
});

vi.mock('sharp', () => ({ default: mockSharp }));

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

vi.mock('@googleapis/sheets', () => ({
    sheets: vi.fn(() => mockSheets),
}));
vi.mock('@googleapis/drive', () => ({
    drive: vi.fn(() => mockDrive),
}));
vi.mock('google-auth-library', () => ({
    GoogleAuth: vi.fn().mockImplementation(() => ({ authorize: vi.fn() })),
}));

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
}));

vi.mock('stream/promises', () => ({
    pipeline: vi.fn().mockResolvedValue(undefined),
}));

// Importer etter mocks
const { syncTannleger, syncMarkdownCollection, syncForsideBilde, syncGalleri, syncPrisliste, syncKontaktSkjema, runSync, cropToOG, escapeDriveQuery, assertSafePath } = await import('../sync-data.js');

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
        delete process.env.PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID;
        
        // Default mock behaviors
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(Buffer.from('dummy'));
        fs.readdirSync.mockReturnValue([]);

        // sharp-mocken må settes opp på nytt etter vi.resetAllMocks()
        mockSharpInstance.metadata.mockResolvedValue({ width: 2000, height: 1000 });
        mockSharpInstance.resize.mockReturnValue(mockSharpInstance);
        mockSharpInstance.extract.mockReturnValue(mockSharpInstance);
        mockSharpInstance.png.mockReturnValue(mockSharpInstance);
        mockSharpInstance.toFile.mockResolvedValue({});
        mockSharp.mockReturnValue(mockSharpInstance);

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

        it('bør håndtere at bilde mangler i Drive og nullstille image-felt', async () => {
            const mockData = {
                data: {
                    values: [['Ola', 'T', 'B', 'mangler.jpg', 'ja']],
                },
            };
            mockSheets.spreadsheets.values.get.mockResolvedValue(mockData);
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

            await syncTannleger();

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Bilde ikke funnet'));
            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData[0].image).toBe('');
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
            
            // Per: Skala ugyldig (0.1 < 1.0 → default 1.0), X/Y fallback (50) siden 150 og -10 er utenfor 0-100
            expect(writtenData[2].imageConfig.scale).toBe(1.0); // 0.1 er under min (1.0) → default
            expect(writtenData[2].imageConfig.positionX).toBe(50); // 150 er ugyldig -> default 50
            expect(writtenData[2].imageConfig.positionY).toBe(50); // -10 er ugyldig -> default 50
        });

        it('bør clampe scale til 3.0 når verdien er over maks', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                data: {
                    values: [
                        ['Anna', 'T', 'B', 'a.jpg', 'ja', '5.0', '50', '50'],
                        ['Bo', 'T', 'B', 'b.jpg', 'ja', '3.0', '50', '50'],
                        ['Cato', 'T', 'B', 'c.jpg', 'ja', '3.1', '50', '50'],
                    ],
                },
            });
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

            await syncTannleger();

            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData[0].imageConfig.scale).toBe(3.0); // 5.0 → clamped til 3.0
            expect(writtenData[1].imageConfig.scale).toBe(3.0); // 3.0 → eksakt maks, beholdes
            expect(writtenData[2].imageConfig.scale).toBe(3.0); // 3.1 → clamped til 3.0
        });

        it('bør logge advarsel ved path traversal i bildeFil', async () => {
            const mockData = {
                data: {
                    values: [['Ola', 'T', 'B', '../../../etc/passwd', 'ja']],
                },
            };
            mockSheets.spreadsheets.values.get.mockResolvedValue(mockData);
            mockDrive.files.list.mockResolvedValue({ data: { files: [{ id: '123', md5Checksum: 'abc' }] } });

            await syncTannleger();

            // Path traversal kastes inne i try/catch og logges som advarsel
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Path traversal'));
        });

        it('bør returnere tomt array når Sheets returnerer undefined values', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                data: {} // ingen values-felt
            });

            await syncTannleger();

            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData).toHaveLength(0);
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
            // Galleri-arket: ingen forsidebilde-rad
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({ data: { values: [] } });
            // Innstillinger fallback: ingen forsideBilde-nøkkel
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({ data: { values: [['annet', 'verdi']] } });

            await syncForsideBilde();

            expect(mockDrive.files.list).not.toHaveBeenCalled();
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Ingen forsidebilde konfigurert'))).toBe(true);
        });

        it('bør laste ned bilde hvis det har endret seg', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } }); // parent lookup
            // Galleri-ark: ingen forsidebilde-rad → fallback
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({ data: { values: [] } });
            // Innstillinger fallback
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
            // Galleri-ark: ingen forsidebilde-rad → fallback
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({ data: { values: [] } });
            // Innstillinger fallback
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
            expect(logs.some(l => l.includes('uendret.jpg er uendret'))).toBe(true);
        });

        it('bør generere beskjært OG-bilde til public/ etter nedlasting', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } });
            // Galleri-ark: ingen forsidebilde-rad → fallback
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({ data: { values: [] } });
            // Innstillinger fallback
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [
                    ['forsideBilde', 'nytt-bilde.jpg'],
                    ['forsideBildeScale', '1.5'],
                    ['forsideBildePosX', '60'],
                    ['forsideBildePosY', '40'],
                ]}
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f1', name: 'nytt-bilde.jpg', md5Checksum: 'different-hash' }] }
            });
            mockDrive.files.get.mockResolvedValueOnce({ data: { on: vi.fn() } });
            fs.existsSync.mockReturnValue(false);

            await syncForsideBilde();

            expect(mockSharp).toHaveBeenCalledWith(expect.stringContaining('src/assets/hovedbilde.png'));
            expect(mockSharpInstance.toFile).toHaveBeenCalledWith(expect.stringContaining('public/hovedbilde.png'));
        });

        it('bør generere OG-bilde selv om bildefilen er uendret', async () => {
            const dummyHash = crypto.createHash('md5').update(Buffer.from('dummy')).digest('hex');
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } });
            // Galleri-ark: ingen forsidebilde-rad → fallback
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({ data: { values: [] } });
            // Innstillinger fallback
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [['forsideBilde', 'uendret.jpg']] }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f2', name: 'uendret.jpg', md5Checksum: dummyHash }] }
            });
            fs.existsSync.mockReturnValue(true);

            await syncForsideBilde();

            expect(mockSharpInstance.toFile).toHaveBeenCalledWith(expect.stringContaining('public/hovedbilde.png'));
        });

        it('bør advare hvis bilde ikke finnes i Drive', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } }); // parent lookup
            // Galleri-ark: ingen forsidebilde-rad → fallback
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({ data: { values: [] } });
            // Innstillinger fallback
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [['forsideBilde', 'mangler.jpg']] }
            });
            mockDrive.files.list.mockResolvedValueOnce({ data: { files: [] } });

            await syncForsideBilde();

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Forsidebilde ikke funnet'));
        });

        it('bør kaste feil hvis galleri Sheets API feiler med uventet feil', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } }); // parent lookup
            // Galleri-ark: feiler med uventet feil → kastes videre
            mockSheets.spreadsheets.values.get.mockRejectedValueOnce(new Error('Galleri feil'));

            await expect(syncForsideBilde()).rejects.toThrow('Galleri feil');
        });

        it('bør lese forsidebilde fra galleri-arket når type=forsidebilde finnes', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } }); // parent lookup
            // Galleri-arket har en forsidebilde-rad
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        // Tittel, Bildefil, AltTekst, Aktiv, Rekkefølge, Skala, PosX, PosY, Type
                        ['Forside', 'hero.jpg', 'Hero', 'ja', '0', '1.5', '60', '40', 'forsidebilde'],
                        ['Venterom', 'venterom.jpg', 'Vent', 'ja', '1', '1', '50', '50', 'galleri']
                    ]
                }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f1', name: 'hero.jpg', md5Checksum: 'different-hash' }] }
            });
            mockDrive.files.get.mockResolvedValueOnce({ data: { on: vi.fn() } }); // download stream
            fs.existsSync.mockReturnValue(false);

            await syncForsideBilde();

            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Forsidebilde funnet i galleri-arket'))).toBe(true);
            expect(logs.some(l => l.includes('Laster ned forsidebilde'))).toBe(true);
        });

        it('bør falle tilbake til Innstillinger når galleri-ark ikke er tilgjengelig', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } }); // parent lookup
            // Galleri-arket kaster feil (finnes ikke)
            mockSheets.spreadsheets.values.get.mockRejectedValueOnce(new Error('Unable to parse range'));
            // Fallback til Innstillinger
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [['forsideBilde', 'innstilling.jpg']] }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f2', name: 'innstilling.jpg', md5Checksum: 'different-hash' }] }
            });
            mockDrive.files.get.mockResolvedValueOnce({ data: { on: vi.fn() } }); // download stream
            fs.existsSync.mockReturnValue(false);

            await syncForsideBilde();

            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Galleri-ark ikke tilgjengelig'))).toBe(true);
            expect(logs.some(l => l.includes('Laster ned forsidebilde'))).toBe(true);
        });

        it('bør håndtere galleri-rad med manglende kolonner (sparse row)', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } });
            // Galleri-arket har forsidebilde-rad med bare 2 kolonner (resten mangler)
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        // Bare Tittel og Bildefil — resten av kolonnene mangler helt
                        ['Forside', 'hero.jpg']
                    ]
                }
            });
            // Ingen forsidebilde funnet (row[8] er undefined) → fallback til Innstillinger
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [['forsideBilde', 'fra-innstillinger.jpg']] }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f1', name: 'fra-innstillinger.jpg', md5Checksum: 'hash' }] }
            });
            fs.existsSync.mockReturnValue(false);
            mockDrive.files.get.mockResolvedValueOnce({ data: { on: vi.fn() } });

            await syncForsideBilde();

            // Skal falle tilbake til Innstillinger fordi row[8] er undefined
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Laster ned forsidebilde'))).toBe(true);
        });

        it('bør håndtere galleri-forsidebilde med tom bildefil', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } });
            // Galleri-arket har forsidebilde-rad men bildefil er tom
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        // Tittel, Bildefil(tom), AltTekst, Aktiv, Rekkefølge, Skala, PosX, PosY, Type
                        ['Forside', '', 'Hero', 'ja', '0', '', '', '', 'forsidebilde']
                    ]
                }
            });

            await syncForsideBilde();

            // bildeFil er '' → hopper over
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Ingen forsidebilde konfigurert'))).toBe(true);
        });

        it('bør håndtere at Innstillinger-arket returnerer undefined values', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } });
            // Galleri-ark: ingen forsidebilde-rad
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({ data: { values: [] } });
            // Innstillinger fallback: undefined values
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({ data: {} });

            await syncForsideBilde();

            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Ingen forsidebilde konfigurert'))).toBe(true);
        });

        it('bør bruke fallback-verdier når galleri-forsidebilde har tomme felter', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } });
            // Galleri-arket har forsidebilde med tomme scale/posX/posY
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        // Tittel, Bildefil, AltTekst, Aktiv, Rekkefølge, Skala, PosX, PosY, Type
                        ['Forside', 'hero.jpg', 'Hero', 'ja', '0', '', '', '', 'forsidebilde']
                    ]
                }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f1', name: 'hero.jpg', md5Checksum: 'hash' }] }
            });
            fs.existsSync.mockReturnValue(false);
            mockDrive.files.get.mockResolvedValueOnce({ data: { on: vi.fn() } });

            await syncForsideBilde();

            // Verifiser at OG-bilde genereres med fallback-verdier (scale=1, posX=50, posY=50)
            expect(mockSharpInstance.resize).toHaveBeenCalled();
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Forsidebilde funnet i galleri-arket'))).toBe(true);
        });

        it('bør ignorere galleri-rad der type=forsidebilde men aktiv=nei', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } }); // parent lookup
            // Galleri har forsidebilde-rad men den er inaktiv
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        ['Forside', 'hero.jpg', 'Hero', 'nei', '0', '1', '50', '50', 'forsidebilde']
                    ]
                }
            });
            // Fallback til Innstillinger – ingen forsideBilde-nøkkel
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [['siteTitle', 'Tenner og Trivsel']] }
            });

            await syncForsideBilde();

            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Ingen forsidebilde konfigurert'))).toBe(true);
        });

        it('bør bruke bilderFolderId direkte når den er satt (skip drive.files.get)', async () => {
            process.env.PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID = 'bilder-folder-id';
            // Galleri-ark med forsidebilde
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        ['Forside', 'hero.jpg', 'Hero', 'ja', '0', '1', '50', '50', 'forsidebilde']
                    ]
                }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f1', name: 'hero.jpg', md5Checksum: 'different-hash' }] }
            });
            mockDrive.files.get.mockResolvedValueOnce({ data: { on: vi.fn() } }); // download stream
            fs.existsSync.mockReturnValue(false);

            await syncForsideBilde();

            // drive.files.get for parent-folder lookup should NOT have been called
            // Only the download stream call should exist
            const parentLookupCalls = mockDrive.files.get.mock.calls.filter(
                c => c[0]?.fields === 'parents'
            );
            expect(parentLookupCalls).toHaveLength(0);
            // Bilder-mappe-ID-en skal brukes i files.list
            expect(mockDrive.files.list).toHaveBeenCalledWith(
                expect.objectContaining({ q: expect.stringContaining('bilder-folder-id') })
            );
        });

        it('bør falle tilbake til drive.files.get for foreldre-mappe når bilderFolderId ikke er satt', async () => {
            delete process.env.PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID;
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-folder-id'] } });
            // Galleri-ark med forsidebilde
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        ['Forside', 'hero.jpg', 'Hero', 'ja', '0', '1', '50', '50', 'forsidebilde']
                    ]
                }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f1', name: 'hero.jpg', md5Checksum: 'different-hash' }] }
            });
            mockDrive.files.get.mockResolvedValueOnce({ data: { on: vi.fn() } }); // download stream
            fs.existsSync.mockReturnValue(false);

            await syncForsideBilde();

            // drive.files.get should have been called for parent-folder lookup
            const parentLookupCalls = mockDrive.files.get.mock.calls.filter(
                c => c[0]?.fields === 'parents'
            );
            expect(parentLookupCalls).toHaveLength(1);
        });
    });

    describe('cropToOG', () => {
        it('bør lage et 1200×630 bilde sentrert på fokuspunktet', async () => {
            // 2000×1000 bilde, scale=1, posX=50, posY=50 (standard sentrum)
            await cropToOG('/src/bilde.png', '/public/bilde.png', 1, 50, 50);

            // cover-scale: max(1200/2000, 630/1000) = max(0.6, 0.63) = 0.63
            // totalScale = 0.63 * 1 = 0.63 → scaledW=1260, scaledH=630
            expect(mockSharp).toHaveBeenCalledWith('/src/bilde.png');
            expect(mockSharpInstance.resize).toHaveBeenCalledWith(1260, 630, { fit: 'fill' });
            expect(mockSharpInstance.extract).toHaveBeenCalledWith({ left: 30, top: 0, width: 1200, height: 630 });
            expect(mockSharpInstance.toFile).toHaveBeenCalledWith('/public/bilde.png');
        });

        it('bør bruke brukerzoom på toppen av cover-skalaen', async () => {
            // 2000×1000, scale=2 → totalScale=0.63*2=1.26 → scaledW=2520, scaledH=1260
            await cropToOG('/src/bilde.png', '/public/bilde.png', 2, 50, 50);

            expect(mockSharpInstance.resize).toHaveBeenCalledWith(2520, 1260, { fit: 'fill' });
            // focusX=1260, focusY=630 → left=660, top=315
            expect(mockSharpInstance.extract).toHaveBeenCalledWith({ left: 660, top: 315, width: 1200, height: 630 });
        });

        it('bør klemme utsnitt til bildegrensen hvis fokuspunkt er nær kanten', async () => {
            // posX=0, posY=0 → fokus i øvre venstre hjørne → left/top skal bli 0
            await cropToOG('/src/bilde.png', '/public/bilde.png', 1, 0, 0);

            const extractCall = mockSharpInstance.extract.mock.calls[0][0];
            expect(extractCall.left).toBe(0);
            expect(extractCall.top).toBe(0);
        });
    });

    describe('syncGalleri', () => {
        it('bør advare hvis ingen foreldre-mappe finnes for regnearket', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: {} });

            await syncGalleri();

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Hopper over galleri'));
        });

        it('bør skrive tom galleri.json hvis fane mangler (400 error)', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            const sheetErr = new Error('Unable to parse range');
            sheetErr.code = 400;
            mockSheets.spreadsheets.values.get.mockRejectedValueOnce(sheetErr);

            await syncGalleri();

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('galleri.json'),
                '[]'
            );
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('finnes ikke ennå'))).toBe(true);
        });

        it('bør skrive tom galleri.json ved parse range error', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            const sheetErr = new Error('Unable to parse range: galleri!A2:H');
            mockSheets.spreadsheets.values.get.mockRejectedValueOnce(sheetErr);

            await syncGalleri();

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('galleri.json'),
                '[]'
            );
            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Tom galleri.json skrevet'))).toBe(true);
        });

        it('bør kaste videre uventede API-feil', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockRejectedValueOnce(new Error('Server Error'));

            await expect(syncGalleri()).rejects.toThrow('Server Error');
        });

        it('bør hente galleribilder og skrive JSON-fil', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        ['Venterom', 'venterom.jpg', 'Venterommet', 'ja', '1', '1.2', '30', '40'],
                        ['Behandling', 'behandling.jpg', 'Behandlingsrom', 'nei', '2', '', '', ''],
                        ['Fasade', 'fasade.jpg', 'Bygningen', 'ja', '3', '0.1', '150', '-10'],
                    ]
                }
            });
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

            await syncGalleri();

            expect(fs.writeFileSync).toHaveBeenCalled();
            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            // Kun aktive rader
            expect(writtenData).toHaveLength(2);
            expect(writtenData[0].title).toBe('Venterom');
            expect(writtenData[0].imageConfig).toEqual({ scale: 1.2, positionX: 30, positionY: 40 });
            // Fasade: ugyldig scale (0.1 < 1.0 → default 1.0), posX (150 → default 50), posY (-10 → default 50)
            expect(writtenData[1].title).toBe('Fasade');
            expect(writtenData[1].imageConfig.scale).toBe(1.0);
            expect(writtenData[1].imageConfig.positionX).toBe(50);
            expect(writtenData[1].imageConfig.positionY).toBe(50);
        });

        it('bør slette bilder som ikke lenger er i bruk', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [['Venterom', 'brukt.jpg', 'Alt', 'ja', '1', '', '', '']]
                }
            });
            // brukt.jpg finnes i Drive, ubrukt.jpg gjør det ikke
            mockDrive.files.list.mockResolvedValue({ data: { files: [{ id: 'f1', name: 'brukt.jpg', md5Checksum: 'abc' }] } });
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['brukt.jpg', 'ubrukt.jpg', '.gitkeep']);

            await syncGalleri();

            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringMatching(/[\/\\]ubrukt\.jpg$/));
            expect(fs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining('.gitkeep'));
            expect(fs.unlinkSync).not.toHaveBeenCalledWith(expect.stringMatching(/[\/\\]brukt\.jpg$/));
        });

        it('bør håndtere tom gallerifane uten å krasje', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({ data: { values: [] } });

            await syncGalleri();

            expect(fs.writeFileSync).toHaveBeenCalled();
            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData).toHaveLength(0);
        });

        it('bør laste ned bilde som har endret seg', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [['Bilde', 'ny.jpg', 'Alt', 'ja', '1', '', '', '']]
                }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f1', name: 'ny.jpg', md5Checksum: 'different-hash' }] }
            });
            mockDrive.files.get.mockResolvedValueOnce({ data: { on: vi.fn() } });
            fs.existsSync.mockReturnValue(false);

            await syncGalleri();

            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Laster ned galleribilde: ny.jpg'))).toBe(true);
        });

        it('bør advare og nullstille image-felt hvis galleribilde ikke finnes i Drive', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [['Bilde', 'mangler.jpg', 'Alt', 'ja', '1', '', '', '']]
                }
            });
            mockDrive.files.list.mockResolvedValueOnce({ data: { files: [] } });

            await syncGalleri();

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Galleribilde ikke funnet'));
            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData[0].image).toBe('');
        });

        it('bør inkludere forsidebilde-rad i galleri-output med type-felt', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        // Tittel, Bildefil, AltTekst, Aktiv, Rekkefølge, Skala, PosX, PosY, Type
                        ['Forside', 'hero.jpg', 'Hero', 'ja', '0', '1.5', '30', '20', 'forsidebilde'],
                        ['Venterom', 'venterom.jpg', 'Vent', 'ja', '1', '1', '50', '50', 'galleri'],
                        ['Fasade', 'fasade.jpg', 'Fas', 'ja', '2', '1', '50', '50', '']
                    ]
                }
            });
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

            await syncGalleri();

            expect(fs.writeFileSync).toHaveBeenCalled();
            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData).toHaveLength(3);
            expect(writtenData[0].title).toBe('Forside');
            expect(writtenData[0].type).toBe('forsidebilde');
            expect(writtenData[0].imageConfig).toEqual({ scale: 1.5, positionX: 30, positionY: 20 });
            expect(writtenData[1].type).toBe('galleri');
            expect(writtenData[2].type).toBe('galleri');
        });

        it('bør ikke laste ned bilde for forsidebilde-rader (håndteres av syncForsideBilde)', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        ['Forside', 'hero.jpg', 'Hero', 'ja', '0', '1', '50', '50', 'forsidebilde'],
                    ]
                }
            });

            await syncGalleri();

            // findFileMetadataByName skal ikke kalles for forsidebilde
            expect(mockDrive.files.list).not.toHaveBeenCalled();
        });

        it('bør clampe scale til 3.0 når galleri-verdien er over maks', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        ['Over', 'over.jpg', 'Alt', 'ja', '1', '4.5', '50', '50'],
                        ['Maks', 'maks.jpg', 'Alt', 'ja', '2', '3.0', '50', '50'],
                    ]
                }
            });
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

            await syncGalleri();

            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData[0].imageConfig.scale).toBe(3.0); // 4.5 → clamped
            expect(writtenData[1].imageConfig.scale).toBe(3.0); // eksakt maks
        });

        it('bør håndtere feil ved nedlasting av galleribilde', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [['Bilde', 'feil.jpg', 'Alt', 'ja', '1', '', '', '']]
                }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f1', name: 'feil.jpg', md5Checksum: 'abc' }] }
            });
            fs.existsSync.mockReturnValue(false);
            // Simuler feil ved nedlasting (drive.files.get for stream)
            mockDrive.files.get.mockRejectedValueOnce(new Error('Download failed'));

            await syncGalleri();

            // Bør advare, ikke krasje
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Feil ved behandling av galleribilde'));
        });

        it('bør hoppe over nedlasting av galleribilde som er uendret', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [['Bilde', 'cached.jpg', 'Alt', 'ja', '1', '', '', '']]
                }
            });
            mockDrive.files.list.mockResolvedValueOnce({
                data: { files: [{ id: 'f1', name: 'cached.jpg', md5Checksum: 'same-hash' }] }
            });
            fs.existsSync.mockReturnValue(true);
            // Mock crypto for matching hash
            const hashMock = { update: vi.fn().mockReturnThis(), digest: vi.fn().mockReturnValue('same-hash') };
            vi.spyOn(crypto, 'createHash').mockReturnValue(hashMock);

            await syncGalleri();

            const logs = logSpy.mock.calls.map(c => c[0]);
            expect(logs.some(l => l.includes('Skip') && l.includes('cached.jpg'))).toBe(true);
        });

        it('bør håndtere at galleri-arket returnerer undefined values', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {} // ingen values-felt
            });

            await syncGalleri();

            expect(fs.writeFileSync).toHaveBeenCalled();
            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData).toHaveLength(0);
        });

        it('bør gi defaults for rader med tomme galleri-felter', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        // Alle felter tomme bortsett fra Aktiv
                        ['', '', '', 'ja', '', '', '', '']
                    ]
                }
            });
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

            await syncGalleri();

            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData[0].title).toBe('');
            expect(writtenData[0].image).toBe('');
            expect(writtenData[0].altText).toBe('');
            expect(writtenData[0].order).toBe(99); // default
            expect(writtenData[0].imageConfig).toEqual({ scale: 1.0, positionX: 50, positionY: 50 });
            expect(writtenData[0].id).toBe('galleri'); // fallback id
        });

        it('bør behandle rader uten type-kolonne som galleri', async () => {
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        // Gammel format uten Type-kolonne (8 kolonner)
                        ['Bilde1', 'b1.jpg', 'Alt1', 'ja', '1', '1', '50', '50'],
                        ['Bilde2', 'b2.jpg', 'Alt2', 'ja', '2', '1', '50', '50']
                    ]
                }
            });
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

            await syncGalleri();

            const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
            expect(writtenData).toHaveLength(2);
        });

        it('bør bruke bilderFolderId direkte når den er satt (skip drive.files.get)', async () => {
            process.env.PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID = 'bilder-folder-id';
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: {
                    values: [
                        ['Bilde1', 'b1.jpg', 'Alt1', 'ja', '1', '1', '50', '50', 'galleri']
                    ]
                }
            });
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

            await syncGalleri();

            // drive.files.get for parent-folder lookup should NOT have been called
            const parentLookupCalls = mockDrive.files.get.mock.calls.filter(
                c => c[0]?.fields === 'parents'
            );
            expect(parentLookupCalls).toHaveLength(0);
        });

        it('bør falle tilbake til drive.files.get for foreldre-mappe når bilderFolderId ikke er satt', async () => {
            delete process.env.PUBLIC_GOOGLE_DRIVE_BILDER_FOLDER_ID;
            mockDrive.files.get.mockResolvedValueOnce({ data: { parents: ['parent-id'] } });
            mockSheets.spreadsheets.values.get.mockResolvedValueOnce({
                data: { values: [['Bilde1', 'b1.jpg', 'Alt1', 'ja', '1', '1', '50', '50', 'galleri']] }
            });
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

            await syncGalleri();

            const parentLookupCalls = mockDrive.files.get.mock.calls.filter(
                c => c[0]?.fields === 'parents'
            );
            expect(parentLookupCalls).toHaveLength(1);
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

    describe('syncPrisliste', () => {
        const emptyKategoriRekkefølge = { data: { values: [] } };

        beforeEach(() => {
            vi.clearAllMocks();
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue([]);
        });

        it('should sync prisliste from Sheets to JSON with sistOppdatert', async () => {
            mockSheets.spreadsheets.values.get
                .mockResolvedValueOnce({
                    data: {
                        values: [
                            ['Undersokelser', 'Vanlig undersokelse', 850, '2026-03-01T10:00:00.000Z', 2],
                            ['Undersokelser', 'Rontgen', 350, '2026-03-05T10:00:00.000Z', 1],
                            ['Bleking', 'Hjemmebleking', 2500],
                        ]
                    }
                })
                .mockResolvedValueOnce({ data: { values: [['Undersokelser', 1], ['Bleking', 2]] } });

            await syncPrisliste();

            expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledWith(
                expect.objectContaining({
                    range: 'Prisliste!A2:E',
                    valueRenderOption: 'UNFORMATTED_VALUE',
                })
            );

            const writeCall = fs.writeFileSync.mock.calls.find(
                c => c[0].includes('prisliste.json')
            );
            expect(writeCall).toBeTruthy();
            const written = JSON.parse(writeCall[1]);
            expect(written.items).toHaveLength(3);
            expect(written.items[0]).toEqual({
                kategori: 'Undersokelser',
                behandling: 'Vanlig undersokelse',
                pris: 850,
                sistOppdatert: '2026-03-01T10:00:00.000Z',
                order: 2,
            });
            expect(written.items[1].order).toBe(1);
            expect(written.sistOppdatert).toBe('2026-03-05T10:00:00.000Z');
            expect(written.kategoriOrder).toEqual([
                { kategori: 'Undersokelser', order: 1 },
                { kategori: 'Bleking', order: 2 },
            ]);
        });

        it('should default order to 0 when column E is missing or invalid', async () => {
            mockSheets.spreadsheets.values.get
                .mockResolvedValueOnce({
                    data: {
                        values: [
                            ['Test', 'Behandling A', 500, '', undefined],
                            ['Test', 'Behandling B', 600],
                        ]
                    }
                })
                .mockResolvedValueOnce(emptyKategoriRekkefølge);

            await syncPrisliste();

            const writeCall = fs.writeFileSync.mock.calls.find(
                c => c[0].includes('prisliste.json')
            );
            const written = JSON.parse(writeCall[1]);
            expect(written.items[0].order).toBe(0);
            expect(written.items[1].order).toBe(0);
        });

        it('should handle empty Prisliste sheet', async () => {
            mockSheets.spreadsheets.values.get
                .mockResolvedValueOnce({ data: { values: [] } })
                .mockResolvedValueOnce(emptyKategoriRekkefølge);

            await syncPrisliste();

            const writeCall = fs.writeFileSync.mock.calls.find(
                c => c[0].includes('prisliste.json')
            );
            expect(writeCall).toBeTruthy();
            const written = JSON.parse(writeCall[1]);
            expect(written).toEqual({ sistOppdatert: '', kategoriOrder: [], items: [] });
        });

        it('should handle missing Prisliste sheet gracefully', async () => {
            mockSheets.spreadsheets.values.get.mockRejectedValue({
                code: 400,
                message: 'Unable to parse range: Prisliste!A2:E'
            });

            await syncPrisliste();

            const writeCall = fs.writeFileSync.mock.calls.find(
                c => c[0].includes('prisliste.json')
            );
            expect(writeCall).toBeTruthy();
            const written = JSON.parse(writeCall[1]);
            expect(written).toEqual([]);
        });

        it('should preserve string prices like "Fra 500,-"', async () => {
            mockSheets.spreadsheets.values.get
                .mockResolvedValueOnce({
                    data: {
                        values: [
                            ['Bleking', 'Hjemmebleking', 'Fra 2500,-'],
                        ]
                    }
                })
                .mockResolvedValueOnce(emptyKategoriRekkefølge);

            await syncPrisliste();

            const writeCall = fs.writeFileSync.mock.calls.find(
                c => c[0].includes('prisliste.json')
            );
            const written = JSON.parse(writeCall[1]);
            expect(written.items[0].pris).toBe('Fra 2500,-');
        });

        it('should handle rows without sistOppdatert column', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                data: {
                    values: [
                        ['Test', 'Behandling A', 500],
                    ]
                }
            });

            await syncPrisliste();

            const writeCall = fs.writeFileSync.mock.calls.find(
                c => c[0].includes('prisliste.json')
            );
            const written = JSON.parse(writeCall[1]);
            expect(written.items[0].sistOppdatert).toBe('');
            expect(written.sistOppdatert).toBe('');
        });
    });

    describe('syncKontaktSkjema', () => {
        let writtenData;
        const SHEET_ID = 'test-sheet-id';

        beforeEach(() => {
            writtenData = null;
            process.env.PUBLIC_GOOGLE_SHEET_ID = SHEET_ID;
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com';
            process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----';
            vi.mocked(fs.writeFileSync).mockImplementation((_p, data) => { writtenData = JSON.parse(data); });
        });

        it('skriver korrekt JSON med aktiv=true og tema-liste', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                data: {
                    values: [
                        ['Nøkkel', 'Verdi'],
                        ['aktiv', 'ja'],
                        ['tittel', 'Ta kontakt'],
                        ['tekst', 'Vi svarer raskt.'],
                        ['kontaktEpost', 'test@example.com'],
                        ['tema', 'Timebooking'],
                        ['tema', 'Priser'],
                    ]
                }
            });
            const result = await syncKontaktSkjema();
            expect(writtenData).toEqual({
                aktiv: true,
                tittel: 'Ta kontakt',
                tekst: 'Vi svarer raskt.',
                tema: ['Timebooking', 'Priser'],
            });
            expect(writtenData.kontaktEpost).toBeUndefined();
            expect(result.kontaktEpost).toBe('test@example.com');
        });

        it('skriver aktiv=false når verdien er "nei"', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                data: { values: [['Nøkkel', 'Verdi'], ['aktiv', 'nei']] }
            });
            await syncKontaktSkjema();
            expect(writtenData.aktiv).toBe(false);
        });

        it('skriver tom standardfil og returnerer null-epost når arket ikke finnes', async () => {
            mockSheets.spreadsheets.values.get.mockRejectedValue(
                Object.assign(new Error('Unable to parse range'), { code: 400 })
            );
            const result = await syncKontaktSkjema();
            expect(writtenData).toEqual({ aktiv: false, tittel: '', tekst: '', tema: [] });
            expect(result.kontaktEpost).toBeNull();
        });

        it('filtrerer bort tomme tema-verdier', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                data: {
                    values: [
                        ['Nøkkel', 'Verdi'],
                        ['aktiv', 'ja'],
                        ['tema', 'Timebooking'],
                        ['tema', ''],
                        ['tema', 'Priser'],
                    ]
                }
            });
            await syncKontaktSkjema();
            expect(writtenData.tema).toEqual(['Timebooking', 'Priser']);
        });
    });

    describe('escapeDriveQuery', () => {
        it('skal escape enkle anførselstegn', () => {
            expect(escapeDriveQuery("fil'navn")).toBe("fil\\'navn");
        });

        it('skal escape backslash', () => {
            expect(escapeDriveQuery('fil\\navn')).toBe('fil\\\\navn');
        });

        it('skal escape begge i riktig rekkefølge', () => {
            expect(escapeDriveQuery("a\\'b")).toBe("a\\\\\\'b");
        });

        it('skal returnere uendret streng uten spesialtegn', () => {
            expect(escapeDriveQuery('normal')).toBe('normal');
        });

        it('skal konvertere tall til streng', () => {
            expect(escapeDriveQuery(42)).toBe('42');
        });
    });

    describe('assertSafePath', () => {
        it('skal akseptere fil innenfor basemappe', () => {
            expect(() => assertSafePath('/base/dir/file.txt', '/base/dir')).not.toThrow();
        });

        it('skal kaste ved path traversal med ..', () => {
            expect(() => assertSafePath('/base/dir/../etc/passwd', '/base/dir')).toThrow('Path traversal');
        });

        it('skal kaste ved absolutt sti utenfor base', () => {
            expect(() => assertSafePath('/etc/passwd', '/base/dir')).toThrow('Path traversal');
        });

        it('skal kaste ved dobbel path traversal', () => {
            expect(() => assertSafePath('/base/dir/../../etc/shadow', '/base/dir')).toThrow('Path traversal');
        });

        it('skal akseptere fil i undermapper', () => {
            expect(() => assertSafePath('/base/dir/sub/file.txt', '/base/dir')).not.toThrow();
        });
    });
});
