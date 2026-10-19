import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './prompt-input.js';

export default defineExamples('odd-prompt-input', {
  default: {
    label: 'Composer',
    props: {
      label: 'Message',
      placeholder: 'Ask anything',
      capabilities: { send: { available: true }, attachments: { available: true } },
    },
    slots: { above: 'Replying in #design', 'toolbar-start': 'Attach', 'toolbar-end': 'Model' },
    recommended: true,
    guidance:
      'Enter sends by default; Shift+Enter adds a line. Sending is unavailable until the host allows it.',
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
  busy: {
    label: 'Answer in progress',
    props: {
      label: 'Message',
      busy: true,
      attemptId: 'at1',
      capabilities: { send: { available: true }, stop: { available: true } },
    },
  },
});
