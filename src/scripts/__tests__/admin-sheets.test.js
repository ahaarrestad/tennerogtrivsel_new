// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSheets = {
    spreadsheets: {
        values: {
            get: vi.fn(),
            update: vi.fn(),
            append: vi.fn(),
        },
        get: vi.fn(),
        batchUpdate: vi.fn(),
    },
};
const mockDrive = {
    files: { get: vi.fn() },
};

vi.stubGlobal('gapi', {
    client: {
        sheets: mockSheets,
        drive: mockDrive,
    },
});

vi.mock('../image-config.js', () => ({
    parseImageConfig: vi.fn((s, x, y) => ({
        scale: s ?? 1, positionX: x ?? 50, positionY: y ?? 50
    })),
}));

const {
    getPrislisteRaw,
    addPrislisteRow,
    updatePrislisteRow,
    deletePrislisteRowPermanently,
    ensurePrislisteSheet,
} = await import('../admin-sheets.js');

const SHEET_ID = 'test-sheet-id';

describe('Prisliste CRUD', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // ensurePrislisteSheet needs spreadsheets.get to check if sheet exists
        mockSheets.spreadsheets.get.mockResolvedValue({
            result: { sheets: [{ properties: { title: 'Prisliste' } }] }
        });
    });

    describe('getPrislisteRaw', () => {
        it('should return parsed prisliste rows', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: {
                    values: [
                        ['Kategori', 'Behandling', 'Pris'],
                        ['Undersokelser', 'Vanlig undersokelse', 850],
                        ['Bleking', 'Hjemmebleking', 'Fra 2500,-'],
                    ]
                }
            });

            const result = await getPrislisteRaw(SHEET_ID);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                rowIndex: 2,
                kategori: 'Undersokelser',
                behandling: 'Vanlig undersokelse',
                pris: 850,
            });
            expect(result[1].pris).toBe('Fra 2500,-');
        });

        it('should return empty array when no data', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: null }
            });
            const result = await getPrislisteRaw(SHEET_ID);
            expect(result).toEqual([]);
        });

        it('should use UNFORMATTED_VALUE', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: [['H1','H2','H3']] }
            });
            await getPrislisteRaw(SHEET_ID);
            expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledWith(
                expect.objectContaining({
                    valueRenderOption: 'UNFORMATTED_VALUE',
                })
            );
        });
    });

    describe('addPrislisteRow', () => {
        it('should append a new row', async () => {
            mockSheets.spreadsheets.get.mockResolvedValue({
                result: { sheets: [{ properties: { title: 'Prisliste' } }] }
            });
            mockSheets.spreadsheets.values.append.mockResolvedValue({});

            await addPrislisteRow(SHEET_ID, {
                kategori: 'Bleking',
                behandling: 'Hjemmebleking',
                pris: 2500,
            });

            expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith(
                expect.objectContaining({
                    range: 'Prisliste!A:C',
                    resource: { values: [['Bleking', 'Hjemmebleking', 2500]] },
                })
            );
        });
    });

    describe('updatePrislisteRow', () => {
        it('should update existing row', async () => {
            mockSheets.spreadsheets.values.update.mockResolvedValue({});

            await updatePrislisteRow(SHEET_ID, 3, {
                kategori: 'Bleking',
                behandling: 'Hjemmebleking',
                pris: 3000,
            });

            expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    range: 'Prisliste!A3:C3',
                })
            );
        });
    });

    describe('deletePrislisteRowPermanently', () => {
        it('should delete the row', async () => {
            mockSheets.spreadsheets.get.mockResolvedValue({
                result: {
                    sheets: [{ properties: { title: 'Prisliste', sheetId: 42 } }]
                }
            });
            mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});

            await deletePrislisteRowPermanently(SHEET_ID, 5);

            expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    resource: {
                        requests: [{
                            deleteDimension: {
                                range: {
                                    sheetId: 42,
                                    dimension: 'ROWS',
                                    startIndex: 4,
                                    endIndex: 5,
                                }
                            }
                        }]
                    }
                })
            );
        });
    });
});
