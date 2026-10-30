// Tester scripts/audit-selvheling.mjs: de rene beslutningsfunksjonene og CLI-en (`main`) med
// falske avhengigheter. Ingen nett — registryet er en falsk `fetch`. qs-fixturen er kuttet ned
// fra en ekte osv-scanner v2.7.0-skanning (Docker) av lockfila fra 4bfc5df.
import { describe, it, expect } from 'vitest';
import {
    alvor,
    sammenlignVersjoner,
    lesFunn,
    fiksFor,
    grense,
    vurder,
    unikeIder,
    lagMarkør,
    lesMarkør,
    nyeIder,
    main,
} from '../audit-selvheling.mjs';

const ROT = '/github/workspace';
const CUTOFF = new Date('2026-10-23T06:00:00Z');
const NÅ = new Date('2026-10-30T06:00:00Z');

const QS_VULN = {
    id: 'GHSA-6pq8-jhm2-2vcw',
    aliases: ['CVE-2026-110816'],
    database_specific: { severity: 'MODERATE' },
    affected: [
        {
            package: { ecosystem: 'npm', name: 'qs', purl: 'pkg:npm/qs' },
            ranges: [{ type: 'SEMVER', events: [{ introduced: '6.7.0' }, { fixed: '6.16.1' }] }],
        },
    ],
};

/** Ett OSV-resultat (én lockfil) med én pakke og dens sårbarheter. */
function resultat(katalog, navn, versjon, vulns, maxSeverity = '6.3') {
    const path = katalog === '.' ? `${ROT}/package-lock.json` : `${ROT}/${katalog}/package-lock.json`;
    return {
        source: { path, type: 'lockfile' },
        packages: [
            {
                package: { name: navn, version: versjon, ecosystem: 'npm' },
                groups: [{ ids: vulns.map((v) => v.id), aliases: [], max_severity: maxSeverity }],
                vulnerabilities: vulns,
            },
        ],
    };
}

function vuln(id, navn, events, { aliases = [], dbSeverity } = {}) {
    return {
        id,
        aliases,
        database_specific: dbSeverity ? { severity: dbSeverity } : {},
        affected: [{ package: { ecosystem: 'npm', name: navn }, ranges: [{ type: 'SEMVER', events }] }],
    };
}

const QS_OSV = { results: [resultat('.', 'qs', '6.16.0', [QS_VULN])] };

function funn(overstyr = {}) {
    return {
        id: 'GHSA-6pq8-jhm2-2vcw',
        pakke: 'qs',
        versjon: '6.16.0',
        katalog: '.',
        alvor: 'medium',
        områder: [{ introdusert: '6.7.0', fikset: '6.16.1' }],
        ...overstyr,
    };
}

const BACKPORT = funn({
    id: 'GHSA-back-port-test',
    pakke: 'bp',
    versjon: '1.4.1',
    områder: [
        { introdusert: '0', fikset: '1.4.2' },
        { introdusert: '2.0.0', fikset: '2.0.5' },
    ],
});

describe('alvor', () => {
    it.each([
        ['3.9', undefined, 'lav'],
        ['4.0', undefined, 'medium'],
        ['6.9', undefined, 'medium'],
        ['7.0', undefined, 'høy'],
        ['9.0', undefined, 'kritisk'],
        ['', 'LOW', 'lav'],
        ['', 'MODERATE', 'medium'],
        ['', 'HIGH', 'høy'],
        ['', 'CRITICAL', 'kritisk'],
        ['', undefined, 'medium'],
        ['abc', undefined, 'medium'],
        [undefined, 'UKJENT', 'medium'],
    ])('(%j, %j) gir %s', (score, db, forventet) => {
        expect(alvor(score, db)).toBe(forventet);
    });
});

describe('sammenlignVersjoner', () => {
    it.each([
        ['6.16.1', '6.16.0', 1],
        ['6.10.0', '6.9.9', 1],
        ['2.0.0-beta.1', '2.0.0', -1],
        ['2.0.0', '2.0.0-beta.1', 1],
        ['2.0.0-beta.2', '2.0.0-beta.10', -1],
        ['2.0.0-rc.1', '2.0.0-beta.1', 1],
        ['2.0.0-beta', '2.0.0-beta.1', -1],
        ['1.2.3', '1.2.3', 0],
        ['2.0.0-beta.1', '2.0.0-beta.1', 0],
        ['0', '1.4.1', -1],
        ['1.0.0+build.5', '1.0.0', 0],
    ])('%s mot %s gir %i', (a, b, forventet) => {
        expect(sammenlignVersjoner(a, b)).toBe(forventet);
    });
});

describe('lesFunn', () => {
    it('leser qs-funnet fra en ekte skanning', () => {
        expect(lesFunn(QS_OSV, ROT)).toEqual([funn()]);
    });

    it('gir lambda-katalogen for en lockfil der', () => {
        const osv = { results: [resultat('lambda/kontakt-form-handler', 'qs', '6.16.0', [QS_VULN])] };
        expect(lesFunn(osv, ROT)[0].katalog).toBe('lambda/kontakt-form-handler');
    });

    it.each([[{}], [{ results: [] }]])('%j gir ingen funn', (osv) => {
        expect(lesFunn(osv, ROT)).toEqual([]);
    });

    it('foretrekker GHSA blant aliasene og faller tilbake til OSV-id', () => {
        const osv = {
            results: [
                resultat('.', 'a', '1.0.0', [
                    vuln('CVE-2026-1', 'a', [{ introduced: '0' }], { aliases: ['GHSA-aaaa-bbbb-cccc'] }),
                    vuln('PYSEC-1', 'a', [{ introduced: '0' }]),
                ]),
            ],
        };
        expect(lesFunn(osv, ROT).map((f) => f.id)).toEqual(['GHSA-aaaa-bbbb-cccc', 'PYSEC-1']);
    });

    it('henter alvor fra gruppen sårbarheten hører til, med database_specific som reserve', () => {
        const a = vuln('GHSA-a', 'p', [{ introduced: '0' }]);
        const b = vuln('GHSA-b', 'p', [{ introduced: '0' }], { dbSeverity: 'HIGH' });
        const osv = {
            results: [
                {
                    source: { path: `${ROT}/package-lock.json` },
                    packages: [
                        {
                            package: { name: 'p', version: '1.0.0', ecosystem: 'npm' },
                            groups: [
                                { ids: ['GHSA-a'], max_severity: '9.8' },
                                { ids: ['GHSA-b'], max_severity: '' },
                            ],
                            vulnerabilities: [a, b],
                        },
                    ],
                },
            ],
        };
        expect(lesFunn(osv, ROT).map((f) => [f.id, f.alvor])).toEqual([
            ['GHSA-a', 'kritisk'],
            ['GHSA-b', 'høy'],
        ]);
    });

    it('leser flere områder i rekkefølge og ignorerer andre pakker og økosystemer', () => {
        const v = {
            id: 'GHSA-x',
            affected: [
                {
                    package: { ecosystem: 'npm', name: 'bp' },
                    ranges: [
                        { type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '1.4.2' }, { introduced: '2.0.0' }, { fixed: '2.0.5' }] },
                        { type: 'GIT', events: [{ introduced: 'abc' }, { fixed: 'def' }] },
                    ],
                },
                { package: { ecosystem: 'npm', name: 'annen' }, ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }] }] },
                { package: { ecosystem: 'PyPI', name: 'bp' }, ranges: [{ type: 'ECOSYSTEM', events: [{ introduced: '0' }] }] },
                { package: { ecosystem: 'npm', name: 'bp' }, ranges: [{ type: 'SEMVER', events: [{ introduced: '3.0.0' }, { last_affected: '3.1.0' }] }] },
            ],
        };
        expect(lesFunn({ results: [resultat('.', 'bp', '1.4.1', [v])] }, ROT)[0].områder).toEqual([
            { introdusert: '0', fikset: '1.4.2' },
            { introdusert: '2.0.0', fikset: '2.0.5' },
            { introdusert: '3.0.0' },
        ]);
    });

    it('holder hver installerte versjon av samme pakke som eget funn', () => {
        const toVersjoner = resultat('.', 'qs', '6.16.0', [QS_VULN]);
        toVersjoner.packages.push(resultat('.', 'qs', '6.10.0', [QS_VULN]).packages[0]);
        expect(lesFunn({ results: [toVersjoner] }, ROT).map((f) => f.versjon)).toEqual(['6.16.0', '6.10.0']);
    });

    it('dedupliserer på katalog, pakke, versjon og id, og hopper over pakker utenfor npm', () => {
        const dobbel = { ...resultat('.', 'qs', '6.16.0', [QS_VULN, QS_VULN]) };
        const go = {
            source: { path: `${ROT}/go.sum` },
            packages: [{ package: { name: 'x', version: '1', ecosystem: 'Go' }, vulnerabilities: [QS_VULN] }],
        };
        expect(lesFunn({ results: [dobbel, go] }, ROT)).toHaveLength(1);
    });
});

describe('fiksFor', () => {
    it('gir fiksen i området som inneholder installert versjon', () => {
        expect(fiksFor(funn())).toBe('6.16.1');
    });

    it('velger backport-fiksen, ikke den nyeste', () => {
        expect(fiksFor(BACKPORT)).toBe('1.4.2');
    });

    it('gir undefined når installert versjon er utenfor alle områder', () => {
        expect(fiksFor(funn({ versjon: '6.6.0' }))).toBeUndefined();
    });

    it('gir undefined for et område uten fiks', () => {
        expect(fiksFor(funn({ områder: [{ introdusert: '0' }] }))).toBeUndefined();
    });
});

describe('grense', () => {
    it.each([
        ['lav', CUTOFF],
        ['medium', CUTOFF],
        ['høy', NÅ],
        ['kritisk', NÅ],
    ])('%s gir %s', (a, forventet) => {
        expect(grense(a, CUTOFF, NÅ)).toBe(forventet);
    });
});

describe('vurder', () => {
    it.each([
        ['2026-10-28T23:41:47Z', '2026-11-05'],
        ['2026-10-25T05:00:00Z', '2026-11-01'],
    ])('fersk fiks publisert %s venter til %s', (tid, dato) => {
        const v = vurder(funn(), { '6.16.1': tid }, CUTOFF, NÅ);
        expect(v).toMatchObject({ utfall: 'venter', aktuellFra: dato, pakke: 'qs' });
    });

    it('gammel fiks som ikke er tatt, gir varsel om rangene', () => {
        const v = vurder(funn(), { '6.16.1': '2026-10-14T22:06:17Z' }, CUTOFF, NÅ);
        expect(v.utfall).toBe('varsle');
        expect(v.grunn).toMatch(/ikke innenfor package\.json-rangene/);
    });

    it('upublisert fiks gir varsel', () => {
        expect(vurder(funn(), {}, CUTOFF, NÅ)).toMatchObject({ utfall: 'varsle', grunn: 'ingen fiks publisert' });
    });

    it('funn uten fiks gir varsel', () => {
        const v = vurder(funn({ områder: [{ introdusert: '0' }] }), { '6.16.1': '2026-10-14T00:00:00Z' }, CUTOFF, NÅ);
        expect(v).toMatchObject({ utfall: 'varsle', grunn: 'ingen fiks publisert' });
    });

    it('lavt funn ignoreres', () => {
        expect(vurder(funn({ alvor: 'lav' }), {}, CUTOFF, NÅ).utfall).toBe('ignorer');
    });

    it('backport-fiks publisert i går venter', () => {
        const v = vurder(BACKPORT, { '1.4.2': '2026-10-29T12:00:00Z', '2.0.5': '2026-01-01T00:00:00Z' }, CUTOFF, NÅ);
        expect(v.utfall).toBe('venter');
    });

    it.each(['høy', 'kritisk'])('%s funn med fersk fiks som står igjen, varsles straks', (a) => {
        const v = vurder(funn({ alvor: a }), { '6.16.1': '2026-10-29T12:00:00Z' }, CUTOFF, NÅ);
        expect(v.utfall).toBe('varsle');
    });
});

describe('markører', () => {
    it('unikeIder slår sammen samme id i rot og lambda og sorterer', () => {
        const v = [funn({ id: 'B' }), funn({ id: 'A', katalog: 'lambda/x' }), funn({ id: 'B', katalog: 'lambda/x' })];
        expect(unikeIder(v)).toEqual(['A', 'B']);
    });

    it('lagMarkør lager en skjult HTML-kommentar', () => {
        expect(lagMarkør(['B', 'A'])).toBe('<!-- audit-funn: A,B -->');
    });

    it.each([
        [[lagMarkør(['B', 'A'])], ['A', 'B']],
        [[lagMarkør(['A']), lagMarkør(['B'])], ['A', 'B']],
        [[`tekst\n${lagMarkør(['A'])}\n${lagMarkør(['C'])}`], ['A', 'C']],
        [['ingen markør her', ''], []],
        [[undefined, null], []],
    ])('lesMarkør(%j) gir %j', (tekster, forventet) => {
        expect(lesMarkør(tekster)).toEqual(forventet);
    });

    it.each([
        [['A'], ['A', 'B'], ['B']],
        [['A', 'B'], ['A'], []],
    ])('nyeIder(%j, %j) gir %j', (gamle, nye, forventet) => {
        expect(nyeIder(gamle, nye)).toEqual(forventet);
    });
});

// --- CLI ---------------------------------------------------------------------------------

/** Falske avhengigheter: filer i et objekt, registry som objekt pakke → svar. */
function lagDeps({ filer = {}, registry = {}, env = {} } = {}) {
    const ut = [];
    const feil = [];
    const skrevet = {};
    const hentet = [];
    const deps = {
        env: { GITHUB_OUTPUT: '/out', GITHUB_STEP_SUMMARY: '/sum', OSV_ROT: ROT, ...env },
        ut: (s) => ut.push(s),
        feil: (s) => feil.push(s),
        lesFil: (p) => {
            if (!(p in filer)) throw new Error(`ENOENT: ${p}`);
            return filer[p];
        },
        leggTil: (p, s) => {
            skrevet[p] = (skrevet[p] ?? '') + s;
        },
        fetch: async (url) => {
            hentet.push(url);
            const svar = registry[decodeURIComponent(url.replace('https://registry.npmjs.org/', ''))];
            if (svar instanceof Error) throw svar;
            if (typeof svar === 'number') return { status: svar, json: async () => ({}) };
            if (!svar) return { status: 404, json: async () => ({}) };
            return { status: 200, json: async () => ({ time: svar }) };
        },
    };
    return { deps, ut, feil, skrevet, hentet };
}

/** Leser GITHUB_OUTPUT til et objekt (også flerlinjeverdier med skilletekst). */
function output(tekst = '') {
    const res = {};
    const linjer = tekst.split('\n');
    for (let i = 0; i < linjer.length; i++) {
        const m = linjer[i].match(/^([a-z_]+)<<(.+)$/);
        if (m) {
            const slutt = linjer.indexOf(m[2], i + 1);
            res[m[1]] = linjer.slice(i + 1, slutt).join('\n');
            i = slutt;
        } else if (linjer[i].includes('=')) {
            const [k, ...v] = linjer[i].split('=');
            res[k] = v.join('=');
        }
    }
    return res;
}

const VURDER = ['vurder', '/osv.json', '--cutoff', CUTOFF.toISOString(), '--na', NÅ.toISOString()];

describe('main: pakker', () => {
    it('gir én linje per katalog og pakke, straks for høy og vent for medium', async () => {
        const osv = {
            results: [
                resultat('.', 'qs', '6.16.0', [QS_VULN]),
                resultat('lambda/kontakt-form-handler', 'fast-xml-parser', '4.0.0', [vuln('GHSA-h', 'fast-xml-parser', [{ introduced: '0' }])], '7.5'),
            ],
        };
        const { deps, ut } = lagDeps({ filer: { '/osv.json': JSON.stringify(osv) } });
        expect(await main(['pakker', '/osv.json'], deps)).toBe(0);
        expect(ut).toEqual(['.\tqs\tvent', 'lambda/kontakt-form-handler\tfast-xml-parser\tstraks']);
    });

    it('slår sammen flere funn i samme pakke og bruker straks hvis ett er høyt', async () => {
        const osv = {
            results: [
                {
                    source: { path: `${ROT}/package-lock.json` },
                    packages: [
                        {
                            package: { name: 'p', version: '1.0.0', ecosystem: 'npm' },
                            groups: [
                                { ids: ['GHSA-m'], max_severity: '5.0' },
                                { ids: ['GHSA-k'], max_severity: '9.1' },
                            ],
                            vulnerabilities: [vuln('GHSA-m', 'p', [{ introduced: '0' }]), vuln('GHSA-k', 'p', [{ introduced: '0' }])],
                        },
                    ],
                },
            ],
        };
        const { deps, ut } = lagDeps({ filer: { '/osv.json': JSON.stringify(osv) } });
        await main(['pakker', '/osv.json'], deps);
        expect(ut).toEqual(['.\tp\tstraks']);
    });
});

describe('main: vurder', () => {
    it('fersk fiks gir venter, en advarsel og datoen', async () => {
        const { deps, ut, skrevet } = lagDeps({
            filer: { '/osv.json': JSON.stringify(QS_OSV) },
            registry: { qs: { '6.16.1': '2026-10-28T23:41:47Z' } },
        });
        expect(await main(VURDER, deps)).toBe(0);
        expect(output(skrevet['/out']).status).toBe('venter');
        expect(ut).toEqual([
            '::warning::GHSA-6pq8-jhm2-2vcw i qs@6.16.0 (.): venter på cooldown, fiksen blir aktuell 2026-11-05',
        ]);
        expect(skrevet['/sum']).toMatch(/2026-11-05/);
    });

    it('gammel fiks gir varsle med id og tekst', async () => {
        const { deps, feil, skrevet } = lagDeps({
            filer: { '/osv.json': JSON.stringify(QS_OSV) },
            registry: { qs: { '6.16.1': '2026-10-14T22:06:17Z' } },
        });
        expect(await main(VURDER, deps)).toBe(0);
        const o = output(skrevet['/out']);
        expect(o.status).toBe('varsle');
        expect(o.varsle_ider).toBe('GHSA-6pq8-jhm2-2vcw');
        expect(o.varsle_tekst).toMatch(/`qs@6\.16\.0`/);
        expect(feil.join('\n')).toMatch(/GHSA-6pq8-jhm2-2vcw/);
    });

    it('ingen funn gir ren uten registry-oppslag', async () => {
        const { deps, skrevet, hentet } = lagDeps({ filer: { '/osv.json': '{"results":[]}' } });
        expect(await main(VURDER, deps)).toBe(0);
        expect(output(skrevet['/out']).status).toBe('ren');
        expect(hentet).toEqual([]);
    });

    it('lave funn hentes ikke og gir ren', async () => {
        const osv = { results: [resultat('.', 'qs', '6.16.0', [QS_VULN], '2.0')] };
        const { deps, skrevet, hentet } = lagDeps({ filer: { '/osv.json': JSON.stringify(osv) } });
        expect(await main(VURDER, deps)).toBe(0);
        expect(output(skrevet['/out']).status).toBe('ren');
        expect(hentet).toEqual([]);
    });

    it('scoped pakke kodes i URL-en og står i backticks', async () => {
        const osv = { results: [resultat('.', '@scope/navn', '1.0.0', [vuln('GHSA-s', '@scope/navn', [{ introduced: '0' }, { fixed: '1.0.1' }])])] };
        const { deps, skrevet, hentet } = lagDeps({
            filer: { '/osv.json': JSON.stringify(osv) },
            registry: { '@scope/navn': { '1.0.1': '2026-01-01T00:00:00Z' } },
        });
        await main(VURDER, deps);
        expect(hentet).toEqual(['https://registry.npmjs.org/%40scope%2Fnavn']);
        expect(output(skrevet['/out']).varsle_tekst).toMatch(/`@scope\/navn@1\.0\.0`/);
    });

    it('henter hver pakke bare én gang selv om den finnes i rot og lambda', async () => {
        const osv = { results: [resultat('.', 'qs', '6.16.0', [QS_VULN]), resultat('lambda/x', 'qs', '6.16.0', [QS_VULN])] };
        const { deps, hentet, skrevet } = lagDeps({
            filer: { '/osv.json': JSON.stringify(osv) },
            registry: { qs: { '6.16.1': '2026-10-14T22:06:17Z' } },
        });
        await main(VURDER, deps);
        expect(hentet).toHaveLength(1);
        expect(output(skrevet['/out']).varsle_ider).toBe('GHSA-6pq8-jhm2-2vcw');
    });

    it('varsle vinner over venter', async () => {
        const osv = {
            results: [resultat('.', 'qs', '6.16.0', [QS_VULN]), resultat('lambda/x', 'ny', '1.0.0', [vuln('GHSA-n', 'ny', [{ introduced: '0' }, { fixed: '1.0.1' }])])],
        };
        const { deps, skrevet, ut } = lagDeps({
            filer: { '/osv.json': JSON.stringify(osv) },
            registry: { qs: { '6.16.1': '2026-10-14T22:06:17Z' }, ny: { '1.0.1': '2026-10-29T00:00:00Z' } },
        });
        await main(VURDER, deps);
        expect(output(skrevet['/out']).status).toBe('varsle');
        expect(ut).toHaveLength(1);
    });

    it('404 fra registryet gir varsle med ingen fiks publisert', async () => {
        const { deps, skrevet } = lagDeps({ filer: { '/osv.json': JSON.stringify(QS_OSV) } });
        expect(await main(VURDER, deps)).toBe(0);
        expect(output(skrevet['/out']).varsle_tekst).toMatch(/ingen fiks publisert/);
    });

    it('skilleteksten er tilfeldig og avslutter flerlinjeverdien', async () => {
        const { deps, skrevet } = lagDeps({
            filer: { '/osv.json': JSON.stringify(QS_OSV) },
            registry: { qs: { '6.16.1': '2026-10-14T22:06:17Z' } },
        });
        await main(VURDER, deps);
        const m = skrevet['/out'].match(/^varsle_tekst<<(.+)$/m);
        expect(m[1]).toMatch(/^[0-9a-f-]{36}$/);
        expect(skrevet['/out']).toContain(`\n${m[1]}\n`);
    });

    it('skriver ingenting til GITHUB_OUTPUT eller oppsummering når de ikke er satt', async () => {
        const { deps, skrevet } = lagDeps({ filer: { '/osv.json': '{"results":[]}' }, env: { GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '' } });
        expect(await main(VURDER, deps)).toBe(0);
        expect(skrevet).toEqual({});
    });

    it('bruker /github/workspace som rot når OSV_ROT mangler', async () => {
        const { deps, skrevet } = lagDeps({
            filer: { '/osv.json': JSON.stringify(QS_OSV) },
            registry: { qs: { '6.16.1': '2026-10-14T22:06:17Z' } },
            env: { OSV_ROT: undefined },
        });
        await main(VURDER, deps);
        expect(output(skrevet['/out']).varsle_tekst).toMatch(/\(\.,/);
    });

    it.each([
        ['fetch som kaster', new Error('ECONNRESET')],
        ['svar 503', 503],
    ])('%s gir 2', async (_navn, svar) => {
        const { deps, feil, skrevet } = lagDeps({ filer: { '/osv.json': JSON.stringify(QS_OSV) }, registry: { qs: svar } });
        expect(await main(VURDER, deps)).toBe(2);
        expect(feil.join('\n')).toMatch(/^::error::/m);
        expect(skrevet['/out']).toBeUndefined();
    });

    it.each([
        ['ugyldig JSON', '{ikke json'],
        ['tom fil', ''],
        ['results null', '{"results":null}'],
        ['uten results', '{}'],
    ])('%s gir 2', async (_navn, innhold) => {
        const { deps, feil } = lagDeps({ filer: { '/osv.json': innhold } });
        expect(await main(VURDER, deps)).toBe(2);
        expect(feil.join('\n')).toMatch(/^::error::/m);
    });

    it('manglende fil gir 2', async () => {
        const { deps } = lagDeps();
        expect(await main(VURDER, deps)).toBe(2);
    });

    it.each([
        [['vurder', '/osv.json', '--na', NÅ.toISOString()]],
        [['vurder', '/osv.json', '--cutoff', CUTOFF.toISOString()]],
        [['vurder', '/osv.json', '--cutoff', 'i går', '--na', NÅ.toISOString()]],
        [['vurder', '/osv.json', '--cutoff']],
    ])('%j gir 2', async (argv) => {
        const { deps } = lagDeps({ filer: { '/osv.json': '{"results":[]}' } });
        expect(await main(argv, deps)).toBe(2);
    });
});

describe('main: nedgradert', () => {
    const lock = (pakker) => JSON.stringify({ packages: pakker });

    it('en nedgradering gir 1 og navnet på pakken', async () => {
        const { deps, feil } = lagDeps({
            filer: {
                '/gammel': lock({ '': { version: '1.0.0' }, 'node_modules/qs': { version: '6.16.1' } }),
                '/ny': lock({ '': { version: '1.0.0' }, 'node_modules/qs': { version: '6.16.0' } }),
            },
        });
        expect(await main(['nedgradert', '/gammel', '/ny'], deps)).toBe(1);
        expect(feil).toEqual(['node_modules/qs 6.16.1 → 6.16.0']);
    });

    it('bare oppgraderinger, nye og fjernede pakker gir 0', async () => {
        const { deps, feil } = lagDeps({
            filer: {
                '/gammel': lock({ 'node_modules/qs': { version: '6.16.0' }, 'node_modules/borte': { version: '1.0.0' }, 'node_modules/lenke': { link: true } }),
                '/ny': lock({ 'node_modules/qs': { version: '6.16.1' }, 'node_modules/ny': { version: '0.1.0' }, 'node_modules/lenke': { link: true } }),
            },
        });
        expect(await main(['nedgradert', '/gammel', '/ny'], deps)).toBe(0);
        expect(feil).toEqual([]);
    });

    it('lockfil uten packages gir 2', async () => {
        const { deps } = lagDeps({ filer: { '/gammel': '{}', '/ny': lock({}) } });
        expect(await main(['nedgradert', '/gammel', '/ny'], deps)).toBe(2);
    });
});

describe('main: nye og markør', () => {
    const issue = (body, kommentarer = []) =>
        JSON.stringify({ body, comments: kommentarer.map(([login, b]) => ({ author: { login }, body: b })) });

    it.each([
        ['markør A i body', issue(`x\n${lagMarkør(['A'])}`), 'B'],
        ['falsk markør fra eve', issue('x', [['eve', lagMarkør(['A', 'B'])]]), 'A,B'],
        ['markør fra github-actions i kommentar', issue(lagMarkør(['A']), [['github-actions', lagMarkør(['B'])]]), ''],
        ['kommentar uten forfatter', JSON.stringify({ body: '', comments: [{ body: lagMarkør(['A']) }] }), 'A,B'],
    ])('%s', async (_navn, json, forventet) => {
        const { deps, ut } = lagDeps({ filer: { '/issue.json': json }, env: { ISSUE_JSON: '/issue.json' } });
        expect(await main(['nye', 'A,B'], deps)).toBe(0);
        expect(ut).toEqual([forventet]);
    });

    it('uten kommentarer i JSON-en leses bare body', async () => {
        const { deps, ut } = lagDeps({ filer: { '/issue.json': JSON.stringify({ body: lagMarkør(['A']) }) }, env: { ISSUE_JSON: '/issue.json' } });
        await main(['nye', 'A,B'], deps);
        expect(ut).toEqual(['B']);
    });

    it('nye uten ISSUE_JSON gir 2', async () => {
        const { deps } = lagDeps();
        expect(await main(['nye', 'A'], deps)).toBe(2);
    });

    it('markør skriver markøren for listen', async () => {
        const { deps, ut } = lagDeps();
        expect(await main(['markør', 'B,A'], deps)).toBe(0);
        expect(ut).toEqual(['<!-- audit-funn: A,B -->']);
    });

    it.each([[['ukjent']], [[]]])('underkommando %j gir 2', async (argv) => {
        const { deps, feil } = lagDeps();
        expect(await main(argv, deps)).toBe(2);
        expect(feil[0]).toMatch(/^::error::/);
    });
});
