import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './response-feedback.js';

type Submit = CustomEvent<{
  readonly messageId: string;
  readonly rating: 'positive' | 'negative';
  readonly reasons: readonly string[];
  readonly comment: string;
}>;

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
      const rating = element as HTMLElement & { feedback: unknown };
      scope.listen(element, 'odd-feedback-submit', (event) => {
        const detail = (event as Submit).detail;
        rating.feedback = { ...detail, reasons: [...detail.reasons], status: 'pending' };
        scope.timeout(() => {
          rating.feedback = { ...detail, reasons: [...detail.reasons], status: 'submitted' };
        }, 600);
      });
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
