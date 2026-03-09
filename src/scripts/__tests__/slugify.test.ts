import { describe, it, expect } from 'vitest';
import { slugify } from '../slugify';

describe('slugify', () => {
    it.each([
        ['Rotbehandling', 'rotbehandling'],
        ['Forebyggende behandling', 'forebyggende-behandling'],
        ['Tannkjøttsykdom', 'tannkjottsykdom'],
        ['Ærlig sak', 'aerlig-sak'],
        ['Åpen dør', 'apen-dor'],
        ['Krone / Bro / Fasetter', 'krone-bro-fasetter'],
        ['Tannlegeskrekk (Odontofobi)', 'tannlegeskrekk-odontofobi'],
        ['Tanngnissing (Bruxisme)', 'tanngnissing-bruxisme'],
        ['  Hei  ', 'hei'],
        ['---test---', 'test'],
        ['a   b   c', 'a-b-c'],
    ])('should slugify "%s" → "%s"', (input, expected) => {
        expect(slugify(input)).toBe(expected);
    });
});
