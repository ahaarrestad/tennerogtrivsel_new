// CloudFront Function (viewer-request): 301-redirect URIer uten avsluttende skråstrek
// til tilsvarende URI med skråstrek — unngår duplicate-URL-advarsler i Google Search Console.
// Kjøretid: cloudfront-js-2.0 (ES5.1-kompatibel)
function handler(event) {
    var uri = event.request.uri;
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
