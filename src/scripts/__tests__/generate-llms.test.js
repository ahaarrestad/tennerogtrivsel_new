import { describe, it, expect } from 'vitest';
import { generateLlmsTxt, generateLlmsFullTxt } from '../generate-llms.js';

const baseData = {
    settings: {
        siteDescription: 'Moderne tannklinikk i Stavanger.',
        adresse1: 'Gartnerveien 15',
        adresse2: '4016 Stavanger',
        phone1: '51 52 96 18',
        businessHours1: 'Mandag: 08:00 - 15:30',
        businessHours2: 'Tirsdag: 07:30 - 20:00',
        businessHours3: 'Onsdag: 08:00 - 20:00',
        businessHours4: 'Torsdag: 07:30 - 15:30',
        businessHours5: 'Fredag: 07:30 - 15:30',
    },
    tannleger: [
        { name: 'Ingjerd Øvestad', title: 'Allmenpraksis', description: 'Spesialkompetanse implantatprotetikk' },
        { name: 'Dyveke Knudsen', title: 'Endodontist', description: '' },
    ],
    tjenester: [
        { title: 'Bleking', ingress: 'Et hvitt smil er alltid pent.', body: '### Hjemmebleking\nTannlegen tar avtrykk.' },
        { title: 'Rotbehandling', ingress: 'Smertefri rotbehandling.', body: '' },
    ],
    prisliste: {
        kategoriOrder: [
            { kategori: 'Konserverende behandling', order: 1 },
            { kategori: 'Protetikk', order: 2 },
        ],
        items: [
            { kategori: 'Konserverende behandling', behandling: 'Fylling 1 flate', pris: 1050, order: 0 },
            { kategori: 'Konserverende behandling', behandling: 'Fylling 2 flater', pris: '1670 - 1750', order: 1 },
            { kategori: 'Protetikk', behandling: 'Krone', pris: null, order: 0 },
            { kategori: 'Protetikk', behandling: 'Bro', pris: '', order: 1 },
        ],
    },
};

describe('generateLlmsTxt', () => {
    it('skal starte med klinikkens navn og siteDescription', () => {
        const result = generateLlmsTxt(baseData);
        expect(result).toMatch(/^# Tenner og Trivsel/);
        expect(result).toContain('Moderne tannklinikk i Stavanger.');
    });

    it('skal inneholde adresse og telefon', () => {
        const result = generateLlmsTxt(baseData);
        expect(result).toContain('Gartnerveien 15');
        expect(result).toContain('4016 Stavanger');
        expect(result).toContain('51 52 96 18');
    });

    it('skal liste åpningstider', () => {
        const result = generateLlmsTxt(baseData);
        expect(result).toContain('Mandag: 08:00 - 15:30');
        expect(result).toContain('Fredag: 07:30 - 15:30');
    });

    it('skal inneholde tjenester med tittel og ingress', () => {
        const result = generateLlmsTxt(baseData);
        expect(result).toContain('## Tjenester');
        expect(result).toContain('Bleking: Et hvitt smil er alltid pent.');
        expect(result).toContain('Rotbehandling: Smertefri rotbehandling.');
    });

    it('skal ikke inkludere tjeneste-body i kortversjonen', () => {
        const result = generateLlmsTxt(baseData);
        expect(result).not.toContain('Hjemmebleking');
    });

    it('skal inneholde tannleger med navn og tittel', () => {
        const result = generateLlmsTxt(baseData);
        expect(result).toContain('## Tannleger');
        expect(result).toContain('Ingjerd Øvestad (Allmenpraksis): Spesialkompetanse implantatprotetikk');
    });

    it('skal utelate beskrivelse-kolon for tannlege uten beskrivelse', () => {
        const result = generateLlmsTxt(baseData);
        expect(result).toContain('- Dyveke Knudsen (Endodontist)\n');
    });

    it('skal utelate tannlegeseksjonen når listen er tom', () => {
        const result = generateLlmsTxt({ ...baseData, tannleger: [] });
        expect(result).not.toContain('## Tannleger');
    });

    it('skal inneholde lenke til /llms-full.txt', () => {
        const result = generateLlmsTxt(baseData);
        expect(result).toContain('/llms-full.txt');
    });

    it('skal inneholde lenker til tjenester, prisliste og kontakt', () => {
        const result = generateLlmsTxt(baseData);
        expect(result).toContain('[Tjenester](/tjenester)');
        expect(result).toContain('[Prisliste](/prisliste)');
        expect(result).toContain('[Kontakt](/kontakt)');
    });
});

describe('generateLlmsFullTxt', () => {
    it('skal inneholde full tjeneste-body', () => {
        const result = generateLlmsFullTxt(baseData);
        expect(result).toContain('Hjemmebleking');
        expect(result).toContain('Tannlegen tar avtrykk.');
    });

    it('skal vise tjeneste uten body kun med tittel og ingress', () => {
        const result = generateLlmsFullTxt(baseData);
        expect(result).toContain('Rotbehandling');
        expect(result).toContain('Smertefri rotbehandling.');
    });

    it('skal inneholde prisliste gruppert per kategori', () => {
        const result = generateLlmsFullTxt(baseData);
        expect(result).toContain('## Prisliste');
        expect(result).toContain('### Konserverende behandling');
        expect(result).toContain('Fylling 1 flate: 1050 kr');
        expect(result).toContain('Fylling 2 flater: 1670 - 1750 kr');
    });

    it('skal hoppe over prisliste-items med manglende pris', () => {
        const result = generateLlmsFullTxt(baseData);
        expect(result).not.toContain('Krone');
        expect(result).not.toContain('Bro');
    });

    it('skal sortere prisliste-kategorier etter kategoriOrder', () => {
        const result = generateLlmsFullTxt(baseData);
        const konservIndex = result.indexOf('Konserverende behandling');
        const protetikkIndex = result.indexOf('Protetikk');
        // Protetikk-seksjonen er tom (alt filtrert bort), bare sjekk Konserverende er først
        expect(konservIndex).toBeGreaterThan(-1);
        expect(konservIndex).toBeLessThan(result.indexOf('Fylling 1 flate'));
    });

    it('skal utelate tannlegeseksjonen når listen er tom', () => {
        const result = generateLlmsFullTxt({ ...baseData, tannleger: [] });
        expect(result).not.toContain('## Tannleger');
    });

    it('skal ikke lenke til /llms-full.txt fra fullversjonen', () => {
        const result = generateLlmsFullTxt(baseData);
        expect(result).not.toContain('/llms-full.txt');
    });

    it('skal utelate prisliste-seksjonen når alle items mangler pris', () => {
        const data = {
            ...baseData,
            prisliste: {
                kategoriOrder: [],
                items: [
                    { kategori: 'Test', behandling: 'Behandling', pris: null, order: 0 },
                    { kategori: 'Test', behandling: 'Annen', pris: '', order: 1 },
                ],
            },
        };
        const result = generateLlmsFullTxt(data);
        expect(result).not.toContain('## Prisliste');
    });

    it('skal utelate prisliste-seksjonen ved tom prisliste', () => {
        const result = generateLlmsFullTxt({ ...baseData, prisliste: { kategoriOrder: [], items: [] } });
        expect(result).not.toContain('## Prisliste');
    });

    it('skal utelate tjeneste-seksjonen ved tom tjenesteliste', () => {
        const result = generateLlmsFullTxt({ ...baseData, tjenester: [] });
        expect(result).not.toContain('## Tjenester');
    });
});

describe('generateLlmsTxt — kantsaker', () => {
    it('skal utelate tjeneste-seksjonen ved tom tjenesteliste', () => {
        const result = generateLlmsTxt({ ...baseData, tjenester: [] });
        expect(result).not.toContain('## Tjenester');
    });

    it('skal utelate åpningstider som mangler', () => {
        const data = { ...baseData, settings: { ...baseData.settings, businessHours5: undefined } };
        const result = generateLlmsTxt(data);
        expect(result).not.toContain('undefined');
    });
});
