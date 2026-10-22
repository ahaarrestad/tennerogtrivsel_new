const GOOGLE_BUSINESS_PROFILE = 'https://maps.google.com/?cid=1532811702748545219';

const DAG_MAP: Record<string, string> = {
    Mandag: 'Monday',
    Tirsdag: 'Tuesday',
    Onsdag: 'Wednesday',
    Torsdag: 'Thursday',
    Fredag: 'Friday',
};

interface OpeningHoursSpec {
    '@type': 'OpeningHoursSpecification';
    dayOfWeek: string[];
    opens: string;
    closes: string;
}

interface PostalAddress {
    '@type': 'PostalAddress';
    streetAddress: string;
    addressLocality: string;
    postalCode: string;
    addressCountry: string;
}

interface ContactPoint {
    '@type': 'ContactPoint';
    telephone: string;
    contactType: string;
    availableLanguage: string[];
    hoursAvailable: OpeningHoursSpec[];
}

interface DentistSchema {
    '@context': string;
    '@type': string[];
    '@id'?: string;
    name: string;
    description: string;
    telephone: string;
    address: PostalAddress;
    geo: { '@type': 'GeoCoordinates'; latitude: string; longitude: string };
    openingHoursSpecification: OpeningHoursSpec[];
    hasMap: string;
    sameAs: string[];
    contactPoint?: ContactPoint;
    url?: string;
    image?: { '@type': 'ImageObject'; url: string };
    availableService?: Array<{ '@type': 'MedicalProcedure'; name: string }>;
}

function parseOpeningHours(value: string): OpeningHoursSpec | null {
    if (!value) return null;
    const match = value.match(/^([\p{L}]+):\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/u);
    if (!match) return null;
    const [, dagNavn, opens, closes] = match;
    const dayOfWeek = DAG_MAP[dagNavn];
    if (!dayOfWeek) return null;
    return { '@type': 'OpeningHoursSpecification', dayOfWeek: [dayOfWeek], opens, closes };
}

function parseAddress(adresse1: string, adresse2: string): PostalAddress {
    const firstSpace = adresse2.indexOf(' ');
    const postalCode = firstSpace === -1 ? '' : adresse2.slice(0, firstSpace);
    const addressLocality = firstSpace === -1 ? adresse2 : adresse2.slice(firstSpace + 1);
    return {
        '@type': 'PostalAddress',
        streetAddress: adresse1,
        addressLocality,
        postalCode,
        addressCountry: 'NO',
    };
}

/** Stabil identitet for klinikken, som side-schema peker til med `{ '@id': ... }`. */
export function klinikkId(siteUrl: string): string {
    if (!siteUrl) return '';
    return new URL('#klinikk', siteUrl).href;
}

export function buildSchema(
    settings: Record<string, string>,
    services: Array<{ data: { title: string; active?: boolean } }>,
    siteUrl: string
): DentistSchema {
    const openingHours = ['businessHours1', 'businessHours2', 'businessHours3', 'businessHours4', 'businessHours5']
        .map(key => parseOpeningHours(settings[key] ?? ''))
        .filter((spec): spec is OpeningHoursSpec => spec !== null);

    // MedicalClinic gjør availableService gyldig — egenskapen er ikke definert på Dentist alene.
    const schema: DentistSchema = {
        '@context': 'https://schema.org',
        '@type': ['Dentist', 'MedicalClinic'],
        name: (settings.siteTitle ?? '').split('|')[0].trim(),
        description: settings.siteDescription,
        telephone: settings.phone1,
        address: parseAddress(settings.adresse1 ?? '', settings.adresse2 ?? ''),
        geo: {
            '@type': 'GeoCoordinates',
            latitude: settings.latitude,
            longitude: settings.longitude,
        },
        openingHoursSpecification: openingHours,
        hasMap: GOOGLE_BUSINESS_PROFILE,
        sameAs: [GOOGLE_BUSINESS_PROFILE],
    };

    // Klinikken tar ikke imot nettbestilling — timer bestilles på telefon.
    if (settings.phone1) {
        schema.contactPoint = {
            '@type': 'ContactPoint',
            telephone: settings.phone1,
            contactType: 'reservations',
            availableLanguage: ['nb'],
            hoursAvailable: openingHours,
        };
    }

    if (siteUrl) {
        schema['@id'] = klinikkId(siteUrl);
        schema.url = siteUrl;
        schema.image = {
            '@type': 'ImageObject',
            url: new URL('/hovedbilde.png', siteUrl).href,
        };
    }

    const synlige = services.filter(entry => entry.data.active !== false);
    if (synlige.length > 0) {
        schema.availableService = synlige.map(entry => ({
            '@type': 'MedicalProcedure',
            name: entry.data.title,
        }));
    }

    return schema;
}

export function buildPersonSchema(
    tannlege: { name: string; title: string; description?: string },
    siteUrl: string
): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: tannlege.name,
        jobTitle: tannlege.title,
        ...(tannlege.description && { description: tannlege.description }),
        ...(siteUrl && { worksFor: { '@id': klinikkId(siteUrl) } }),
    };
}

export function buildTjenesteSideSchema(
    tjeneste: { title: string; ingress: string },
    url: string,
    siteUrl: string,
    dateModified?: string
): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'MedicalWebPage',
        url,
        name: tjeneste.title,
        description: tjeneste.ingress,
        ...(dateModified && { dateModified }),
        ...(siteUrl && { publisher: { '@id': klinikkId(siteUrl) } }),
        about: { '@type': 'MedicalProcedure', name: tjeneste.title },
    };
}

/** JSON for `<script type="application/ld+json">`. `<` escapes så innhold fra Drive ikke kan lukke taggen. */
export function serializeJsonLd(obj: object): string {
    return JSON.stringify(obj).replace(/</g, '\\u003c');
}
