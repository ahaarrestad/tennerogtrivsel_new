# Plan: Konsolidere og rydde i E2E-tester

## Bakgrunn

E2E-suiten har 7 aktive spec-filer (33 tester) som kjører i 3 nettlesere (chromium, webkit, Mobile Chrome) = **~99 nettleser-instanser**. Analysen viser overlapp og unødvendig bred nettleser-dekning for metadata-tester.

## Funn fra analyse

### 1. `homepage.spec.ts` er nesten helt redundant

| Test | Dekket av |
|------|-----------|
| Riktig tittel | `seo.spec.ts` (tittel + OG), `sitemap-pages.spec.ts` (tittel) |
| h1 synlig | `sitemap-pages.spec.ts` (nav synlig, indirekte) |
| Hovedseksjoner eksisterer | `sitemap-pages.spec.ts` (200 OK + innhold) |
| Mobilmeny fungerer | Unik — flyttes |

**Handling:** Slett filen. Flytt mobilmeny-testen til `sitemap-pages.spec.ts`.

### 2. Metadata-tester trenger ikke 3 nettlesere

`seo.spec.ts` og `links.spec.ts` sjekker HTML-metadata og HTTP-statuskoder. Disse er serverside-generert og identiske uavhengig av nettleser. Å kjøre dem i webkit og Mobile Chrome i tillegg til chromium gir null ekstra verdi.

**Handling:** Begrens `seo.spec.ts` og `links.spec.ts` til kun chromium via `grep`-tag.

### 3. Tjeneste-navigasjon testes i 4 filer

| Fil | Hva den tester |
|-----|---------------|
| `services.spec.ts` | Klikk → innhold + sidebar |
| `seo.spec.ts` | Klikk → tittel + OG-metadata |
| `links.spec.ts` | Navigerer → spot-sjekker 5 lenker |
| `sitemap-pages.spec.ts` | Navigerer → 200 OK + tittel |

**Handling:** Slå sammen `services.spec.ts` inn i `sitemap-pages.spec.ts` (sidebar-sjekk og innhold-sjekk som del av tjeneste-undersider-testen).

### 4. Overlappende statuskode-sjekker

`links.spec.ts` tester alle interne lenker for 200-status, og `sitemap-pages.spec.ts` tester alle hovedsider + tjeneste-undersider for 200-status.

**Handling:** Beholde begge — de har ulik vinkling. `links.spec.ts` finner lenker dynamisk (crawler), mens `sitemap-pages.spec.ts` tester spesifikke kjente sider. Ingen endring.

## Gjennomføringsplan

### Steg 1: Begrens nettlesere for metadata-tester

Legg til `test.describe` med tag `@chromium-only` i `seo.spec.ts` og `links.spec.ts`, og konfigurer Playwright til å filtrere:

**Alternativ (enklere):** Bruk `test.skip()` basert på prosjektnavn:
```ts
test.skip(({ browserName }) => browserName !== 'chromium', 'Metadata er nettleser-uavhengig');
```

Legg dette øverst i `seo.spec.ts` og `links.spec.ts`.

**Effekt:** −12 nettleser-instanser (6 tester × 2 nettlesere spart)

### Steg 2: Slett `homepage.spec.ts`, flytt mobilmeny-test

1. Flytt "mobilmeny skal fungere"-testen til `sitemap-pages.spec.ts`
2. Slett `homepage.spec.ts`

**Effekt:** −9 nettleser-instanser (3 tester × 3 nettlesere, men +1 for flyttet test = netto −8)

### Steg 3: Konsolider `services.spec.ts` inn i `sitemap-pages.spec.ts`

1. Legg til sidebar- og innhold-sjekk i den eksisterende tjeneste-undersider-testen i `sitemap-pages.spec.ts`
2. Slett `services.spec.ts`

**Effekt:** −6 nettleser-instanser (2 tester × 3 nettlesere, men funksjonaliteten innlemmes)

### Steg 4: Verifiser

1. Kjør full E2E-suite, bekreft at alle tester passerer
2. Sjekk at ingen dekning er tapt (alle opprinnelige sjekker ivaretas)

## Oppsummering

| Endring | Filer slettet | Nettleser-instanser spart |
|---------|--------------|--------------------------|
| Chromium-only for seo + links | 0 | ~12 |
| Slett homepage.spec.ts | 1 | ~8 |
| Konsolider services.spec.ts | 1 | ~4–6 |
| **Totalt** | **2** | **~24–26** |

**Før:** ~99 nettleser-instanser (33 tester × 3 nettlesere)
**Etter:** ~73 nettleser-instanser (~25% reduksjon)

Opprinnelig TODO-estimat var ~48 færre instanser, men det antok mer aggressiv konsolidering. Denne planen prioriterer å beholde alle reelle sjekker og kun fjerne ekte redundans.
