import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-copy-button> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './copy-button.js';

export default defineExamples('odd-copy-button', {
  default: {
    label: 'Copy a value',
    previewRoles: ['copyButton'],
    props: { value: 'ws_83f2a9' },
    recommended: true,
    preset: true,
    guidance:
      'Give it the text with `value`, or name the element that shows it with `from`. It says "Copied to clipboard." or, when the browser refuses, selects the text for a manual copy.',
  },
  labelled: {
    label: 'Own label',
    props: { value: 'https://oddkin.dev/docs', label: 'Copy link' },
    guidance: 'Say what it copies when there are several copy buttons nearby.',
  },
  disabled: { label: 'Disabled', props: { value: 'ws_83f2a9', disabled: true } },
  disabledFalse: {
    label: 'disabled="false"',
    attributes: { value: 'ws_83f2a9', disabled: 'false' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: disabled="false" disables the button. Leave the attribute out.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
});
