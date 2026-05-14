// Testbar ESM-kopi av CloudFront-funksjonen — deploy-scriptet bruker .js-filen.
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

export function handler(event) {
    var uri = event.request.uri;
    var host = event.request.headers && event.request.headers.host && event.request.headers.host.value;

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
