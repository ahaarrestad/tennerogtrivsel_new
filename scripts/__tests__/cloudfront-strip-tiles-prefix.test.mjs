import { describe, it, expect } from 'vitest';
import { handler } from '../cloudfront-strip-tiles-prefix.js';

function makeEvent(uri) {
    return { request: { uri } };
}

describe('cloudfront-strip-tiles-prefix', () => {
    describe('reskriving av /tiles-prefiks til /rastertiles/voyager', () => {
        it('typisk flisforespørsel', () => {
            const result = handler(makeEvent('/tiles/10/512/512.png'));
            expect(result).toEqual({ uri: '/rastertiles/voyager/10/512/512.png' });
        });

        it('rotflise', () => {
            const result = handler(makeEvent('/tiles/1/0/0.png'));
            expect(result).toEqual({ uri: '/rastertiles/voyager/1/0/0.png' });
        });

        it('kun /tiles-prefiks', () => {
            const result = handler(makeEvent('/tiles'));
            expect(result).toEqual({ uri: '/rastertiles/voyager' });
        });
    });

    describe('pass-through (ingen /tiles-prefiks)', () => {
        it('annen sti endres ikke', () => {
            const result = handler(makeEvent('/api/kontakt'));
            expect(result).toEqual({ uri: '/api/kontakt' });
        });

        it('sti med "tiles" midt i endres ikke', () => {
            const result = handler(makeEvent('/cache/tiles/foo'));
            expect(result).toEqual({ uri: '/cache/tiles/foo' });
        });
    });
});
