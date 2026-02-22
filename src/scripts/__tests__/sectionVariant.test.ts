import { describe, it, expect } from 'vitest';
import { getSectionClasses } from '../sectionVariant';

describe('getSectionClasses', () => {
  it('returnerer hvite bakgrunner for variant "white"', () => {
    const result = getSectionClasses('white');
    expect(result.sectionBg).toBe('bg-white');
    expect(result.headerBg).toBe('bg-white/95');
  });

  it('returnerer brand-bakgrunner for variant "brand"', () => {
    const result = getSectionClasses('brand');
    expect(result.sectionBg).toBe('bg-brand-light');
    expect(result.headerBg).toBe('bg-brand-light/95 md:bg-transparent');
  });

  it('bruker "white" som standardverdi', () => {
    const result = getSectionClasses();
    expect(result.sectionBg).toBe('bg-white');
    expect(result.headerBg).toBe('bg-white/95');
  });
});
