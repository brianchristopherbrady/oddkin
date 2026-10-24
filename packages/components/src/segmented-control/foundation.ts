// Skin-free foundation: behavior, anatomy, and structural styles (shared host defaults first).
// Loads no default visual styles and registers nothing (multi-product.md §4).
export { hostStyles } from '../styles/host.styles.js';
export { fieldStructuralStyles } from '../styles/field.structural.styles.js';
export { visuallyHiddenStyles } from '../styles/visually-hidden.styles.js';
export {
  OddkinSegmentedControl,
  inputEvent,
  changeEvent,
  type OptionRecord,
} from './segmented-control.js';
export { segmentedControlTemplate } from './segmented-control.template.js';
export { segmentedControlStructuralStyles } from './segmented-control.structural.styles.js';
