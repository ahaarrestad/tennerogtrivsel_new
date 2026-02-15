import { describe, it, expect } from 'vitest';
import { generateRobotsTxt } from '../generate-robots.js';

describe('generate-robots.js', () => {
    const sitemapUrl = 'https://www.tennerogtrivsel.no/sitemap-index.xml';

    it('skal blokkere alt på test-domenet', () => {
        const result = generateRobotsTxt('test2.aarrestad.com', sitemapUrl);
        expect(result).toContain('User-agent: *');
        expect(result).toContain('Disallow: /');
        expect(result).not.toContain('Allow: /');
    });

    it('skal blokkere alt på localhost', () => {
        const result = generateRobotsTxt('localhost', sitemapUrl);
        expect(result).toContain('Disallow: /');
    });

    it('skal tillate alt og inkludere sitemap på produksjons-domenet', () => {
        const result = generateRobotsTxt('www.tennerogtrivsel.no', sitemapUrl);
        expect(result).toContain('Allow: /');
        expect(result).toContain(`Sitemap: ${sitemapUrl}`);
    });
});
