# Bildeutsnitt: deaktiver posisjons-slidere som ikke har effekt

## Problem

I admin (galleri og tannleger) har bildeutsnittet tre slidere: Zoom, X og Y, hver med −/+-knapper.
Forhåndsvisningen bruker `object-fit: cover` + `object-position: X% Y%` + `transform: scale(zoom)`
med `transform-origin: X% Y%` — samme stil som den publiserte siden (`buildImageStyle` i
`src/scripts/image-config.js`).

Ved zoom 1,0 flytter `object-position` kun langs aksen der bildet er *større* enn rammen etter
`cover`-skalering, og `transform-origin` har ingen effekt. Konsekvens:

- Bildet har samme form som rammen → verken X eller Y gjør noe.
- Bildet er bredere enn rammen → kun X virker. Høyere enn rammen → kun Y virker.

Sliderne ser likevel aktive ut. Redaktøren drar i dem, ingenting skjer, og det ser ut som en bug
(rapportert av eier 2026-11-22). Rammene har ulik form (forsidebilde 16:10, fellesbilde 16:9,
galleri 4:3, tannleger 3:4), så det er umulig å forutsi uten å vite om dette.

## Mål

Kontrollene skal vise om de har effekt: en slider (og −/+-knappene) som ikke kan flytte bildet er
deaktivert med en kort forklaring, og blir aktiv igjen straks den får effekt.

## Krav og akseptansekriterier

1. **Regel per akse.** En akse er *flyttbar* når zoom > 1,0, eller når bildet etter `cover`
   stikker utenfor rammen langs den aksen med mer enn 1 % (X: bildets bredde/høyde-forhold >
   rammens × 1,01; Y: omvendt). Toleransen hindrer at en nesten-match (få piksler å flytte)
   regnes som flyttbar.
2. **Deaktivert tilstand.** Ikke-flyttbar akse: range-input og begge step-knapper får
   `disabled`, vises dempet (`cursor-not-allowed`, redusert opasitet, ingen hover-effekt), og en
   hint-tekst vises under slideren:
   - X: «Bildet fyller rammen i bredden — øk zoom for å flytte sideveis.»
   - Y: «Bildet fyller rammen i høyden — øk zoom for å flytte opp eller ned.»
   Hinten er knyttet til slideren med `aria-describedby`. Zoom-slideren deaktiveres aldri.
3. **Live oppdatering.** Tilstanden beregnes på nytt når:
   - zoom endres (slider eller −/+) — f.eks. zoom 1,0 → 1,01 aktiverer begge akser, tilbake til
     1,0 deaktiverer igjen;
   - bildet lastes eller byttes (bildevelger/opplasting) — beregnes på `load` når bildets
     naturlige størrelse er kjent;
   - rammens form endres (forsidebilde/fellesbilde-avkrysning i galleri).
4. **Verdien bevares.** Deaktivering endrer ikke X/Y-verdien; den lagres som før, og brukes igjen
   så snart zoom økes.
5. **Ukjent → ikke blokker.** Mangler bilde, eller er bildets/rammens størrelse 0 (ikke lastet,
   skjult), er begge akser aktive (dagens oppførsel).
6. Gjelder begge editorer som bruker `renderImageCropSliders`: galleri (`admin-module-bilder.js`)
   og tannleger (`admin-module-tannleger.js`).

## Non-goals

- Ingen endring av hvordan utsnittet lagres eller rendres på den publiserte siden.
- Ingen auto-justering av X/Y (f.eks. nullstille til 50 %).
- Ingen dra-for-å-panorere direkte i forhåndsvisningen.
- Ingen endring av zoom-slideren eller dens område.

## Designvalg

- **Aspektforhold, ikke piksler.** Flyttbarhet avhenger bare av bildets og rammens
  bredde/høyde-forhold pluss zoom, så regelen er en ren funksjon som kan enhetstestes uten DOM.
  Rammens forhold måles fra containerens `clientWidth/clientHeight` (ikke hardkodet per type), så
  den følger aspect-klassen automatisk.
- **Deaktiver framfor å skjule.** Skjulte slidere ville få layouten til å hoppe når zoom endres,
  og redaktøren mister informasjonen om at aksen finnes. Dempet + hint forklarer *hvorfor* og *hva
  som skal til*.
- **Eksplisitte kall framfor ResizeObserver.** Hendelsene som endrer tilstanden er få og kjente
  (zoom, bilde-load, typebytte). jsdom mangler ResizeObserver, og eksplisitte kall er enklere å
  teste.
- **Admin-forhåndsvisningen speiler siden.** Siden bruker faste rammer (Forside 16:10, Tannleger
  16:9, Galleri 4:3, tannleger-siden 3:4) og Astro-bilder skalert på bredde (forholdet bevares), så
  regelen i admin gjelder også for det publiserte bildet.
