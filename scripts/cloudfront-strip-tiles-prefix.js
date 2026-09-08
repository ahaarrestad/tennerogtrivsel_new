// CloudFront Function (viewer-request): omskriver /tiles/{z}/{x}/{y} til /rastertiles/voyager/{z}/{x}/{y}
// slik at basemaps.cartocdn.com mottar riktig path, og setter CARTO-nøkkelen som ?key=.
//
// Nøkkelen står her som en placeholder (se CARTO_KEY_PLACEHOLDER i
// setup-cloudfront-functions.mjs), og byttes ut med verdien fra miljøvariabelen
// CARTO_API_KEY rett før opplasting. Selve nøkkelen skal aldri ligge i git, og settes
// her — etter at nettleseren har sendt sin forespørsel — slik at klienten aldri ser den.
//
// Referer settes deterministisk, av to grunner:
//   1. CARTO håndhever nøkkelens domenerestriksjon på Referer, mens cache-nøkkelen for
//      /tiles/* kun er pathen. Videresendte vi klientens egen Referer, kunne hvem som
//      helst hotlinke tile-URL-en fra et fremmed domene, få et vannmerket svar fra CARTO,
//      og få det cachet i 180 dager for alle ekte besøkende (CARTO sender max-age=15552000).
//   2. Klientens Referer er full side-URL (same-origin). Å sende den videre ville lekket
//      hver besøkendes side-URL til CARTO — stikk i strid med hvorfor vi proxyer i det
//      hele tatt.
//
// Host alene er ikke nok. CloudFront validerer den mot distribusjonens aliaser, men prod
// har seks av dem (apex + www for .no/.net/.com) pluss *.cloudfront.net, og kun det
// kanoniske domenet registreres på CARTO-nøkkelen. www-redirecten i sitemap_redirect
// redder oss ikke: /tiles/* har denne funksjonen knyttet til seg, og CloudFront tillater
// kun én viewer-request-funksjon per behavior — så tile-forespørsler mot et apex-alias
// blir aldri redirectet. Derfor mappes Host til ett av to faste domener; verdien som
// sendes videre er alltid en konstant, aldri klientens streng.
// Kjøretid: cloudfront-js-2.0
var TILES_PREFIX = /^\/tiles/;
var PROD_REFERER = 'https://www.tennerogtrivsel.no/';
var TEST_REFERER = 'https://test2.aarrestad.com/';
// Test-distribusjonens aliaser. Eksakt likhet, ikke delstreng: `indexOf('aarrestad.com')`
// ville også slått til på `aarrestad.com.angriper.example`. CloudFront validerer riktignok
// Host mot distribusjonens aliaser, så en fremmed verdi når oss ikke i praksis — men det er
// en ekstern garanti, og en delstreng-sjekk går i stykker stille hvis et alias legges til.
var TEST_HOSTS = ['test2.aarrestad.com', 'test3.aarrestad.com'];

function handler(event) {
    var request = event.request;
    if (TILES_PREFIX.test(request.uri)) {
        request.uri = request.uri.replace(TILES_PREFIX, '/rastertiles/voyager');
        request.querystring.key = { value: '__CARTO_API_KEY__' };

        if (!request.headers) request.headers = {};
        var host = ((request.headers.host && request.headers.host.value) || '').toLowerCase();
        request.headers.referer = {
            value: TEST_HOSTS.indexOf(host) !== -1 ? TEST_REFERER : PROD_REFERER
        };
    }
    return request;
}

/* v8 ignore next */
if (typeof module !== 'undefined') {
  module.exports = { handler };
}
