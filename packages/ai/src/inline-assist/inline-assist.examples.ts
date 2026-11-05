import { defineExamples } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
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

export default defineExamples('odd-inline-assist', {
  default: {
    label: 'Ask about a selection',
    props: { selection, documentRevision: 'v1', actions },
    recommended: true,
    guidance:
      'The element only asks: each action sends `odd-assist-request` with the selection and its revision; the host works on it, sets `status` to `pending`, then to `complete` with a `result` (or `failed` with an `error`). Here the host answers from a script after a moment, about the word selected in its document.',
    fixture({ scope, element, mount }) {
      // The host's document, revision v1, with the selection (characters 4 to 9) marked.
      mount(html`<p>The <mark>build</mark> takes twelve minutes on every pull request.</p>`);
      scope.listen<GlobalEventHandlersEventMap['odd-assist-request']>(
        element,
        'odd-assist-request',
        ({ detail }) => {
          element.status = 'pending';
          element.pendingAction = detail.action;
          element.result = '';
          scope.timeout(() => {
            element.status = 'complete';
            element.result = answers[detail.action] ?? '';
          }, 600);
        },
      );
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
