import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

// Mock astro:content
vi.mock('astro:content', () => {
    const zMock: any = {
        object: vi.fn(() => zMock),
        string: vi.fn(() => zMock),
        number: vi.fn(() => zMock),
        boolean: vi.fn(() => zMock),
        array: vi.fn(() => zMock),
        optional: vi.fn(() => zMock),
        default: vi.fn(() => zMock),
        describe: vi.fn(() => zMock),
        coerce: {
            date: vi.fn(() => zMock),
        },
        safeParse: vi.fn((data) => ({ success: true, data })),
    };
    return {
        defineCollection: vi.fn((config) => config),
        z: zMock,
    };
});

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock fs
vi.mock('fs', async () => {
    return {
        default: {
            existsSync: vi.fn(),
            readFileSync: vi.fn(),
        },
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
    };
});

const { collections } = await import('../content.config.ts');

describe('content.config.ts - Loaders', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.PUBLIC_GOOGLE_API_KEY = 'test-api-key';
        process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
        
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('innstillinger loader', () => {
        it('bør hente og mappe innstillinger fra Google Sheets korrekt', async () => {
            const mockSheetsResponse = {
                values: [
                    ['Nøkkel', 'Verdi'],
                    ['phone1', '12345678'],
                    ['email', 'test@example.com'],
                ],
            };

            mockFetch.mockResolvedValue({
                json: () => Promise.resolve(mockSheetsResponse),
            });

            const loader = (collections.innstillinger as any).loader;
            const result = await loader();

            expect(mockFetch).toHaveBeenCalled();
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 'phone1', value: '12345678' });
        });

        it('bør håndtere rader med manglende data', async () => {
            const mockSheetsResponse = {
                values: [
                    ['Nøkkel', 'Verdi'],
                    ['phone1', '12345678'],
                    ['empty', ''], // Missing value
                    ['', 'value'], // Missing key
                ],
            };

            mockFetch.mockResolvedValue({
                json: () => Promise.resolve(mockSheetsResponse),
            });

            const loader = (collections.innstillinger as any).loader;
            await loader();

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Mangler data i A eller B kolonne'));
        });

        it('bør håndtere tomme svar fra Google Sheets', async () => {
            mockFetch.mockResolvedValue({
                json: () => Promise.resolve({ values: [] }),
            });

            const loader = (collections.innstillinger as any).loader;
            const result = await loader();

            expect(result).toEqual([]);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Ingen rader funnet'));
        });

        it('bør håndtere feil fra API-et', async () => {
            mockFetch.mockResolvedValue({
                json: () => Promise.resolve({ error: { code: 403, message: 'Forbidden', status: 'PERMISSION_DENIED' } }),
            });

            const loader = (collections.innstillinger as any).loader;
            const result = await loader();

            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Google API feil'));
        });

        it('bør håndtere kritiske feil under fetch', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const loader = (collections.innstillinger as any).loader;
            const result = await loader();

            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Kritisk feil under fetch'), expect.any(Error));
        });
    });

    describe('tannleger loader', () => {
        it('bør lese tannleger fra JSON-fil korrekt', async () => {
            const mockTannleger = [
                { id: 'ola-nordmann', name: 'Ola Nordmann' },
            ];

            (fs.existsSync as any).mockReturnValue(true);
            (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockTannleger));

            const loader = (collections.tannleger as any).loader;
            const result = await loader();

            expect(result).toEqual(mockTannleger);
        });

        it('bør bruke generert ID hvis id mangler i JSON', async () => {
            const mockTannleger = [
                { name: 'Kari Nordmann' },
            ];

            (fs.existsSync as any).mockReturnValue(true);
            (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockTannleger));

            const loader = (collections.tannleger as any).loader;
            const result = await loader();

            expect(result[0].id).toBe('tannlege-0');
        });

        it('bør returnere tom liste hvis filen ikke finnes', async () => {
            (fs.existsSync as any).mockReturnValue(false);

            const loader = (collections.tannleger as any).loader;
            const result = await loader();

            expect(result).toEqual([]);
        });
    });
});
