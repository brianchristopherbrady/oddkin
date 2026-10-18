import { buttonDefinition } from '@oddkin/components/button';
import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinQuestion } from './question.js';
import { questionStyles } from './question.styles.js';
import { questionTemplate } from './question.template.js';

export const questionDefinition = compose({
  name: 'odd-question',
  element: OddkinQuestion,
  template: questionTemplate,
  styles: [aiBaseStyles, questionStyles],
  dependencies: { button: buttonDefinition },
});
