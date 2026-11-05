import { defineExamples } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import type {} from './prompt-input.js';

export default defineExamples('odd-prompt-input', {
  default: {
    label: 'Composer',
    props: {
      label: 'Message',
      placeholder: 'Ask anything',
      capabilities: { send: { available: true }, attachments: { available: true } },
    },
    slots: { header: 'Replying in #design', 'toolbar-start': 'Attach', 'toolbar-end': 'Model' },
    recommended: true,
    guidance:
      'Enter sends by default; Shift+Enter adds a line. Sending only asks (`odd-prompt-submit`): the host takes the message, and the composer clears once the host calls `acknowledge()`, or keeps the text after `fail()`. Here the host acknowledges a moment later and says what was sent.',
    // The host: it takes each message a moment later and shows what it sent.
    fixture({ scope, element, mount }) {
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
    },
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
        'There is no `toolbar` slot, so the content is not shown. Use `toolbar-start` or `toolbar-end` for controls beside the send button, or `above` for context over the field.',
      diagnostic: 'usage.slot.unknown',
      correct: 'default',
    },
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
