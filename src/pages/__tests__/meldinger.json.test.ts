import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GET } from '../meldinger.json.ts';
import { getCollection } from 'astro:content';

vi.mock('astro:content', () => ({
    getCollection: vi.fn(),
}));

const getCollectionMock = getCollection as Mock;

describe('meldinger.json API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('skal returnere alle meldinger', async () => {
        const mockMessages = [
            {
                data: {
                    title: 'Melding 1',
                    startDate: new Date('2026-01-01'),
                    endDate: new Date('2026-12-31'),
                },
                body: 'Innhold 1'
            }
        ];

        getCollectionMock.mockResolvedValue(mockMessages);

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toHaveLength(1);
        expect(json[0].title).toBe('Melding 1');
        expect(json[0].body).toBe('Innhold 1');
    });
});
