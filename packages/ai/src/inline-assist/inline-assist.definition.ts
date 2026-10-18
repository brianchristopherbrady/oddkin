import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinInlineAssist } from './inline-assist.js';
import { inlineAssistStyles } from './inline-assist.styles.js';
import { inlineAssistTemplate } from './inline-assist.template.js';

export const inlineAssistDefinition = compose({
  name: 'odd-inline-assist',
  element: OddkinInlineAssist,
  template: inlineAssistTemplate,
  styles: [aiBaseStyles, inlineAssistStyles],
});
