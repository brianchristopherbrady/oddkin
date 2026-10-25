// Skin-free foundation: behavior, anatomy, and structural styles (shared host defaults first).
// Loads no default visual styles and registers nothing (multi-product.md §4).
export { hostStyles } from '../styles/host.styles.js';
export { fieldStructuralStyles } from '../styles/field.structural.styles.js';
export { visuallyHiddenStyles } from '../styles/visually-hidden.styles.js';
export { glyphStyles } from '../styles/glyphs.js';
export {
  OddkinRating,
  RATING_STRINGS,
  inputEvent,
  changeEvent,
  type OptionRecord,
} from './rating.js';
export { ratingTemplate } from './rating.template.js';
export { ratingStructuralStyles } from './rating.structural.styles.js';
