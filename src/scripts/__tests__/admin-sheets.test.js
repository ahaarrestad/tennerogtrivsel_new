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
        it('should return parsed prisliste rows with order field', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: {
                    values: [
                        ['Kategori', 'Behandling', 'Pris', 'SistOppdatert', 'Rekkefølge'],
                        ['Undersokelser', 'Vanlig undersokelse', 850, '2026-01-01T00:00:00.000Z', 1],
                        ['Bleking', 'Hjemmebleking', 'Fra 2500,-', '2026-01-02T00:00:00.000Z', 2],
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
                sistOppdatert: '2026-01-01T00:00:00.000Z',
                order: 1,
            });
            expect(result[1].pris).toBe('Fra 2500,-');
            expect(result[1].order).toBe(2);
        });

        it('should fall back to 0 for order when column E is missing', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: {
                    values: [
                        ['Kategori', 'Behandling', 'Pris', 'SistOppdatert'],
                        ['Undersokelser', 'Vanlig undersokelse', 850],
                    ]
                }
            });

            const result = await getPrislisteRaw(SHEET_ID);
            expect(result[0].order).toBe(0);
        });

        it('should fall back to 0 for order when column E is not a number', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: {
                    values: [
                        ['Kategori', 'Behandling', 'Pris', 'SistOppdatert', 'Rekkefølge'],
                        ['Undersokelser', 'Vanlig undersokelse', 850, '', 'ugyldig'],
                    ]
                }
            });

            const result = await getPrislisteRaw(SHEET_ID);
            expect(result[0].order).toBe(0);
        });

        it('should return empty array when no data', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: null }
            });
            const result = await getPrislisteRaw(SHEET_ID);
            expect(result).toEqual([]);
        });

        it('should return empty array when only header row', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: [['Kategori', 'Behandling', 'Pris', 'SistOppdatert', 'Rekkefølge']] }
            });
            const result = await getPrislisteRaw(SHEET_ID);
            expect(result).toEqual([]);
        });

        it('should use UNFORMATTED_VALUE and range A:E', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: { values: [['H1','H2','H3','H4','H5']] }
            });
            await getPrislisteRaw(SHEET_ID);
            expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledWith(
                expect.objectContaining({
                    range: 'Prisliste!A:E',
                    valueRenderOption: 'UNFORMATTED_VALUE',
                })
            );
        });

        it('should throw when sheets API fails', async () => {
            mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('API error'));
            await expect(getPrislisteRaw(SHEET_ID)).rejects.toThrow('API error');
        });
    });

    describe('addPrislisteRow', () => {
        it('should append a new row with order', async () => {
            mockSheets.spreadsheets.get.mockResolvedValue({
                result: { sheets: [{ properties: { title: 'Prisliste' } }] }
            });
            mockSheets.spreadsheets.values.append.mockResolvedValue({});

            await addPrislisteRow(SHEET_ID, {
                kategori: 'Bleking',
                behandling: 'Hjemmebleking',
                pris: 2500,
                order: 3,
            });

            expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith(
                expect.objectContaining({
                    resource: { values: [['Bleking', 'Hjemmebleking', 2500, expect.any(String), 3]] },
                })
            );
        });

        it('should default order to 0 when not provided', async () => {
            mockSheets.spreadsheets.values.append.mockResolvedValue({});

            await addPrislisteRow(SHEET_ID, {
                kategori: 'Bleking',
                behandling: 'Hjemmebleking',
                pris: 2500,
            });

            expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith(
                expect.objectContaining({
                    resource: { values: [['Bleking', 'Hjemmebleking', 2500, expect.any(String), 0]] },
                })
            );
        });

        it('should default behandling to "Ny behandling" when not provided', async () => {
            mockSheets.spreadsheets.values.append.mockResolvedValue({});

            await addPrislisteRow(SHEET_ID, { kategori: 'Test', pris: 100 });

            expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith(
                expect.objectContaining({
                    resource: { values: [['Test', 'Ny behandling', 100, expect.any(String), 0]] },
                })
            );
        });

        it('should throw when append fails', async () => {
            mockSheets.spreadsheets.values.append.mockRejectedValue(new Error('Network error'));
            await expect(addPrislisteRow(SHEET_ID, { kategori: 'X' })).rejects.toThrow('Network error');
        });
    });

    describe('updatePrislisteRow', () => {
        it('should update existing row with 5 columns (A:E)', async () => {
            mockSheets.spreadsheets.values.update.mockResolvedValue({});

            await updatePrislisteRow(SHEET_ID, 3, {
                kategori: 'Bleking',
                behandling: 'Hjemmebleking',
                pris: 3000,
                order: 5,
            });

            expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    range: 'Prisliste!A3:E3',
                })
            );
        });

        it('should include order in the values written', async () => {
            mockSheets.spreadsheets.values.update.mockResolvedValue({});

            await updatePrislisteRow(SHEET_ID, 3, {
                kategori: 'Bleking',
                behandling: 'Hjemmebleking',
                pris: 3000,
                order: 7,
            });

            const call = mockSheets.spreadsheets.values.update.mock.calls[0][0];
            const values = call.resource.values[0];
            expect(values[4]).toBe(7);
        });

        it('should default order to 0 when not provided', async () => {
            mockSheets.spreadsheets.values.update.mockResolvedValue({});

            await updatePrislisteRow(SHEET_ID, 3, {
                kategori: 'Bleking',
                behandling: 'Hjemmebleking',
                pris: 3000,
            });

            const call = mockSheets.spreadsheets.values.update.mock.calls[0][0];
            const values = call.resource.values[0];
            expect(values[4]).toBe(0);
        });
    });

    describe('ensurePrislisteSheet', () => {
        it('should create sheet with 5-column header when sheet does not exist', async () => {
            mockSheets.spreadsheets.get.mockResolvedValue({
                result: { sheets: [] }
            });
            mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});
            mockSheets.spreadsheets.values.update.mockResolvedValue({});

            await ensurePrislisteSheet(SHEET_ID);

            expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    range: 'Prisliste!A1:E1',
                    resource: { values: [['Kategori', 'Behandling', 'Pris', 'SistOppdatert', 'Rekkefølge']] },
                })
            );
        });

        it('should not create sheet when it already exists', async () => {
            mockSheets.spreadsheets.get.mockResolvedValue({
                result: { sheets: [{ properties: { title: 'Prisliste' } }] }
            });

            await ensurePrislisteSheet(SHEET_ID);

            expect(mockSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
            expect(mockSheets.spreadsheets.values.update).not.toHaveBeenCalled();
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
