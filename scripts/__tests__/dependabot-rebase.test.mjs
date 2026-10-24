// Tester .github/scripts/dependabot-rebase.sh (ligger her fordi vitest bare plukker opp
// scripts/__tests__). Skriptet kjøres med bash og en falsk `gh` først i PATH; den falske
// svarer fra ruter definert i hver test og logger alle kall. `--jq` kjøres med ekte jq,
// og skriptet bruker GNU `date -d`, så testen krever jq og GNU coreutils.
// Testene beviser greinlogikken, ikke hvordan GitHub og Dependabot oppfører seg.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SKRIPT = resolve(import.meta.dirname, '../../.github/scripts/dependabot-rebase.sh');
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

const FAKE_GH = `#!/usr/bin/env node
const { readFileSync, appendFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const dir = process.env.FAKE_GH_DIR;
appendFileSync(dir + '/calls.jsonl', JSON.stringify(args) + '\\n');
const ruter = JSON.parse(readFileSync(dir + '/ruter.json', 'utf8'));
const linje = args.join(' ');
const rute = ruter.find((r) => new RegExp(r.match).test(linje));
if (!rute) { process.stderr.write('ingen rute: ' + linje + '\\n'); process.exit(1); }
if (rute.rc) { process.stderr.write('feil\\n'); process.exit(rute.rc); }
let ut = typeof rute.out === 'string' ? rute.out : JSON.stringify(rute.out ?? '');
const jqIdx = args.indexOf('--jq');
if (jqIdx >= 0) {
  const jq = spawnSync('jq', ['-r', args[jqIdx + 1]], { input: ut, encoding: 'utf8' });
  if (jq.status !== 0) { process.stderr.write(jq.stderr); process.exit(jq.status); }
  ut = jq.stdout;
}
process.stdout.write(ut);
`;

const minutterSiden = (min) => new Date(Date.now() - min * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

let dir;
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dependabot-rebase-'));
    writeFileSync(join(dir, 'gh'), FAKE_GH);
    chmodSync(join(dir, 'gh'), 0o755);
    writeFileSync(join(dir, 'calls.jsonl'), '');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function kjør(env, ruter) {
    writeFileSync(join(dir, 'ruter.json'), JSON.stringify(ruter));
    const res = spawnSync('bash', [SKRIPT], {
        encoding: 'utf8',
        env: {
            PATH: `${dir}:${process.env.PATH}`,
            FAKE_GH_DIR: dir,
            GH_REPO: 'eier/repo',
            ...env,
        },
    });
    const kall = existsSync(join(dir, 'calls.jsonl'))
        ? readFileSync(join(dir, 'calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
        : [];
    return { rc: res.status, ut: res.stdout + res.stderr, kall };
}

const skrivende = (kall) => kall.filter((a) => a[0] === 'pr' && a[1] === 'comment' || a.includes('PUT'));
const kommentarer = (kall) => kall.filter((a) => a[0] === 'pr' && a[1] === 'comment').map((a) => a[2]);
const oppdateringer = (kall) => kall.filter((a) => a.includes('PUT'));

const commitRute = (sha, verified, dato = minutterSiden(300)) => ({
    match: `^api repos/eier/repo/commits/${sha}`,
    out: { commit: { verification: { verified }, committer: { date: dato } } },
});

describe('push-modus', () => {
    const liste = (prs) => ({ match: '^pr list', out: prs });
    const pr = (number, login, sha) => ({ number, author: { login }, headRefOid: sha });

    it.each([['app/dependabot'], ['dependabot[bot]']])('Dependabot-PR (%s) med signert head får kommentar', (login) => {
        const { rc, kall } = kjør({ MODUS: 'push' }, [
            liste([pr(5, login, SHA_A)]),
            commitRute(SHA_A, true),
            { match: '^pr comment', out: '' },
        ]);
        expect(rc).toBe(0);
        expect(kommentarer(kall)).toEqual(['5']);
        expect(oppdateringer(kall)).toEqual([]);
    });

    it('annen PR oppdateres via API', () => {
        const { rc, kall } = kjør({ MODUS: 'push' }, [
            liste([pr(7, 'eier', SHA_A)]),
            { match: 'PUT', out: '' },
        ]);
        expect(rc).toBe(0);
        expect(oppdateringer(kall)).toEqual([
            ['api', '--method', 'PUT', 'repos/eier/repo/pulls/7/update-branch', '-f', 'update_method=rebase'],
        ]);
    });

    it('Dependabot-PR med usignert head (eskalert før) oppdateres i stedet for å kommenteres', () => {
        const { kall } = kjør({ MODUS: 'push' }, [
            liste([pr(5, 'app/dependabot', SHA_A)]),
            commitRute(SHA_A, false),
            { match: 'PUT', out: '' },
        ]);
        expect(kommentarer(kall)).toEqual([]);
        expect(oppdateringer(kall)).toHaveLength(1);
    });

    it('feiler signatur-oppslaget, kommenteres som før', () => {
        const { kall } = kjør({ MODUS: 'push' }, [
            liste([pr(5, 'app/dependabot', SHA_A)]),
            { match: '^api repos/eier/repo/commits/', rc: 1 },
            { match: '^pr comment', out: '' },
        ]);
        expect(kommentarer(kall)).toEqual(['5']);
    });

    it('feil på én PR stopper ikke de neste', () => {
        const { rc, kall } = kjør({ MODUS: 'push' }, [
            liste([pr(5, 'app/dependabot', SHA_A), pr(7, 'eier', SHA_B)]),
            commitRute(SHA_A, true),
            { match: '^pr comment', rc: 1 },
            { match: 'PUT', out: '' },
        ]);
        expect(rc).toBe(0);
        expect(oppdateringer(kall)).toHaveLength(1);
    });

    it('ingen åpne PR-er gir ingen skrivende kall', () => {
        const { rc, kall } = kjør({ MODUS: 'push' }, [liste([])]);
        expect(rc).toBe(0);
        expect(skrivende(kall)).toEqual([]);
    });
});

describe('retry-modus', () => {
    const mainRute = (min = 120) => ({
        match: '^api repos/eier/repo/commits/main',
        out: { commit: { committer: { date: minutterSiden(min) } } },
    });
    const pr = (number, login, sha, status = 'BEHIND', enabledAt = minutterSiden(500)) => ({
        number, author: { login }, headRefOid: sha, mergeStateStatus: status,
        autoMergeRequest: enabledAt === undefined ? null : { enabledAt },
    });
    const liste = (prs) => ({ match: '^pr list', out: prs });
    const kommentarRute = (nr, tider, body = '@dependabot rebase') => ({
        match: `^pr view ${nr}`,
        out: { comments: tider.map((min) => ({ body, createdAt: minutterSiden(min) })) },
    });
    const dependabot = (kommentarMin, headMin = 300) => kjør({ MODUS: 'retry' }, [
        mainRute(),
        liste([pr(522, 'app/dependabot', SHA_A)]),
        commitRute(SHA_A, true, minutterSiden(headMin)),
        kommentarRute(522, kommentarMin),
        { match: '^pr comment', out: '' },
        { match: 'PUT', out: '' },
    ]);

    it('main endret for under 30 min siden → ingen PR-oppslag', () => {
        const { rc, kall, ut } = kjør({ MODUS: 'retry' }, [mainRute(10)]);
        expect(rc).toBe(0);
        expect(kall.some((a) => a[0] === 'pr')).toBe(false);
        expect(ut).toContain('push-kjøringen har nettopp prøvd');
    });

    it.each([
        ['ingen kommentarer', []],
        ['én gammel kommentar', [90]],
    ])('Dependabot med %s → ny kommentar', (_navn, tider) => {
        const { rc, kall } = dependabot(tider);
        expect(rc).toBe(0);
        expect(kommentarer(kall)).toEqual(['522']);
        expect(oppdateringer(kall)).toEqual([]);
    });

    it('siste kommentar under 30 min gammel → venter', () => {
        const { kall, ut } = dependabot([150, 10]);
        expect(skrivende(kall)).toEqual([]);
        expect(ut).toContain('venter');
    });

    it('to ubesvarte kommentarer etter head → eskalerer med expected_head_sha', () => {
        const { kall, ut } = dependabot([150, 90]);
        expect(kommentarer(kall)).toEqual([]);
        expect(oppdateringer(kall)).toEqual([[
            'api', '--method', 'PUT', 'repos/eier/repo/pulls/522/update-branch',
            '-f', 'update_method=rebase', '-f', `expected_head_sha=${SHA_A}`,
        ]]);
        expect(ut).toContain('eskalerer');
    });

    it('kommentarer eldre enn head-commiten teller ikke', () => {
        const { kall } = dependabot([400, 90], 300);
        expect(kommentarer(kall)).toEqual(['522']);
    });

    it('andre kommentarer enn nøyaktig «@dependabot rebase» teller ikke', () => {
        const { kall } = kjør({ MODUS: 'retry' }, [
            mainRute(),
            liste([pr(522, 'app/dependabot', SHA_A)]),
            commitRute(SHA_A, true),
            kommentarRute(522, [150, 90], '@dependabot rebase please'),
            { match: '^pr comment', out: '' },
        ]);
        expect(kommentarer(kall)).toEqual(['522']);
    });

    it.each([
        ['annen forfatter', 'eier', true],
        ['Dependabot med usignert head', 'app/dependabot', false],
    ])('%s → update-branch uten expected_head_sha', (_navn, login, verified) => {
        const { kall } = kjør({ MODUS: 'retry' }, [
            mainRute(),
            liste([pr(9, login, SHA_A)]),
            commitRute(SHA_A, verified),
            { match: 'PUT', out: '' },
        ]);
        expect(kommentarer(kall)).toEqual([]);
        expect(oppdateringer(kall)).toEqual([
            ['api', '--method', 'PUT', 'repos/eier/repo/pulls/9/update-branch', '-f', 'update_method=rebase'],
        ]);
    });

    it.each([
        ['CLEAN', pr(1, 'app/dependabot', SHA_A, 'CLEAN')],
        ['BLOCKED', pr(1, 'app/dependabot', SHA_A, 'BLOCKED')],
        ['UNKNOWN', pr(1, 'app/dependabot', SHA_A, 'UNKNOWN')],
        ['auto-merge av', pr(1, 'app/dependabot', SHA_A, 'BEHIND', undefined)],
        ['enabledAt null', pr(1, 'app/dependabot', SHA_A, 'BEHIND', null)],
    ])('%s → ingen skrivende kall', (_navn, p) => {
        const { rc, kall } = kjør({ MODUS: 'retry' }, [mainRute(), liste([p])]);
        expect(rc).toBe(0);
        expect(skrivende(kall)).toEqual([]);
    });

    it('UNKNOWN logges med PR-nummer', () => {
        const { ut } = kjør({ MODUS: 'retry' }, [mainRute(), liste([pr(3, 'eier', SHA_A, 'UNKNOWN')])]);
        expect(ut).toContain('PR #3: UNKNOWN');
    });

    it('feil på én PR → neste behandles, rc 0', () => {
        const { rc, kall, ut } = kjør({ MODUS: 'retry' }, [
            mainRute(),
            liste([pr(1, 'app/dependabot', SHA_A), pr(2, 'eier', SHA_B)]),
            commitRute(SHA_A, true),
            commitRute(SHA_B, true),
            { match: '^pr view 1', rc: 1 },
            { match: 'PUT', out: '' },
        ]);
        expect(rc).toBe(0);
        expect(oppdateringer(kall).map((a) => a[3])).toEqual(['repos/eier/repo/pulls/2/update-branch']);
        expect(ut).toContain('::warning::PR #1');
    });

    it.each([
        ['commits/main', [{ match: '^api repos/eier/repo/commits/main', rc: 1 }]],
        ['pr list', [mainRute(), { match: '^pr list', rc: 1 }]],
    ])('%s feiler → rc 1', (_navn, ruter) => {
        expect(kjør({ MODUS: 'retry' }, ruter).rc).not.toBe(0);
    });

    it.each([
        ['ugyldig nr', { number: 'x;rm', author: { login: 'eier' }, headRefOid: SHA_A }],
        ['ugyldig sha', { number: 4, author: { login: 'eier' }, headRefOid: 'abc' }],
    ])('%s → hoppes over med warning', (_navn, p) => {
        const { rc, kall, ut } = kjør({ MODUS: 'retry' }, [
            mainRute(),
            liste([{ ...p, mergeStateStatus: 'BEHIND', autoMergeRequest: { enabledAt: minutterSiden(500) } }]),
        ]);
        expect(rc).toBe(0);
        expect(skrivende(kall)).toEqual([]);
        expect(ut).toContain('::warning::Hopper over');
    });

    it('MIN_MINUTES=abc → rc 1 uten kall', () => {
        const { rc, kall } = kjør({ MODUS: 'retry', MIN_MINUTES: 'abc' }, []);
        expect(rc).toBe(1);
        expect(kall).toEqual([]);
    });

    it('MIN_MINUTES=0 slipper gjennom en fersk main', () => {
        const { kall } = kjør({ MODUS: 'retry', MIN_MINUTES: '0' }, [mainRute(1), liste([])]);
        expect(kall.some((a) => a[0] === 'pr' && a[1] === 'list')).toBe(true);
    });
});

describe('tørrkjøring og modus', () => {
    const ruter = [
        { match: '^pr list', out: [{ number: 7, author: { login: 'eier' }, headRefOid: SHA_A }] },
        { match: 'PUT', out: '' },
    ];

    it('DRY_RUN=true → ingen skrivende kall, men logg', () => {
        const { kall, ut } = kjør({ MODUS: 'push', DRY_RUN: 'true' }, ruter);
        expect(skrivende(kall)).toEqual([]);
        expect(ut).toContain('(tørrkjøring) ville kjørt: gh api --method PUT');
    });

    it.each([[''], ['false']])('DRY_RUN=«%s» → ekte kall', (verdi) => {
        const { kall } = kjør({ MODUS: 'push', DRY_RUN: verdi }, ruter);
        expect(oppdateringer(kall)).toHaveLength(1);
    });

    it('ukjent MODUS → rc 1', () => {
        expect(kjør({ MODUS: 'noe' }, []).rc).toBe(1);
    });
});
