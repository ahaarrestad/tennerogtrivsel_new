import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { lesEndret, tjenesteLastmod } from '../tjeneste-endret';

let dir: string;

function skrivTjeneste(filnavn: string, frontmatter: string, body = 'Brødtekst.') {
    fs.writeFileSync(path.join(dir, filnavn), `---\n${frontmatter}\n---\n${body}\n`);
}

function skrivEndret(innhold: unknown) {
    fs.writeFileSync(path.join(dir, '_endret.json'), typeof innhold === 'string' ? innhold : JSON.stringify(innhold));
}

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tjeneste-endret-'));
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('lesEndret', () => {
    it('gir tomt objekt når mappa mangler', () => {
        expect(lesEndret(path.join(dir, 'finnes-ikke'))).toEqual({});
    });

    it('gir tomt objekt når _endret.json mangler', () => {
        expect(lesEndret(dir)).toEqual({});
    });

    it.each([
        ['ugyldig JSON', '{ikke json'],
        ['en liste', '["a.md"]'],
        ['null', 'null'],
        ['en streng', '"tekst"'],
    ])('gir tomt objekt ved %s', (_navn, innhold) => {
        skrivEndret(innhold);
        expect(lesEndret(dir)).toEqual({});
    });

    it('filtrerer bort ugyldige datoer og verdier som ikke er strenger', () => {
        skrivEndret({
            'gyldig.md': '2026-10-01T10:00:00.000Z',
            'tull.md': 'tull',
            'tall.md': 42,
        });
        expect(lesEndret(dir)).toEqual({ 'gyldig.md': '2026-10-01T10:00:00.000Z' });
    });
});

describe('tjenesteLastmod', () => {
    it('gir lastmod per aktiv tjeneste og nyeste dato for /tjenester/', () => {
        skrivTjeneste('en.md', 'id: en\ntitle: Tjeneste En\nactive: true');
        skrivTjeneste('rot.md', 'id: rot\ntitle: Rotfylling på barn\nactive: true');
        skrivTjeneste('skjult.md', 'id: skjult\ntitle: Skjult\nactive: false');
        skrivEndret({
            'en.md': '2026-09-15T08:30:00.000Z',
            'rot.md': '2026-10-01T10:00:00.000Z',
            'skjult.md': '2026-10-05T10:00:00.000Z',
        });

        expect(Object.fromEntries(tjenesteLastmod(dir))).toEqual({
            '/tjenester/tjeneste-en/': '2026-09-15T08:30:00.000Z',
            '/tjenester/rotfylling-pa-barn/': '2026-10-01T10:00:00.000Z',
            '/tjenester/': '2026-10-01T10:00:00.000Z',
        });
    });

    it('hopper over en tjeneste uten dato uten å stoppe de andre', () => {
        skrivTjeneste('en.md', 'title: Tjeneste En');
        skrivTjeneste('to.md', 'title: Tjeneste To');
        skrivEndret({ 'en.md': '2026-09-15T08:30:00.000Z' });

        expect(Object.fromEntries(tjenesteLastmod(dir))).toEqual({
            '/tjenester/tjeneste-en/': '2026-09-15T08:30:00.000Z',
            '/tjenester/': '2026-09-15T08:30:00.000Z',
        });
    });

    it('gir tom map uten _endret.json', () => {
        skrivTjeneste('en.md', 'title: Tjeneste En');
        expect(tjenesteLastmod(dir).size).toBe(0);
    });

    it('gir tom map når mappa mangler', () => {
        expect(tjenesteLastmod(path.join(dir, 'finnes-ikke')).size).toBe(0);
    });

    it('ignorerer datoer for filer som ikke finnes', () => {
        skrivEndret({ 'slettet.md': '2026-09-15T08:30:00.000Z' });
        expect(tjenesteLastmod(dir).size).toBe(0);
    });

    it.each([
        ['doble anførselstegn', 'title: "Med anførsel"', '/tjenester/med-anforsel/'],
        ['enkle anførselstegn', "title: 'Enkel'", '/tjenester/enkel/'],
        ['kolon i tittelen', 'title: Bleking: hjemme', '/tjenester/bleking-hjemme/'],
    ])('leser tittel med %s', (_navn, linje, sti) => {
        skrivTjeneste('a.md', linje);
        skrivEndret({ 'a.md': '2026-09-15T08:30:00.000Z' });
        expect(tjenesteLastmod(dir).get(sti)).toBe('2026-09-15T08:30:00.000Z');
    });

    it('tåler CRLF-linjeslutt', () => {
        fs.writeFileSync(path.join(dir, 'a.md'), '---\r\ntitle: Tjeneste En\r\nactive: true\r\n---\r\nTekst\r\n');
        skrivEndret({ 'a.md': '2026-09-15T08:30:00.000Z' });
        expect(tjenesteLastmod(dir).get('/tjenester/tjeneste-en/')).toBe('2026-09-15T08:30:00.000Z');
    });

    it('leser bare frontmatter-blokken, ikke title-linjer i brødteksten', () => {
        skrivTjeneste('a.md', 'title: Ekte', 'title: Falsk');
        skrivEndret({ 'a.md': '2026-09-15T08:30:00.000Z' });
        expect([...tjenesteLastmod(dir).keys()]).toEqual(['/tjenester/ekte/', '/tjenester/']);
    });

    it('hopper over filer uten frontmatter eller uten tittel', () => {
        fs.writeFileSync(path.join(dir, 'uten.md'), 'Bare tekst');
        skrivTjeneste('tom.md', 'id: tom');
        skrivEndret({ 'uten.md': '2026-09-15T08:30:00.000Z', 'tom.md': '2026-09-15T08:30:00.000Z' });
        expect(tjenesteLastmod(dir).size).toBe(0);
    });
});
