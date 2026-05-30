// CloudFront Function (viewer-request): samlet viewer-request-logikk for default behavior.
// 1. Non-kanoniske domener (ikke www.tennerogtrivsel.no) → https://www.tennerogtrivsel.no (301)
// 2. /sitemap.xml → /sitemap-index.xml (301)
// 3. URIer uten avsluttende skråstrek og uten filutvidelse → URI/ (301)
// 4. URIer med avsluttende skråstrek (unntatt rot) → legg til index.html (S3 REST serverer ikke kataloger)
// 5. ?page=X → ny sti (legacy jQuery SPA redirects) (301)
// 6. /index.html, /www/index.html → / (301)
// Kjøretid: cloudfront-js-2.0 (ES5.1-kompatibel)
// CloudFront URL-encodes querystring values before delivering them to the function,
// so v.value and v.multiValue[n].value are already %XX-encoded — no re-encoding needed.
function buildQuerySuffix(qs) {
    var keys = Object.keys(qs || {});
    if (keys.length === 0) return '';
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = qs[k];
        if (v.multiValue) {
            for (var j = 0; j < v.multiValue.length; j++) {
                parts.push(k + '=' + v.multiValue[j].value);
            }
        } else {
            parts.push(k + '=' + v.value);
        }
    }
    return '?' + parts.join('&');
}

function handler(event) {
    var uri = event.request.uri;
    var host = event.request.headers && event.request.headers.host && event.request.headers.host.value;
    var qs = event.request.querystring;

    if (host && host !== 'www.tennerogtrivsel.no') {
        var targetUri = uri;
        var lastSeg = targetUri.split('/').pop();
        if (targetUri !== '/' && lastSeg.indexOf('.') === -1 && targetUri.charAt(targetUri.length - 1) !== '/') {
            targetUri = targetUri + '/';
        }
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { 'location': { value: 'https://www.tennerogtrivsel.no' + targetUri + buildQuerySuffix(event.request.querystring) } }
        };
    }

    // Legacy ?page=-redirects fra gammel jQuery SPA
    if (qs.page) {
        var pageMap = {
            'kontakt': '/kontakt/',
            'behandlingstilbud': '/tjenester/',
            'trygdeordninger': '/tjenester/',
            'omoss': '/tannleger/'
        };
        var newPath = pageMap[qs.page.value];
        if (newPath) {
            return {
                statusCode: 301,
                statusDescription: 'Moved Permanently',
                headers: { 'location': { value: newPath } }
            };
        }
    }

    // Legacy /index.html og /www/index.html → /
    if (uri === '/index.html' || uri === '/www/index.html') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { 'location': { value: '/' } }
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
