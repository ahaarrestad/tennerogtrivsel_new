import { describe, it, expect } from 'vitest';
import { formatPris } from '../format-pris.js';

describe('formatPris', () => {
    it.each([
        [830, 'kr 830'],
        [8370, 'kr 8 370'],
        [17170, 'kr 17 170'],
        [70, 'kr 70'],
        ['1234', 'kr 1 234'],
        ['830', 'kr 830'],
        ['17170', 'kr 17 170'],
        ['  1234  ', 'kr 1 234'],
    ])('should format number/numeric-string %s → "%s"', (input, expected) => {
        expect(formatPris(input)).toBe(expected);
    });

    it.each([
        [null, ''],
        [undefined, ''],
    ])('should return empty string for %s', (input, expected) => {
        expect(formatPris(input)).toBe(expected);
    });

    it.each([
        ['1050 - 1350', 'kr 1 050 – 1 350'],
        ['500 - 1200', 'kr 500 – 1 200'],
        ['7500 - 9500', 'kr 7 500 – 9 500'],
        ['330 - 410', 'kr 330 – 410'],
        [' 1050 - 1350 ', 'kr 1 050 – 1 350'],
    ])('should format range "%s" → "%s"', (input, expected) => {
        expect(formatPris(input)).toBe(expected);
    });

    it.each([
        ['2700 pr time', 'kr 2 700 pr time'],
        ['3380 pr time', 'kr 3 380 pr time'],
        ['  2700 pr time  ', 'kr 2 700 pr time'],
        ['5950 + tekn.', 'kr 5 950 + tekn.'],
        ['1730 + tekn', 'kr 1 730 + tekn'],
        ['2980 m/tannteknikk', 'kr 2 980 m/tannteknikk'],
        ['4500 m/tannteknikk', 'kr 4 500 m/tannteknikk'],
    ])('should format price with suffix "%s" → "%s"', (input, expected) => {
        expect(formatPris(input)).toBe(expected);
    });

    it.each([
        ['Fra 830', 'Fra 830'],
        ['Inkludert', 'Inkludert'],
    ])('should return non-numeric string "%s" unchanged', (input, expected) => {
        expect(formatPris(input)).toBe(expected);
    });
});
