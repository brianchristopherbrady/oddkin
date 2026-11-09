import { defineExamples } from '@oddkin/workbench/examples';
import type { AttemptRecord, BranchPosition, MessageRecord } from '../contracts/types.js';
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
// Three answers to one prompt, in the order they were generated.
const versions = [
  { id: 'm2a', text: 'Use a media query on the page.' },
  { id: 'm2', text: 'Use a container query on the card.' },
  { id: 'm2c', text: 'Use a grid with auto-fit columns.' },
];
const version = (id: string): MessageRecord => ({
  id,
  role: 'assistant',
  parentId: 'm1',
  parts: [{ type: 'text', id: 't1', text: versions.find((v) => v.id === id)?.text ?? '' }],
});
const position = (id: string): BranchPosition => {
  const at = versions.findIndex((v) => v.id === id);
  return {
    index: at + 1,
    count: versions.length,
    ...(at > 0 ? { previousId: versions[at - 1]!.id } : {}),
    ...(at < versions.length - 1 ? { nextId: versions[at + 1]!.id } : {}),
  };
};

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
  versions: {
    label: 'Second of three answers',
    props: {
      message: {
        id: 'm2',
        role: 'assistant',
        parentId: 'm1',
        parts: [{ type: 'text', id: 't1', text: 'Use a container query on the card.' }],
      },
      branch: { index: 2, count: 3, previousId: 'm2a', nextId: 'm2c' },
      capabilities: { switchBranch: { available: true } },
    },
    guidance:
      'The arrows only ask (`odd-branch-switch` names the version to show); the host shows that message and passes back its position. Here the host keeps three answers to one prompt.',
    fixture({ scope, element }) {
      scope.listen<GlobalEventHandlersEventMap['odd-branch-switch']>(
        element,
        'odd-branch-switch',
        ({ detail }) => {
          element.message = version(detail.targetMessageId);
          element.branch = position(detail.targetMessageId);
        },
      );
    },
  },
});
