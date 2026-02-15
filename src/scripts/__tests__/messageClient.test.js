import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveMessage } from '../messageClient.js';

// Mock snarkdown
vi.mock('snarkdown', () => ({
    default: vi.fn((markdown) => `<html>${markdown}</html>`)
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('messageClient.js', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('skal hente aktiv melding og formatere med snarkdown', async () => {
        const mockApiResponse = [
            {
                title: 'Viktig melding',
                content: 'Dette er linje 1' + String.fromCharCode(10) + 'Linje 2',
                startDate: '2026-01-01',
                endDate: '2026-12-31'
            }
        ];

        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockApiResponse)
        });

        const result = await getActiveMessage();

        expect(mockFetch).toHaveBeenCalledWith('/api/active-messages.json');
        expect(result).not.toBeNull();
        expect(result.title).toBe('Viktig melding');
        // Sjekk at \n er byttet ut med <br /> før snarkdown
        expect(result.htmlContent).toContain('<html>Dette er linje 1<br />Linje 2</html>');
    });

    it('skal returnere null hvis ingen meldinger finnes i API-svaret', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([])
        });

        const result = await getActiveMessage();

        expect(result).toBeNull();
    });

    it('skal returnere null og logge feil hvis fetch feiler', async () => {
        mockFetch.mockResolvedValue({
            ok: false
        });

        const result = await getActiveMessage();

        expect(result).toBeNull();
    });

    it('skal håndtere nettverksfeil (exception)', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const result = await getActiveMessage();

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Feil ved henting av meldinger'), expect.any(Error));
    });
});
