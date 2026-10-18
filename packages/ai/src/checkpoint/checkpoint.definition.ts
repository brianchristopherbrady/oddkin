import { buttonDefinition } from '@oddkin/components/button';
import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinCheckpoint } from './checkpoint.js';
import { checkpointStyles } from './checkpoint.styles.js';
import { checkpointTemplate } from './checkpoint.template.js';

export const checkpointDefinition = compose({
  name: 'odd-checkpoint',
  element: OddkinCheckpoint,
  template: checkpointTemplate,
  styles: [aiBaseStyles, checkpointStyles],
  dependencies: { button: buttonDefinition },
});
