import { defineExamples, type ExampleFixtureContext } from '@oddkin/workbench/examples';
import type {} from './response-feedback.js';

// The host: it records the feedback as pending, then as submitted a moment later.
function recordFeedback({
  scope,
  element,
}: ExampleFixtureContext<HTMLElementTagNameMap['odd-response-feedback']>): void {
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
}

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
    fixture: recordFeedback,
  },
  negative: {
    label: 'Negative rating with reasons, recorded',
    props: {
      messageId: 'm2',
      reasons: ['Inaccurate', 'Not helpful', 'Unsafe'],
      feedback: {
        messageId: 'm2',
        rating: 'negative',
        reasons: ['Inaccurate'],
        status: 'submitted',
      },
    },
    guidance:
      'The element shows the rating the host recorded: once `feedback` is submitted, its rating is pressed and the thanks show.',
  },
  failed: {
    label: 'Feedback that was not sent',
    props: {
      messageId: 'm2',
      reasons: ['Inaccurate', 'Not helpful', 'Unsafe'],
      feedback: {
        messageId: 'm2',
        rating: 'negative',
        reasons: ['Not helpful'],
        status: 'failed',
        error: {
          code: 'feedback.unavailable',
          message: 'The server did not answer.',
          retryable: true,
        },
      },
    },
    guidance:
      'When the host records the feedback as failed, its error shows and the ratings stay available: the user rates again, and the button that sends reads Try again. Here the second attempt is recorded.',
    fixture: recordFeedback,
  },
});
