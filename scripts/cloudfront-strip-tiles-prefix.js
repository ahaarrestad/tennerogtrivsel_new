// CloudFront Function (viewer-request): omskriver /tiles/{z}/{x}/{y} til /rastertiles/voyager/{z}/{x}/{y}
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
