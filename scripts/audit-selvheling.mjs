// Beslutningslogikk for selvhelingen i .github/workflows/scheduled-audit.yml.
// Leser osv-scanner-JSON og avgjør per funn om det skal ignoreres (lavt), vente på cooldown
// (fiksen er yngre enn 7 dager — gjelder bare lav/medium; høy/kritisk rettes straks) eller
// varsles i en issue (ingen fiks publisert, eller fiksen ligger utenfor package.json-rangene).
// Kjøres i workflowen før `npm ci`, så skriptet kan bare bruke Node-standardbiblioteket.
// Underkommandoer og exit-koder: se `main` nederst.
import { readFileSync, appendFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ALVOR_FRA_DB = { LOW: 'lav', MODERATE: 'medium', HIGH: 'høy', CRITICAL: 'kritisk' };
const GRUNN_INGEN_FIKS = 'ingen fiks publisert';
const GRUNN_UTENFOR = 'fiks finnes, men ikke innenfor package.json-rangene (major eller override)';
const KJØRETIME_UTC = 6;
const DAG_MS = 24 * 60 * 60 * 1000;

/** CVSS-score først (<4 lav, <7 medium, <9 høy, ellers kritisk), så GitHubs nivå, ellers medium. */
export function alvor(score, dbSeverity) {
    const tall = score === '' || score == null ? NaN : Number(score);
    if (Number.isFinite(tall)) {
        if (tall < 4) return 'lav';
        if (tall < 7) return 'medium';
        return tall < 9 ? 'høy' : 'kritisk';
    }
    return ALVOR_FRA_DB[dbSeverity] ?? 'medium';
}

function delOpp(v) {
    const [kjerne, pre] = String(v).split('+')[0].split(/-(.*)/s);
    return { tall: kjerne.split('.').map((d) => Number(d) || 0), pre: pre ? pre.split('.') : [] };
}

function sammenlignPre(a, b) {
    if (!a.length || !b.length) return Math.sign(b.length - a.length);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] === undefined || b[i] === undefined) return a[i] === undefined ? -1 : 1;
        if (a[i] === b[i]) continue;
        const na = /^\d+$/.test(a[i]);
        const nb = /^\d+$/.test(b[i]);
        if (na && nb) return Math.sign(Number(a[i]) - Number(b[i]));
        if (na !== nb) return na ? -1 : 1;
        return a[i] < b[i] ? -1 : 1;
    }
    return 0;
}

/** Semver-sammenligning av `major.minor.patch`; en forhåndsversjon er lavere enn den stabile. */
export function sammenlignVersjoner(a, b) {
    const x = delOpp(a);
    const y = delOpp(b);
    for (let i = 0; i < 3; i++) {
        const d = (x.tall[i] ?? 0) - (y.tall[i] ?? 0);
        if (d) return Math.sign(d);
    }
    return sammenlignPre(x.pre, y.pre);
}

function områderFor(vuln, pakke) {
    const områder = [];
    for (const a of vuln.affected ?? []) {
        if (a.package?.ecosystem !== 'npm' || a.package?.name !== pakke) continue;
        for (const r of a.ranges ?? []) {
            if (r.type === 'GIT') continue;
            for (const e of r.events ?? []) {
                if (e.introduced !== undefined) områder.push({ introdusert: e.introduced });
                else if (e.fixed !== undefined && områder.length) områder.at(-1).fikset = e.fixed;
            }
        }
    }
    return områder;
}

/** Gjør osv-scanner-JSON om til én post per (katalog, pakke, sårbarhet). */
export function lesFunn(osv, rot) {
    const funn = new Map();
    for (const r of osv.results ?? []) {
        const katalog = relative(rot, dirname(r.source.path)) || '.';
        for (const p of r.packages ?? []) {
            if (p.package.ecosystem !== 'npm') continue;
            for (const v of p.vulnerabilities ?? []) {
                const id = [v.id, ...(v.aliases ?? [])].find((s) => s.startsWith('GHSA-')) ?? v.id;
                const nøkkel = `${katalog}\0${p.package.name}\0${id}`;
                if (funn.has(nøkkel)) continue;
                const gruppe = (p.groups ?? []).find((g) => g.ids?.includes(v.id));
                funn.set(nøkkel, {
                    id,
                    pakke: p.package.name,
                    versjon: p.package.version,
                    katalog,
                    alvor: alvor(gruppe?.max_severity, v.database_specific?.severity),
                    områder: områderFor(v, p.package.name),
                });
            }
        }
    }
    return [...funn.values()];
}

/** Fiksversjonen i området som inneholder installert versjon (backport, ikke nyeste). */
export function fiksFor(funn) {
    const område = funn.områder.find(
        (o) =>
            sammenlignVersjoner(o.introdusert, funn.versjon) <= 0 &&
            (o.fikset === undefined || sammenlignVersjoner(funn.versjon, o.fikset) < 0),
    );
    return område?.fikset;
}

/** Høy og kritisk rettes straks; lav og medium venter til fiksen er eldre enn cutoff. */
export function grense(alvorsgrad, cutoff, nå) {
    return alvorsgrad === 'høy' || alvorsgrad === 'kritisk' ? nå : cutoff;
}

/** Første daglige kjøring (06:00 UTC) på eller etter tidspunktet, som YYYY-MM-DD. */
function førsteKjøring(tid) {
    const kjøring = new Date(Date.UTC(tid.getUTCFullYear(), tid.getUTCMonth(), tid.getUTCDate(), KJØRETIME_UTC));
    if (kjøring < tid) kjøring.setTime(kjøring.getTime() + DAG_MS);
    return kjøring.toISOString().slice(0, 10);
}

/** @param publisert registryets `.time` (versjon → ISO-tid) */
export function vurder(funn, publisert, cutoff, nå) {
    if (funn.alvor === 'lav') return { ...funn, utfall: 'ignorer', grunn: 'lavt funn' };
    const fiks = fiksFor(funn);
    if (!fiks || !publisert[fiks]) return { ...funn, utfall: 'varsle', grunn: GRUNN_INGEN_FIKS };
    const t = new Date(publisert[fiks]);
    if (t > grense(funn.alvor, cutoff, nå)) {
        const aktuellFra = førsteKjøring(new Date(t.getTime() + (nå - cutoff)));
        return { ...funn, utfall: 'venter', aktuellFra, grunn: `fiks ${fiks} er yngre enn cooldownen` };
    }
    return { ...funn, utfall: 'varsle', grunn: GRUNN_UTENFOR };
}

export function unikeIder(vurderinger) {
    return [...new Set(vurderinger.map((v) => v.id))].sort();
}

export function lagMarkør(ider) {
    return `<!-- audit-funn: ${[...ider].sort().join(',')} -->`;
}

/** Unionen av alle markører. Kalleren sender bare tekst workflowen selv har skrevet. */
export function lesMarkør(tekster) {
    const ider = new Set();
    for (const t of tekster) {
        for (const m of String(t ?? '').matchAll(/<!-- audit-funn: ([^>]*?) -->/g)) {
            m[1].split(',').filter(Boolean).forEach((id) => ider.add(id));
        }
    }
    return [...ider].sort();
}

export function nyeIder(gamle, nye) {
    return nye.filter((id) => !gamle.includes(id));
}

// --- CLI ---------------------------------------------------------------------------------

function lesJson(deps, fil) {
    let tekst;
    try {
        tekst = deps.lesFil(fil);
        return JSON.parse(tekst);
    } catch (e) {
        throw new Error(tekst === '' ? `${fil} er tom` : `kan ikke lese ${fil}: ${e.message}`);
    }
}

function lesOsv(deps, fil) {
    const osv = lesJson(deps, fil);
    if (!Array.isArray(osv?.results)) throw new Error(`${fil}: results er ikke en liste`);
    return lesFunn(osv, deps.env.OSV_ROT ?? '/github/workspace');
}

function liste(arg) {
    return String(arg ?? '').split(',').filter(Boolean);
}

function flagg(argv, navn) {
    const i = argv.indexOf(navn);
    const verdi = i >= 0 ? new Date(argv[i + 1]) : undefined;
    if (!verdi || Number.isNaN(verdi.getTime())) throw new Error(`${navn} mangler eller er ugyldig`);
    return verdi;
}

function pakker(argv, deps) {
    const perPakke = new Map();
    for (const f of lesOsv(deps, argv[1])) {
        const nøkkel = `${f.katalog}\t${f.pakke}`;
        const straks = f.alvor === 'høy' || f.alvor === 'kritisk';
        perPakke.set(nøkkel, perPakke.get(nøkkel) || straks);
    }
    for (const [nøkkel, straks] of perPakke) deps.ut(`${nøkkel}\t${straks ? 'straks' : 'vent'}`);
    return 0;
}

function nedgradert(argv, deps) {
    const gammel = lesJson(deps, argv[1]).packages;
    const ny = lesJson(deps, argv[2]).packages;
    if (!gammel || !ny) throw new Error('lockfil mangler packages');
    let funnet = 0;
    for (const [nøkkel, p] of Object.entries(gammel)) {
        const nyVersjon = ny[nøkkel]?.version;
        if (p.version && nyVersjon && sammenlignVersjoner(nyVersjon, p.version) < 0) {
            deps.feil(`${nøkkel} ${p.version} → ${nyVersjon}`);
            funnet = 1;
        }
    }
    return funnet;
}

async function hentTider(deps, pakke) {
    let svar;
    try {
        svar = await deps.fetch(`https://registry.npmjs.org/${encodeURIComponent(pakke)}`);
    } catch (e) {
        throw new Error(`registry-oppslag for ${pakke} feilet: ${e.message}`);
    }
    if (svar.status === 404) return {};
    if (svar.status !== 200) throw new Error(`registry svarte ${svar.status} for ${pakke}`);
    return (await svar.json()).time ?? {};
}

async function vurderKommando(argv, deps) {
    const cutoff = flagg(argv, '--cutoff');
    const nå = flagg(argv, '--na');
    const funn = lesOsv(deps, argv[1]).filter((f) => f.alvor !== 'lav');
    const tider = new Map();
    for (const pakke of new Set(funn.map((f) => f.pakke))) tider.set(pakke, await hentTider(deps, pakke));
    const vurderinger = funn.map((f) => vurder(f, tider.get(f.pakke), cutoff, nå));

    const venter = vurderinger.filter((v) => v.utfall === 'venter');
    const varsle = vurderinger.filter((v) => v.utfall === 'varsle');
    for (const v of venter) {
        deps.ut(`::warning::${v.id} i ${v.pakke}@${v.versjon} (${v.katalog}): venter på cooldown, fiksen blir aktuell ${v.aktuellFra}`);
    }
    const linjer = varsle.map((v) => `- **${v.id}** i \`${v.pakke}@${v.versjon}\` (${v.katalog}, ${v.alvor}): ${v.grunn}`);
    linjer.forEach((l) => deps.feil(l));

    const status = varsle.length ? 'varsle' : venter.length ? 'venter' : 'ren';
    if (deps.env.GITHUB_OUTPUT) {
        const skille = randomUUID();
        deps.leggTil(
            deps.env.GITHUB_OUTPUT,
            `status=${status}\nvarsle_ider=${unikeIder(varsle).join(',')}\nvarsle_tekst<<${skille}\n${linjer.join('\n')}\n${skille}\n`,
        );
    }
    if (deps.env.GITHUB_STEP_SUMMARY) {
        const rader = vurderinger.map(
            (v) => `| ${v.id} | \`${v.pakke}@${v.versjon}\` | ${v.katalog} | ${v.alvor} | ${v.utfall}${v.aktuellFra ? ` (${v.aktuellFra})` : ''} |`,
        );
        deps.leggTil(
            deps.env.GITHUB_STEP_SUMMARY,
            `### OSV-selvheling: ${status}\n\n| Funn | Pakke | Katalog | Alvor | Utfall |\n|---|---|---|---|---|\n${rader.join('\n')}\n`,
        );
    }
    return 0;
}

function nye(argv, deps) {
    if (!deps.env.ISSUE_JSON) throw new Error('ISSUE_JSON mangler');
    const issue = lesJson(deps, deps.env.ISSUE_JSON);
    const tekster = [issue.body, ...(issue.comments ?? []).filter((c) => c.author?.login === 'github-actions').map((c) => c.body)];
    deps.ut(nyeIder(lesMarkør(tekster), liste(argv[1])).join(','));
    return 0;
}

const KOMMANDOER = {
    pakker,
    nedgradert,
    vurder: vurderKommando,
    nye,
    markør: (argv, deps) => {
        deps.ut(lagMarkør(liste(argv[1])));
        return 0;
    },
};

/**
 * Underkommandoer:
 *   pakker <osv.json>                          → `katalog\tpakke\tstraks|vent` per pakke med funn
 *   nedgradert <gammel-lock> <ny-lock>         → exit 1 hvis en pakke fikk lavere versjon
 *   vurder <osv.json> --cutoff <ISO> --na <ISO> → status/varsle_ider/varsle_tekst i GITHUB_OUTPUT
 *   nye <id,id>                                → id-er som ikke står i markøren i issuen (ISSUE_JSON)
 *   markør <id,id>                             → skjult markør for issue-teksten
 * Exit 2 (`::error::`) ved ugyldig input eller registry-feil — workflowen tolker det som `feil`.
 */
export async function main(argv, deps) {
    const kommando = KOMMANDOER[argv[0]];
    try {
        if (!kommando) throw new Error(`ukjent underkommando: ${argv[0] ?? '(ingen)'}`);
        return await kommando(argv, deps);
    } catch (e) {
        deps.feil(`::error::audit-selvheling: ${e.message}`);
        return 2;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await main(process.argv.slice(2), {
        fetch: globalThis.fetch,
        env: process.env,
        ut: (s) => process.stdout.write(`${s}\n`),
        feil: (s) => process.stderr.write(`${s}\n`),
        lesFil: (p) => readFileSync(p, 'utf8'),
        leggTil: appendFileSync,
    });
}
