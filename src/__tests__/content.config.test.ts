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
        union: vi.fn(() => zMock),
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

        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('innstillinger loader', () => {
        it('bør lese innstillinger fra JSON-fil korrekt', async () => {
            const mockInnstillinger = [
                { id: 'phone1', value: '12345678' },
                { id: 'email', value: 'test@example.com' },
            ];

            (fs.existsSync as any).mockReturnValue(true);
            (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockInnstillinger));

            const loader = (collections.innstillinger as any).loader;
            const result = await loader();

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 'phone1', value: '12345678' });
        });

        it('bør returnere tom liste hvis filen ikke finnes', async () => {
            (fs.existsSync as any).mockReturnValue(false);

            const loader = (collections.innstillinger as any).loader;
            const result = await loader();

            expect(result).toEqual([]);
        });

        it('bør håndtere manglende felter med fallback-verdier', async () => {
            const mockInnstillinger = [
                { id: 'phone1' },
                { value: 'bare-verdi' },
            ];

            (fs.existsSync as any).mockReturnValue(true);
            (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockInnstillinger));

            const loader = (collections.innstillinger as any).loader;
            const result = await loader();

            expect(result[0]).toEqual({ id: 'phone1', value: '' });
            expect(result[1]).toEqual({ id: '', value: 'bare-verdi' });
        });
    });

    describe('galleri loader', () => {
        it('bør lese galleri fra JSON-fil korrekt', async () => {
            const mockGalleri = [
                { id: 'bilde-1', title: 'Venterom', image: 'venterom.jpg' },
            ];

            (fs.existsSync as any).mockReturnValue(true);
            (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockGalleri));

            const loader = (collections.galleri as any).loader;
            const result = await loader();

            expect(result).toEqual(mockGalleri);
        });

        it('bør bruke generert ID hvis id mangler i JSON', async () => {
            const mockGalleri = [
                { title: 'Uten ID' },
            ];

            (fs.existsSync as any).mockReturnValue(true);
            (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockGalleri));

            const loader = (collections.galleri as any).loader;
            const result = await loader();

            expect(result[0].id).toBe('galleri-0');
        });

        it('bør returnere tom liste hvis filen ikke finnes', async () => {
            (fs.existsSync as any).mockReturnValue(false);

            const loader = (collections.galleri as any).loader;
            const result = await loader();

            expect(result).toEqual([]);
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

    describe('prisliste loader', () => {
        it('should read prisliste from JSON file', async () => {
            const mockPrisliste = [
                { kategori: 'Undersokelser', behandling: 'Vanlig undersokelse', pris: 850 },
            ];

            (fs.existsSync as any).mockReturnValue(true);
            (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockPrisliste));

            const loader = (collections.prisliste as any).loader;
            const result = await loader();

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('prisliste-0');
            expect(result[0].kategori).toBe('Undersokelser');
        });

        it('should return empty array if file does not exist', async () => {
            (fs.existsSync as any).mockReturnValue(false);

            const loader = (collections.prisliste as any).loader;
            const result = await loader();

            expect(result).toEqual([]);
        });
    });
});
