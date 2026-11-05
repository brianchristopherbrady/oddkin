import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './inline-assist.js';

const selection = { start: 4, end: 9, revision: 'v1', text: 'build' };
const actions = [
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'explain', label: 'Explain' },
  { id: 'summarize', label: 'Summarize' },
];
// The host's scripted answers: fixed, so the example shows the same thing every time.
const answers: Readonly<Record<string, string>> = {
  rewrite: 'compile step',
  explain: 'A **build** turns sources into the files that ship.',
  summarize: 'Builds turn sources into shippable files.',
};

type Assist = HTMLElement & { status: string; pendingAction: string; result: string };

export default defineExamples('odd-inline-assist', {
  default: {
    label: 'Ask about a selection',
    props: { selection, documentRevision: 'v1', actions },
    recommended: true,
    guidance:
      'The element only asks: each action sends `odd-assist-request` with the selection and its revision; the host works on it, sets `status` to `pending`, then to `complete` with a `result` (or `failed` with an `error`). Here the host answers from a script after a moment.',
    fixture({ scope, element }) {
      const assist = element as Assist;
      scope.listen(element, 'odd-assist-request', (event) => {
        const { action } = (event as CustomEvent<{ readonly action: string }>).detail;
        Object.assign(assist, { status: 'pending', pendingAction: action, result: '' });
        scope.timeout(
          () => Object.assign(assist, { status: 'complete', result: answers[action] ?? '' }),
          600,
        );
      });
    },
  },
  result: {
    label: 'Explanation ready',
    props: {
      selection,
      documentRevision: 'v1',
      actions,
      status: 'complete',
      result: 'A **build** turns sources into the files that ship.',
    },
  },
});
