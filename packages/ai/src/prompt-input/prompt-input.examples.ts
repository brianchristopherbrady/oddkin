import { defineExamples, type ExampleFixtureContext } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import type {} from './prompt-input.js';

// The host: it takes each message a moment later and shows what it sent.
function takeMessages({
  scope,
  element,
  mount,
}: ExampleFixtureContext<HTMLElementTagNameMap['odd-prompt-input']>): void {
  const sent = mount(html`<p></p>`);
  scope.listen<GlobalEventHandlersEventMap['odd-prompt-submit']>(
    element,
    'odd-prompt-submit',
    ({ detail }) => {
      element.loading = true;
      scope.timeout(() => {
        element.loading = false;
        element.acknowledge(detail.submissionId);
        sent.textContent = `Sent: ${detail.text}`;
      }, 600);
    },
  );
}

export default defineExamples('odd-prompt-input', {
  default: {
    label: 'Composer',
    props: {
      label: 'Message',
      placeholder: 'Ask anything',
      capabilities: { send: { available: true }, attachments: { available: true } },
    },
    slots: { header: 'Replying in #design' },
    recommended: true,
    guidance:
      'Enter sends by default; Shift+Enter adds a line. Sending only asks (`odd-prompt-submit`): the host takes the message, and the composer clears once the host calls `acknowledge()`, or keeps the text after `fail()`. Here the host acknowledges a moment later and says what was sent.',
    fixture: takeMessages,
  },
  disabledFalse: {
    label: 'Enabled with disabled="false"',
    props: { label: 'Message' },
    attributes: { disabled: 'false' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: this composer is disabled. Remove the attribute (or set `.disabled = false`) to enable it.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
  toolbarSlot: {
    label: 'Content in a "toolbar" slot',
    props: { label: 'Message' },
    slots: { toolbar: 'Attach' },
    incorrect: {
      explanation:
        'There is no `toolbar` slot, so the content is not shown. Use `toolbar-start` or `toolbar-end` for controls beside the send button, or `header` for context over the field.',
      diagnostic: 'usage.slot.unknown',
      correct: 'default',
    },
  },
  failedSend: {
    label: 'A send that fails',
    props: { label: 'Message', capabilities: { send: { available: true } } },
    guidance:
      'The host calls `fail()` with an error: its message shows, and the draft stays, so the user can send it again. Here the host fails the first send and takes the next.',
    // The host: offline for the first send, then it takes the message.
    fixture({ scope, element, mount }) {
      const sent = mount(html`<p></p>`);
      element.value = 'Draft the release notes.';
      let offline = true;
      scope.listen<GlobalEventHandlersEventMap['odd-prompt-submit']>(
        element,
        'odd-prompt-submit',
        ({ detail }) => {
          element.loading = true;
          scope.timeout(() => {
            element.loading = false;
            if (offline) {
              offline = false;
              element.fail(detail.submissionId, {
                code: 'send.offline',
                message: 'The message was not sent: you are offline.',
                retryable: true,
              });
              return;
            }
            element.acknowledge(detail.submissionId);
            sent.textContent = `Sent: ${detail.text}`;
          }, 600);
        },
      );
    },
  },
  attachments: {
    label: 'Attachments while they upload',
    props: {
      label: 'Message',
      capabilities: { send: { available: true }, attachments: { available: true } },
    },
    guidance:
      "The host uploads each attachment and reports its progress to the element's composer (`activeController`): uploading, then uploaded, or failed with an error. Sending waits for uploads, and refuses a failed one until it is removed. Here the second upload fails.",
    // The host: two files attached, uploaded a moment later; the second upload fails.
    fixture({ scope, element }) {
      const composer = element.activeController;
      const [notes, scan] = composer.addFiles([
        new File(['# Release notes'], 'release-notes.md', { type: 'text/markdown' }),
        new File([new Uint8Array(2048)], 'scan.png', { type: 'image/png' }),
      ]);
      composer.updateAttachment(notes!.id, { status: 'uploading', progress: 0.4 });
      composer.updateAttachment(scan!.id, { status: 'uploading', progress: 0.1 });
      scope.timeout(() => composer.updateAttachment(notes!.id, { status: 'uploaded' }), 600);
      scope.timeout(
        () =>
          composer.updateAttachment(scan!.id, {
            status: 'failed',
            error: { code: 'upload.failed', message: 'The upload failed.' },
          }),
        900,
      );
    },
  },
  newline: {
    label: 'Enter adds a line',
    props: {
      label: 'Message',
      enterBehavior: 'newline',
      capabilities: { send: { available: true } },
    },
    guidance:
      "With `enterBehavior: newline`, Enter adds a line and Ctrl+Enter (⌘+Enter on a Mac) sends, for composers where people write longer messages; the field's description tells screen reader users.",
    fixture: takeMessages,
  },
  loading: {
    label: 'Answer in progress',
    props: {
      label: 'Message',
      loading: true,
      attemptId: 'at1',
      capabilities: { send: { available: true }, stop: { available: true } },
    },
  },
});
