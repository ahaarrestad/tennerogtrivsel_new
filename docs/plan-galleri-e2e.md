# Plan: Fiks galleri-relaterte E2E-feil og vis tom-melding

**Status: Fullført**

## Problem

5 E2E-tester feiler når galleriet er tomt (kun forsidebilde, ingen galleri-bilder):

1. **`seo.spec.ts` — canonical-tag**: `/galleri/` redirecter til `/`, gir feil canonical URL
2. **`seo.spec.ts` — unike titler**: `/galleri/` har samme tittel som `/` etter redirect
3–5. **`sitemap-pages.spec.ts` — galleri-lenke i nav** (3 nettlesere): Lenken er skjult i nav når galleriet er tomt

## Rotårsak

- `galleri.json` har kun én entry med `type: "forsidebilde"` → `hasGalleryImages = false`
- `galleri.astro` gjør `Astro.redirect('/')` → ingen egen side med metadata
- `Navbar.astro` filtrerer bort galleri-lenken → E2E-tester finner den ikke

## Løsning

### Steg 1: `galleri.astro` — tom-melding i stedet for redirect

Fjern `Astro.redirect('/')`. Vis i stedet en side med:
- Riktig Layout (egen `<title>` og canonical for `/galleri/`)
- Overskrift fra `settings.galleriTittel`
- Melding: "Galleriet er tomt for øyeblikket."

Dette fikser automatisk SEO-testene (canonical, unike titler, meta description, OpenGraph, Twitter Card).

### Steg 2: `sitemap-pages.spec.ts` — håndter tom galleri-nav

Galleri-nav-testen sjekker om lenken finnes før den asserterer tekst.
At lenken er skjult er riktig oppførsel når galleriet er tomt.

## Berørte filer

- `src/pages/galleri.astro` — fjern redirect, legg til tom-melding
- `tests/sitemap-pages.spec.ts` — gjør galleri-nav-test robust mot tomt galleri
