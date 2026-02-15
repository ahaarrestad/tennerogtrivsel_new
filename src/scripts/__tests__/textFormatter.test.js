import { describe, it, expect } from 'vitest';
import { formatInfoText, formatDate, stripStackEditData, sortMessages } from '../textFormatter';

describe('formatInfoText', () => {
    it('should return an empty string for null, undefined, or empty input', () => {
        expect(formatInfoText(null)).toBe('');
        expect(formatInfoText(undefined)).toBe('');
        expect(formatInfoText('')).toBe('');
    });

    it('should return the original text if no emails or phone numbers are found', () => {
        const text = 'This is a plain text without any contact info.';
        expect(formatInfoText(text)).toBe(text);
    });

    it('should correctly linkify a single email address', () => {
        const text = 'Contact us at test@example.com.';
        const expected = 'Contact us at <a href="mailto:test@example.com" class="text-brand hover:text-brand-hover hover:no-underline whitespace-nowrap">test@example.com</a>.';
        expect(formatInfoText(text)).toBe(expected);
    });

    it('should correctly linkify multiple email addresses', () => {
        const text = 'Emails: one@example.com and two@domain.com.';
        const expected = 'Emails: <a href="mailto:one@example.com" class="text-brand hover:text-brand-hover hover:no-underline whitespace-nowrap">one@example.com</a> and <a href="mailto:two@domain.com" class="text-brand hover:text-brand-hover hover:no-underline whitespace-nowrap">two@domain.com</a>.';
        expect(formatInfoText(text)).toBe(expected);
    });

    it('should correctly linkify a single 8-digit Norwegian phone number', () => {
        const text = 'Call us at 98765432.';
        const expected = 'Call us at <a href="tel:98765432" class="text-brand hover:text-brand-hover hover:no-underline lg:pointer-events-none lg:cursor-default lg:text-inherit lg:no-underline whitespace-nowrap">98765432</a>.';
        expect(formatInfoText(text)).toBe(expected);
    });

    it('should correctly linkify a Norwegian phone number with +47 prefix and spaces', () => {
        const text = 'Call us at +47 23 45 67 89.';
        const expected = 'Call us at <a href="tel:+4723456789" class="text-brand hover:text-brand-hover hover:no-underline lg:pointer-events-none lg:cursor-default lg:text-inherit lg:no-underline whitespace-nowrap">+47 23 45 67 89</a>.';
        expect(formatInfoText(text)).toBe(expected);
    });

    it('should correctly linkify a Norwegian phone number with 0047 prefix and spaces', () => {
        const text = 'Call us at 0047 23 45 67 89.';
        const expected = 'Call us at <a href="tel:004723456789" class="text-brand hover:text-brand-hover hover:no-underline lg:pointer-events-none lg:cursor-default lg:text-inherit lg:no-underline whitespace-nowrap">0047 23 45 67 89</a>.';
        expect(formatInfoText(text)).toBe(expected);
    });

    it('should correctly linkify multiple Norwegian phone numbers', () => {
        const text = 'Numbers: 22334455 and 99887766.';
        const expected = 'Numbers: <a href="tel:22334455" class="text-brand hover:text-brand-hover hover:no-underline lg:pointer-events-none lg:cursor-default lg:text-inherit lg:no-underline whitespace-nowrap">22334455</a> and <a href="tel:99887766" class="text-brand hover:text-brand-hover hover:no-underline lg:pointer-events-none lg:cursor-default lg:text-inherit lg:no-underline whitespace-nowrap">99887766</a>.';
        expect(formatInfoText(text)).toBe(expected);
    });

    it('should correctly linkify both email and phone number in the same text', () => {
        const text = 'Contact support@example.com or call 21223344.';
        const expected = 'Contact <a href="mailto:support@example.com" class="text-brand hover:text-brand-hover hover:no-underline whitespace-nowrap">support@example.com</a> or call <a href="tel:21223344" class="text-brand hover:text-brand-hover hover:no-underline lg:pointer-events-none lg:cursor-default lg:text-inherit lg:no-underline whitespace-nowrap">21223344</a>.';
        expect(formatInfoText(text)).toBe(expected);
    });

    it('should handle email and phone number at the beginning and end of the string', () => {
        const text = 'test@start.com and 55667788';
        const expected = '<a href="mailto:test@start.com" class="text-brand hover:text-brand-hover hover:no-underline whitespace-nowrap">test@start.com</a> and <a href="tel:55667788" class="text-brand hover:text-brand-hover hover:no-underline lg:pointer-events-none lg:cursor-default lg:text-inherit lg:no-underline whitespace-nowrap">55667788</a>';
        expect(formatInfoText(text)).toBe(expected);
    });

    it('should not linkify international numbers not matching +47/0047', () => {
        const text = 'International number: +1 123 456 7890.';
        expect(formatInfoText(text)).toBe(text);
    });

    it('should not linkify numbers shorter than 8 digits', () => {
        const text = 'Short number: 1234567.';
        expect(formatInfoText(text)).toBe(text);
    });

    it('should correctly linkify a Norwegian phone number with internal spaces (DD DD DD DD format)', () => {
        const text = 'Ring oss på 22 44 22 33 for spørsmål.';
        const expected = 'Ring oss på <a href="tel:22442233" class="text-brand hover:text-brand-hover hover:no-underline lg:pointer-events-none lg:cursor-default lg:text-inherit lg:no-underline whitespace-nowrap">22 44 22 33</a> for spørsmål.';
        expect(formatInfoText(text)).toBe(expected);
    });

    it('should correctly apply HTML classes to generated links', () => {
        const text = 'Email: test@example.com, Phone: 21234567';
        const result = formatInfoText(text);
        expect(result).toContain('class="text-brand hover:text-brand-hover hover:no-underline whitespace-nowrap"'); // for email
        expect(result).toContain('class="text-brand hover:text-brand-hover hover:no-underline lg:pointer-events-none lg:cursor-default lg:text-inherit lg:no-underline whitespace-nowrap"'); // for phone
    });

    it('should handle text with markdown-like syntax without processing it', () => {
        const text = 'This has *some* markdown and test@example.com.';
        const expected = 'This has *some* markdown and <a href="mailto:test@example.com" class="text-brand hover:text-brand-hover hover:no-underline whitespace-nowrap">test@example.com</a>.';
        expect(formatInfoText(text)).toBe(expected);
    });
});

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
        const active1 = { title: 'Slutter snart', startDate: '2020-01-01', endDate: '2026-03-01' };
        const active2 = { title: 'Slutter senere', startDate: '2020-01-01', endDate: '2026-12-01' };
        const sorted = sortMessages([active2, active1]);
        expect(sorted[0].title).toBe('Slutter snart');
    });

    it('should sort planned messages by start date (nearest first)', () => {
        const planned1 = { title: 'Starter snart', startDate: '2026-03-01', endDate: '2026-04-01' };
        const planned2 = { title: 'Starter senere', startDate: '2026-12-01', endDate: '2027-01-01' };
        // We need to make sure now < start. Assuming "now" in tests is current date.
        // Let's use 2099 to be safe.
        const p1 = { ...planned1, startDate: '2099-01-01' };
        const p2 = { ...planned2, startDate: '2099-02-01' };
        const sorted = sortMessages([p2, p1]);
        expect(sorted[0].title).toBe('Starter snart');
    });
});