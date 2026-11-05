import { defineExamples } from '@oddkin/workbench/examples';
import type { AttemptRecord } from '../contracts/types.js';
import type {} from './message.js';

const source = {
  type: 'source',
  id: 's1',
  sourceId: 'spec',
  title: 'CSS Containment Module Level 3',
  url: 'https://www.w3.org/TR/css-contain-3/',
} as const;
// What Regenerate brings back, in turn: fixed, so the example shows the same thing every time.
const answers = [
  'Use a container query on the card [^spec].',
  'Make the card’s wrapper a container, then style the card in an `@container` rule [^spec].',
];
const attempt = (attemptId: string, status: 'streaming' | 'completed'): AttemptRecord => ({
  attemptId,
  runId: attemptId,
  conversationId: 'c1',
  messageId: 'm2',
  promptId: 'm1',
  relation: 'regenerate',
  parentAttemptId: 'at1',
  status,
  connection: status === 'streaming' ? 'open' : 'closed',
  stop: 'none',
});

export default defineExamples('odd-message', {
  default: {
    label: 'Assistant message with a source',
    props: {
      message: {
        id: 'm2',
        role: 'assistant',
        parentId: 'm1',
        attemptId: 'at1',
        parts: [
          { type: 'text', id: 't1', text: 'Use a container query on the card [^spec].' },
          source,
        ],
        provenance: { kind: 'generated', model: 'Example model' },
      },
      capabilities: { feedback: { available: true }, regenerate: { available: true } },
    },
    recommended: true,
    guidance:
      'Parts render in order; unknown parts and missing records render explicit fallbacks. Regenerate and feedback only ask (`odd-message-regenerate`, `odd-feedback-submit`); here the host streams a new answer for a moment, then replaces the message, and records feedback as pending, then submitted.',
    fixture({ scope, element }) {
      let regenerated = 0;
      scope.listen<GlobalEventHandlersEventMap['odd-message-regenerate']>(
        element,
        'odd-message-regenerate',
        ({ detail }) => {
          const attemptId = `at${++regenerated + 1}`;
          const text = answers[regenerated % answers.length] ?? '';
          element.feedback = undefined;
          element.attempt = attempt(attemptId, 'streaming');
          element.message = {
            id: detail.messageId,
            role: 'assistant',
            parentId: 'm1',
            attemptId,
            parts: [{ type: 'text', id: 't1', text: '' }],
          };
          scope.timeout(() => {
            element.message = {
              id: detail.messageId,
              role: 'assistant',
              parentId: 'm1',
              attemptId,
              parts: [{ type: 'text', id: 't1', text }, source],
              provenance: { kind: 'generated', model: 'Example model' },
            };
            element.attempt = attempt(attemptId, 'completed');
          }, 600);
        },
      );
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
  user: {
    label: 'User message',
    props: {
      message: {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', id: 't0', text: 'How do I make the card responsive?' }],
      },
      capabilities: { edit: { available: true } },
    },
    guidance:
      'Edit only asks (`odd-message-edit` with the new text); here the host replaces the message with it.',
    fixture({ scope, element }) {
      scope.listen<GlobalEventHandlersEventMap['odd-message-edit']>(
        element,
        'odd-message-edit',
        ({ detail }) => {
          element.message = {
            id: detail.messageId,
            role: 'user',
            parts: [{ type: 'text', id: 't0', text: detail.text }],
          };
        },
      );
    },
  },
});
