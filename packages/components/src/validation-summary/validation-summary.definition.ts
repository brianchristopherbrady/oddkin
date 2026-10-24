import { compose } from '@oddkin/core/element';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { toneStyles } from '../styles/tone.styles.js';
import { OddkinValidationSummary } from './validation-summary.js';
import { validationSummaryStructuralStyles } from './validation-summary.structural.styles.js';
import { validationSummaryStyles } from './validation-summary.styles.js';
import { validationSummaryTemplate } from './validation-summary.template.js';

export const validationSummaryDefinition = compose({
  name: 'odd-validation-summary',
  element: OddkinValidationSummary,
  template: validationSummaryTemplate,
  styles: [
    hostStyles,
    validationSummaryStructuralStyles,
    glyphStyles,
    toneStyles,
    focusRingStyles,
    validationSummaryStyles,
  ],
});
