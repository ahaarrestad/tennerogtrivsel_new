import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { extractInlineScripts, computeHash } from '../generate-csp-hashes.mjs';

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
