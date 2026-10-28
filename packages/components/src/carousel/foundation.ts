// Skin-free foundation: behavior, anatomy, and structural styles (shared host defaults first).
// Loads no default visual styles and registers nothing (multi-product.md §4).
export { hostStyles } from '../styles/host.styles.js';
export { glyphStyles } from '../styles/glyphs.js';
export {
  OddkinCarousel,
  CAROUSEL_STRINGS,
  carouselInputEvent,
  carouselChangeEvent,
} from './carousel.js';
export { carouselTemplate } from './carousel.template.js';
export { carouselStructuralStyles } from './carousel.structural.styles.js';
