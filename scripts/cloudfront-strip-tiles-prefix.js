// CloudFront Function (viewer-request): omskriver /tiles/{z}/{x}/{y} til /rastertiles/voyager/{z}/{x}/{y}
// slik at basemaps.cartocdn.com mottar riktig path.
// Kjøretid: cloudfront-js-2.0
function handler(event) {
    var request = event.request;
    request.uri = request.uri.replace(/^\/tiles/, '/rastertiles/voyager');
    return request;
}

/* v8 ignore next */
if (typeof module !== 'undefined') {
  module.exports = { handler };
}
