import { compose } from '@oddkin/core/element';
import { spinnerStyles } from '../styles/spinner.styles.js';
import { visuallyHiddenStyles } from '../styles/visually-hidden.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinSpinner } from './spinner.js';
import { spinnerStructuralStyles } from './spinner.structural.styles.js';
import { spinnerElementStyles } from './spinner.styles.js';
import { spinnerTemplate } from './spinner.template.js';

export const spinnerDefinition = compose({
  name: 'odd-spinner',
  element: OddkinSpinner,
  template: spinnerTemplate,
  styles: [
    hostStyles,
    spinnerStructuralStyles,
    spinnerStyles,
    visuallyHiddenStyles,
    spinnerElementStyles,
  ],
});
