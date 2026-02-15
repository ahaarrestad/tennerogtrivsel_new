import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../active-messages.json';
import { getCollection } from 'astro:content';

// Mock the getCollection function from astro:content
vi.mock('astro:content', async (importOriginal) => {
    const mod = await importOriginal<typeof import('astro:content')>();
    return {
        ...mod,
        getCollection: vi.fn(), // Mock getCollection
    };
});

describe('active-messages API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

        (getCollection as vi.Mock).mockResolvedValueOnce(mockMessages);

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
        (getCollection as vi.Mock).mockResolvedValueOnce([]);

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(json).toEqual([]);
    });

    it('should return a 500 status if getCollection throws an error', async () => {
        (getCollection as vi.Mock).mockRejectedValueOnce(new Error('Database error'));

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

        (getCollection as vi.Mock).mockResolvedValueOnce(mockMessages);

        const response = await GET();
        const json = await response.json();

        expect(json[0].content).toBe('Content before.Content after.');
        expect(json[1].content).toBe('Just plain content.');
        expect(json[2].content).toBe('');
    });

    it('should filter out messages that are not active', async () => {
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

        (getCollection as vi.Mock).mockResolvedValueOnce(mockMessages);

        const response = await GET();
        const json = await response.json();

        expect(json).toHaveLength(1);
        expect(json[0].title).toBe('Active');
    });
});
