import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSiteSettings, HARD_DEFAULTS } from '../getSettings';
// The actual getCollection is mocked via vitest.config.ts alias,
// but we need to import it here to be able to mock its behavior dynamically per test.
import { getCollection } from 'astro:content';

// Mock the getCollection function from astro:content
vi.mock('astro:content', async (importOriginal) => {
    const mod = await importOriginal<typeof import('astro:content')>();
    return {
        ...mod,
        getCollection: vi.fn(), // Mock getCollection
    };
});

describe('getSiteSettings', () => {
    // Suppress console.error output for tests that expect errors
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore(); // Restore original console.error after each test
    });



    it('should return HARD_DEFAULTS when getCollection is empty', async () => {
        (getCollection as vi.Mock).mockResolvedValueOnce([]); // Mock an empty collection
        const settings = await getSiteSettings();
        expect(settings).toEqual(HARD_DEFAULTS);
    });

    it('should return HARD_DEFAULTS when getCollection throws an error', async () => {
        (getCollection as vi.Mock).mockRejectedValueOnce(new Error('Failed to fetch')); // Mock an error
        const settings = await getSiteSettings();
        expect(settings).toEqual(HARD_DEFAULTS);
    });

    it('should override HARD_DEFAULTS with values from getCollection', async () => {
        const collectionData = [
            { id: 'phone1', data: { value: '99887766' } },
            { id: 'email', data: { value: 'new@example.com' } },
        ];
        (getCollection as vi.Mock).mockResolvedValueOnce(collectionData);

        const settings = await getSiteSettings();
        expect(settings.phone1).toBe('99887766');
        expect(settings.email).toBe('new@example.com');
        expect(settings.adresse1).toBe(HARD_DEFAULTS.adresse1); // Ensure other defaults are preserved
    });

    it('should merge HARD_DEFAULTS with new values from getCollection', async () => {
        const collectionData = [
            { id: 'newSetting', data: { value: 'someValue' } },
            { id: 'businessHours1', data: { value: 'Always Open' } },
        ];
        (getCollection as vi.Mock).mockResolvedValueOnce(collectionData);

        const settings = await getSiteSettings();
        expect(settings.newSetting).toBe('someValue');
        expect(settings.businessHours1).toBe('Always Open');
        expect(settings.adresse2).toBe(HARD_DEFAULTS.adresse2);
    });

    it('should handle collection data with empty string values', async () => {
        const collectionData = [
            { id: 'phone1', data: { value: '' } }, // Empty string should override
            { id: 'email', data: { value: 'new@example.com' } },
        ];
        (getCollection as vi.Mock).mockResolvedValueOnce(collectionData);

        const settings = await getSiteSettings();
        expect(settings.phone1).toBe(''); // Expect empty string
        expect(settings.email).toBe('new@example.com');
    });
});