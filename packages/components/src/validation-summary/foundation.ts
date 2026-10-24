// Skin-free foundation: behavior, anatomy, and structural styles (shared host defaults first).
// Loads no default visual styles and registers nothing (multi-product.md §4).
export { hostStyles } from '../styles/host.styles.js';
export { glyphStyles } from '../styles/glyphs.js';
export {
  OddkinValidationSummary,
  VALIDATION_SUMMARY_STRINGS,
  type ValidationEntry,
} from './validation-summary.js';
export { validationSummaryTemplate } from './validation-summary.template.js';
export { validationSummaryStructuralStyles } from './validation-summary.structural.styles.js';
