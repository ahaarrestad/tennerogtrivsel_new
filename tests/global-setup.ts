import { chromium, type FullConfig } from '@playwright/test';

// Varmer dev-serveren før testkjøring: besøker hovedrutene én gang så Vites
// dep-optimering (og den påfølgende reloaden) er unnagjort FØR de assertende
// testene kjører. Uten dette kan reloaden starte midt i axe-skannet i
// accessibility.spec.ts → «Execution context was destroyed». Se
// docs/designs/archive/2026-06-28-dev-a11y-flake-warmup.md.
//
// Hoppes over i CI: der serverer `npm run preview` et statisk prod-bygg uten
// Vite-dev-server, så ingen dep-optimering skjer.
//
// Vi venter på 'load' (ikke 'networkidle'): warm-upen trenger bare å laste
// modulgrafen så Vite oppdager og cacher deps — 'load' er nok til det, og
// raskere. '/admin' laster Google Identity Services som holder gjentakende
// nettverksaktivitet, så «networkidle» kan være tregt/upålitelig der under
// parallell last; å legge enda et networkidle-kall i warm-upen øker bare
// risikoen for å race mot 30s-timeouten unødvendig. Warm-upen er dessuten
// best-effort: et enkelt rute-hikke skal ikke felle hele suiten — de ekte
// testene har sine egne assertions og rapporterer reelle feil tydelig.
async function globalSetup(config: FullConfig): Promise<void> {
  if (process.env.CI) return;

  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) throw new Error('globalSetup: baseURL mangler i Playwright-config');

  const ruter = ['/', '/kontakt/', '/tannleger/', '/tjenester/', '/galleri/', '/admin'];

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL });
    for (const rute of ruter) {
      try {
        await page.goto(rute, { waitUntil: 'load' });
      } catch (err) {
        console.warn(`globalSetup: warm-up av ${rute} feilet (ignorert):`, err);
      }
    }
  } finally {
    await browser.close();
  }
}

export default globalSetup;
