import { describe, it, expect } from 'vitest';
import { getBusinessHours } from '../getBusinessHours.js';

describe('getBusinessHours', () => {
    it('extracts and sorts business hours entries from settings', () => {
        const settings = {
            phone1: '12345678',
            businessHours2: 'Tirsdag: 08:00–20:00',
            businessHours1: 'Mandag: 08:00–15:30',
            businessHours3: 'Onsdag: 08:00–20:00',
        };
        expect(getBusinessHours(settings)).toEqual([
            'Mandag: 08:00–15:30',
            'Tirsdag: 08:00–20:00',
            'Onsdag: 08:00–20:00',
        ]);
    });

    it('filters out empty and whitespace-only entries', () => {
        const settings = {
            businessHours1: 'Mandag: 08:00–15:30',
            businessHours2: '',
            businessHours3: '   ',
        };
        expect(getBusinessHours(settings)).toEqual(['Mandag: 08:00–15:30']);
    });

    it('returns empty array when no businessHours keys exist', () => {
        expect(getBusinessHours({ phone1: '123' })).toEqual([]);
    });

    it('returns fallback when settings is null/undefined', () => {
        expect(getBusinessHours(null)).toEqual([]);
        expect(getBusinessHours(undefined)).toEqual([]);
        expect(getBusinessHours(null, ['Ta kontakt'])).toEqual(['Ta kontakt']);
    });

    it('returns empty array (not fallback) when settings exist but no hours', () => {
        expect(getBusinessHours({ phone1: '123' }, ['fallback'])).toEqual([]);
    });
});
