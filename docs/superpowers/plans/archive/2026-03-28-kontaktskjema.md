# Kontaktskjema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legg til et kontaktskjema som åpnes i en modal fra kontaktsiden — sender e-post via Lambda + SES, administreres via admin-panelet og Google Sheets.

**Architecture:** `kontaktskjema.json` synkroniseres fra Sheets ved bygg; `ContactButton.astro` og `ContactModal.astro` rendres kun når `aktiv === true`. Nettleseren POST-er til `/api/kontakt` (CloudFront-path) som CloudFront videresender til en Lambda Function URL med `X-Origin-Verify`-header. Admin-modulen gir klinikken full kontroll over innhold og tema-liste. Lambda-miljøvariabelen `KONTAKT_MOTTAKER_EPOST` oppdateres automatisk av CI/CD ved hvert bygg.

**Tech Stack:** Astro 5, TypeScript, Vitest (unit), AWS Lambda (Node.js 22), AWS SES, AWS DynamoDB, AWS SDK v3, `@googleapis/sheets`, `google-auth-library`

**Spec:** `docs/superpowers/specs/2026-03-28-kontaktskjema-design.md`

---

## Filstruktur

**Nye filer:**
- `src/content/kontaktskjema.json` — generert av sync (ikke committert)
- `src/components/ContactButton.astro`
- `src/components/ContactModal.astro` — inkl. form og klient-side `<script>`
- `src/scripts/contact-form.js` — klient-side logikk, testbar
- `src/scripts/__tests__/contact-form.test.js`
- `src/scripts/admin-module-kontaktskjema.js`
- `src/scripts/__tests__/admin-module-kontaktskjema.test.js`
- `lambda/kontakt-form-handler/index.mjs`
- `lambda/kontakt-form-handler/package.json`
- `scripts/read-kontakt-epost.mjs` — CLI-script for CI

**Endrede filer:**
- `src/scripts/sync-data.js` — legg til `syncKontaktSkjema` og kall i `runSync`
- `src/scripts/__tests__/sync-data.test.js` — tester for `syncKontaktSkjema`
- `src/content.config.ts` — legg til `kontaktskjema`-samling
- `src/__tests__/content.config.test.ts` — tester
- `src/components/Kontakt.astro` — legg til ContactButton + ContactModal
- `src/pages/personvern.astro` — betinget kontaktskjema-seksjon
- `src/scripts/admin-sheets.js` — legg til KontaktSkjema-funksjoner
- `src/scripts/__tests__/admin-sheets.test.js` — tester
- `src/scripts/admin-init.js` — import + routing for ny modul
- `src/pages/admin/index.astro` — nytt kort og data-attributt
- `.github/workflows/deploy.yml` — ny `update-lambda`-jobb

---

## Task 1: syncKontaktSkjema

**Files:**
- Modify: `src/scripts/sync-data.js`
- Modify: `src/scripts/__tests__/sync-data.test.js`

- [ ] **Steg 1: Skriv de failing testene**

Finn `describe`-blokken for prisliste-tester i `sync-data.test.js` og legg til **etter** den:

```javascript
describe('syncKontaktSkjema', () => {
    let writtenData;
    const SHEET_ID = 'test-sheet-id';

    beforeEach(() => {
        writtenData = null;
        process.env.PUBLIC_GOOGLE_SHEET_ID = SHEET_ID;
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com';
        process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----';
        vi.mocked(fs.writeFileSync).mockImplementation((_p, data) => { writtenData = JSON.parse(data); });
    });

    it('skriver korrekt JSON med aktiv=true og tema-liste', async () => {
        mockSheets.spreadsheets.values.get.mockResolvedValue({
            data: {
                values: [
                    ['Nøkkel', 'Verdi'],
                    ['aktiv', 'ja'],
                    ['tittel', 'Ta kontakt'],
                    ['tekst', 'Vi svarer raskt.'],
                    ['kontaktEpost', 'test@example.com'],
                    ['tema', 'Timebooking'],
                    ['tema', 'Priser'],
                ]
            }
        });
        const result = await syncKontaktSkjema();
        expect(writtenData).toEqual({
            aktiv: true,
            tittel: 'Ta kontakt',
            tekst: 'Vi svarer raskt.',
            tema: ['Timebooking', 'Priser'],
        });
        expect(writtenData.kontaktEpost).toBeUndefined();
        expect(result.kontaktEpost).toBe('test@example.com');
    });

    it('skriver aktiv=false når verdien er "nei"', async () => {
        mockSheets.spreadsheets.values.get.mockResolvedValue({
            data: { values: [['Nøkkel', 'Verdi'], ['aktiv', 'nei']] }
        });
        await syncKontaktSkjema();
        expect(writtenData.aktiv).toBe(false);
    });

    it('skriver tom standardfil og returnerer null-epost når arket ikke finnes', async () => {
        mockSheets.spreadsheets.values.get.mockRejectedValue(
            Object.assign(new Error('Unable to parse range'), { code: 400 })
        );
        const result = await syncKontaktSkjema();
        expect(writtenData).toEqual({ aktiv: false, tittel: '', tekst: '', tema: [] });
        expect(result.kontaktEpost).toBeNull();
    });

    it('filtrerer bort tomme tema-verdier', async () => {
        mockSheets.spreadsheets.values.get.mockResolvedValue({
            data: {
                values: [
                    ['Nøkkel', 'Verdi'],
                    ['aktiv', 'ja'],
                    ['tema', 'Timebooking'],
                    ['tema', ''],
                    ['tema', 'Priser'],
                ]
            }
        });
        await syncKontaktSkjema();
        expect(writtenData.tema).toEqual(['Timebooking', 'Priser']);
    });
});
```

Legg til `syncKontaktSkjema` i import-listen øverst i testfilen.

- [ ] **Steg 2: Kjør testene og bekreft at de feiler**

```bash
npx vitest run src/scripts/__tests__/sync-data.test.js --reporter=verbose 2>&1 | tail -20
```

Forventet: FAIL — `syncKontaktSkjema is not a function` e.l.

- [ ] **Steg 3: Implementer syncKontaktSkjema i sync-data.js**

Legg til `kontaktskjemaData`-path i `getConfig()` sitt `paths`-objekt:

```javascript
kontaktskjemaData: path.join(process.cwd(), 'src/content/kontaktskjema.json'),
```

Legg til funksjonen **etter** `syncPrisliste` og **før** `runSync`:

```javascript
export async function syncKontaktSkjema() {
    const config = getConfig();
    const sheets = getSheets();

    console.log('Synkroniserer kontaktskjema...');

    try {
        const rows = await getOptionalSheetValues(
            sheets, config.spreadsheetId, 'KontaktSkjema!A:B'
        );

        if (rows === null) {
            console.log('  Fane "KontaktSkjema" finnes ikke enda. Skriver tom fil.');
            fs.writeFileSync(
                config.paths.kontaktskjemaData,
                JSON.stringify({ aktiv: false, tittel: '', tekst: '', tema: [] })
            );
            return { kontaktEpost: null };
        }

        const dataRows = rows.slice(1);
        const getValue = (key) =>
            dataRows.find(r => r[0] === key)?.[1] ?? null;

        const aktiv = (getValue('aktiv') || '').toLowerCase() === 'ja';
        const tittel = String(getValue('tittel') || '');
        const tekst  = String(getValue('tekst')  || '');
        const kontaktEpost = String(getValue('kontaktEpost') || '');
        const tema   = dataRows
            .filter(r => r[0] === 'tema')
            .map(r => String(r[1] || '').trim())
            .filter(Boolean);

        fs.writeFileSync(
            config.paths.kontaktskjemaData,
            JSON.stringify({ aktiv, tittel, tekst, tema }, null, 2)
        );
        console.log(`  Synkroniserte kontaktskjema (${tema.length} temaer, aktiv: ${aktiv}).`);
        return { kontaktEpost: kontaktEpost || null };
    } catch (err) {
        console.error('Feil under synkronisering av kontaktskjema:', err.message);
        throw err;
    }
}
```

Legg til kallet i `runSync` etter `syncPrisliste`:

```javascript
// 1c. Synkroniser kontaktskjema fra Sheets
await syncKontaktSkjema();
```

- [ ] **Steg 4: Kjør testene og bekreft at de passerer**

```bash
npx vitest run src/scripts/__tests__/sync-data.test.js --reporter=verbose 2>&1 | tail -20
```

Forventet: PASS for alle `syncKontaktSkjema`-tester.

- [ ] **Steg 5: Commit**

```bash
git add src/scripts/sync-data.js src/scripts/__tests__/sync-data.test.js
git commit -m "feat(sync): legg til syncKontaktSkjema"
```

---

## Task 2: Kontaktskjema content collection

**Files:**
- Modify: `src/content.config.ts`
- Modify: `src/__tests__/content.config.test.ts` (eller opprett om den ikke finnes)

- [ ] **Steg 1: Skriv failing test**

Finn eller opprett `src/__tests__/content.config.test.ts`. Legg til:

```typescript
describe('kontaktskjema collection', () => {
    const KONTAKTSKJEMA_PATH = path.join(process.cwd(), 'src/content/kontaktskjema.json');

    afterEach(() => {
        if (fs.existsSync(KONTAKTSKJEMA_PATH)) fs.unlinkSync(KONTAKTSKJEMA_PATH);
    });

    it('returnerer standardverdier når filen ikke finnes', async () => {
        if (fs.existsSync(KONTAKTSKJEMA_PATH)) fs.unlinkSync(KONTAKTSKJEMA_PATH);
        const { collections } = await import('../content.config.ts');
        const result = await (collections.kontaktskjema as any).loader();
        expect(result).toEqual([{
            id: 'kontaktskjema', aktiv: false, tittel: '', tekst: '', tema: []
        }]);
    });

    it('leser data fra fil og beholder aktiv som boolsk', async () => {
        fs.writeFileSync(KONTAKTSKJEMA_PATH, JSON.stringify({
            aktiv: true, tittel: 'Ta kontakt', tekst: 'Svar raskt.', tema: ['Timebooking']
        }));
        // Reimport etter skriving
        vi.resetModules();
        const { collections } = await import('../content.config.ts');
        const result = await (collections.kontaktskjema as any).loader();
        expect(result[0]).toMatchObject({
            id: 'kontaktskjema', aktiv: true, tittel: 'Ta kontakt', tema: ['Timebooking']
        });
    });
});
```

- [ ] **Steg 2: Kjør test og bekreft at den feiler**

```bash
npx vitest run src/__tests__/content.config.test.ts --reporter=verbose 2>&1 | tail -15
```

- [ ] **Steg 3: Legg til kontaktskjema-samling i content.config.ts**

Legg til **etter** `prisliste`-samlingen og **før** eksportlinjen:

```typescript
const kontaktskjema = defineCollection({
    loader: async () => {
        const filePath = path.join(process.cwd(), 'src/content/kontaktskjema.json');
        if (!fs.existsSync(filePath)) {
            return [{ id: 'kontaktskjema', aktiv: false, tittel: '', tekst: '', tema: [] }];
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return [{ id: 'kontaktskjema', ...data }];
    },
    schema: z.object({
        id: z.string(),
        aktiv: z.boolean().default(false),
        tittel: z.string().default(''),
        tekst: z.string().default(''),
        tema: z.array(z.string()).default([]),
    }),
});
```

Oppdater eksportlinjen:

```typescript
export const collections = { tjenester, meldinger, innstillinger, tannleger, galleri, prisliste, kontaktskjema };
```

- [ ] **Steg 4: Kjør test og bekreft pass**

```bash
npx vitest run src/__tests__/content.config.test.ts --reporter=verbose 2>&1 | tail -15
```

- [ ] **Steg 5: Commit**

```bash
git add src/content.config.ts src/__tests__/content.config.test.ts
git commit -m "feat(content): legg til kontaktskjema-samling"
```

---

## Task 3: contact-form.js — klient-side skjemastyring

**Files:**
- Create: `src/scripts/contact-form.js`
- Create: `src/scripts/__tests__/contact-form.test.js`

- [ ] **Steg 1: Skriv failing tester**

Opprett `src/scripts/__tests__/contact-form.test.js`:

```javascript
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initContactForm } from '../contact-form.js';

function setupDOM({ tema = ['Timebooking', 'Priser'] } = {}) {
    document.body.innerHTML = `
        <button id="open-contact-modal">Ta kontakt</button>
        <dialog id="contact-modal">
            <button id="close-contact-modal">✕</button>
            <form id="contact-form">
                <select name="tema">
                    ${tema.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
                <input name="navn" value="Ola Nordmann">
                <input name="telefon" value="12345678">
                <input name="epost" value="ola@example.com">
                <textarea name="melding">Hei!</textarea>
                <input name="website" value="">
                <button id="contact-submit-btn" type="submit">Send</button>
            </form>
            <div id="contact-success" hidden></div>
            <div id="contact-error" hidden></div>
        </dialog>
    `;
    initContactForm();
}

beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
});

describe('initContactForm', () => {
    it('åpner modalen ved klikk på open-knappen', () => {
        setupDOM();
        document.getElementById('open-contact-modal').click();
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
    });

    it('lukker modalen ved klikk på close-knappen', () => {
        setupDOM();
        document.getElementById('close-contact-modal').click();
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();
    });

    it('sender POST til /api/kontakt med skjemadata', async () => {
        setupDOM();
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

        const form = document.getElementById('contact-form');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

        const [url, opts] = fetch.mock.calls[0];
        expect(url).toBe('/api/kontakt');
        expect(opts.method).toBe('POST');
        const body = JSON.parse(opts.body);
        expect(body.navn).toBe('Ola Nordmann');
        expect(body.epost).toBe('ola@example.com');
        expect(body.website).toBe('');
    });

    it('viser suksessmelding og skjuler skjema ved 200-svar', async () => {
        setupDOM();
        global.fetch.mockResolvedValue({ ok: true });

        document.getElementById('contact-form')
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() =>
            expect(document.getElementById('contact-success').hidden).toBe(false)
        );
        expect(document.getElementById('contact-form').hidden).toBe(true);
    });

    it('viser feilmelding fra server ved ikke-ok svar', async () => {
        setupDOM();
        global.fetch.mockResolvedValue({
            ok: false,
            json: async () => ({ error: 'For mange forsøk' }),
        });

        document.getElementById('contact-form')
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() =>
            expect(document.getElementById('contact-error').hidden).toBe(false)
        );
        expect(document.getElementById('contact-error').textContent).toBe('For mange forsøk');
    });

    it('viser nettverksfeil og aktiverer submit-knapp igjen ved fetch-feil', async () => {
        setupDOM();
        global.fetch.mockRejectedValue(new Error('Nettverksfeil'));

        document.getElementById('contact-form')
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() =>
            expect(document.getElementById('contact-error').hidden).toBe(false)
        );
        expect(document.getElementById('contact-submit-btn').disabled).toBe(false);
        expect(document.getElementById('contact-submit-btn').textContent).toBe('Send melding');
    });

    it('gjør ingenting uten nødvendige DOM-elementer', () => {
        document.body.innerHTML = '';
        expect(() => initContactForm()).not.toThrow();
    });
});
```

- [ ] **Steg 2: Kjør test og bekreft at den feiler**

```bash
npx vitest run src/scripts/__tests__/contact-form.test.js --reporter=verbose 2>&1 | tail -20
```

- [ ] **Steg 3: Implementer contact-form.js**

Opprett `src/scripts/contact-form.js`:

```javascript
export function initContactForm() {
    const modal     = document.getElementById('contact-modal');
    const form      = document.getElementById('contact-form');
    const openBtn   = document.getElementById('open-contact-modal');
    const closeBtn  = document.getElementById('close-contact-modal');
    const submitBtn = document.getElementById('contact-submit-btn');
    const successEl = document.getElementById('contact-success');
    const errorEl   = document.getElementById('contact-error');

    if (!modal || !form) return;

    openBtn?.addEventListener('click', () => modal.showModal());
    closeBtn?.addEventListener('click', () => modal.close());

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.close();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sender...';
        errorEl.hidden = true;

        const data = {
            tema:    form.elements['tema']?.value    ?? '',
            navn:    form.elements['navn']?.value    ?? '',
            telefon: form.elements['telefon']?.value ?? '',
            epost:   form.elements['epost']?.value   ?? '',
            melding: form.elements['melding']?.value ?? '',
            website: form.elements['website']?.value ?? '',
        };

        try {
            const res = await fetch('/api/kontakt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                form.hidden = true;
                successEl.hidden = false;
            } else {
                const body = await res.json().catch(() => ({}));
                showError(body.error || 'Noe gikk galt. Prøv igjen.', submitBtn, errorEl);
            }
        } catch {
            showError(
                'Ingen nettverksforbindelse. Sjekk internett og prøv igjen.',
                submitBtn, errorEl
            );
        }
    });
}

function showError(msg, submitBtn, errorEl) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send melding';
}
```

- [ ] **Steg 4: Kjør tester og bekreft pass**

```bash
npx vitest run src/scripts/__tests__/contact-form.test.js --reporter=verbose 2>&1 | tail -20
```

- [ ] **Steg 5: Commit**

```bash
git add src/scripts/contact-form.js src/scripts/__tests__/contact-form.test.js
git commit -m "feat: legg til klient-side contact-form.js med tester"
```

---

## Task 4: ContactButton.astro + ContactModal.astro

**Files:**
- Create: `src/components/ContactButton.astro`
- Create: `src/components/ContactModal.astro`

Ingen unit-tester for Astro-komponenter — disse dekkes av E2E-tester.

- [ ] **Steg 1: Opprett ContactButton.astro**

```astro
---
// src/components/ContactButton.astro
---
<button id="open-contact-modal" class="btn-accent px-8 py-4 text-sm font-black uppercase tracking-widest">
    Ta kontakt
</button>
```

- [ ] **Steg 2: Opprett ContactModal.astro**

```astro
---
// src/components/ContactModal.astro
interface Props {
    tittel: string;
    tekst:  string;
    tema:   string[];
}
const { tittel, tekst, tema } = Astro.props;
---
<dialog
    id="contact-modal"
    class="contact-modal backdrop:bg-black/50 backdrop:backdrop-blur-sm
           m-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-0 shadow-2xl
           md:max-w-[480px]
           max-md:fixed max-md:bottom-0 max-md:top-auto max-md:translate-y-full max-md:rounded-b-none max-md:open:translate-y-0"
>
    <div class="flex flex-col gap-6 p-6">
        <!-- Drag-indikator (mobil) -->
        <div class="mx-auto h-1 w-10 rounded-full bg-brand-muted/30 md:hidden" aria-hidden="true"></div>

        <!-- Header -->
        <div class="flex items-start justify-between gap-4">
            <div>
                <h2 class="font-heading text-xl font-black text-brand">{tittel}</h2>
                {tekst && <p class="mt-1 text-sm text-brand-muted">{tekst}</p>}
            </div>
            <button
                id="close-contact-modal"
                aria-label="Lukk kontaktskjema"
                class="shrink-0 rounded-full p-1 text-brand-muted hover:text-brand transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>

        <!-- Skjema -->
        <form id="contact-form" novalidate class="flex flex-col gap-4">
            <!-- Honeypot — skjult for brukere, synlig for bots -->
            <input
                type="text"
                name="website"
                class="absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
                tabindex="-1"
                autocomplete="off"
                aria-hidden="true"
            >

            {tema.length > 0 && (
                <div class="flex flex-col gap-1.5">
                    <label for="contact-tema" class="text-sm font-semibold text-brand">Tema</label>
                    <select id="contact-tema" name="tema"
                            class="w-full rounded-xl border border-brand-muted/20 bg-white px-3 py-2.5 text-sm text-brand focus:outline-none focus:ring-2 focus:ring-brand/30">
                        {tema.map(t => <option value={t}>{t}</option>)}
                    </select>
                </div>
            )}

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                    <label for="contact-navn" class="text-sm font-semibold text-brand">
                        Navn <span class="text-brand-muted font-normal">(påkrevd)</span>
                    </label>
                    <input id="contact-navn" type="text" name="navn" required
                           autocomplete="name"
                           class="w-full rounded-xl border border-brand-muted/20 bg-white px-3 py-2.5 text-sm text-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                           placeholder="Ditt navn">
                </div>
                <div class="flex flex-col gap-1.5">
                    <label for="contact-telefon" class="text-sm font-semibold text-brand">Telefon</label>
                    <input id="contact-telefon" type="tel" name="telefon"
                           autocomplete="tel" inputmode="tel"
                           class="w-full rounded-xl border border-brand-muted/20 bg-white px-3 py-2.5 text-sm text-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                           placeholder="Ditt telefonnummer">
                </div>
            </div>

            <div class="flex flex-col gap-1.5">
                <label for="contact-epost" class="text-sm font-semibold text-brand">
                    E-post <span class="text-brand-muted font-normal">(påkrevd)</span>
                </label>
                <input id="contact-epost" type="email" name="epost" required
                       autocomplete="email"
                       class="w-full rounded-xl border border-brand-muted/20 bg-white px-3 py-2.5 text-sm text-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                       placeholder="din@epost.no">
            </div>

            <div class="flex flex-col gap-1.5">
                <label for="contact-melding" class="text-sm font-semibold text-brand">Melding</label>
                <textarea id="contact-melding" name="melding" rows="3"
                          style="field-sizing: content; resize: vertical;"
                          class="w-full rounded-xl border border-brand-muted/20 bg-white px-3 py-2.5 text-sm text-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                          placeholder="Skriv meldingen din her..."></textarea>
            </div>

            <label class="flex items-start gap-2.5 text-sm text-brand-muted cursor-pointer">
                <input type="checkbox" name="gdpr" required class="mt-0.5 accent-brand">
                <span>Jeg har lest og godtatt
                    <a href="/personvern" class="underline hover:text-brand transition-colors">personvernerklæringen</a>
                    og godtar at kontaktinformasjonen min brukes for å besvare henvendelsen.
                </span>
            </label>

            <button id="contact-submit-btn" type="submit"
                    class="btn-accent w-full py-3.5 text-sm font-black uppercase tracking-widest disabled:opacity-50">
                Send melding
            </button>
        </form>

        <!-- Suksessmelding -->
        <div id="contact-success" hidden class="flex flex-col items-center gap-3 py-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round" class="text-green-600" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <h3 class="font-heading text-lg font-black text-brand">Takk for henvendelsen!</h3>
            <p class="text-sm text-brand-muted">Vi svarer deg så snart vi kan.</p>
        </div>

        <!-- Feilmelding -->
        <div id="contact-error" hidden
             class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
             role="alert" aria-live="polite"></div>
    </div>
</dialog>

<script>
import { initContactForm } from '../scripts/contact-form.js';
initContactForm();
</script>
```

- [ ] **Steg 3: Verifiser at Astro bygger uten feil**

```bash
npx astro check 2>&1 | tail -10
```

Forventet: ingen TypeScript- eller Astro-feil for de to nye komponentene.

- [ ] **Steg 4: Commit**

```bash
git add src/components/ContactButton.astro src/components/ContactModal.astro
git commit -m "feat: legg til ContactButton og ContactModal-komponenter"
```

---

## Task 5: Kontakt.astro + personvern.astro

**Files:**
- Modify: `src/components/Kontakt.astro`
- Modify: `src/pages/personvern.astro`

- [ ] **Steg 1: Finn kontaktskjema-section i Kontakt.astro**

```bash
grep -n "import\|getEntry\|btn-" src/components/Kontakt.astro | head -20
```

Identifiser der telefon-knapp eller handlingsknapper rendres.

- [ ] **Steg 2: Oppdater Kontakt.astro**

Legg til i frontmatter-seksjonen (`---`):

```typescript
import { getEntry } from 'astro:content';
import ContactButton from './ContactButton.astro';
import ContactModal from './ContactModal.astro';

const ksEntry = await getEntry('kontaktskjema', 'kontaktskjema');
const ks = ksEntry?.data ?? { aktiv: false, tittel: '', tekst: '', tema: [] };
```

Legg til kontaktskjema-knapp og modal i HTML-seksjonen (plasser etter telefon/e-post-knappene):

```astro
{ks.aktiv && (
    <>
        <ContactButton />
        <ContactModal tittel={ks.tittel} tekst={ks.tekst} tema={ks.tema} />
    </>
)}
```

- [ ] **Steg 3: Oppdater personvern.astro**

Legg til i frontmatter (`---`):

```typescript
import { getEntry } from 'astro:content';
const ksEntry = await getEntry('kontaktskjema', 'kontaktskjema');
const visKontaktPersonvern = ksEntry?.data?.aktiv ?? false;
```

Legg til etter eksisterende `<h2>Karttjeneste</h2>`-seksjonen:

```astro
{visKontaktPersonvern && (
    <section aria-labelledby="kontaktskjema-personvern">
        <h2 id="kontaktskjema-personvern">Kontaktskjema</h2>
        <p>
            Kontaktsiden har et kontaktskjema der du kan sende oss en direkte henvendelse.
        </p>
        <table>
            <tbody>
                <tr><th scope="row">Hva samles inn</th><td>Navn, e-post, telefon, melding og tema</td></tr>
                <tr><th scope="row">Formål</th><td>Besvare henvendelser fra besøkende</td></tr>
                <tr><th scope="row">Rettslig grunnlag</th><td>Ditt samtykke (avkrysning i skjemaet)</td></tr>
                <tr><th scope="row">Lagringstid</th><td>Overføres på e-post og lagres i klinikkens e-postarkiv</td></tr>
                <tr><th scope="row">Databehandler</th><td>Amazon Web Services (SES) for e-postutsending</td></tr>
            </tbody>
        </table>
        <p>
            Du har rett til innsyn, retting og sletting av opplysningene, og du kan klage til
            <a href="https://www.datatilsynet.no/om-datatilsynet/kontakt-oss/" target="_blank" rel="noopener noreferrer">
                Datatilsynet
            </a>.
            Ta kontakt med klinikken for å utøve dine rettigheter.
        </p>
    </section>
)}
```

- [ ] **Steg 4: Sjekk Astro-build**

```bash
npx astro check 2>&1 | tail -10
```

Forventet: ingen feil.

- [ ] **Steg 5: Commit**

```bash
git add src/components/Kontakt.astro src/pages/personvern.astro
git commit -m "feat: integrer kontaktskjema i Kontakt.astro og personvern.astro"
```

---

## Task 6: Lambda — kontakt-form-handler

**Files:**
- Create: `lambda/kontakt-form-handler/index.mjs`
- Create: `lambda/kontakt-form-handler/package.json`
- Create: `lambda/kontakt-form-handler/__tests__/handler.test.mjs`

- [ ] **Steg 1: Opprett package.json for Lambda**

```bash
mkdir -p lambda/kontakt-form-handler/__tests__
```

Opprett `lambda/kontakt-form-handler/package.json`:

```json
{
  "name": "kontakt-form-handler",
  "version": "1.0.0",
  "type": "module",
  "description": "Lambda handler for kontaktskjema",
  "main": "index.mjs",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/client-ses": "^3.0.0"
  }
}
```

- [ ] **Steg 2: Skriv failing tester**

Opprett `lambda/kontakt-form-handler/__tests__/handler.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { validatePayload } from '../index.mjs';

describe('validatePayload', () => {
    const validPayload = {
        tema: 'Timebooking', navn: 'Ola', telefon: '12345678',
        epost: 'ola@example.com', melding: 'Hei', website: ''
    };

    it('returnerer ok:true for gyldig payload', () => {
        expect(validatePayload(validPayload)).toEqual({ ok: true });
    });

    it('returnerer honeypot:true når website er fylt ut', () => {
        expect(validatePayload({ ...validPayload, website: 'spam' }))
            .toEqual({ ok: false, honeypot: true });
    });

    it('returnerer feil ved manglende navn', () => {
        const r = validatePayload({ ...validPayload, navn: '' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/navn/i);
    });

    it('returnerer feil ved manglende epost', () => {
        const r = validatePayload({ ...validPayload, epost: '' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/e-post/i);
    });

    it('returnerer feil ved ugyldig e-postformat', () => {
        const r = validatePayload({ ...validPayload, epost: 'ikke-en-epost' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/e-postformat/i);
    });

    it('returnerer feil når melding overskrider 5000 tegn', () => {
        const r = validatePayload({ ...validPayload, melding: 'x'.repeat(5001) });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/lang/i);
    });

    it('godtar melding på nøyaktig 5000 tegn', () => {
        expect(validatePayload({ ...validPayload, melding: 'x'.repeat(5000) }))
            .toEqual({ ok: true });
    });
});
```

Legg til i `vitest.config.js` / `vitest.config.ts` under `include` (eller bruk `--reporter` direkte):

```bash
npx vitest run lambda/kontakt-form-handler/__tests__/handler.test.mjs --reporter=verbose 2>&1 | tail -20
```

Forventet: FAIL — `validatePayload is not a function`.

- [ ] **Steg 3: Implementer Lambda-funksjonen**

Opprett `lambda/kontakt-form-handler/index.mjs`:

```javascript
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const ses    = new SESClient({ region: process.env.SES_REGION || 'eu-west-1' });

const ORIGIN_SECRET  = process.env.ORIGIN_VERIFY_SECRET;
const MOTTAKER_EPOST = process.env.KONTAKT_MOTTAKER_EPOST;
const SENDER_EPOST   = 'noreply@tennerogtrivsel.no';
const RATE_TABLE     = process.env.RATE_LIMIT_TABLE || 'kontakt-rate-limit';
const MAX_PER_WINDOW = 3;
const WINDOW_SECONDS = 600;

// Eksportert for testing
export function validatePayload({ tema, navn, telefon, epost, melding, website } = {}) {
    if (website) return { ok: false, honeypot: true };
    if (!String(navn || '').trim()) return { ok: false, error: 'Manglende navn' };
    if (!String(epost || '').trim()) return { ok: false, error: 'Manglende e-post' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost))
        return { ok: false, error: 'Ugyldig e-postformat' };
    if (melding && String(melding).length > 5000)
        return { ok: false, error: 'Melding er for lang (maks 5000 tegn)' };
    return { ok: true };
}

function sanitize(s, maxLen = 500) {
    return String(s || '').replace(/[\r\n]/g, ' ').substring(0, maxLen);
}

async function checkRateLimit(ip, now) {
    const result = await dynamo.send(new GetItemCommand({
        TableName: RATE_TABLE,
        Key: { ip: { S: ip } },
    }));
    if (!result.Item) return false;
    const count = parseInt(result.Item.count.N, 10);
    const ttl   = parseInt(result.Item.ttl.N, 10);
    return ttl > now && count >= MAX_PER_WINDOW;
}

async function incrementRateLimit(ip, now, existing) {
    const newCount = existing ? parseInt(existing.count.N, 10) + 1 : 1;
    await dynamo.send(new PutItemCommand({
        TableName: RATE_TABLE,
        Item: {
            ip:    { S: ip },
            count: { N: String(newCount) },
            ttl:   { N: String(now + WINDOW_SECONDS) },
        },
    }));
}

export const handler = async (event) => {
    const json = (status, body) => ({
        statusCode: status,
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });

    // 1. Verifiser origin secret
    const originHeader = event.headers?.['x-origin-verify'];
    if (!originHeader || originHeader !== ORIGIN_SECRET) {
        return { statusCode: 403, body: 'Forbidden' };
    }

    // 2. Parse body
    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        return json(400, { error: 'Ugyldig JSON' });
    }

    // 3. Valider (inkl. honeypot)
    const validation = validatePayload(payload);
    if (!validation.ok) {
        if (validation.honeypot) return json(200, { ok: true }); // stille avvisning
        return json(400, { error: validation.error });
    }

    // 4. Rate limiting
    const ip  = event.requestContext?.http?.sourceIp
             || event.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
             || 'unknown';
    const now = Math.floor(Date.now() / 1000);

    try {
        const existing = (await dynamo.send(new GetItemCommand({
            TableName: RATE_TABLE,
            Key: { ip: { S: ip } },
        }))).Item;

        const limited = existing
            && parseInt(existing.ttl.N, 10) > now
            && parseInt(existing.count.N, 10) >= MAX_PER_WINDOW;

        if (limited) {
            return json(429, { error: 'For mange forsøk. Vent litt og prøv igjen.' });
        }
        await incrementRateLimit(ip, now, existing);
    } catch (err) {
        console.error('DynamoDB feil (ignorert):', err.message);
    }

    // 5. Send e-post via SES
    const { tema, navn, telefon, epost, melding } = payload;
    const emailBody = [
        `Tema:    ${sanitize(tema)}`,
        `Navn:    ${sanitize(navn)}`,
        `Telefon: ${sanitize(telefon)}`,
        `E-post:  ${sanitize(epost)}`,
        '',
        String(melding || '').substring(0, 5000),
    ].join('\n');

    try {
        await ses.send(new SendEmailCommand({
            Source:           SENDER_EPOST,
            Destination:      { ToAddresses: [MOTTAKER_EPOST] },
            ReplyToAddresses: [sanitize(epost)],
            Message: {
                Subject: { Data: `Kontaktskjema: ${sanitize(tema)}` },
                Body:    { Text: { Data: emailBody } },
            },
        }));
    } catch (err) {
        console.error('SES feil:', err.message);
        return json(500, { error: 'Kunne ikke sende e-post. Prøv igjen.' });
    }

    return json(200, { ok: true });
};
```

- [ ] **Steg 4: Kjør tester og bekreft pass**

```bash
npx vitest run lambda/kontakt-form-handler/__tests__/handler.test.mjs --reporter=verbose 2>&1 | tail -20
```

- [ ] **Steg 5: Commit**

```bash
git add lambda/
git commit -m "feat(lambda): implementer kontakt-form-handler med validering og rate limiting"
```

---

## Task 7: admin-sheets.js — KontaktSkjema-funksjoner

**Files:**
- Modify: `src/scripts/admin-sheets.js`
- Modify: `src/scripts/__tests__/admin-sheets.test.js`

- [ ] **Steg 1: Skriv failing tester**

Legg til etter eksisterende `describe`-blokker i `admin-sheets.test.js`:

```javascript
const {
    getKontaktSkjemaRaw,
    updateKontaktSkjemaField,
    addKontaktTemaRow,
    ensureKontaktSkjemaSheet,
} = await import('../admin-sheets.js');
```

(Legg dette til i den eksisterende `import`-blokken øverst.)

```javascript
describe('KontaktSkjema CRUD', () => {
    const SHEET_ID = 'test-sheet-id';

    beforeEach(() => {
        vi.clearAllMocks();
        mockSheets.spreadsheets.get.mockResolvedValue({
            result: { sheets: [{ properties: { title: 'KontaktSkjema', sheetId: 42 } }] }
        });
    });

    describe('getKontaktSkjemaRaw', () => {
        it('returnerer strukturert objekt med rowIndex for hvert felt', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({
                result: {
                    values: [
                        ['Nøkkel', 'Verdi'],
                        ['aktiv', 'ja'],
                        ['tittel', 'Ta kontakt'],
                        ['tekst', 'Svar raskt'],
                        ['kontaktEpost', 'test@example.com'],
                        ['tema', 'Timebooking'],
                        ['tema', 'Priser'],
                    ]
                }
            });
            const result = await getKontaktSkjemaRaw(SHEET_ID);
            expect(result.aktiv).toEqual({ rowIndex: 2, value: 'ja' });
            expect(result.tittel).toEqual({ rowIndex: 3, value: 'Ta kontakt' });
            expect(result.kontaktEpost).toEqual({ rowIndex: 5, value: 'test@example.com' });
            expect(result.tema).toEqual([
                { rowIndex: 6, value: 'Timebooking' },
                { rowIndex: 7, value: 'Priser' },
            ]);
        });

        it('returnerer tomme standardverdier ved tomt ark', async () => {
            mockSheets.spreadsheets.values.get.mockResolvedValue({ result: { values: [] } });
            const result = await getKontaktSkjemaRaw(SHEET_ID);
            expect(result.aktiv).toEqual({ rowIndex: null, value: '' });
            expect(result.tema).toEqual([]);
        });
    });

    describe('updateKontaktSkjemaField', () => {
        it('kaller values.update med riktig range og verdi', async () => {
            mockSheets.spreadsheets.values.update.mockResolvedValue({});
            await updateKontaktSkjemaField(SHEET_ID, 3, 'Ny tittel');
            expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    spreadsheetId: SHEET_ID,
                    range: 'KontaktSkjema!B3',
                    resource: { values: [['Ny tittel']] },
                })
            );
        });
    });

    describe('addKontaktTemaRow', () => {
        it('kaller values.append med riktig tema-rad', async () => {
            mockSheets.spreadsheets.values.append.mockResolvedValue({});
            await addKontaktTemaRow(SHEET_ID, 'Spørsmål om priser');
            expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith(
                expect.objectContaining({
                    spreadsheetId: SHEET_ID,
                    range: 'KontaktSkjema!A:B',
                    resource: { values: [['tema', 'Spørsmål om priser']] },
                })
            );
        });
    });

    describe('ensureKontaktSkjemaSheet', () => {
        it('gjør ingenting hvis arket allerede finnes', async () => {
            await ensureKontaktSkjemaSheet(SHEET_ID);
            expect(mockSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
        });

        it('oppretter ark og fyller inn standarddata hvis arket mangler', async () => {
            mockSheets.spreadsheets.get.mockResolvedValue({ result: { sheets: [] } });
            mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});
            mockSheets.spreadsheets.values.update.mockResolvedValue({});
            await ensureKontaktSkjemaSheet(SHEET_ID);
            expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledOnce();
            expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledOnce();
        });
    });
});
```

- [ ] **Steg 2: Kjør tester og bekreft at de feiler**

```bash
npx vitest run src/scripts/__tests__/admin-sheets.test.js --reporter=verbose 2>&1 | grep -E "PASS|FAIL|✓|✗|×" | tail -20
```

- [ ] **Steg 3: Implementer KontaktSkjema-funksjonene i admin-sheets.js**

Legg til **på slutten av filen**, etter eksisterende CRUD-seksjoner:

```javascript
// --- KONTAKTSKJEMA ---

export async function ensureKontaktSkjemaSheet(spreadsheetId) {
    const sheetResp = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties',
    });
    const exists = (sheetResp.result.sheets || [])
        .some(s => s.properties.title === 'KontaktSkjema');
    if (exists) return;

    await gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests: [{ addSheet: { properties: { title: 'KontaktSkjema' } } }] },
    });

    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'KontaktSkjema!A1:B9',
        valueInputOption: 'RAW',
        resource: {
            values: [
                ['Nøkkel', 'Verdi'],
                ['aktiv', 'nei'],
                ['tittel', 'Ta kontakt med oss'],
                ['tekst', 'Vi svarer vanligvis innen én arbeidsdag.'],
                ['kontaktEpost', ''],
                ['tema', 'Timebooking'],
                ['tema', 'Spørsmål om behandling'],
                ['tema', 'Priser'],
                ['tema', 'Annet'],
            ],
        },
    });
    console.log('[Admin] KontaktSkjema-ark opprettet med standarddata.');
}

export async function getKontaktSkjemaRaw(spreadsheetId) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'KontaktSkjema!A:B',
            valueRenderOption: 'UNFORMATTED_VALUE',
        });
        const rows = response.result.values || [];
        const dataRows = rows.slice(1);

        const findField = (key) => {
            const idx = dataRows.findIndex(r => r[0] === key);
            return idx === -1
                ? { rowIndex: null, value: '' }
                : { rowIndex: idx + 2, value: String(dataRows[idx][1] ?? '') };
        };

        const tema = dataRows
            .map((r, i) => r[0] === 'tema'
                ? { rowIndex: i + 2, value: String(r[1] ?? '') }
                : null)
            .filter(Boolean);

        return {
            aktiv:        findField('aktiv'),
            tittel:       findField('tittel'),
            tekst:        findField('tekst'),
            kontaktEpost: findField('kontaktEpost'),
            tema,
        };
    } catch (err) {
        console.error('[Admin] Kunne ikke hente KontaktSkjema:', err);
        throw err;
    }
}

export async function updateKontaktSkjemaField(spreadsheetId, rowIndex, value) {
    try {
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `KontaktSkjema!B${rowIndex}`,
            valueInputOption: 'RAW',
            resource: { values: [[String(value)]] },
        });
        console.log(`[Admin] KontaktSkjema rad ${rowIndex} oppdatert.`);
        return true;
    } catch (err) {
        console.error('[Admin] Kunne ikke oppdatere KontaktSkjema-felt:', err);
        throw err;
    }
}

export async function addKontaktTemaRow(spreadsheetId, value) {
    try {
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'KontaktSkjema!A:B',
            valueInputOption: 'RAW',
            resource: { values: [['tema', String(value)]] },
        });
        console.log('[Admin] Nytt kontaktskjema-tema lagt til.');
        return true;
    } catch (err) {
        console.error('[Admin] Kunne ikke legge til tema:', err);
        throw err;
    }
}
```

- [ ] **Steg 4: Kjør tester og bekreft pass**

```bash
npx vitest run src/scripts/__tests__/admin-sheets.test.js --reporter=verbose 2>&1 | grep -E "PASS|FAIL|✓|✗|×" | tail -20
```

- [ ] **Steg 5: Commit**

```bash
git add src/scripts/admin-sheets.js src/scripts/__tests__/admin-sheets.test.js
git commit -m "feat(admin): legg til KontaktSkjema CRUD i admin-sheets.js"
```

---

## Task 8: admin-module-kontaktskjema.js

**Files:**
- Create: `src/scripts/admin-module-kontaktskjema.js`
- Create: `src/scripts/__tests__/admin-module-kontaktskjema.test.js`

- [ ] **Steg 1: Skriv failing tester**

Opprett `src/scripts/__tests__/admin-module-kontaktskjema.test.js`:

```javascript
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockAutoSaver, mockAdminDialog, setupModuleDOM } from './test-helpers.js';

vi.mock('../admin-client.js', () => ({ silentLogin: vi.fn() }));
vi.mock('../admin-dialog.js', () => mockAdminDialog());
vi.mock('../admin-reorder.js', () => ({
    animateSwap: vi.fn(),
    disableReorderButtons: vi.fn(),
    enableReorderButtons: vi.fn(),
    updateReorderButtonVisibility: vi.fn(),
}));
vi.mock('../admin-editor-helpers.js', () => ({
    getAdminConfig: vi.fn(() => ({ SHEET_ID: 'test-sheet' })),
    escapeHtml: vi.fn(s => String(s || '')),
    createAutoSaver: createMockAutoSaver(),
    renderToggleHtml: vi.fn((id, active) =>
        `<button id="${id}" data-active="${active}"><span class="toggle-label">${active ? 'Aktiv' : 'Inaktiv'}</span></button>`),
    attachToggleClick: vi.fn(),
    setToggleState: vi.fn(),
    handleSaveError: vi.fn(),
}));
vi.mock('../admin-sheets.js', () => ({
    getKontaktSkjemaRaw: vi.fn(),
    updateKontaktSkjemaField: vi.fn(),
    addKontaktTemaRow: vi.fn(),
    ensureKontaktSkjemaSheet: vi.fn(),
    deleteSheetRow: vi.fn(),
}));
vi.mock('../admin-api-retry.js', () => ({
    createAuthRefresher: vi.fn(() => () => Promise.resolve(true)),
}));
vi.mock('../admin-dashboard.js', () => ({
    ICON_ADD:    '<span>+</span>',
    ICON_UP:     '<span>▲</span>',
    ICON_DOWN:   '<span>▼</span>',
    ICON_DELETE: '<span>🗑</span>',
}));

import { showToast, showConfirm } from '../admin-dialog.js';
import {
    getKontaktSkjemaRaw, updateKontaktSkjemaField,
    addKontaktTemaRow, ensureKontaktSkjemaSheet, deleteSheetRow,
} from '../admin-sheets.js';
import { initKontaktSkjemaModule, reloadKontaktSkjema } from '../admin-module-kontaktskjema.js';

const defaultRaw = {
    aktiv:        { rowIndex: 2, value: 'nei' },
    tittel:       { rowIndex: 3, value: 'Ta kontakt' },
    tekst:        { rowIndex: 4, value: 'Vi svarer raskt.' },
    kontaktEpost: { rowIndex: 5, value: 'test@example.com' },
    tema:         [{ rowIndex: 6, value: 'Timebooking' }, { rowIndex: 7, value: 'Priser' }],
};

beforeEach(() => {
    setupModuleDOM({ configAttrs: 'data-sheet-id="test-sheet"' });
    vi.clearAllMocks();
    vi.useFakeTimers();
    getKontaktSkjemaRaw.mockResolvedValue(defaultRaw);
    ensureKontaktSkjemaSheet.mockResolvedValue();
    updateKontaktSkjemaField.mockResolvedValue(true);
    addKontaktTemaRow.mockResolvedValue(true);
    deleteSheetRow.mockResolvedValue(true);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('reloadKontaktSkjema', () => {
    it('kaller ensureKontaktSkjemaSheet og getKontaktSkjemaRaw', async () => {
        await reloadKontaktSkjema();
        expect(ensureKontaktSkjemaSheet).toHaveBeenCalledWith('test-sheet');
        expect(getKontaktSkjemaRaw).toHaveBeenCalledWith('test-sheet');
    });

    it('rendrer tittel og tekst-felter i module-inner', async () => {
        await reloadKontaktSkjema();
        const inner = document.getElementById('module-inner');
        expect(inner.innerHTML).toContain('Ta kontakt');
        expect(inner.innerHTML).toContain('Vi svarer raskt.');
    });

    it('rendrer tema-listen med to rader', async () => {
        await reloadKontaktSkjema();
        const rows = document.querySelectorAll('[data-tema-row]');
        expect(rows).toHaveLength(2);
    });

    it('viser feilmelding ved API-feil', async () => {
        getKontaktSkjemaRaw.mockRejectedValue(new Error('Nettverksfeil'));
        await reloadKontaktSkjema();
        expect(document.getElementById('module-inner').innerHTML).toContain('Feil');
    });
});

describe('tema-liste interaksjon', () => {
    it('legger til ny tema-rad ved klikk på legg-til-knapp og bekreftelsesskjema', async () => {
        await reloadKontaktSkjema();
        const addBtn = document.getElementById('btn-add-tema');
        addBtn.click();
        const input = document.getElementById('new-tema-input');
        input.value = 'Nytt tema';
        const saveBtn = document.getElementById('btn-save-new-tema');
        saveBtn.click();
        await vi.runAllTimersAsync();
        expect(addKontaktTemaRow).toHaveBeenCalledWith('test-sheet', 'Nytt tema');
    });

    it('sletter tema etter bekreftelse', async () => {
        showConfirm.mockResolvedValue(true);
        await reloadKontaktSkjema();
        const deleteBtn = document.querySelector('[data-delete-tema]');
        deleteBtn.click();
        await vi.runAllTimersAsync();
        expect(deleteSheetRow).toHaveBeenCalledWith('test-sheet', 'KontaktSkjema', 6);
    });

    it('sletter ikke tema ved avbryt', async () => {
        showConfirm.mockResolvedValue(false);
        await reloadKontaktSkjema();
        document.querySelector('[data-delete-tema]').click();
        await vi.runAllTimersAsync();
        expect(deleteSheetRow).not.toHaveBeenCalled();
    });
});
```

- [ ] **Steg 2: Kjør tester og bekreft at de feiler**

```bash
npx vitest run src/scripts/__tests__/admin-module-kontaktskjema.test.js --reporter=verbose 2>&1 | tail -20
```

- [ ] **Steg 3: Implementer admin-module-kontaktskjema.js**

Opprett `src/scripts/admin-module-kontaktskjema.js`:

```javascript
import { showToast, showConfirm } from './admin-dialog.js';
import {
    getKontaktSkjemaRaw, updateKontaktSkjemaField,
    addKontaktTemaRow, ensureKontaktSkjemaSheet, deleteSheetRow,
} from './admin-sheets.js';
import {
    getAdminConfig, escapeHtml, createAutoSaver,
    renderToggleHtml, attachToggleClick, setToggleState, handleSaveError,
} from './admin-editor-helpers.js';
import {
    animateSwap, disableReorderButtons, enableReorderButtons,
    updateReorderButtonVisibility,
} from './admin-reorder.js';
import { ICON_ADD, ICON_UP, ICON_DOWN, ICON_DELETE } from './admin-dashboard.js';
import { createAuthRefresher } from './admin-api-retry.js';
import { silentLogin } from './admin-client.js';

const refreshAuth = createAuthRefresher(silentLogin);

let _raw = null;

export async function reloadKontaktSkjema() {
    const inner = document.getElementById('module-inner');
    if (!inner) return;
    inner.innerHTML = '<div class="text-admin-muted italic text-sm animate-pulse">Laster...</div>';

    const { SHEET_ID } = getAdminConfig();
    try {
        await ensureKontaktSkjemaSheet(SHEET_ID);
        _raw = await getKontaktSkjemaRaw(SHEET_ID);
        renderKontaktSkjemaModule(_raw);
    } catch (err) {
        inner.innerHTML = `<p class="text-red-600 text-sm">Feil ved lasting: ${escapeHtml(err.message)}</p>`;
    }
}

function renderKontaktSkjemaModule(raw) {
    const inner = document.getElementById('module-inner');
    const { SHEET_ID } = getAdminConfig();

    const temaHtml = raw.tema.map((t, i) => `
        <div class="admin-list-row flex items-center gap-3" data-tema-row data-row-index="${t.rowIndex}">
            <input type="text" class="admin-input flex-1" value="${escapeHtml(t.value)}" data-tema-input data-row-index="${t.rowIndex}">
            <div class="flex gap-1 shrink-0">
                <button class="admin-reorder-btn" data-direction="up" aria-label="Flytt opp" ${i === 0 ? 'hidden' : ''}>${ICON_UP}</button>
                <button class="admin-reorder-btn" data-direction="down" aria-label="Flytt ned" ${i === raw.tema.length - 1 ? 'hidden' : ''}>${ICON_DOWN}</button>
                <button class="admin-delete-btn" data-delete-tema data-row-index="${t.rowIndex}" aria-label="Slett tema">${ICON_DELETE}</button>
            </div>
        </div>
    `).join('');

    inner.innerHTML = `
        <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div class="admin-card space-y-4">
                <h2 class="admin-subtitle">Modal-innhold</h2>
                ${renderToggleHtml('toggle-kontaktskjema-aktiv', raw.aktiv.value === 'ja')}
                <div class="flex flex-col gap-1.5">
                    <label class="admin-label" for="ks-tittel">Tittel</label>
                    <input id="ks-tittel" type="text" class="admin-input"
                           value="${escapeHtml(raw.tittel.value)}" data-row-index="${raw.tittel.rowIndex}">
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="admin-label" for="ks-tekst">Tekst / ingress</label>
                    <textarea id="ks-tekst" class="admin-input" rows="2"
                              data-row-index="${raw.tekst.rowIndex}">${escapeHtml(raw.tekst.value)}</textarea>
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="admin-label" for="ks-epost">Mottaker-e-post</label>
                    <input id="ks-epost" type="email" class="admin-input"
                           value="${escapeHtml(raw.kontaktEpost.value)}" data-row-index="${raw.kontaktEpost.rowIndex}">
                    <p class="text-xs text-admin-muted-light">
                        Sendes ikke til nettsiden — synkroniseres til Lambda ved neste bygg.
                    </p>
                </div>
            </div>

            <div class="admin-card space-y-3">
                <h2 class="admin-subtitle">Tema-alternativer</h2>
                <div id="tema-list" class="space-y-2">${temaHtml}</div>
                <div id="new-tema-form" hidden class="flex gap-2 mt-2">
                    <input id="new-tema-input" type="text" class="admin-input flex-1" placeholder="Nytt tema...">
                    <button id="btn-save-new-tema" class="btn-primary px-4 py-2 text-xs">Opprett</button>
                    <button id="btn-cancel-new-tema" class="admin-btn-cancel">Avbryt</button>
                </div>
                <button id="btn-add-tema" class="btn-secondary flex items-center gap-2 px-4 py-2 text-sm mt-1">
                    ${ICON_ADD} Legg til tema
                </button>
            </div>
        </div>
    `;

    attachEventListeners(SHEET_ID, raw);
}

function attachEventListeners(SHEET_ID, raw) {
    // Toggle aktiv
    attachToggleClick('toggle-kontaktskjema-aktiv', async () => {
        const btn = document.getElementById('toggle-kontaktskjema-aktiv');
        const aktiv = btn.dataset.active === 'true';
        try {
            await refreshAuth();
            await updateKontaktSkjemaField(SHEET_ID, raw.aktiv.rowIndex, aktiv ? 'ja' : 'nei');
            showToast(aktiv ? 'Kontaktskjema aktivert' : 'Kontaktskjema deaktivert');
        } catch (err) {
            handleSaveError(err, 'aktiv');
            setToggleState(btn, !aktiv);
        }
    });

    // Autosave på tekstfelt
    for (const field of [
        { id: 'ks-tittel', label: 'Tittel' },
        { id: 'ks-tekst',  label: 'Tekst' },
        { id: 'ks-epost',  label: 'Mottaker-e-post' },
    ]) {
        const el = document.getElementById(field.id);
        if (!el) continue;
        const saver = createAutoSaver(async () => {
            const rowIndex = parseInt(el.dataset.rowIndex, 10);
            await refreshAuth();
            await updateKontaktSkjemaField(SHEET_ID, rowIndex, el.value);
            showToast(`${field.label} lagret`);
        });
        el.addEventListener('input', () => saver.trigger());
        el.addEventListener('blur', () => saver.trigger());
    }

    // Autosave på tema-input-felter
    document.querySelectorAll('[data-tema-input]').forEach(input => {
        const saver = createAutoSaver(async () => {
            const rowIndex = parseInt(input.dataset.rowIndex, 10);
            await refreshAuth();
            await updateKontaktSkjemaField(SHEET_ID, rowIndex, input.value);
            showToast('Tema lagret');
        });
        input.addEventListener('input', () => saver.trigger());
        input.addEventListener('blur', () => saver.trigger());
    });

    // Slett tema
    document.querySelectorAll('[data-delete-tema]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const rowIndex = parseInt(btn.dataset.rowIndex, 10);
            const temaVerdi = document.querySelector(
                `[data-tema-input][data-row-index="${rowIndex}"]`
            )?.value || 'dette temaet';
            if (await showConfirm(`Slett «${temaVerdi}»?`, { destructive: true })) {
                try {
                    await refreshAuth();
                    await deleteSheetRow(SHEET_ID, 'KontaktSkjema', rowIndex);
                    showToast(`«${temaVerdi}» slettet`);
                    reloadKontaktSkjema();
                } catch (err) {
                    handleSaveError(err, 'temaet');
                }
            }
        });
    });

    // Reorder-knapper
    document.querySelectorAll('[data-tema-row]').forEach(row => {
        row.querySelectorAll('[data-direction]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const direction = btn.dataset.direction;
                const currentRow = btn.closest('[data-tema-row]');
                const neighborRow = direction === 'up'
                    ? currentRow.previousElementSibling
                    : currentRow.nextElementSibling;
                if (!neighborRow) return;

                const currentInput   = currentRow.querySelector('[data-tema-input]');
                const neighborInput  = neighborRow.querySelector('[data-tema-input]');
                const currentRowIdx  = parseInt(currentInput.dataset.rowIndex, 10);
                const neighborRowIdx = parseInt(neighborInput.dataset.rowIndex, 10);
                const currentVal     = currentInput.value;
                const neighborVal    = neighborInput.value;

                disableReorderButtons(document.getElementById('tema-list'));
                try {
                    await refreshAuth();
                    await animateSwap(currentRow, neighborRow);
                    await updateKontaktSkjemaField(SHEET_ID, currentRowIdx, neighborVal);
                    await updateKontaktSkjemaField(SHEET_ID, neighborRowIdx, currentVal);
                    reloadKontaktSkjema();
                } catch (err) {
                    handleSaveError(err, 'rekkefølge');
                    enableReorderButtons(document.getElementById('tema-list'));
                }
            });
        });
    });

    // Legg til tema
    document.getElementById('btn-add-tema')?.addEventListener('click', () => {
        document.getElementById('new-tema-form').hidden = false;
        document.getElementById('btn-add-tema').hidden = true;
        document.getElementById('new-tema-input').focus();
    });

    document.getElementById('btn-cancel-new-tema')?.addEventListener('click', () => {
        document.getElementById('new-tema-form').hidden = true;
        document.getElementById('btn-add-tema').hidden = false;
        document.getElementById('new-tema-input').value = '';
    });

    document.getElementById('btn-save-new-tema')?.addEventListener('click', async () => {
        const input = document.getElementById('new-tema-input');
        const val = input.value.trim();
        if (!val) return;
        try {
            await refreshAuth();
            await addKontaktTemaRow(SHEET_ID, val);
            showToast(`«${val}» lagt til`);
            reloadKontaktSkjema();
        } catch (err) {
            handleSaveError(err, 'tema');
        }
    });
}

export function initKontaktSkjemaModule() {
    // Ingen global init nødvendig — alt startes via reloadKontaktSkjema()
}
```

- [ ] **Steg 4: Kjør tester og bekreft pass**

```bash
npx vitest run src/scripts/__tests__/admin-module-kontaktskjema.test.js --reporter=verbose 2>&1 | tail -20
```

- [ ] **Steg 5: Commit**

```bash
git add src/scripts/admin-module-kontaktskjema.js src/scripts/__tests__/admin-module-kontaktskjema.test.js
git commit -m "feat(admin): implementer admin-module-kontaktskjema.js med tester"
```

---

## Task 9: Admin-integrering — admin-init.js + admin/index.astro

**Files:**
- Modify: `src/scripts/admin-init.js`
- Modify: `src/pages/admin/index.astro`

- [ ] **Steg 1: Oppdater admin-init.js**

Finn import-blokken øverst og legg til:

```javascript
import { initKontaktSkjemaModule, reloadKontaktSkjema } from './admin-module-kontaktskjema.js';
```

Finn `openModule`-funksjonen der `id === 'prisliste'` håndteres, og legg til:

```javascript
else if (id === 'kontaktskjema') reloadKontaktSkjema();
```

Finn der `initMeldingerModule()` og `initPrislisteModule()` kalles, og legg til:

```javascript
initKontaktSkjemaModule();
```

Finn kortnavigasjonsarrayen (`['card-meldinger', ...]`) og legg til:

```javascript
['card-kontaktskjema', 'kontaktskjema', 'Kontaktskjemaet'],
```

- [ ] **Steg 2: Legg til "Kontaktskjema"-kort i admin/index.astro**

Finn `div.admin-module-grid` i admin/index.astro og legg til etter `card-prisliste`:

```html
<div id="card-kontaktskjema" class="admin-card-interactive group" role="link" tabindex="0" aria-label="Gå til Kontaktskjemaet">
    <h2 class="admin-subtitle group-hover:text-brand-hover">Kontaktskjemaet</h2>
    <p class="admin-description">Aktiver skjema, rediger innhold og administrer tema-alternativer.</p>
    <span class="admin-card-chevron" aria-hidden="true">&rsaquo;</span>
</div>
```

- [ ] **Steg 3: Bygg og sjekk for feil**

```bash
npx astro check 2>&1 | tail -10
```

- [ ] **Steg 4: Commit**

```bash
git add src/scripts/admin-init.js src/pages/admin/index.astro
git commit -m "feat(admin): legg til Kontaktskjema-modul i admin-dashboardet"
```

---

## Task 10: CI/CD — update-lambda-jobb + read-kontakt-epost.mjs

**Files:**
- Create: `scripts/read-kontakt-epost.mjs`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Steg 1: Opprett read-kontakt-epost.mjs**

```bash
mkdir -p scripts
```

Opprett `scripts/read-kontakt-epost.mjs`:

```javascript
/**
 * Leser kontaktEpost fra KontaktSkjema-fanen i Google Sheets.
 * Brukes av GitHub Actions for å oppdatere Lambda-miljøvariabel ved bygg.
 * Output: e-postadresse (tom streng hvis ikke funnet).
 */
try { process.loadEnvFile(); } catch { /* ok — CI setter env vars direkte */ }

import { sheets as sheetsFactory } from '@googleapis/sheets';
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sh = sheetsFactory({ version: 'v4', auth });

try {
    const res = await sh.spreadsheets.values.get({
        spreadsheetId: process.env.PUBLIC_GOOGLE_SHEET_ID,
        range: 'KontaktSkjema!A:B',
        valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = res.data.values || [];
    const epost = rows.find(r => r[0] === 'kontaktEpost')?.[1] || '';
    process.stdout.write(epost);
} catch {
    process.stdout.write('');
}
```

- [ ] **Steg 2: Legg til update-lambda-jobb i deploy.yml**

Finn `deploy:`-jobben i `.github/workflows/deploy.yml` og legg til en ny jobb **etter** `deploy:`, med `needs: build` og samme betingelser:

```yaml
  update-lambda:
    needs: build
    if: always() && needs.build.result == 'success' && github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    env:
      GOOGLE_SERVICE_ACCOUNT_EMAIL: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_EMAIL }}
      GOOGLE_PRIVATE_KEY: ${{ secrets.GOOGLE_PRIVATE_KEY }}
      PUBLIC_GOOGLE_SHEET_ID: ${{ secrets.GOOGLE_SHEET_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-1

      - name: Read kontaktEpost from Sheets
        id: kontakt-epost
        run: |
          EPOST=$(node scripts/read-kontakt-epost.mjs)
          echo "::add-mask::$EPOST"
          echo "value=$EPOST" >> $GITHUB_OUTPUT

      - name: Update Lambda environment variables
        run: |
          aws lambda update-function-configuration \
            --function-name ${{ secrets.LAMBDA_KONTAKT_ARN }} \
            --environment "Variables={KONTAKT_MOTTAKER_EPOST=${{ steps.kontakt-epost.outputs.value }},ORIGIN_VERIFY_SECRET=${{ secrets.ORIGIN_VERIFY_SECRET }},RATE_LIMIT_TABLE=kontakt-rate-limit,AWS_NODEJS_CONNECTION_REUSE_ENABLED=1}" \
            --region eu-west-1

      - name: Wait for Lambda update to complete
        run: |
          aws lambda wait function-updated \
            --function-name ${{ secrets.LAMBDA_KONTAKT_ARN }} \
            --region eu-west-1
```

**Nødvendige GitHub Secrets (legg til manuelt én gang):**
- `LAMBDA_KONTAKT_ARN` — ARN til `kontakt-form-handler` Lambda-funksjonen
- `ORIGIN_VERIFY_SECRET` — generer med `openssl rand -hex 32`

**CloudFront-konfigurasjon (gjøres manuelt én gang i AWS Console):**
1. Legg til ny origin i CloudFront-distribusjonen: Lambda Function URL
2. Legg til custom origin header: `X-Origin-Verify: <ORIGIN_VERIFY_SECRET>`
3. Legg til cache behaviour: `POST /api/kontakt` → Lambda-origin (cache deaktivert, `AllViewerExceptHostHeader` origin request policy)

- [ ] **Steg 3: Valider deploy.yml-syntaks**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo "OK"
```

Forventet: `OK`

- [ ] **Steg 4: Commit**

```bash
git add .github/workflows/deploy.yml scripts/read-kontakt-epost.mjs
git commit -m "feat(ci): legg til update-lambda-jobb for kontaktskjema"
```

---

## Avsluttende kvalitetssikring

- [ ] **Kjør alle tester**

```bash
npm test 2>&1 | tail -30
```

Forventet: alle tester passerer. Sjekk branch coverage for berørte filer:
- `src/scripts/sync-data.js`
- `src/scripts/contact-form.js`
- `src/scripts/admin-sheets.js`
- `src/scripts/admin-module-kontaktskjema.js`

- [ ] **Sjekk branch coverage for nye filer**

```bash
npx vitest run --coverage --reporter=verbose 2>&1 | grep -E "sync-data|contact-form|admin-sheets|admin-module-kontaktskjema" | head -20
```

Alle berørte filer skal ha ≥ 80% branch coverage.

- [ ] **Kjør Astro check**

```bash
npx astro check 2>&1 | tail -10
```

- [ ] **Bygg lokalt**

```bash
npm run build 2>&1 | tail -10
```

Forventet: `dist/`-mappen opprettes uten feil.
