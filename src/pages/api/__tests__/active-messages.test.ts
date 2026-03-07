import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { GET } from '../active-messages.json.ts';
import { getCollection } from 'astro:content';

// Mock the getCollection function from astro:content
vi.mock('astro:content', async (importOriginal) => {
    const mod = await importOriginal<typeof import('astro:content')>();
    return {
        ...mod,
        getCollection: vi.fn(), // Mock getCollection
    };
});

const getCollectionMock = getCollection as Mock;

describe('active-messages API', () => {
    beforeEach(() => {
        vi.useFakeTimers({ now: new Date('2026-02-15T12:00:00') });
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return active messages with cleaned content', async () => {
        const mockMessages = [
            {
                slug: 'message-1',
                data: {
                    title: 'Test Message 1',
                    startDate: new Date('2026-01-01'),
                    endDate: new Date('2026-12-31'),
                },
                body: 'This is the content of message 1.<!--stackedit_data-->some data<!--/stackedit_data-->',
            },
            {
                slug: 'message-2',
                data: {
                    title: 'Test Message 2',
                    startDate: new Date('2026-01-01'),
                    endDate: new Date('2026-12-31'),
                },
                body: 'This is the content of message 2.',
            },
        ];

        getCollectionMock.mockResolvedValueOnce(mockMessages);

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(json[0].title).toBe('Test Message 1');
        expect(json[0].content).toBe('This is the content of message 1.');
        expect(json[1].title).toBe('Test Message 2');
        expect(json[1].content).toBe('This is the content of message 2.');
    });

    it('should return an empty array if no messages are found', async () => {
        getCollectionMock.mockResolvedValueOnce([]);

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(json).toEqual([]);
    });

    it('should return a 500 status if getCollection throws an error', async () => {
        getCollectionMock.mockRejectedValueOnce(new Error('Database error'));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(json).toEqual({ error: 'Klarte ikke hente meldinger' });
    });

    it('should correctly clean content by removing stackedit_data comments', async () => {
        const mockMessages = [
            {
                slug: 'message-with-stackedit',
                data: {
                    title: 'Message with StackEdit',
                    startDate: new Date('2026-01-01'),
                    endDate: new Date('2026-12-31'),
                },
                body: `Content before.<!--stackedit_data-->
Some data here
<!--/stackedit_data-->Content after.`,
            },
            {
                slug: 'message-without-stackedit',
                data: {
                    title: 'Message without StackEdit',
                    startDate: new Date('2026-01-01'),
                    endDate: new Date('2026-12-31'),
                },
                body: 'Just plain content.',
            },
            {
                slug: 'message-without-body',
                data: {
                    title: 'Message without body',
                    startDate: new Date('2026-01-01'),
                    endDate: new Date('2026-12-31'),
                },
                body: undefined, // Test the branch where body is missing
            },
        ];

        getCollectionMock.mockResolvedValueOnce(mockMessages);

        const response = await GET();
        const json = await response.json();

        expect(json[0].content).toBe('Content before.Content after.');
        expect(json[1].content).toBe('Just plain content.');
        expect(json[2].content).toBe('');
    });

    it('should return all messages without date filtering (filtering moved to client)', async () => {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);

        const mockMessages = [
            {
                slug: 'expired',
                data: {
                    title: 'Expired',
                    startDate: new Date('2020-01-01'),
                    endDate: yesterday,
                },
                body: 'Expired',
            },
            {
                slug: 'upcoming',
                data: {
                    title: 'Upcoming',
                    startDate: tomorrow,
                    endDate: new Date('2030-01-01'),
                },
                body: 'Upcoming',
            },
            {
                slug: 'active',
                data: {
                    title: 'Active',
                    startDate: yesterday,
                    endDate: tomorrow,
                },
                body: 'Active',
            },
        ];

        getCollectionMock.mockResolvedValueOnce(mockMessages);

        const response = await GET();
        const json = await response.json();

        // Alle meldinger returneres — datofiltrering skjer på klienten
        expect(json).toHaveLength(3);
        expect(json.map((m: { title: string }) => m.title)).toContain('Expired');
        expect(json.map((m: { title: string }) => m.title)).toContain('Upcoming');
        expect(json.map((m: { title: string }) => m.title)).toContain('Active');
    });

    it('should include date fields in output', async () => {
        const mockMessages = [
            {
                slug: 'msg',
                data: {
                    title: 'Test',
                    startDate: new Date('2026-03-01'),
                    endDate: new Date('2026-03-31'),
                },
                body: 'Content',
            },
        ];

        getCollectionMock.mockResolvedValueOnce(mockMessages);

        const response = await GET();
        const json = await response.json();

        expect(json[0]).toHaveProperty('startDate');
        expect(json[0]).toHaveProperty('endDate');
    });
});
