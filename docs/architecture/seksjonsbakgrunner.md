# Arkitektur: Seksjonsbakgrunner (variant-prop)

Seksjonskomponentene (`Kontakt`, `Galleri`, `Tjenester`, `Tannleger`) tar en `variant`-prop for å kontrollere bakgrunnsfarge:

```astro
interface Props { variant?: 'white' | 'brand' }
```

- `'brand'` → `bg-brand-light` på section, `bg-brand-light/95 md:bg-transparent` på sticky header
- `'white'` → `bg-white` på section, `bg-white/95` på sticky header

## Forsiden (index.astro): Annenhver-mønster

`index.astro` beregner variant dynamisk basert på om galleriet er synlig:

```
Forside:   hvit (hero, ingen variant)
Kontakt:   brand (alltid #1)
Galleri:   white (alltid #2, betinget synlig)
Tjenester: brand hvis galleri synlig, white hvis ikke
Tannleger: motsatt av Tjenester
```

## Standalone-sider: Alltid hvit

Egne sider (`/kontakt`, `/tjenester`, `/tannleger`) bruker **alltid `variant="white"`** for konsistent hvit bakgrunn. Annenhver-mønsteret gjelder kun forsiden.
