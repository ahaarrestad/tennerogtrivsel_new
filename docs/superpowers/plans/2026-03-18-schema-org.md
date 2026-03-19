# Schema.org JSON-LD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gjøre SchemaOrg-komponenten fullt datadriven ved å flytte all konstruksjonslogikk til en testbar utility-funksjon `buildSchema`.

**Architecture:** Ny ren funksjon `buildSchema.ts` håndterer all logikk (åpningstider, adresse, tjenester, bilde). `SchemaOrg.astro` forenkles til ren rendering av et ferdig objekt. `Layout.astro` henter tjenester og kaller `buildSchema` før rendering.

**Tech Stack:** TypeScript, Astro (getCollection, content collections), Vitest

---

## Filer

| Fil | Endring |
|-----|---------|
| `src/scripts/buildSchema.ts` | Opprett ny |
| `src/scripts/__tests__/buildSchema.test.ts` | Opprett ny |
| `src/components/SchemaOrg.astro` | Props: `settings` → `schema: object` |
| `src/layouts/Layout.astro` | Hent tjenester, kall `buildSchema`, send `schema` |

---

### Task 1: Skriv tester for `buildSchema`

**Files:**
- Create: `src/scripts/__tests__/buildSchema.test.ts`

- [ ] **Steg 1: Opprett testfilen**

```typescript
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

    it('hopper over ukjent dagsnavn uten feil', () => {
        const schema = buildSchema({ ...baseSettings, businessHours1: 'Lørdag: 10:00 - 14:00', businessHours2: '', businessHours3: '', businessHours4: '', businessHours5: '' }, [], '');
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
```

- [ ] **Steg 2: Kjør testene og verifiser at de feiler**

```bash
npx vitest run src/scripts/__tests__/buildSchema.test.ts
```

Forventet: FAIL — `Cannot find module '../buildSchema'`

---

### Task 2: Implementer `buildSchema`

**Files:**
- Create: `src/scripts/buildSchema.ts`

- [ ] **Steg 1: Skriv implementasjonen**

```typescript
const DAG_MAP: Record<string, string> = {
    Mandag: 'Monday',
    Tirsdag: 'Tuesday',
    Onsdag: 'Wednesday',
    Torsdag: 'Thursday',
    Fredag: 'Friday',
};

function parseOpeningHours(value: string): object | null {
    if (!value) return null;
    const match = value.match(/^(\w+):\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
    if (!match) return null;
    const [, dagNavn, opens, closes] = match;
    const dayOfWeek = DAG_MAP[dagNavn];
    if (!dayOfWeek) return null;
    return { '@type': 'OpeningHoursSpecification', dayOfWeek: [dayOfWeek], opens, closes };
}

function parseAddress(adresse1: string, adresse2: string): object {
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
): Record<string, unknown> {
    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Dentist',
        name: settings.siteTitle,
        description: settings.siteDescription,
        url: siteUrl || undefined,
        telephone: settings.phone1,
        address: parseAddress(settings.adresse1 ?? '', settings.adresse2 ?? ''),
        geo: {
            '@type': 'GeoCoordinates',
            latitude: settings.latitude,
            longitude: settings.longitude,
        },
        openingHoursSpecification: ['businessHours1', 'businessHours2', 'businessHours3', 'businessHours4', 'businessHours5']
            .map(key => parseOpeningHours(settings[key] ?? ''))
            .filter(Boolean),
        hasMap: `https://www.google.com/maps/search/?api=1&query=${settings.latitude},${settings.longitude}`,
    };

    if (settings.showEmail === 'ja') {
        schema.email = settings.email;
    }

    if (siteUrl) {
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
```

- [ ] **Steg 2: Kjør testene og verifiser at alle passerer**

```bash
npx vitest run src/scripts/__tests__/buildSchema.test.ts
```

Forventet: alle tester PASS

- [ ] **Steg 3: Sjekk branch coverage**

```bash
npx vitest run --coverage src/scripts/__tests__/buildSchema.test.ts
```

Forventet: branch coverage ≥ 80% for `buildSchema.ts`

- [ ] **Steg 4: Commit via `/commit`-skillen**

Bruk `/commit`-skillen (ALDRI `git commit` direkte — se prosjektregler).

---

### Task 3: Oppdater `SchemaOrg.astro`

**Files:**
- Modify: `src/components/SchemaOrg.astro`

Erstatt hele filen. Fra:
```astro
---
interface Props {
    settings: Record<string, string>;
}
const { settings } = Astro.props;
const schema = { ... }; // all konstruksjonslogikk
---
<script type="application/ld+json" set:html={JSON.stringify(schema)} />
```

Til:
```astro
---
interface Props {
    schema: object;
}
const { schema } = Astro.props;
---
<script type="application/ld+json" set:html={JSON.stringify(schema)} />
```

- [ ] **Steg 1: Erstatt innholdet i `SchemaOrg.astro`**

Ny fil:
```astro
---
interface Props {
    schema: object;
}

const { schema } = Astro.props;
---
<script type="application/ld+json" set:html={JSON.stringify(schema)} />
```

- [ ] **Steg 2: Commit via `/commit`-skillen**

Bruk `/commit`-skillen (ALDRI `git commit` direkte — se prosjektregler).

---

### Task 4: Oppdater `Layout.astro`

**Files:**
- Modify: `src/layouts/Layout.astro`

- [ ] **Steg 1: Legg til import og kall til `buildSchema`**

Legg til import øverst i frontmatter-blokken (etter eksisterende imports). Merk: `getCollection` er allerede importert på linje 14 — ikke legg til duplikat:
```ts
import { buildSchema } from '../scripts/buildSchema';
```

Legg til etter `const settings = await getSiteSettings();`:
```ts
const tjenester = await getCollection('tjenester');
const schema = buildSchema(settings, tjenester, Astro.site?.toString() ?? '');
```

- [ ] **Steg 2: Oppdater `SchemaOrg`-bruken i HTML**

Fra:
```astro
<SchemaOrg settings={settings} />
```

Til:
```astro
<SchemaOrg schema={schema} />
```

- [ ] **Steg 3: Kjør full testsuiten**

```bash
npx vitest run
```

Forventet: alle eksisterende tester passerer fortsatt

- [ ] **Steg 4: Bygg prosjektet for å verifisere ingen build-feil**

```bash
npm run build:ci
```

Forventet: bygg fullføres uten feil

- [ ] **Steg 5: Commit via `/commit`-skillen**

Bruk `/commit`-skillen (ALDRI `git commit` direkte — se prosjektregler).

---

## Etter implementasjon

Kjør quality gate (`/quality-gate`) og commit/push via `/commit`-skillen.
