export type SectionVariant = 'white' | 'brand';

export function getSectionClasses(variant: SectionVariant = 'white') {
  return {
    sectionBg: variant === 'brand' ? 'bg-brand-light' : 'bg-white',
    headerBg: variant === 'brand' ? 'bg-brand-light/95 md:bg-transparent' : 'bg-white/95',
  };
}
