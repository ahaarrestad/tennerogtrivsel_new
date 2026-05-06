// CloudFront Function (viewer-request): samlet viewer-request-logikk for default behavior.
// 1. /sitemap.xml → /sitemap-index.xml (301)
// 2. URIer uten avsluttende skråstrek og uten filutvidelse → URI/ (301)
// Kjøretid: cloudfront-js-2.0 (ES5.1-kompatibel)
function handler(event) {
    var uri = event.request.uri;

    if (uri === '/sitemap.xml') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { 'location': { value: '/sitemap-index.xml' } }
        };
    }

    var lastSegment = uri.split('/').pop();
    var hasExtension = lastSegment.indexOf('.') !== -1;
    var hasTrailingSlash = uri.charAt(uri.length - 1) === '/';

    if (uri === '/' || hasTrailingSlash || hasExtension) {
        return event.request;
    }

    return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: { 'location': { value: uri + '/' } }
    };
}

// Eksport for Node.js-testing — ignorert av CloudFront-runtime
if (typeof module !== 'undefined') {
    module.exports = { handler };
}
