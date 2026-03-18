# Design: Schema.org strukturerte data (JSON-LD)

## Mål

Forbedre og utvide eksisterende `SchemaOrg.astro`-komponent til å være fullt datadriven og dekke alle relevante Schema.org-felter for en tannklinikk. All konstruksjonslogikk flyttes til en testbar utility-funksjon.

---

## Arkitektur

```
src/scripts/buildSchema.ts        ← ny: ren funksjon, fullt testbar
src/components/SchemaOrg.astro    ← forenkles til bare rendering
src/layouts/Layout.astro          ← sender inn settings, tjenester og siteUrl
```

### Funksjonssignatur

```ts
export function buildSchema(
    settings: Record<string, string>,
    services: Array<{ data: { title: string } }>,
    siteUrl: string
): object
```

`Layout.astro` kaller:
```ts
const tjenester = await getCollection('tjenester');
const schema = buildSchema(settings, tjenester, Astro.site?.toString() ?? '');
```

Tjenester-content-collection har `title`-felt i sin schema (Zod). `entry.data.title` er det eneste feltet som brukes.

`SchemaOrg.astro` mottar `schema: object` som prop og serialiserer til JSON-LD.

### SchemaOrg.astro Props-interface

```ts
interface Props {
    schema: object;
}
```

Komponenten gjør ingenting annet enn:
```astro
<script type="application/ld+json" set:html={JSON.stringify(schema)} />
```

---

## Schema-felter

Alle felter samles i ett `Dentist`-skjema som legges i `<head>` på alle sider via Layout.

| Felt | Kilde |
|------|-------|
| `@context` | Hardkodet `"https://schema.org"` |
| `@type` | Hardkodet `"Dentist"` |
| `name` | `settings.siteTitle` |
| `description` | `settings.siteDescription` |
| `url` | `siteUrl`-parameter |
| `telephone` | `settings.phone1` |
| `email` | `settings.email` (kun hvis `settings.showEmail === "ja"`) |
| `address` | Parset fra `settings.adresse1` + `settings.adresse2` |
| `geo` | `settings.latitude` / `settings.longitude` |
| `openingHoursSpecification` | Parset fra `settings.businessHours1`–`businessHours5` |
| `image` | `ImageObject` med `url: new URL('/hovedbilde.png', siteUrl).href` — utelates hvis `siteUrl` er tom |
| `hasMap` | Google Maps-URL konstruert fra lat/lng |
| `medicalSpecialty` | Utelates — `@type: "Dentist"` kommuniserer allerede spesialiteten |
| `availableService` | Tjenester fra content-collection (`@type: "MedicalProcedure"`) — utelates hvis tom liste |

---

## Parsing-logikk

### Åpningstider

Inndata: `"Mandag: 08:00 - 15:30"`

Format: `/<DagNavn>: (\d{2}:\d{2}) - (\d{2}:\d{2})/`

Norsk → engelsk dag-mapping:
```
Mandag→Monday, Tirsdag→Tuesday, Onsdag→Wednesday,
Torsdag→Thursday, Fredag→Friday
```

- Én `OpeningHoursSpecification` per dag, med `@type: "OpeningHoursSpecification"`
- Tomme/manglende felter hoppes over
- Oppføringer der dagnavn ikke matcher mapping hoppes over (ikke feil)
- Alle fem felt `businessHours1`–`businessHours5` prosesseres

### geo

```ts
{
    "@type": "GeoCoordinates",
    "latitude": settings.latitude,
    "longitude": settings.longitude
}
```

Inkluderes alltid (samme oppførsel som eksisterende komponent).

### Adresse

Inndata `adresse2`: `"4011 Stavanger"`

```ts
const firstSpace = adresse2.indexOf(' ');
if (firstSpace === -1) {
    postalCode = '';
    addressLocality = adresse2;
} else {
    postalCode = adresse2.slice(0, firstSpace);
    addressLocality = adresse2.slice(firstSpace + 1); // alt etter første mellomrom
}
```

- `adresse1` brukes direkte som `streetAddress` (tom streng hvis ikke satt)
- `addressCountry` hardkodet til `"NO"`

### image

Kun inkludert hvis `siteUrl` er ikke-tom:

```ts
if (siteUrl) {
    schema.image = {
        "@type": "ImageObject",
        "url": new URL('/hovedbilde.png', siteUrl).href
    };
}
```

### hasMap-URL

```
https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}
```

Inkluderes alltid (selv om lat/lng er tomme strenger) — samme oppførsel som eksisterende komponent.

### Tjenester

```ts
services.map(entry => ({
    "@type": "MedicalProcedure",
    "name": entry.data.title
}))
```

Feltet `availableService` utelates helt fra schema-objektet hvis `services` er tom.

---

## Testing

Fil: `src/scripts/__tests__/buildSchema.test.ts`

### `@context` og toppnivå
- Returnert objekt inneholder `"@context": "https://schema.org"` og `"@type": "Dentist"`

### Åpningstider
- `"Mandag: 08:00 - 15:30"` → `{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday"], opens: "08:00", closes: "15:30" }`
- Korrekt `opens`/`closes` trekkes ut
- Ukjent dagsnavn (f.eks. `"Lørdag: 10:00 - 14:00"`) hoppes over uten feil
- Tom streng hoppes over
- Alle fem `businessHours1`–`businessHours5` prosesseres og gir fem spec-innslag

### Adresse
- Standard: `"4011 Stavanger"` → `postalCode: "4011"`, `addressLocality: "Stavanger"`
- Flerdelt by: `"5020 Bergen sentrum"` → `postalCode: "5020"`, `addressLocality: "Bergen sentrum"`
- Ingen mellomrom: `"Ukjent"` → `postalCode: ""`, `addressLocality: "Ukjent"`
- Tom `adresse1`: `streetAddress: ""`

### email
- Utelates når `showEmail !== "ja"`
- Inkluderes når `showEmail === "ja"`

### image
- Utelates fra schema-objektet når `siteUrl` er tom streng
- Inkluderes som `ImageObject` med korrekt `url` når `siteUrl` er satt

### Tjenester
- Tom liste: `availableService` utelates fra schema-objektet
- Liste med innslag: `availableService` inkluderes med korrekt struktur (`@type: "MedicalProcedure"`, `name`)

### geo
- `geo`-feltet inneholder `latitude` og `longitude` fra settings med `@type: "GeoCoordinates"`

### hasMap
- URL konstrueres korrekt fra lat/lng

`SchemaOrg.astro` trenger ingen egne tester (ren rendering uten logikk).

---

## Filer som endres

| Fil | Endring |
|-----|---------|
| `src/scripts/buildSchema.ts` | Ny fil |
| `src/scripts/__tests__/buildSchema.test.ts` | Ny fil |
| `src/components/SchemaOrg.astro` | Forenkles — props endres fra `settings` til `schema` |
| `src/layouts/Layout.astro` | Henter tjenester, kaller `buildSchema`, sender `schema` til komponent |
