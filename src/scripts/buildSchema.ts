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

interface DentistSchema {
    '@context': string;
    '@type': string;
    name: string;
    description: string;
    telephone: string;
    address: PostalAddress;
    geo: { '@type': 'GeoCoordinates'; latitude: string; longitude: string };
    openingHoursSpecification: OpeningHoursSpec[];
    hasMap: string;
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

export function buildSchema(
    settings: Record<string, string>,
    services: Array<{ data: { title: string } }>,
    siteUrl: string
): DentistSchema {
    const schema: DentistSchema = {
        '@context': 'https://schema.org',
        '@type': 'Dentist',
        name: settings.siteTitle,
        description: settings.siteDescription,
        telephone: settings.phone1,
        address: parseAddress(settings.adresse1 ?? '', settings.adresse2 ?? ''),
        geo: {
            '@type': 'GeoCoordinates',
            latitude: settings.latitude,
            longitude: settings.longitude,
        },
        openingHoursSpecification: ['businessHours1', 'businessHours2', 'businessHours3', 'businessHours4', 'businessHours5']
            .map(key => parseOpeningHours(settings[key] ?? ''))
            .filter((spec): spec is OpeningHoursSpec => spec !== null),
        hasMap: `https://www.google.com/maps/search/?api=1&query=${settings.latitude},${settings.longitude}`,
    };

    if (siteUrl) {
        schema.url = siteUrl;
        schema.image = {
            '@type': 'ImageObject',
            url: new URL('/hovedbilde.png', siteUrl).href,
        };
    }

    if (services.length > 0) {
        schema.availableService = services.map(entry => ({
            '@type': 'MedicalProcedure',
            name: entry.data.title,
        }));
    }

    return schema;
}
