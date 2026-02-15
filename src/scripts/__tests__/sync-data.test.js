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
const { syncTannleger, syncMarkdownCollection } = await import('../sync-data.js');

describe('sync-data.js', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
        process.env.GOOGLE_DRIVE_TJENESTER_FOLDER_ID = 'test-folder-id';
    });

    it('syncTannleger bør hente data fra Google Sheets og skrive til fil', async () => {
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
        
        mockDrive.files.list.mockResolvedValue({
            data: {
                files: [{ id: 'file-id-123' }],
            },
        });
        
        mockDrive.files.get.mockResolvedValue({
            data: {
                on: vi.fn(),
            }
        });

        await syncTannleger();

        expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledWith(expect.objectContaining({
            spreadsheetId: 'test-sheet-id',
        }));

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        
        expect(writtenData).toHaveLength(2);
        expect(writtenData[0].name).toBe('Ola Nordmann');
    });

    it('syncMarkdownCollection bør laste ned .md filer fra Drive', async () => {
        const mockFiles = {
            data: {
                files: [
                    { id: 'file-1', name: 'tjeneste1.md' },
                    { id: 'file-2', name: 'bilde.png' }, // Skal ignoreres
                    { id: 'file-3', name: 'tjeneste2.md' },
                ],
            },
        };

        mockDrive.files.list.mockResolvedValue(mockFiles);
        mockDrive.files.get.mockResolvedValue({
            data: {
                on: vi.fn(),
            }
        });

        const collection = {
            name: 'tjenester',
            folderId: 'folder-123',
            dest: '/tmp/tjenester'
        };

        await syncMarkdownCollection(collection);

        // Sjekk at den listet filer i riktig mappe
        expect(mockDrive.files.list).toHaveBeenCalledWith(expect.objectContaining({
            q: "'folder-123' in parents and trashed = false"
        }));

        // Sjekk at den lastet ned de to .md filene
        expect(mockDrive.files.get).toHaveBeenCalledTimes(2);
        expect(mockDrive.files.get).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'file-1' }), expect.anything());
        expect(mockDrive.files.get).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'file-3' }), expect.anything());
    });
});
