# Plan: Hjelpetekst på alle admin-innstillinger

## Mål

Legge til forklarende hjelpetekst på alle felter i alle admin-moduler, etter samme mønster som Settings-modulen (`SETTING_HINTS`).

## Design

### Mønster

Alle hints rendres som `<p class="text-xs text-admin-muted-light -mt-0.5">` under label, over input. Settings-felter bruker prefix "Vises på: ". For dato-felter og lignende hvor "Vises på:" ikke gir mening, droppes prefixet.

### Hints per modul

#### Settings (manglende felter)

| Felt | Hint |
|------|------|
| businessHours3 | Kontakt, footer — format: «Dag(er): HH:MM - HH:MM» |
| businessHours4 | Kontakt, footer — format: «Dag(er): HH:MM - HH:MM» |
| businessHours5 | Kontakt, footer — format: «Dag(er): HH:MM - HH:MM» |

#### Finpussen (tjenester)

| Felt | Hint |
|------|------|
| title | Tjenestesiden, navigasjon |
| ingress | Tjenestekort på forsiden og tjenestesiden |
| content | Tjenestens detaljside |

#### Oppslagstavla (meldinger)

| Felt | Hint |
|------|------|
| title | Infobanner øverst på siden |
| startDate | Styrer når meldingen vises |
| endDate | Styrer når meldingen skjules |
| content | Infobanner, under tittelen |

#### Tannlegekrakken (tannleger)

| Felt | Hint |
|------|------|
| name | Tannlegekort og detaljside |
| title | Tannlegekort, under navnet |
| description | Tannlegekort og detaljside |
| image | Tannlegekort og detaljside |

#### Røntgenbildene (bilder)

| Felt | Hint |
|------|------|
| title | Bildetekst i galleriet |
| alt | Skjermlesere og søkemotorer |
| image | Galleri og forsidebilde |

#### Takstlista (prisliste)

| Felt | Hint |
|------|------|
| kategori | Gruppeoverskrift i prislisten |
| behandling | Rad i prislisten |
| pris | Rad i prislisten |

## Implementasjonssteg

1. **Settings**: Legg til businessHours3–5 i `SETTING_HINTS`
2. **Tjenester**: Legg til HINTS-objekt og rendre hints i `admin-module-tjenester.js`
3. **Meldinger**: Legg til HINTS-objekt og rendre hints i `admin-module-meldinger.js`
4. **Tannleger**: Legg til HINTS-objekt og rendre hints i `admin-module-tannleger.js`
5. **Bilder**: Legg til HINTS-objekt og rendre hints i `admin-module-bilder.js`
6. **Prisliste**: Legg til HINTS-objekt og rendre hints i `admin-module-prisliste.js`
7. **Tester**: Oppdater/skriv tester for at hints rendres korrekt
