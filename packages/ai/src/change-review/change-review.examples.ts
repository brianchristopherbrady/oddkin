import { defineExamples } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import { DocumentSession } from '@oddkin/ai/controllers';
import type {} from './change-review.js';

type Request = CustomEvent<{ readonly proposalId: string }>;

// The proposals' text, for the default example's document and the statuses example.
const TEXT = 'The build is very slow, so every release waits a day.';

export default defineExamples('odd-change-review', {
  default: {
    label: 'Accept, reject, and undo',
    props: {
      proposals: [
        {
          proposalId: 'p1',
          baseRevision: 'v1',
          range: { start: 13, end: 22 },
          original: 'very slow',
          replacement: 'slow (12 minutes)',
          label: 'Make it specific',
          status: 'requested',
        },
      ],
    },
    recommended: true,
    guidance:
      "The review only asks: on Accept, Reject, or Undo it sends an event, the host applies it to its document (here a DocumentSession) and passes back the proposals, and the review shows each one's status. Edit the text and the proposal is out of date: it was made for the earlier text.",
    // The host: a DocumentSession, its text in a field after the review.
    fixture({ scope, element, mount }) {
      const session = new DocumentSession(TEXT, { revisionPrefix: 'v' });
      const field = mount(
        html`<odd-textarea label="Document" rows="2" resize="auto"></odd-textarea>`,
      ) as HTMLElement & { value: string };
      const show = () => {
        const state = session.getSnapshot();
        if (field.value !== state.text) field.value = state.text;
        element.proposals = [...state.proposals];
      };
      const { text, revision } = session.getSnapshot();
      const start = text.indexOf('very slow');
      session.propose({
        proposalId: 'p1',
        baseRevision: revision,
        range: { start, end: start + 'very slow'.length },
        original: 'very slow',
        replacement: 'slow (12 minutes)',
        label: 'Make it specific',
      });
      scope.listen(field, 'input', () => {
        session.setText(field.value);
        show();
      });
      scope.listen(element, 'odd-change-accept', (event) => {
        session.accept((event as Request).detail.proposalId);
        show();
      });
      scope.listen(element, 'odd-change-reject', (event) => {
        session.reject((event as Request).detail.proposalId);
        show();
      });
      scope.listen(element, 'odd-change-undo', (event) => {
        session.undo((event as Request).detail.proposalId);
        show();
      });
      show();
    },
  },
  split: {
    label: 'Rewrites, before and after',
    props: {
      view: 'split',
      proposals: [
        {
          proposalId: 'p1',
          baseRevision: 'v1',
          range: { start: 0, end: 23 },
          original: 'The build is very slow.',
          replacement: 'Builds take 40% less time.',
          label: 'Make it specific',
          status: 'requested',
        },
        {
          proposalId: 'p2',
          baseRevision: 'v1',
          range: { start: 24, end: 41 },
          original: 'Contact the team.',
          replacement: 'Write to the release team.',
          label: 'Say who',
          status: 'requested',
        },
      ],
    },
    preset: true,
    guidance:
      'When a proposal rewrites a sentence, `view="split"` shows the text before and after side by side; inline shows the old sentence struck through, then the new one.',
  },
  statuses: {
    label: 'Every status',
    props: {
      proposals: [
        {
          proposalId: 'p1',
          baseRevision: 'v1',
          range: { start: 13, end: 22 },
          original: 'very slow',
          replacement: 'slow',
          label: 'Applied: the host applied it, so it can be undone',
          status: 'applied',
        },
        {
          proposalId: 'p6',
          baseRevision: 'v1',
          range: { start: 4, end: 9 },
          original: 'build',
          replacement: 'release build',
          label: 'Applied before a later change, so it can no longer be undone',
          status: 'applied',
          undoable: false,
        },
        {
          proposalId: 'p2',
          baseRevision: 'v1',
          range: { start: 27, end: 40 },
          original: 'every release',
          replacement: 'each release',
          label: 'Rejected: the reader turned it down',
          status: 'rejected',
        },
        {
          proposalId: 'p3',
          baseRevision: 'v1',
          range: { start: 41, end: 52 },
          original: 'waits a day',
          replacement: 'waits',
          label: 'Out of date: the text changed after it was made',
          status: 'stale',
        },
        {
          proposalId: 'p4',
          baseRevision: 'v1',
          range: { start: 0, end: 9 },
          original: 'The build',
          replacement: 'Our build',
          label: 'Failed: the host could not apply it',
          status: 'failed',
          error: { code: 'ai.edit.range', message: 'The proposal does not match the text.' },
        },
        {
          proposalId: 'p5',
          baseRevision: 'v1',
          range: { start: 24, end: 26 },
          original: 'so',
          replacement: 'and so',
          label: 'Applying: a host that applies asynchronously sets this while it works',
          status: 'applying',
        },
      ],
    },
    preset: true,
    guidance:
      'Every status comes from the proposals the host passes in. `applying` and `undoing` are for a host that applies asynchronously; a `DocumentSession` applies at once. An applied proposal offers Undo unless its `undoable` is `false`, as `DocumentSession` sets it on every change but the latest. An out-of-date proposal offers Dismiss.',
  },
});
