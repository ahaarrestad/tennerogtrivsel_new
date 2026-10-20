// Engangs-probe for CodeQL-porten (#13) — skal aldri merges. Samme mønster som #456.
export function velgReferer(request) {
  var host = ((request.headers.host && request.headers.host.value) || '').toLowerCase();
  return host.indexOf('aarrestad.com') !== -1 ? 'test' : 'prod';
}
