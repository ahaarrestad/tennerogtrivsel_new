// Seeder syntetiske testdata inn i src/content/ + src/assets/ for E2E-bygget.
//
// Hensikt: gjøre Playwright-testene uavhengige av live Google Drive. I stedet for
// `npm run sync` (som henter ekte Drive-data) kjører test-bygget dette scriptet, slik
// at siden alltid bygges fra det committede fixture-settet i tests/fixtures/.
//
// ⚠️ Scriptet OVERSKRIVER gitignorerte content-/asset-filer lokalt. Kjør `npm run sync`
// for å gjenopprette ekte Drive-data etterpå.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(ROOT, 'tests/fixtures');

/** Tømmer en mappe for alle filer unntatt .gitkeep, og sikrer at den finnes. */
function clearDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
    for (const entry of fs.readdirSync(dir)) {
        if (entry === '.gitkeep') continue;
        fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    }
}

/** Kopierer alle filer (rekursivt) fra src til dest. */
function copyContents(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);
        if (entry.isDirectory()) copyContents(from, to);
        else fs.copyFileSync(from, to);
    }
}

function copyFile(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

// 1. JSON-filer (overskrives direkte)
for (const file of ['innstillinger.json', 'tannleger.json', 'galleri.json', 'prisliste.json', 'kontaktskjema.json']) {
    copyFile(path.join(FIXTURES, 'content', file), path.join(ROOT, 'src/content', file));
}

// 2. Markdown-collections (tøm + kopier, bevar .gitkeep)
for (const coll of ['tjenester', 'meldinger']) {
    const dest = path.join(ROOT, 'src/content', coll);
    clearDir(dest);
    copyContents(path.join(FIXTURES, 'content', coll), dest);
}

// 3. Bilder (tøm + kopier, bevar .gitkeep)
for (const dir of ['tannleger', 'galleri']) {
    const dest = path.join(ROOT, 'src/assets', dir);
    clearDir(dest);
    copyContents(path.join(FIXTURES, 'assets', dir), dest);
}

// 4. Forsidebilde (statisk import i Forside.astro)
copyFile(path.join(FIXTURES, 'assets/hovedbilde.png'), path.join(ROOT, 'src/assets/hovedbilde.png'));

console.log('⚠️  Seedet syntetiske testdata fra tests/fixtures/ inn i src/content/ + src/assets/.');
console.log('    Kjør `npm run sync` for å gjenopprette ekte Drive-data.');
