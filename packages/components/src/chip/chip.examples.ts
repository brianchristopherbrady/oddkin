import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-chip> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './chip.js';

export default defineExamples('odd-chip', {
  default: {
    label: 'Removable',
    previewRoles: ['chip'],
    props: { removable: true },
    slots: { default: 'Design systems' },
    recommended: true,
    preset: true,
    guidance:
      'Listen for `odd-chip-remove`, remove the value, and move focus to the next chip or the input.',
  },
  plain: { label: 'Plain', slots: { default: 'Accessibility' } },
  selected: {
    label: 'Selected',
    props: { removable: true, selected: true },
    slots: { default: 'Design systems' },
  },
  disabled: {
    label: 'Disabled',
    props: { removable: true, disabled: true },
    slots: { default: 'Design systems' },
  },
  removableFalse: {
    label: 'removable="false"',
    attributes: { removable: 'false' },
    slots: { default: 'Design systems' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: removable="false" shows the remove button. Leave the attribute out.',
      diagnostic: 'usage.boolean.false',
      correct: 'plain',
    },
  },
});
