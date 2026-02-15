import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

// Mock astro:content
vi.mock('astro:content', () => ({
    defineCollection: vi.fn((config) => config),
    z: {
        object: vi.fn(() => ({
            optional: vi.fn(),
        })),
        string: vi.fn(() => ({
            optional: vi.fn(),
            trim: vi.fn(),
        })),
        coerce: {
            date: vi.fn(),
        },
    },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock fs med vi.spyOn i stedet for vi.mock for å unngå problemer med "is not a function"
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

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('test-sheet-id'),
                expect.anything()
            );
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 'phone1', value: '12345678' });
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
    });
});
