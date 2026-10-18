import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinAiLabel } from './ai-label.js';
import { aiLabelStyles } from './ai-label.styles.js';
import { aiLabelTemplate } from './ai-label.template.js';

export const aiLabelDefinition = compose({
  name: 'odd-ai-label',
  element: OddkinAiLabel,
  template: aiLabelTemplate,
  styles: [aiBaseStyles, aiLabelStyles],
});
