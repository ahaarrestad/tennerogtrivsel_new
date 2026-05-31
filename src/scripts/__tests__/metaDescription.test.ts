import { describe, it, expect } from 'vitest';
import { stripMarkdown, truncateDescription } from '../metaDescription';

describe('stripMarkdown', () => {
    it('should return empty string for empty input', () => {
        expect(stripMarkdown('')).toBe('');
    });

    it('should remove StackEdit metadata comments', () => {
        const input = 'Some text\n<!--stackedit_data:eyJoaXN0b3J5IjpbMTIzXX0=-->';
        expect(stripMarkdown(input)).toBe('Some text');
    });

    it('should remove heading prefixes', () => {
        expect(stripMarkdown('# Heading 1')).toBe('Heading 1');
        expect(stripMarkdown('## Heading 2')).toBe('Heading 2');
        expect(stripMarkdown('### Heading 3')).toBe('Heading 3');
    });

    it('should remove bold markers', () => {
        expect(stripMarkdown('This is **bold** text')).toBe('This is bold text');
        expect(stripMarkdown('This is __bold__ text')).toBe('This is bold text');
    });

    it('should remove italic markers', () => {
        expect(stripMarkdown('This is *italic* text')).toBe('This is italic text');
        expect(stripMarkdown('This is _italic_ text')).toBe('This is italic text');
    });

    it('should not strip underscores in snake_case identifiers', () => {
        expect(stripMarkdown('my_variable_name')).toBe('my_variable_name');
        expect(stripMarkdown('some_long_identifier stays')).toBe('some_long_identifier stays');
    });

    it('should replace links with link text', () => {
        expect(stripMarkdown('[les mer](https://example.com)')).toBe('les mer');
        expect(stripMarkdown('Se [vår nettside](https://tennerogtrivsel.no) for info')).toBe('Se vår nettside for info');
    });

    it('should remove backtick code markers', () => {
        expect(stripMarkdown('Use `npm install` to install')).toBe('Use npm install to install');
    });

    it('should normalize extra whitespace and newlines', () => {
        expect(stripMarkdown('Line one\n\nLine two')).toBe('Line one Line two');
        expect(stripMarkdown('Text  with   extra   spaces')).toBe('Text with extra spaces');
    });

    it('should remove unordered list prefixes', () => {
        expect(stripMarkdown('- Tannbleking\n- Rotbehandling\n- Fyllinger')).toBe('Tannbleking Rotbehandling Fyllinger');
        expect(stripMarkdown('* Tannbleking\n* Rotbehandling')).toBe('Tannbleking Rotbehandling');
        expect(stripMarkdown('+ Tannbleking\n+ Rotbehandling')).toBe('Tannbleking Rotbehandling');
    });

    it('should remove ordered list prefixes (1–99)', () => {
        expect(stripMarkdown('1. Tannbleking\n2. Rotbehandling\n3. Fyllinger')).toBe('Tannbleking Rotbehandling Fyllinger');
    });

    it('should not strip ordered list prefixes above 99', () => {
        expect(stripMarkdown('100. Tannbleking')).toBe('100. Tannbleking');
    });

    it('should handle combined markdown elements', () => {
        const input = '## Tjenester\n\nVi tilbyr **tannbleking** og _rotbehandling_.\n\n<!--stackedit_data:abc-->';
        expect(stripMarkdown(input)).toBe('Tjenester Vi tilbyr tannbleking og rotbehandling.');
    });
});

describe('truncateDescription', () => {
    it('should return empty string for empty input', () => {
        expect(truncateDescription('')).toBe('');
    });

    it('should return text unchanged when shorter than maxLen', () => {
        const text = 'Kort tekst';
        expect(truncateDescription(text)).toBe(text);
    });

    it('should return text unchanged when exactly maxLen', () => {
        const text = 'a'.repeat(155);
        expect(truncateDescription(text)).toBe(text);
    });

    it('should truncate at word boundary with ellipsis', () => {
        const text = 'Dette er en veldig lang tekst som er lenger enn grensen og skal kappes ved en ordgrense slik at den ikke kuttes midt i et ord og avsluttes med ellipsis punktum';
        const result = truncateDescription(text, 50);
        expect(result.length).toBeLessThanOrEqual(50);
        expect(result.endsWith('…')).toBe(true);
    });

    it('should not cut in the middle of a word', () => {
        const text = 'Tenner og Trivsel tannklinikk tilbyr mange tjenester for hele familien i Stavanger sentrum nær Kilden';
        const result = truncateDescription(text, 50);
        expect(result.endsWith('…')).toBe(true);
        const textBeforeEllipsis = result.slice(0, -1);
        expect(text.startsWith(textBeforeEllipsis)).toBe(true);
        expect(text[textBeforeEllipsis.length]).toBe(' ');
    });

    it('should use default maxLen of 155', () => {
        const text = 'a '.repeat(100).trim();
        const result = truncateDescription(text);
        expect(result.length).toBeLessThanOrEqual(155);
    });

    it('should respect custom maxLen', () => {
        const text = 'Ord '.repeat(50).trim();
        const result = truncateDescription(text, 80);
        expect(result.length).toBeLessThanOrEqual(80);
    });

    it('should cut at maxLen when text has no spaces within limit', () => {
        const text = 'a'.repeat(200);
        const result = truncateDescription(text, 50);
        expect(result).toBe('a'.repeat(50) + '…');
    });
});
