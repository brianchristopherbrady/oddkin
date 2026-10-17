import type { ThemeConfig } from '../../src/theme/index.js';

/** Configurations whose generated CSS is committed as fixtures and compared byte for byte in Node and browsers. */
export const cases: Record<string, ThemeConfig> = {
  'brand-only': { brand: { primary: '#5b46e8' } },
  'products-density': {
    name: 'acme',
    brand: { primary: '#5b46e8' },
    spacing: { strategy: 'ratio', base: '0.75rem', ratio: 1.5, stepsBelow: 2, stepsAbove: 3 },
    products: {
      clinic: { brand: { primary: '#0f766e' } },
      studio: { brand: { primary: '#e11d48', neutral: '#78716c' } },
    },
    density: { compact: { scale: 0.75 }, spacious: { scale: 1.25 } },
  },
};
