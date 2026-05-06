// src/scripts/generate-robots.js

export function generateRobotsTxt(hostname, sitemapUrl) {
    const isTestSite = hostname === "test2.aarrestad.com" || hostname === "localhost";

    if (isTestSite) {
        // Blokker alt på test-domenet
        return `User-agent: *
Disallow: /`;
    } else {
        // Produksjon: alt tillatt — noindex håndteres via X-Robots-Tag HTTP-header
        return `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}`;
    }
}
