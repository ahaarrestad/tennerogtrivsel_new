# Design: Kollapserbare kategorier i prisliste-admin

## Problem

Prislisten i admin har mange kategorier med rader. Lange lister er vanskelige å navigere — brukeren må scrolle mye for å finne riktig kategori.

## Løsning

Kollapserbare kategori-seksjoner med per-kategori toggle og en global "Kollaps/Ekspander alle"-knapp.

## Interaksjon

- Klikk på kategori-headeren toggler kollaps/ekspansjon av den kategoriens rader
- Chevron-ikon i headeren roterer (ned = ekspandert, høyre = kollapset)
- Ikon-knapp for "Kollaps/Ekspander alle" plasseres i topplinjen til høyre, ved siden av "Ny prisrad" og "Print"-knappene — samme stil som de andre ikon-knappene
- Alle kategorier starter ekspandert ved lasting

## Implementasjon

Ren CSS/DOM — ingen ny state-håndtering eller API-endringer.

- Innholds-div (`px-6 py-2`) i hver kategori toggler `hidden`-klasse
- Headeren får `cursor-pointer` og klikk-handler
- Chevron-ikon i headeren, roteres via CSS `transform: rotate()`
- Ikon-knappen i topplinjen bruker fold/unfold SVG-ikon (Lucide-stil, som resten av admin)
- Knappen toggler mellom "Kollaps alle" og "Ekspander alle" basert på nåværende tilstand

## Hva vi IKKE endrer

- API-kall, datastruktur, reorder-logikk — uberørt
- Ingen ny state i localStorage eller URL

## Testing

- Klikk header → rader skjules
- Klikk header igjen → rader vises
- Ikon-knapp → alle kollapser, knappikon endres
- Klikk igjen → alle ekspanderer
