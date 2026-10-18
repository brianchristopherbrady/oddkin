import { buttonDefinition } from '@oddkin/components/button';
import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinPromptInput } from './prompt-input.js';
import { promptInputStyles } from './prompt-input.styles.js';
import { promptInputTemplate } from './prompt-input.template.js';

export const promptInputDefinition = compose({
  name: 'odd-prompt-input',
  element: OddkinPromptInput,
  template: promptInputTemplate,
  styles: [aiBaseStyles, promptInputStyles],
  dependencies: { button: buttonDefinition },
});
