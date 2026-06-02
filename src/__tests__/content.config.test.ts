import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

type CollectionWithLoader = { loader: () => Promise<Record<string, unknown>[]> };

type ZMock = Record<string, (...args: unknown[]) => ZMock> & {
    coerce: { date: (...args: unknown[]) => ZMock };
    safeParse: (data: unknown) => { success: boolean; data: unknown };
};

// Mock astro:content
vi.mock('astro:content', () => {
    const zMock = {
        object: vi.fn(),
        string: vi.fn(),
        number: vi.fn(),
        boolean: vi.fn(),
        array: vi.fn(),
        union: vi.fn(),
        optional: vi.fn(),
        default: vi.fn(),
        describe: vi.fn(),
        coerce: { date: vi.fn() },
        safeParse: vi.fn((data: unknown) => ({ success: true, data })),
    } as unknown as ZMock;
    Object.entries(zMock).forEach(([key, v]) => {
        if (key !== 'safeParse' && key !== 'coerce' && typeof v === 'function') {
            vi.mocked(v).mockReturnValue(zMock);
        }
    });
    vi.mocked(zMock.coerce.date).mockReturnValue(zMock);
    return {
        defineCollection: vi.fn((config: unknown) => config),
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
            ];

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockInnstillinger));

            const loader = (collections.innstillinger as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ id: 'phone1', value: '12345678' });
        });

        it('bør returnere tom liste hvis filen ikke finnes', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const loader = (collections.innstillinger as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result).toEqual([]);
        });

        it('bør håndtere manglende felter med fallback-verdier', async () => {
            const mockInnstillinger = [
                { id: 'phone1' },
                { value: 'bare-verdi' },
            ];

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockInnstillinger));

            const loader = (collections.innstillinger as unknown as CollectionWithLoader).loader;
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

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockGalleri));

            const loader = (collections.galleri as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result).toEqual(mockGalleri);
        });

        it('bør bruke generert ID hvis id mangler i JSON', async () => {
            const mockGalleri = [
                { title: 'Uten ID' },
            ];

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockGalleri));

            const loader = (collections.galleri as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result[0].id).toBe('galleri-0');
        });

        it('bør returnere tom liste hvis filen ikke finnes', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const loader = (collections.galleri as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result).toEqual([]);
        });
    });

    describe('tannleger loader', () => {
        it('bør lese tannleger fra JSON-fil korrekt', async () => {
            const mockTannleger = [
                { id: 'ola-nordmann', name: 'Ola Nordmann' },
            ];

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockTannleger));

            const loader = (collections.tannleger as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result).toEqual(mockTannleger);
        });

        it('bør bruke generert ID hvis id mangler i JSON', async () => {
            const mockTannleger = [
                { name: 'Kari Nordmann' },
            ];

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockTannleger));

            const loader = (collections.tannleger as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result[0].id).toBe('tannlege-0');
        });

        it('bør returnere tom liste hvis filen ikke finnes', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const loader = (collections.tannleger as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result).toEqual([]);
        });
    });

    describe('kontaktskjema loader', () => {
        it('returnerer standardverdier når filen ikke finnes', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const loader = (collections.kontaktskjema as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result).toEqual([{
                id: 'kontaktskjema', aktiv: false, tittel: '', tekst: '', tema: []
            }]);
        });

        it('leser data fra fil og beholder aktiv som boolsk', async () => {
            const mockData = { aktiv: true, tittel: 'Ta kontakt', tekst: 'Svar raskt.', tema: ['Timebooking'] };
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData));

            const loader = (collections.kontaktskjema as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result[0]).toMatchObject({
                id: 'kontaktskjema', aktiv: true, tittel: 'Ta kontakt', tema: ['Timebooking']
            });
        });
    });

    describe('prisliste loader', () => {
        it('should read prisliste from new format (object with items)', async () => {
            const mockPrisliste = {
                sistOppdatert: '2026-03-07T12:00:00.000Z',
                items: [
                    { kategori: 'Undersokelser', behandling: 'Vanlig undersokelse', pris: 850, sistOppdatert: '2026-03-07T12:00:00.000Z' },
                ],
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockPrisliste));

            const loader = (collections.prisliste as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('prisliste-0');
            expect(result[0].kategori).toBe('Undersokelser');
            expect(result[0].sistOppdatert).toBe('2026-03-07T12:00:00.000Z');
        });

        it('should handle legacy array format', async () => {
            const mockPrisliste = [
                { kategori: 'Undersokelser', behandling: 'Vanlig undersokelse', pris: 850 },
            ];

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockPrisliste));

            const loader = (collections.prisliste as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('prisliste-0');
            expect(result[0].kategori).toBe('Undersokelser');
            expect(result[0].sistOppdatert).toBeUndefined();
        });

        it('should return empty array if file does not exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const loader = (collections.prisliste as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result).toEqual([]);
        });

        it('should include order field when present in data', async () => {
            const mockPrisliste = {
                sistOppdatert: '2026-03-07T12:00:00.000Z',
                items: [
                    { kategori: 'Bleking', behandling: 'Hjemmebleking', pris: 2500, sistOppdatert: '', order: 3 },
                    { kategori: 'Bleking', behandling: 'Klinikk', pris: 5000, sistOppdatert: '', order: 1 },
                ],
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockPrisliste));

            const loader = (collections.prisliste as unknown as CollectionWithLoader).loader;
            const result = await loader();

            expect(result[0].order).toBe(3);
            expect(result[1].order).toBe(1);
        });
    });
});
