// CloudFront Function (viewer-request): stripper /tiles/-prefiks fra URI
// slik at basemaps.cartocdn.com mottar riktig path.
// Kjøretid: cloudfront-js-2.0
function handler(event) {
    var request = event.request;
    request.uri = request.uri.replace(/^\/tiles/, '/rastertiles/voyager');
    return request;
}

if (typeof module !== 'undefined') {
  module.exports = { handler };
}
