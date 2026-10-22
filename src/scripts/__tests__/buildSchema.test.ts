import { describe, it, expect } from 'vitest';
import { buildSchema, buildPersonSchema, buildTjenesteSideSchema, klinikkId, serializeJsonLd } from '../buildSchema';

const baseSettings: Record<string, string> = {
    siteTitle: 'Tenner og Trivsel',
    siteDescription: 'Din tannklinikk',
    phone1: '51 84 34 40',
    adresse1: 'Hillevågsveien 11',
    adresse2: '4011 Stavanger',
    latitude: '58.9690',
    longitude: '5.7331',
    businessHours1: 'Mandag: 08:00 - 15:30',
    businessHours2: 'Tirsdag: 08:00 - 20:00',
    businessHours3: 'Onsdag: 08:00 - 20:00',
    businessHours4: 'Torsdag: 08:00 - 15:30',
    businessHours5: 'Fredag: 08:00 - 15:30',
};

describe('buildSchema – toppnivå', () => {
    it('returnerer @context og @type', () => {
        const schema = buildSchema(baseSettings, [], 'https://tennerogtrivsel.no');
        expect(schema['@context']).toBe('https://schema.org');
        expect(schema['@type']).toEqual(['Dentist', 'MedicalClinic']);
    });

    it('mapper siteTitle til name', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['name']).toBe('Tenner og Trivsel');
    });

    it('bruker bare delen av siteTitle før |', () => {
        const schema = buildSchema({ ...baseSettings, siteTitle: 'Tenner og Trivsel | Din Tannlege i Stavanger' }, [], '');
        expect(schema['name']).toBe('Tenner og Trivsel');
    });

    it('har @id når siteUrl er satt, og utelater den ellers', () => {
        expect(buildSchema(baseSettings, [], 'https://www.tennerogtrivsel.no/')['@id'])
            .toBe('https://www.tennerogtrivsel.no/#klinikk');
        expect(buildSchema(baseSettings, [], '')).not.toHaveProperty('@id');
    });

    it('lenker til Google Business Profile i sameAs', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['sameAs']).toEqual(['https://maps.google.com/?cid=1532811702748545219']);
    });

    it('mapper siteDescription til description', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['description']).toBe('Din tannklinikk');
    });

    it('mapper phone1 til telephone', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['telephone']).toBe('51 84 34 40');
    });

    it('inkluderer url når siteUrl er satt', () => {
        const schema = buildSchema(baseSettings, [], 'https://tennerogtrivsel.no');
        expect(schema['url']).toBe('https://tennerogtrivsel.no');
    });

    it('utelater url når siteUrl er tom', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema).not.toHaveProperty('url');
    });
});

describe('buildSchema – adresse', () => {
    it('parser standard adresse2 korrekt', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['address']['postalCode']).toBe('4011');
        expect(schema['address']['addressLocality']).toBe('Stavanger');
    });

    it('parser flerdelt by korrekt', () => {
        const schema = buildSchema({ ...baseSettings, adresse2: '5020 Bergen sentrum' }, [], '');
        expect(schema['address']['postalCode']).toBe('5020');
        expect(schema['address']['addressLocality']).toBe('Bergen sentrum');
    });

    it('håndterer adresse2 uten mellomrom', () => {
        const schema = buildSchema({ ...baseSettings, adresse2: 'Ukjent' }, [], '');
        expect(schema['address']['postalCode']).toBe('');
        expect(schema['address']['addressLocality']).toBe('Ukjent');
    });

    it('bruker adresse1 som streetAddress', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['address']['streetAddress']).toBe('Hillevågsveien 11');
    });

    it('bruker tom streng som streetAddress hvis adresse1 mangler', () => {
        const schema = buildSchema({ ...baseSettings, adresse1: '' }, [], '');
        expect(schema['address']['streetAddress']).toBe('');
    });

    it('hardkoder addressCountry til NO', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['address']['addressCountry']).toBe('NO');
    });
});

describe('buildSchema – åpningstider', () => {
    it('parser Mandag korrekt', () => {
        const schema = buildSchema({ ...baseSettings, businessHours2: '', businessHours3: '', businessHours4: '', businessHours5: '' }, [], '');
        const specs = schema['openingHoursSpecification'];
        expect(specs).toHaveLength(1);
        expect(specs[0]).toEqual({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday'],
            opens: '08:00',
            closes: '15:30',
        });
    });

    it('prosesserer alle fem businessHours-felt', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['openingHoursSpecification']).toHaveLength(5);
    });

    it('hopper over dagsnavn som ikke er i DAG_MAP (regex matcher, men mapping mangler)', () => {
        // 'Sunday' matcher regex (\w+) men er ikke i DAG_MAP — treffer linje 15 i buildSchema
        const schema = buildSchema({ ...baseSettings, businessHours1: 'Sunday: 08:00 - 16:00', businessHours2: '', businessHours3: '', businessHours4: '', businessHours5: '' }, [], '');
        expect(schema['openingHoursSpecification']).toHaveLength(0);
    });

    it('hopper over tom streng', () => {
        const schema = buildSchema({ ...baseSettings, businessHours1: '', businessHours2: '', businessHours3: '', businessHours4: '', businessHours5: '' }, [], '');
        expect(schema['openingHoursSpecification']).toHaveLength(0);
    });
});

describe('buildSchema – geo', () => {
    it('inkluderer GeoCoordinates med latitude og longitude', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['geo']).toEqual({
            '@type': 'GeoCoordinates',
            latitude: '58.9690',
            longitude: '5.7331',
        });
    });
});

describe('buildSchema – hasMap', () => {
    it('peker til Google Business Profile', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['hasMap']).toBe('https://maps.google.com/?cid=1532811702748545219');
    });
});

describe('buildSchema – image', () => {
    it('utelates fra schema når siteUrl er tom', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema).not.toHaveProperty('image');
    });

    it('inkluderes som ImageObject når siteUrl er satt', () => {
        const schema = buildSchema(baseSettings, [], 'https://tennerogtrivsel.no');
        expect(schema['image']).toEqual({
            '@type': 'ImageObject',
            url: 'https://tennerogtrivsel.no/hovedbilde.png',
        });
    });
});

describe('buildSchema – tjenester', () => {
    it('utelater availableService når tjenestelisten er tom', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema).not.toHaveProperty('availableService');
    });

    it('inkluderer availableService med korrekt struktur', () => {
        const tjenester = [
            { data: { title: 'Tannbleking' } },
            { data: { title: 'Tannrens' } },
        ];
        const schema = buildSchema(baseSettings, tjenester, '');
        expect(schema['availableService']).toEqual([
            { '@type': 'MedicalProcedure', name: 'Tannbleking' },
            { '@type': 'MedicalProcedure', name: 'Tannrens' },
        ]);
    });

    it('utelater inaktive tjenester', () => {
        const tjenester = [
            { data: { title: 'Aktiv' } },
            { data: { title: 'Skjult', active: false } },
        ];
        const schema = buildSchema(baseSettings, tjenester, '');
        expect(schema['availableService']).toEqual([{ '@type': 'MedicalProcedure', name: 'Aktiv' }]);
    });

    it('utelater availableService når alle tjenester er inaktive', () => {
        const schema = buildSchema(baseSettings, [{ data: { title: 'Skjult', active: false } }], '');
        expect(schema).not.toHaveProperty('availableService');
    });
});

describe('buildSchema – contactPoint', () => {
    it('beskriver telefonen som veien til timebestilling', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['contactPoint']).toEqual({
            '@type': 'ContactPoint',
            telephone: '51 84 34 40',
            contactType: 'reservations',
            availableLanguage: ['nb'],
            hoursAvailable: schema['openingHoursSpecification'],
        });
    });

    it('utelates når phone1 er tom', () => {
        const schema = buildSchema({ ...baseSettings, phone1: '' }, [], '');
        expect(schema).not.toHaveProperty('contactPoint');
    });
});

describe('klinikkId', () => {
    it.each([
        ['https://www.tennerogtrivsel.no/', 'https://www.tennerogtrivsel.no/#klinikk'],
        ['https://www.tennerogtrivsel.no', 'https://www.tennerogtrivsel.no/#klinikk'],
        ['', ''],
    ])('klinikkId(%j) → %j', (siteUrl, forventet) => {
        expect(klinikkId(siteUrl)).toBe(forventet);
    });
});

describe('buildPersonSchema', () => {
    const tannlege = { name: 'Kari Nordmann', title: 'Tannlege', description: 'Spesialist i kjeveortopedi' };

    it('beskriver tannlegen som Person som jobber på klinikken', () => {
        expect(buildPersonSchema(tannlege, 'https://www.tennerogtrivsel.no/')).toEqual({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: 'Kari Nordmann',
            jobTitle: 'Tannlege',
            description: 'Spesialist i kjeveortopedi',
            worksFor: { '@id': 'https://www.tennerogtrivsel.no/#klinikk' },
        });
    });

    it('utelater tom description', () => {
        expect(buildPersonSchema({ ...tannlege, description: '' }, 'https://www.tennerogtrivsel.no/'))
            .not.toHaveProperty('description');
    });

    it('utelater worksFor uten siteUrl', () => {
        expect(buildPersonSchema(tannlege, '')).not.toHaveProperty('worksFor');
    });
});

describe('buildTjenesteSideSchema', () => {
    const tjeneste = { title: 'Tannbleking', ingress: 'Hvitere tenner.' };
    const url = 'https://www.tennerogtrivsel.no/tjenester/tannbleking/';

    it('beskriver siden som MedicalWebPage om behandlingen', () => {
        expect(buildTjenesteSideSchema(tjeneste, url, 'https://www.tennerogtrivsel.no/', '2026-10-01T10:00:00.000Z')).toEqual({
            '@context': 'https://schema.org',
            '@type': 'MedicalWebPage',
            url,
            name: 'Tannbleking',
            description: 'Hvitere tenner.',
            dateModified: '2026-10-01T10:00:00.000Z',
            publisher: { '@id': 'https://www.tennerogtrivsel.no/#klinikk' },
            about: { '@type': 'MedicalProcedure', name: 'Tannbleking' },
        });
    });

    it('utelater dateModified når datoen mangler', () => {
        expect(buildTjenesteSideSchema(tjeneste, url, 'https://www.tennerogtrivsel.no/'))
            .not.toHaveProperty('dateModified');
    });

    it('utelater publisher uten siteUrl', () => {
        expect(buildTjenesteSideSchema(tjeneste, url, '')).not.toHaveProperty('publisher');
    });
});

describe('serializeJsonLd', () => {
    it('escaper < så innholdet ikke kan avslutte script-taggen', () => {
        const obj = { a: '</script><b>' };
        const json = serializeJsonLd(obj);
        expect(json).not.toContain('<');
        expect(JSON.parse(json)).toEqual(obj);
    });
});
