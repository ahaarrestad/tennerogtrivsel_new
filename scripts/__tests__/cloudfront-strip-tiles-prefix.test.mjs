import { describe, it, expect } from 'vitest';
import { handler } from '../cloudfront-strip-tiles-prefix.js';

// Placeholderen som deploy-scriptet bytter ut med den ekte nøkkelen.
// Selve nøkkelen skal aldri finnes i git — heller ikke i tester.
const PLACEHOLDER = '__CARTO_API_KEY__';

function makeEvent(uri, querystring = {}, headers = { host: { value: 'www.tennerogtrivsel.no' } }) {
    return { request: { uri, querystring, headers } };
}

describe('cloudfront-strip-tiles-prefix', () => {
    describe('reskriving av /tiles-prefiks til /rastertiles/voyager', () => {
        it('typisk flisforespørsel', () => {
            const result = handler(makeEvent('/tiles/10/512/512.png'));
            expect(result.uri).toBe('/rastertiles/voyager/10/512/512.png');
        });

        it('rotflise', () => {
            const result = handler(makeEvent('/tiles/1/0/0.png'));
            expect(result.uri).toBe('/rastertiles/voyager/1/0/0.png');
        });

        it('kun /tiles-prefiks', () => {
            const result = handler(makeEvent('/tiles'));
            expect(result.uri).toBe('/rastertiles/voyager');
        });
    });

    describe('CARTO-nøkkel legges på tile-forespørsler', () => {
        it('setter key fra placeholderen', () => {
            const result = handler(makeEvent('/tiles/10/512/512.png'));
            expect(result.querystring.key).toEqual({ value: PLACEHOLDER });
        });

        it('beholder eksisterende query-parametere', () => {
            const result = handler(makeEvent('/tiles/10/512/512.png', { foo: { value: 'bar' } }));
            expect(result.querystring).toEqual({
                foo: { value: 'bar' },
                key: { value: PLACEHOLDER },
            });
        });

        it('overstyrer en key klienten selv har sendt', () => {
            const result = handler(makeEvent('/tiles/10/512/512.png', { key: { value: 'fra-klienten' } }));
            expect(result.querystring.key).toEqual({ value: PLACEHOLDER });
        });
    });

    // CARTO håndhever domenerestriksjon på Referer. Videresender vi klientens egen
    // Referer, kan hvem som helst hotlinke tile-URL-en fra et fremmed domene og få et
    // vannmerket svar cachet for alle — cache-nøkkelen inneholder ikke Referer.
    // Headeren settes derfor til en konstant, normalisert fra Host. Rå Host er ikke nok:
    // se kommentaren over it.each under.
    describe('Referer settes til et normalisert, konstant domene', () => {
        it('setter Referer til vårt eget domene', () => {
            const result = handler(makeEvent('/tiles/10/512/512.png'));
            expect(result.headers.referer).toEqual({ value: 'https://www.tennerogtrivsel.no/' });
        });

        it('overstyrer en Referer klienten selv har sendt', () => {
            const result = handler(
                makeEvent(
                    '/tiles/10/512/512.png',
                    {},
                    {
                        host: { value: 'www.tennerogtrivsel.no' },
                        referer: { value: 'https://ondsinnet-side.example/' },
                    }
                )
            );
            expect(result.headers.referer).toEqual({ value: 'https://www.tennerogtrivsel.no/' });
        });

        // Host er klientvalgbar blant distribusjonens aliaser (prod har seks, pluss
        // *.cloudfront.net). Bare det kanoniske domenet registreres på CARTO-nøkkelen,
        // så rå Host ville latt hvem som helst hente en vannmerket tile via et apex-
        // eller .com-alias og få den cachet for alle. Derfor normaliseres den.
        it.each([
            ['www.tennerogtrivsel.no', 'https://www.tennerogtrivsel.no/'],
            ['tennerogtrivsel.no', 'https://www.tennerogtrivsel.no/'],
            ['tennerogtrivsel.com', 'https://www.tennerogtrivsel.no/'],
            ['www.tennerogtrivsel.net', 'https://www.tennerogtrivsel.no/'],
            ['d19b7g2frcrx6i.cloudfront.net', 'https://www.tennerogtrivsel.no/'],
            ['test2.aarrestad.com', 'https://test2.aarrestad.com/'],
            ['test3.aarrestad.com', 'https://test2.aarrestad.com/'],
        ])('normaliserer Host %s til %s', (host, forventet) => {
            const result = handler(makeEvent('/tiles/10/512/512.png', {}, { host: { value: host } }));
            expect(result.headers.referer).toEqual({ value: forventet });
        });

        it('faller tilbake på prod-domenet når Host mangler', () => {
            const result = handler(makeEvent('/tiles/10/512/512.png', {}, {}));
            expect(result.headers.referer).toEqual({ value: 'https://www.tennerogtrivsel.no/' });
        });

        it('krasjer ikke når headers mangler helt', () => {
            const result = handler({ request: { uri: '/tiles/10/512/512.png', querystring: {} } });
            expect(result.headers.referer).toEqual({ value: 'https://www.tennerogtrivsel.no/' });
        });

        it('lekker ikke besøkendes side-URL videre til CARTO', () => {
            const result = handler(
                makeEvent(
                    '/tiles/10/512/512.png',
                    {},
                    {
                        host: { value: 'www.tennerogtrivsel.no' },
                        referer: { value: 'https://www.tennerogtrivsel.no/kontakt/?pasient=12345' },
                    }
                )
            );
            expect(result.headers.referer).toEqual({ value: 'https://www.tennerogtrivsel.no/' });
        });
    });

    describe('pass-through (ingen /tiles-prefiks)', () => {
        it('annen sti endres ikke', () => {
            const result = handler(makeEvent('/api/kontakt'));
            expect(result).toEqual({
                uri: '/api/kontakt',
                querystring: {},
                headers: { host: { value: 'www.tennerogtrivsel.no' } },
            });
        });

        it('sti med "tiles" midt i endres ikke', () => {
            const result = handler(makeEvent('/cache/tiles/foo'));
            expect(result).toEqual({
                uri: '/cache/tiles/foo',
                querystring: {},
                headers: { host: { value: 'www.tennerogtrivsel.no' } },
            });
        });

        it('rører ikke Referer', () => {
            const headers = { host: { value: 'www.tennerogtrivsel.no' }, referer: { value: 'https://annet.example/' } };
            const result = handler(makeEvent('/api/kontakt', {}, headers));
            expect(result.headers.referer).toEqual({ value: 'https://annet.example/' });
        });

        it('får ingen key selv om andre query-parametere finnes', () => {
            const result = handler(makeEvent('/api/kontakt', { foo: { value: 'bar' } }));
            expect(result.querystring).toEqual({ foo: { value: 'bar' } });
        });
    });
});
