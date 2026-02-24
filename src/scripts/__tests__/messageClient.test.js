import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveMessage } from '../messageClient.js';

// Mock snarkdown
vi.mock('snarkdown', () => ({
    default: vi.fn((markdown) => `<html>${markdown}</html>`)
}));

// Mock dompurify – tester kjører i node-miljø uten DOM
vi.mock('dompurify', () => ({
    default: { sanitize: vi.fn((html) => html) }
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
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);

        const mockApiResponse = [
            {
                title: 'Viktig melding',
                content: 'Dette er linje 1' + String.fromCharCode(10) + 'Linje 2',
                startDate: yesterday.toISOString(),
                endDate: tomorrow.toISOString()
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
        expect(result.htmlContent).toContain('<html>Dette er linje 1\nLinje 2</html>');
    });

    it('skal filtrere ut meldinger med utgått endDate', async () => {
        const mockApiResponse = [
            {
                title: 'Utgått melding',
                content: 'Gammel',
                startDate: '2020-01-01',
                endDate: '2020-01-31'
            }
        ];

        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockApiResponse)
        });

        const result = await getActiveMessage();
        expect(result).toBeNull();
    });

    it('skal filtrere ut meldinger med fremtidig startDate', async () => {
        const mockApiResponse = [
            {
                title: 'Fremtidig melding',
                content: 'Kommer snart',
                startDate: '2099-01-01',
                endDate: '2099-12-31'
            }
        ];

        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockApiResponse)
        });

        const result = await getActiveMessage();
        expect(result).toBeNull();
    });

    it('skal kun returnere aktive meldinger (innenfor dato-intervall)', async () => {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);

        const mockApiResponse = [
            {
                title: 'Utgått',
                content: 'Gammel melding',
                startDate: '2020-01-01',
                endDate: '2020-01-31'
            },
            {
                title: 'Aktiv melding',
                content: 'Aktiv innhold',
                startDate: yesterday.toISOString(),
                endDate: tomorrow.toISOString()
            },
            {
                title: 'Fremtidig',
                content: 'Kommende',
                startDate: '2099-01-01',
                endDate: '2099-12-31'
            }
        ];

        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockApiResponse)
        });

        const result = await getActiveMessage();
        expect(result).not.toBeNull();
        expect(result.title).toBe('Aktiv melding');
    });

    it('skal bruke start-of-day og end-of-day for datofiltrering', async () => {
        // En melding som starter og slutter i dag skal være aktiv
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

        const mockApiResponse = [
            {
                title: 'Dagens melding',
                content: 'Vises hele dagen',
                startDate: todayStr,
                endDate: todayStr
            }
        ];

        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockApiResponse)
        });

        const result = await getActiveMessage();
        expect(result).not.toBeNull();
        expect(result.title).toBe('Dagens melding');
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
