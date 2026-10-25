import { compose } from '@oddkin/core/element';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { visuallyHiddenStyles } from '../styles/visually-hidden.styles.js';
import { OddkinRating } from './rating.js';
import { ratingStructuralStyles } from './rating.structural.styles.js';
import { ratingStyles } from './rating.styles.js';
import { ratingTemplate } from './rating.template.js';

export const ratingDefinition = compose({
  name: 'odd-rating',
  element: OddkinRating,
  template: ratingTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    ratingStructuralStyles,
    visuallyHiddenStyles,
    glyphStyles,
    focusRingStyles,
    controlStyles,
    ratingStyles,
  ],
});
