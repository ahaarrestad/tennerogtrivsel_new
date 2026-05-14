// CloudFront Function (viewer-request): samlet viewer-request-logikk for default behavior.
// 1. Non-kanoniske domener (ikke www.tennerogtrivsel.no) → https://www.tennerogtrivsel.no (301)
// 2. /sitemap.xml → /sitemap-index.xml (301)
// 3. URIer uten avsluttende skråstrek og uten filutvidelse → URI/ (301)
// 4. URIer med avsluttende skråstrek (unntatt rot) → legg til index.html (S3 REST serverer ikke kataloger)
// Kjøretid: cloudfront-js-2.0 (ES5.1-kompatibel)
function handler(event) {
    var uri = event.request.uri;
    var host = event.request.headers && event.request.headers.host && event.request.headers.host.value;

    if (host && host !== 'www.tennerogtrivsel.no') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { 'location': { value: 'https://www.tennerogtrivsel.no' + uri } }
        };
    }

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

    if (hasExtension || uri === '/') {
        return event.request;
    }

    if (hasTrailingSlash) {
        event.request.uri = uri + 'index.html';
        return event.request;
    }

    return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: { 'location': { value: uri + '/' } }
    };
}

// Eksport for Node.js-testing — ignorert av CloudFront-runtime
/* v8 ignore next */
if (typeof module !== 'undefined') {
    module.exports = { handler };
}
