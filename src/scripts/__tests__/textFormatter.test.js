import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, stripStackEditData, sortMessages, slugify } from '../textFormatter';

describe('formatDate', () => {
    it('should return an empty string for null, undefined, or empty input', () => {
        expect(formatDate(null)).toBe('');
        expect(formatDate(undefined)).toBe('');
        expect(formatDate('')).toBe('');
    });

    it('should format a date string correctly in Norwegian locale', () => {
        // We use a fixed date to avoid locale/timezone issues if possible, 
        // but Intl.DateTimeFormat with 'no-NO' should be stable.
        const dateStr = '2026-02-15';
        const result = formatDate(dateStr);
        // Note: Intl.DateTimeFormat 'no-NO' might produce "15. feb. 2026" or "15. Feb. 2026" 
        // or even "15 Feb 2026" depending on environment, but typically "15. feb. 2026" in Node 20+.
        // The user asked for "15 Feb 2026" as an example, but standard Norwegian is often "15. feb. 2026".
        // Let's check what it actually produces or use a regex to be safe about the exact formatting 
        // while ensuring it's the right components.
        expect(result).toMatch(/15\.?\s+feb\.?\s+2026/i);
    });

    it('should format a Date object correctly', () => {
        const date = new Date(2026, 1, 15); // Month is 0-indexed, so 1 is February
        const result = formatDate(date);
        expect(result).toMatch(/15\.?\s+feb\.?\s+2026/i);
    });

    it('should return the original string if input is an invalid date string', () => {
        const invalid = 'not-a-date';
        expect(formatDate(invalid)).toBe(invalid);
    });
});

describe('stripStackEditData', () => {
    it('should remove stackedit_data comments', () => {
        const content = 'Hello world\n<!--stackedit_data:eyJoaXN0b3J5IjpbMTIzXX0=-->\nMore text';
        expect(stripStackEditData(content)).toBe('Hello world\n\nMore text');
    });

    it('should handle multiple lines inside the comment', () => {
        const content = 'Text\n<!--stackedit_data:\nline1\nline2\n-->\nEnd';
        expect(stripStackEditData(content)).toBe('Text\n\nEnd');
    });

    it('should return empty string for null or undefined', () => {
        expect(stripStackEditData(null)).toBe('');
        expect(stripStackEditData(undefined)).toBe('');
    });

    it('should return original text if no stackedit comment exists', () => {
        const text = 'Just some markdown';
        expect(stripStackEditData(text)).toBe(text);
    });
});

describe('sortMessages', () => {
    beforeEach(() => {
        vi.useFakeTimers({ now: new Date('2026-02-15T12:00:00') });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    const activeMsg = { title: 'Aktiv', startDate: '2020-01-01', endDate: '2099-01-01' };
    const plannedMsg = { title: 'Planlagt', startDate: '2098-01-01', endDate: '2099-01-01' };
    const expiredMsg = { title: 'Utløpt', startDate: '2020-01-01', endDate: '2021-01-01' };

    it('should sort active messages before planned and expired', () => {
        const msgs = [expiredMsg, plannedMsg, activeMsg];
        const sorted = sortMessages(msgs);
        expect(sorted[0].title).toBe('Aktiv');
        expect(sorted[1].title).toBe('Planlagt');
        expect(sorted[2].title).toBe('Utløpt');
    });

    it('should sort active messages by end date (nearest first)', () => {
        const active1 = { title: 'Slutter snart', startDate: '2020-01-01', endDate: '2090-03-01' };
        const active2 = { title: 'Slutter senere', startDate: '2020-01-01', endDate: '2090-12-01' };
        const sorted = sortMessages([active2, active1]);
        expect(sorted[0].title).toBe('Slutter snart');
    });

    it('should sort planned messages by start date (nearest first)', () => {
        const planned1 = { title: 'Starter snart', startDate: '2099-03-01', endDate: '2099-04-01' };
        const planned2 = { title: 'Starter senere', startDate: '2099-12-01', endDate: '2100-01-01' };
        const sorted = sortMessages([planned2, planned1]);
        expect(sorted[0].title).toBe('Starter snart');
    });

    it('should sort expired messages by end date (newest first)', () => {
        const expired1 = { title: 'Gammel', startDate: '2020-01-01', endDate: '2021-01-01' };
        const expired2 = { title: 'Nyere utløpt', startDate: '2020-01-01', endDate: '2023-01-01' };
        const sorted = sortMessages([expired1, expired2]);
        expect(sorted[0].title).toBe('Nyere utløpt');
    });

    it('should handle invalid dates by putting them at the end', () => {
        const invalid = { title: 'Feil', startDate: 'abc', endDate: 'def' };
        const msgs = [invalid, activeMsg];
        const sorted = sortMessages(msgs);
        expect(sorted[0].title).toBe('Aktiv');
        expect(sorted[1].title).toBe('Feil');
    });

    it('should return empty array for non-array input', () => {
        expect(sortMessages(null)).toEqual([]);
        expect(sortMessages({})).toEqual([]);
    });

    it('should return 0 when both messages have unknown status (fallback branch)', () => {
        // Both messages have invalid dates → status 3 (unknown) for each.
        // When statusA === statusB and neither is 0, 1, nor 2, the comparator hits `return 0`.
        const unknown1 = { title: 'Ukjent 1', startDate: 'ugyldig', endDate: 'ugyldig' };
        const unknown2 = { title: 'Ukjent 2', startDate: 'ugyldig', endDate: 'ugyldig' };
        const sorted = sortMessages([unknown1, unknown2]);
        expect(sorted).toHaveLength(2);
    });
});

describe('slugify', () => {
    it('should convert text to slug', () => {
        expect(slugify('Hello World')).toBe('hello-world');
        expect(slugify('ÆØÅ Test')).toBe('aeoeaa-test');
        expect(slugify('  Trim  ')).toBe('trim');
        expect(slugify('Multiple---Dashes')).toBe('multiple-dashes');
        expect(slugify('Special!Chars?')).toBe('specialchars');
    });

    it('should return empty string for empty input', () => {
        expect(slugify(null)).toBe('');
        expect(slugify('')).toBe('');
    });
});