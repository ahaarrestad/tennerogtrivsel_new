// CloudFront Function (viewer-response): kort nettleser-cache for /tiles/*.
//
// CARTO sender Cache-Control: public,max-age=15552000 (180 dager). Uten overstyring havner den
// hos nettleseren, og en dårlig tile (f.eks. vannmerket) blir liggende der i et halvt år —
// CloudFront-invalidering når ikke nettleserne. Funksjonen kjører etter edge-cachen, så
// CloudFronts egen levetid styres fortsatt av CARTOs header; kun nettleseren får ett døgn.
//
// 304 må med: ved revalidering svarer CloudFront 304 med cache-objektets headere, inkludert
// CARTOs max-age — ellers ville nettleseren fått nye 180 dager ved første revalidering.
// Feilsvar røres ikke; å gi dem ett døgn ville gjort en forbigående feil mer varig. (CloudFront
// kaller ikke viewer-response-funksjoner når origin svarer >= 400, så sjekken er i praksis et
// forsvar i dybden — men den dekker også CloudFront-genererte svar og andre statuser som 206.)
//
// Gjøres her, ikke i en egen response headers policy: en behavior kan bare ha én, og en kopi av
// tot-security-headers ville ikke blitt oppdatert av CSP-synken i CI.
//
// Ett døgn: avveiing mellom hvor fort en dårlig tile forsvinner og hvor ofte faste besøkende
// revaliderer (billig 304 fra edge).
// Kjøretid: cloudfront-js-2.0
var BROWSER_CACHE_CONTROL = 'public, max-age=86400';

function handler(event) {
    var response = event.response;
    if (response.statusCode === 200 || response.statusCode === 304) {
        response.headers['cache-control'] = { value: BROWSER_CACHE_CONTROL };
    }
    return response;
}

/* v8 ignore next */
if (typeof module !== 'undefined') {
  module.exports = { handler };
}
