import { describe, it, expect } from 'vitest';
import { buildSchema } from '../buildSchema';

const baseSettings: Record<string, string> = {
    siteTitle: 'Tenner og Trivsel',
    siteDescription: 'Din tannklinikk',
    phone1: '51 84 34 40',
    email: 'post@tennerogtrivsel.no',
    showEmail: 'ja',
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
        expect(schema['@type']).toBe('Dentist');
    });

    it('mapper siteTitle til name', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['name']).toBe('Tenner og Trivsel');
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

describe('buildSchema – email', () => {
    it('inkluderer email når showEmail === "ja"', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['email']).toBe('post@tennerogtrivsel.no');
    });

    it('utelater email når showEmail !== "ja"', () => {
        const schema = buildSchema({ ...baseSettings, showEmail: 'nei' }, [], '');
        expect(schema).not.toHaveProperty('email');
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
    it('konstruerer Google Maps-URL fra lat/lng', () => {
        const schema = buildSchema(baseSettings, [], '');
        expect(schema['hasMap']).toBe(
            'https://www.google.com/maps/search/?api=1&query=58.9690,5.7331'
        );
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
});
