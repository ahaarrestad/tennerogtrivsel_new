import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { extractInlineScripts, computeHash, run } from '../generate-csp-hashes.mjs';

describe('extractInlineScripts', () => {
    it('ekstraherer inline type=module script', () => {
        const html = '<html><script type="module">console.log(1)</script></html>';
        expect(extractInlineScripts(html)).toEqual(['console.log(1)']);
    });

    it('ignorerer scripts med src-attributt', () => {
        const html = '<script src="/foo.js"></script>';
        expect(extractInlineScripts(html)).toEqual([]);
    });

    it('ignorerer application/ld+json scripts', () => {
        const html = '<script type="application/ld+json">{"@context":"https://schema.org"}</script>';
        expect(extractInlineScripts(html)).toEqual([]);
    });

    it('ekstraherer is:inline script uten type-attributt', () => {
        const html = '<script is:inline>var x = 1;</script>';
        expect(extractInlineScripts(html)).toEqual(['var x = 1;']);
    });

    it('ekstraherer flerlinje script-innhold', () => {
        const content = '\nif (a) {\n  b();\n}\n';
        const html = `<script is:inline>${content}</script>`;
        expect(extractInlineScripts(html)).toEqual([content]);
    });

    it('returnerer tom liste ved ingen inline-skript', () => {
        const html = '<html><head></head><body></body></html>';
        expect(extractInlineScripts(html)).toEqual([]);
    });

    it('ekstraherer flere inline-skript fra samme HTML', () => {
        const html = '<script type="module">a()</script><script is:inline>b()</script>';
        expect(extractInlineScripts(html)).toEqual(['a()', 'b()']);
    });
});

describe('computeHash', () => {
    it('returnerer sha256- prefiks + base64', () => {
        const content = 'console.log(1)';
        const expected = 'sha256-' + createHash('sha256').update(content).digest('base64');
        expect(computeHash(content)).toBe(expected);
    });

    it('gir ulik hash for ulikt innhold', () => {
        expect(computeHash('a')).not.toBe(computeHash('b'));
    });
});

describe('run', () => {
    let tmpDist, tmpOut;

    beforeEach(() => {
        tmpDist = mkdtempSync(join(tmpdir(), 'csp-test-dist-'));
        tmpOut = join(mkdtempSync(join(tmpdir(), 'csp-test-out-')), 'csp-hashes.json');
    });

    afterEach(() => {
        rmSync(tmpDist, { recursive: true, force: true });
        rmSync(dirname(tmpOut), { recursive: true, force: true });
    });

    it('skriver korrekte hashes for inline scripts i dist-mappen', () => {
        writeFileSync(join(tmpDist, 'index.html'), '<script type="module">console.log(1)</script>');
        const hashes = run(tmpDist, tmpOut);
        expect(hashes).toHaveLength(1);
        const data = JSON.parse(readFileSync(tmpOut, 'utf-8'));
        expect(data.scriptHashes).toHaveLength(1);
        expect(data.scriptHashes[0]).toMatch(/^sha256-/);
    });

    it('deduplicerer identiske scripts på tvers av filer', () => {
        const subdir = join(tmpDist, 'sub');
        mkdirSync(subdir);
        const html = '<script is:inline>var x = 1;</script>';
        writeFileSync(join(tmpDist, 'a.html'), html);
        writeFileSync(join(subdir, 'b.html'), html);
        const hashes = run(tmpDist, tmpOut);
        expect(hashes).toHaveLength(1);
    });

    it('returnerer tom liste når dist-mappen ikke har inline scripts', () => {
        writeFileSync(join(tmpDist, 'index.html'), '<html><body>no scripts</body></html>');
        const hashes = run(tmpDist, tmpOut);
        expect(hashes).toHaveLength(0);
        const data = JSON.parse(readFileSync(tmpOut, 'utf-8'));
        expect(data.scriptHashes).toEqual([]);
    });

    it('oppretter output-katalog hvis den ikke finnes', () => {
        // tmpOut is in a fresh temp dir — the parent exists, but this tests mkdirSync
        writeFileSync(join(tmpDist, 'index.html'), '<html></html>');
        expect(() => run(tmpDist, tmpOut)).not.toThrow();
    });

    it('scanner rekursivt i underkataloger', () => {
        const sub = join(tmpDist, 'pages', 'nested');
        mkdirSync(sub, { recursive: true });
        writeFileSync(join(sub, 'deep.html'), '<script>deep()</script>');
        const hashes = run(tmpDist, tmpOut);
        expect(hashes).toHaveLength(1);
    });

    it('ignorerer ikke-html-filer i dist-mappen', () => {
        writeFileSync(join(tmpDist, 'index.html'), '<script>a()</script>');
        writeFileSync(join(tmpDist, 'style.css'), 'body { color: red; }');
        writeFileSync(join(tmpDist, 'data.json'), '{"key":"value"}');
        const hashes = run(tmpDist, tmpOut);
        expect(hashes).toHaveLength(1);
    });

    it('ignorerer scripts med kun whitespace-innhold', () => {
        writeFileSync(join(tmpDist, 'index.html'), '<script>   </script><script>real()</script>');
        const hashes = run(tmpDist, tmpOut);
        expect(hashes).toHaveLength(1);
    });
});
