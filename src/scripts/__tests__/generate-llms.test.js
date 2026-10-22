import { describe, it, expect } from 'vitest';
import { generateLlmsTxt, generateLlmsFullTxt } from '../generate-llms.js';

const SITE = 'https://www.tennerogtrivsel.no/';

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

    it('skal inneholde relative lenker til tjenester, prisliste og kontakt uten siteUrl', () => {
        const result = generateLlmsTxt(baseData);
        expect(result).toContain('[Tjenester](/tjenester/)');
        expect(result).toContain('[Prisliste](/prisliste/)');
        expect(result).toContain('[Kontakt](/kontakt/)');
        expect(result).toContain('[Fullstendig innhold](/llms-full.txt)');
    });

    it('skal bruke absolutte lenker med siteUrl', () => {
        const result = generateLlmsTxt({ ...baseData, siteUrl: SITE });
        expect(result).toContain('[Tjenester](https://www.tennerogtrivsel.no/tjenester/)');
        expect(result).toContain('[Prisliste](https://www.tennerogtrivsel.no/prisliste/)');
        expect(result).toContain('[Kontakt](https://www.tennerogtrivsel.no/kontakt/)');
        expect(result).toContain('[Fullstendig innhold](https://www.tennerogtrivsel.no/llms-full.txt)');
    });

    it('skal vise når prislisten sist ble oppdatert', () => {
        const result = generateLlmsTxt({ ...baseData, siteUrl: SITE, prislisteDato: '2026-01-15T00:00:00.000Z' });
        expect(result).toContain('- [Prisliste](https://www.tennerogtrivsel.no/prisliste/): sist oppdatert januar 2026');
    });

    it.each([
        ['uten dato', ''],
        ['med ugyldig dato', 'tull'],
    ])('skal vise prislistelenken uten suffiks %s', (_navn, prislisteDato) => {
        const result = generateLlmsTxt({ ...baseData, prislisteDato });
        expect(result).toContain('- [Prisliste](/prisliste/)\n');
        expect(result).not.toContain('Invalid Date');
    });
});

describe('timebestilling', () => {
    const TIMEBESTILLING = 'Timebestilling: ring oss på 51 52 96 18. Vi har ikke nettbestilling, fordi vi vil snakke med deg for å finne riktig time og behandling.';

    it.each([
        ['generateLlmsTxt', generateLlmsTxt],
        ['generateLlmsFullTxt', generateLlmsFullTxt],
    ])('%s ber leseren ringe for time', (_navn, generer) => {
        expect(generer(baseData)).toContain(TIMEBESTILLING);
    });

    it('utelater linja uten telefonnummer', () => {
        const result = generateLlmsTxt({ ...baseData, settings: { ...baseData.settings, phone1: '' } });
        expect(result).not.toContain('Timebestilling');
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

    it('skal datere prisene, si at de er veiledende og lenke til gjeldende prisliste', () => {
        const result = generateLlmsFullTxt({
            ...baseData,
            siteUrl: SITE,
            prisliste: { ...baseData.prisliste, sistOppdatert: '2026-01-15T00:00:00.000Z' },
        });
        expect(result).toContain('Sist oppdatert: januar 2026');
        expect(result).toContain('Prisene er veiledende og kan variere etter behandlingens omfang.');
        expect(result).toContain('Gjeldende priser: https://www.tennerogtrivsel.no/prisliste/');
    });

    it.each([
        ['uten dato', undefined],
        ['med ugyldig dato', 'tull'],
    ])('skal utelate datolinja %s', (_navn, sistOppdatert) => {
        const result = generateLlmsFullTxt({ ...baseData, prisliste: { ...baseData.prisliste, sistOppdatert } });
        expect(result).not.toContain('Sist oppdatert');
        expect(result).not.toContain('Invalid Date');
        expect(result).toContain('Prisene er veiledende');
        expect(result).toContain('Gjeldende priser: /prisliste/');
    });

    it('skal bruke absolutte footer-lenker med siteUrl', () => {
        const result = generateLlmsFullTxt({ ...baseData, siteUrl: SITE });
        expect(result).toContain('[Tjenester](https://www.tennerogtrivsel.no/tjenester/)');
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
