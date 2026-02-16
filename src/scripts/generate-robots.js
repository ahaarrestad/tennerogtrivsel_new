// src/scripts/generate-robots.js

export function generateRobotsTxt(hostname, sitemapUrl) {
    const isTestSite = hostname === "test2.aarrestad.com" || hostname === "localhost";

    if (isTestSite) {
        // Blokker alt på test-domenet
        return `User-agent: *
Disallow: /`;
    } else {
        // Tillat det meste på produksjon, men skjul admin
        return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*

Sitemap: ${sitemapUrl}`;
    }
}
