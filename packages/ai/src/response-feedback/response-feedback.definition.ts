import { buttonDefinition } from '@oddkin/components/button';
import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinResponseFeedback } from './response-feedback.js';
import { responseFeedbackStyles } from './response-feedback.styles.js';
import { responseFeedbackTemplate } from './response-feedback.template.js';

export const responseFeedbackDefinition = compose({
  name: 'odd-response-feedback',
  element: OddkinResponseFeedback,
  template: responseFeedbackTemplate,
  styles: [aiBaseStyles, responseFeedbackStyles],
  dependencies: { button: buttonDefinition },
});
