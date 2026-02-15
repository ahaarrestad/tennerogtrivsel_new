// src/scripts/generate-robots.js

export function generateRobotsTxt(hostname, sitemapUrl) {
    const isTestSite = hostname === "test2.aarrestad.com" || hostname === "localhost";

    if (isTestSite) {
        // Blokker alt på test-domenet
        return `User-agent: *
Disallow: /`;
    } else {
        // Tillat alt på alle andre domener (produksjon)
        return `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}`;
    }
}
