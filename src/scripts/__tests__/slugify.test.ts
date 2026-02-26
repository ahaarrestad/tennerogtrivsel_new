import { describe, it, expect } from 'vitest';
import { slugify } from '../slugify';

describe('slugify', () => {
    it('skal konvertere enkel tittel til lowercase slug', () => {
        expect(slugify('Rotbehandling')).toBe('rotbehandling');
    });

    it('skal erstatte mellomrom med bindestrek', () => {
        expect(slugify('Forebyggende behandling')).toBe('forebyggende-behandling');
    });

    it('skal erstatte norske tegn (æ, ø, å)', () => {
        expect(slugify('Tannkjøttsykdom')).toBe('tannkjottsykdom');
        expect(slugify('Ærlig sak')).toBe('aerlig-sak');
        expect(slugify('Åpen dør')).toBe('apen-dor');
    });

    it('skal fjerne spesialtegn og bruke bindestrek', () => {
        expect(slugify('Krone / Bro / Fasetter')).toBe('krone-bro-fasetter');
    });

    it('skal fjerne parenteser og beholde innholdet', () => {
        expect(slugify('Tannlegeskrekk (Odontofobi)')).toBe('tannlegeskrekk-odontofobi');
        expect(slugify('Tanngnissing (Bruxisme)')).toBe('tanngnissing-bruxisme');
    });

    it('skal fjerne ledende og etterfølgende bindestreker', () => {
        expect(slugify('  Hei  ')).toBe('hei');
        expect(slugify('---test---')).toBe('test');
    });

    it('skal kollapse flere bindestreker til én', () => {
        expect(slugify('a   b   c')).toBe('a-b-c');
    });
});
