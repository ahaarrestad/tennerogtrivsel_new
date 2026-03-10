import { describe, it, expect } from 'vitest';
import { parseImageConfig, buildImageStyle } from '../image-config.js';

describe('parseImageConfig', () => {
    it('returnerer defaults for undefined-verdier', () => {
        const result = parseImageConfig(undefined, undefined, undefined);
        expect(result).toEqual({ scale: 1.0, positionX: 50, positionY: 50 });
    });

    it('returnerer defaults for tomme strenger', () => {
        const result = parseImageConfig('', '', '');
        expect(result).toEqual({ scale: 1.0, positionX: 50, positionY: 50 });
    });

    it('parser gyldige verdier korrekt', () => {
        const result = parseImageConfig(1.5, 30, 70);
        expect(result).toEqual({ scale: 1.5, positionX: 30, positionY: 70 });
    });

    it('parser string-verdier korrekt', () => {
        const result = parseImageConfig('2.0', '25', '75');
        expect(result).toEqual({ scale: 2.0, positionX: 25, positionY: 75 });
    });

    it('clamper scale til minimum 1.0', () => {
        expect(parseImageConfig(0.5, 50, 50).scale).toBe(1.0);
        expect(parseImageConfig(-1, 50, 50).scale).toBe(1.0);
        expect(parseImageConfig(0, 50, 50).scale).toBe(1.0);
    });

    it('clamper scale til maksimum 3.0', () => {
        expect(parseImageConfig(5.0, 50, 50).scale).toBe(3.0);
        expect(parseImageConfig(3.1, 50, 50).scale).toBe(3.0);
        expect(parseImageConfig(100, 50, 50).scale).toBe(3.0);
    });

    it('aksepterer scale grenseverdier 1.0 og 3.0', () => {
        expect(parseImageConfig(1.0, 50, 50).scale).toBe(1.0);
        expect(parseImageConfig(3.0, 50, 50).scale).toBe(3.0);
    });

    it('returnerer default posX=50 for verdier utenfor 0-100', () => {
        expect(parseImageConfig(1, -1, 50).positionX).toBe(50);
        expect(parseImageConfig(1, 101, 50).positionX).toBe(50);
    });

    it('returnerer default posY=50 for verdier utenfor 0-100', () => {
        expect(parseImageConfig(1, 50, -1).positionY).toBe(50);
        expect(parseImageConfig(1, 50, 101).positionY).toBe(50);
    });

    it('aksepterer posisjon grenseverdier 0 og 100', () => {
        const result = parseImageConfig(1, 0, 100);
        expect(result.positionX).toBe(0);
        expect(result.positionY).toBe(100);
    });

    it('håndterer NaN-verdier fra ugyldig input', () => {
        const result = parseImageConfig('abc', 'xyz', 'foo');
        expect(result).toEqual({ scale: 1.0, positionX: 50, positionY: 50 });
    });

    it('håndterer null-verdier', () => {
        const result = parseImageConfig(null, null, null);
        expect(result).toEqual({ scale: 1.0, positionX: 50, positionY: 50 });
    });

    it('parseInt trunkerer desimaler for posisjon', () => {
        const result = parseImageConfig(1, 30.7, 70.9);
        expect(result.positionX).toBe(30);
        expect(result.positionY).toBe(70);
    });
});

describe('buildImageStyle', () => {
    it('returns default style when config is undefined', () => {
        expect(buildImageStyle(undefined)).toEqual({
            objectPosition: '50% 50%',
            transform: 'scale(1)',
            transformOrigin: '50% 50%',
        });
    });

    it('returns default style when config is null', () => {
        expect(buildImageStyle(null)).toEqual({
            objectPosition: '50% 50%',
            transform: 'scale(1)',
            transformOrigin: '50% 50%',
        });
    });

    it('builds style from config values', () => {
        expect(buildImageStyle({ positionX: 30, positionY: 70, scale: 1.5 })).toEqual({
            objectPosition: '30% 70%',
            transform: 'scale(1.5)',
            transformOrigin: '30% 70%',
        });
    });

    it('uses defaults for missing config properties', () => {
        expect(buildImageStyle({ scale: 2 })).toEqual({
            objectPosition: '50% 50%',
            transform: 'scale(2)',
            transformOrigin: '50% 50%',
        });
    });
});
