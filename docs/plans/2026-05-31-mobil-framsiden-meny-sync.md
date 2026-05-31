# Plan: Mobil — framsiden og meny ikke i sync

**Dato:** 2026-05-31
**Oppgave:** Rette to uavhengige synkroniseringsfeil mellom hva som vises på framsiden på mobil og hva menylenker peker på.

## Mål og avgrensninger

Rette presentasjonsfeil på mobil. Ingen logikk, dataflyt eller nye funksjoner.

## Steg

### 1 — Skjul Tjenester og Tannleger på mobil (`src/pages/index.astro`)

Wrap `<Tjenester>` og `<Tannleger>` i `<div class="hidden lg:block">`:

```astro
<div class="hidden lg:block">
    <Tjenester variant={tjenesterVariant} limit={6} />
</div>
<div class="hidden lg:block">
    <Tannleger variant={tannlegerVariant} />
</div>
```

Bakgrunnsfargelogikken er byggetid-beregnet og påvirkes ikke.

### 2 — Rett galleri `mobileHref` (`src/components/Navbar.astro`)

```diff
- { name: settings.galleriTittel || 'Klinikken vår', href: '/#galleri', mobileHref: '/galleri/' },
+ { name: settings.galleriTittel || 'Klinikken vår', href: '/#galleri', mobileHref: '/#galleri' },
```

## Testbehov

Ingen eksisterende tester berøres (bekreftet). Manuell verifikasjon på mobilbredde (< 1024px):
- Tjenester og Tannleger er ikke synlige på mobil-framsiden
- «Klinikken vår» i mobilmenyen scroller til `#galleri`-ankerpunktet

## Definition of done

- Endringene er i kode og quality gate passerer
- Manuell test bekreftet på mobilbredde

## Risiko

Lav — rene presentasjonsendringer i to filer.
