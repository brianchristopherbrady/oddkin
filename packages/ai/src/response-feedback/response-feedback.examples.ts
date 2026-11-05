import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './response-feedback.js';

export default defineExamples('odd-response-feedback', {
  default: {
    label: 'Rate a response',
    props: {
      messageId: 'm2',
      reasons: ['Inaccurate', 'Not helpful', 'Unsafe'],
    },
    recommended: true,
    guidance:
      'Sending feedback only asks (`odd-feedback-submit`); the element shows what the host records in `feedback`. Here the host records it as pending, then as submitted a moment later.',
    fixture({ scope, element }) {
      scope.listen<GlobalEventHandlersEventMap['odd-feedback-submit']>(
        element,
        'odd-feedback-submit',
        ({ detail }) => {
          element.feedback = { ...detail, reasons: [...detail.reasons], status: 'pending' };
          scope.timeout(() => {
            element.feedback = { ...detail, reasons: [...detail.reasons], status: 'submitted' };
          }, 600);
        },
      );
    },
  },
  negative: {
    label: 'Negative rating with reasons',
    props: {
      messageId: 'm2',
      reasons: ['Inaccurate', 'Not helpful', 'Unsafe'],
      feedback: { messageId: 'm2', rating: 'negative', status: 'idle' },
    },
  },
});
