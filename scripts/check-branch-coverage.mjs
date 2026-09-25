// Per-fil branch coverage-sjekk (≥ 80 % per fil) mot coverage/coverage-final.json.
// Kjøres etter `npm test`: `npm run coverage:check`. Brukes av /quality-gate.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const THRESHOLD = 80;

export function summarizeBranchCoverage(data, cwd) {
    const prefix = cwd.endsWith('/') ? cwd : cwd + '/';
    return Object.entries(data)
        .map(([fp, fd]) => {
            const counts = Object.values(fd.b || {}).flat();
            const total = counts.length;
            const covered = counts.filter((n) => n > 0).length;
            const pct = total === 0 ? 100 : (covered / total) * 100;
            return { file: fp.replace(prefix, ''), pct, covered, total };
        })
        .sort((a, b) => a.pct - b.pct);
}

export function status(pct) {
    if (pct < THRESHOLD) return 'FAIL';
    return pct < 90 ? 'OK  ' : 'GOOD';
}

export function formatRow(r) {
    return `${status(r.pct)} | ${r.pct.toFixed(1).padStart(5)}% | ${`${r.covered}/${r.total}`.padStart(7)} | ${r.file}`;
}

/** Skriver én rad per fil og returnerer exit-kode (1 hvis noen fil er under terskelen). */
export function run(data, cwd, log = console.log) {
    const results = summarizeBranchCoverage(data, cwd);
    results.forEach((r) => log(formatRow(r)));
    return results.some((r) => r.pct < THRESHOLD) ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const data = JSON.parse(readFileSync('coverage/coverage-final.json', 'utf8'));
    process.exit(run(data, process.cwd()));
}
