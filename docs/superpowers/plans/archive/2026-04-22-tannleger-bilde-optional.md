# Tannleger-bilde på framsiden valgfritt – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skjul tannleger-seksjonen på framsiden hvis ingen fellesbilde er satt; tannlege-siden forblir alltid tilgjengelig via menyen.

**Architecture:** `Tannleger.astro` beregner allerede `hasFellesbilde` internt — vi legger til en betingelse som skrur av rendringen når den er false. `Layout.astro` gjør samme sjekk for å fortelle `Navbar` om den skal lenke til `/#tannleger` (anchor) eller `/tannleger` (full side).

**Tech Stack:** Astro 5, TypeScript, Vitest

---

## Filkart

| Fil | Endring |
|-----|---------|
| `src/components/Tannleger.astro` | Pakk hele `<section>` i `{hasFellesbilde && ...}` |
| `src/layouts/Layout.astro` | Beregn `showTannleger`, send til `<Navbar>` |
| `src/components/Navbar.astro` | Nytt prop `showTannleger`, bytt desktoplenke |

Ingen nye script-filer → ingen coverage-krav utover at eksisterende tester fortsatt er grønne.

---

### Task 1: Tannleger.astro — skjul seksjon når ingen fellesbilde

**Files:**
- Modify: `src/components/Tannleger.astro`

- [ ] **Step 1: Wrap template i betingelse**

Erstatt gjeldende template (linje 25–52) med:

```astro
{hasFellesbilde && (
<section id="tannleger" class={`section-container ${sectionBg}`}>
    <div class="section-content">
        <SectionHeader title={settings.tannlegerTittel} intro={settings.tannlegerTekst} headerBg={headerBg} sticky />

        <a href="/tannleger" class="block rounded-2xl overflow-hidden border border-brand-border/60 shadow-sm transition-all duration-300 hover:shadow-md hover:border-brand-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <div class="relative aspect-[16/9]">
                <Image
                    src={images[fellesbildePath]()}
                    alt={fellesbildeEntry?.data.altText || 'Gruppebilde av teamet hos Tenner og Trivsel'}
                    class="absolute inset-0 w-full h-full object-cover"
                    style={fellesbildeStyle}
                />
                <div class="absolute inset-0 image-overlay-gradient-full" />
                <div class="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                    <h3 class="font-heading font-extrabold text-2xl md:text-3xl text-white">
                        {settings.tannlegerTittel || 'Våre tannleger'}
                    </h3>
                </div>
            </div>
        </a>
    </div>
</section>
)}
```

Placeholder-fallback-blokken (opprinnelig linje 38–41) fjernes — den erstattes av at seksjonen ikke rendres i det hele tatt.

- [ ] **Step 2: Verifiser lokalt**

```bash
npm run build 2>&1 | tail -20
```

Bygg skal gå gjennom uten feil. Ingen `<section id="tannleger">` i HTML-output når galleri.json ikke har en entry med `type === 'fellesbilde'` og satt `image`-felt.

- [ ] **Step 3: Commit** via `/commit`-skillen

---

### Task 2: Layout.astro — beregn showTannleger

**Files:**
- Modify: `src/layouts/Layout.astro:23`

- [ ] **Step 1: Legg til showTannleger etter eksisterende showGalleri-linje (linje 23)**

Eksisterende kode:
```js
const galleri = await getCollection('galleri');
const showGalleri = galleri.some(item => (item.data.type ?? 'galleri') === 'galleri');
```

Legg til linjen under:
```js
const galleri = await getCollection('galleri');
const showGalleri = galleri.some(item => (item.data.type ?? 'galleri') === 'galleri');
const showTannleger = galleri.some(item => item.data.type === 'fellesbilde' && !!item.data.image);
```

- [ ] **Step 2: Send showTannleger til Navbar**

Eksisterende linje (~linje 78):
```astro
<Navbar settings={settings} showGalleri={showGalleri} />
```

Endre til:
```astro
<Navbar settings={settings} showGalleri={showGalleri} showTannleger={showTannleger} />
```

- [ ] **Step 3: Commit** via `/commit`-skillen

---

### Task 3: Navbar.astro — bruk showTannleger i lenken

**Files:**
- Modify: `src/components/Navbar.astro`

- [ ] **Step 1: Legg til showTannleger i Props-grensesnittet og destrukturering**

Eksisterende linje 6–7:
```astro
interface Props { settings?: Record<string, string>; showGalleri?: boolean; }
const { settings = {}, showGalleri = true } = Astro.props;
```

Endre til:
```astro
interface Props { settings?: Record<string, string>; showGalleri?: boolean; showTannleger?: boolean; }
const { settings = {}, showGalleri = true, showTannleger = true } = Astro.props;
```

- [ ] **Step 2: Bruk dynamisk href for tannleger-lenken**

Eksisterende linje 14:
```js
{ name: settings.tannlegerTittel || 'Om oss', href: '/#tannleger', mobileHref: '/tannleger' },
```

Endre til:
```js
{ name: settings.tannlegerTittel || 'Om oss', href: showTannleger ? '/#tannleger' : '/tannleger', mobileHref: '/tannleger' },
```

- [ ] **Step 3: Kjør eksisterende tester**

```bash
npm run test -- --reporter=verbose 2>&1 | tail -30
```

Forventet: alle tester grønne. Ingen script-logikk er endret, så dekningsgraden for scripts er uendret.

- [ ] **Step 4: Commit** via `/commit`-skillen
