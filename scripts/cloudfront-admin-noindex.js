// CloudFront Function (viewer-response): setter X-Robots-Tag: noindex på /admin-paths
// Kjøretid: cloudfront-js-2.0
function handler(event) {
    var response = event.response;
    var request = event.request;
    if (request.uri.startsWith('/admin')) {
        response.headers['x-robots-tag'] = { value: 'noindex' };
    }
    return response;
}

if (typeof module !== 'undefined') {
  module.exports = { handler };
}
