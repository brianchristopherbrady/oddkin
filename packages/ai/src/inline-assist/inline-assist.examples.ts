import { defineExamples } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import { DocumentSession } from '@oddkin/ai/controllers';
import type {} from './inline-assist.js';

type Request = CustomEvent<{ readonly proposalId: string }>;

// The host's document, revision v1; the selection is its word "build" (characters 4 to 9).
const TEXT = 'The build takes twelve minutes on every pull request.';
const selection = { start: 4, end: 9, revision: 'v1', text: 'build' };
const actions = [
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'explain', label: 'Explain' },
  { id: 'summarize', label: 'Summarize' },
];
// The host's scripted answers: fixed, so the examples show the same thing every time.
const answers: Readonly<Record<string, string>> = {
  explain: 'A **build** turns sources into the files that ship.',
  summarize: 'Builds turn sources into shippable files.',
};
const translations: Readonly<Record<string, string>> = {
  fr: '**compilation** (French)',
  de: '**Build** (German)',
  es: '**compilación** (Spanish)',
};

export default defineExamples('odd-inline-assist', {
  default: {
    label: 'Ask about a selection',
    props: { selection, documentRevision: 'v1', actions },
    recommended: true,
    guidance:
      'The element only asks: each action sends `odd-assist-request` with the selection and its revision, and the host answers. Here Rewrite becomes a proposal in an `odd-change-review` under the sentence, where Accept replaces the word; Explain and Summarize answer in the result area. Once the text changes, the selection is out of date until the user selects again.',
    // The host: its document (a DocumentSession), the sentence, and the review of proposed rewrites.
    fixture({ scope, element, mount }) {
      const session = new DocumentSession(TEXT, { revisionPrefix: 'v' });
      // The selection was made in the session's first revision.
      const first = session.getSnapshot().revision;
      element.selection = { ...selection, revision: first };
      const sentence = mount(html`<p></p>`);
      const review = mount(
        html`<odd-change-review></odd-change-review>`,
      ) as HTMLElementTagNameMap['odd-change-review'];
      const show = () => {
        const { text, revision, proposals } = session.getSnapshot();
        if (revision === first) {
          const mark = element.ownerDocument.createElement('mark');
          mark.textContent = text.slice(selection.start, selection.end);
          sentence.replaceChildren(text.slice(0, selection.start), mark, text.slice(selection.end));
        } else sentence.textContent = text;
        review.proposals = [...proposals];
        element.documentRevision = revision;
      };
      scope.listen<GlobalEventHandlersEventMap['odd-assist-request']>(
        element,
        'odd-assist-request',
        ({ detail }) => {
          element.status = 'pending';
          element.pendingAction = detail.action;
          element.result = '';
          scope.timeout(() => {
            if (detail.action !== 'rewrite') {
              element.status = 'complete';
              element.result = answers[detail.action] ?? '';
              return;
            }
            const { start, end, text, revision } = detail.selection;
            session.propose({
              proposalId: `p${session.getSnapshot().proposals.length + 1}`,
              baseRevision: revision,
              range: { start, end },
              original: text,
              replacement: 'compile step',
              label: 'Rewrite',
            });
            element.status = 'idle';
            show();
          }, 600);
        },
      );
      scope.listen(review, 'odd-change-accept', (event) => {
        session.accept((event as Request).detail.proposalId);
        show();
      });
      scope.listen(review, 'odd-change-reject', (event) => {
        session.reject((event as Request).detail.proposalId);
        show();
      });
      scope.listen(review, 'odd-change-undo', (event) => {
        session.undo((event as Request).detail.proposalId);
        show();
      });
      show();
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
  translate: {
    label: 'Translate into a chosen language',
    props: {
      selection,
      documentRevision: 'v1',
      actions: [{ id: 'translate', label: 'Translate' }],
      languages: [
        { id: 'fr', label: 'French' },
        { id: 'de', label: 'German' },
        { id: 'es', label: 'Spanish' },
      ],
    },
    guidance:
      'With `languages`, a language choice shows beside the actions, and Translate sends the chosen one as `options.language` (a BCP 47 tag). Here the host answers in the result area.',
    fixture({ scope, element }) {
      scope.listen<GlobalEventHandlersEventMap['odd-assist-request']>(
        element,
        'odd-assist-request',
        ({ detail }) => {
          element.status = 'pending';
          element.pendingAction = detail.action;
          element.result = '';
          scope.timeout(() => {
            element.status = 'complete';
            element.result = translations[detail.options.language ?? ''] ?? '';
          }, 600);
        },
      );
    },
  },
  stale: {
    label: 'The text changed after the selection',
    props: { selection, documentRevision: 'v2', actions },
    guidance:
      'The selection belongs to revision v1 and the document is at v2, so its offsets may point at other text: the actions are unavailable until the user selects again.',
  },
  noSelection: {
    label: 'Nothing selected',
    props: { documentRevision: 'v1', actions },
    guidance:
      'Without a selection the actions are unavailable, and the element says to select text.',
  },
  failed: {
    label: 'The request failed',
    props: {
      selection,
      documentRevision: 'v1',
      actions,
      status: 'failed',
      error: {
        code: 'assist.unavailable',
        message: 'The assistant is not available right now. Try again.',
        retryable: true,
      },
    },
    guidance:
      'The host reports `failed` with an `error`, and its message shows; the actions stay available, so the user can try again.',
  },
});
