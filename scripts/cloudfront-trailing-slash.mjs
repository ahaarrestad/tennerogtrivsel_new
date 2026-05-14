// Testbar ESM-kopi av CloudFront-funksjonen — deploy-scriptet bruker .js-filen.
export function handler(event) {
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
