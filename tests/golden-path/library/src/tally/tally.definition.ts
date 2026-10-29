import { compose } from '@oddkin/core';
import { AcmeTally } from './tally.js';
import { tallyStyles } from './tally.styles.js';
import { tallyTemplate } from './tally.template.js';

export const tallyDefinition = compose({
  name: 'acme-tally',
  element: AcmeTally,
  template: tallyTemplate,
  styles: tallyStyles,
});
