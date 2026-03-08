import { describe, it, expect } from 'vitest';
import { formatPris } from '../format-pris.js';

describe('formatPris', () => {
    it('formaterer heltall med kr-prefiks og tusen-mellomrom', () => {
        expect(formatPris(830)).toBe('kr 830');
        expect(formatPris(8370)).toBe('kr 8 370');
        expect(formatPris(17170)).toBe('kr 17 170');
        expect(formatPris(70)).toBe('kr 70');
    });

    it('returnerer tom streng for null/undefined', () => {
        expect(formatPris(null)).toBe('');
        expect(formatPris(undefined)).toBe('');
    });

    it('returnerer string-input uendret', () => {
        expect(formatPris('Fra 830')).toBe('Fra 830');
        expect(formatPris('Inkludert')).toBe('Inkludert');
    });
});
