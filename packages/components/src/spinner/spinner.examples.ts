import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-spinner> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './spinner.js';

export default defineExamples('odd-spinner', {
  default: {
    label: 'With status text',
    previewRoles: ['busyIndicator'],
    slots: { default: 'Loading workspace…' },
    recommended: true,
    preset: true,
  },
  inline: {
    label: 'Inline',
    props: { size: 'sm' },
    slots: { default: 'Saving changes…' },
  },
  silent: {
    label: 'Without visible text',
    props: { label: 'Loading results' },
    guidance: 'Without visible text, `label` names the indicator for assistive technology.',
  },
  large: { label: 'Large', props: { size: 'lg' }, slots: { default: 'Preparing export…' } },
  sizeWord: {
    label: 'size="small"',
    attributes: { size: 'small' },
    slots: { default: 'Saving changes…' },
    incorrect: {
      explanation:
        '`size` takes sm, md, or lg, as every Oddkin element does. Other values are reported and the medium ring is drawn.',
      diagnostic: 'usage.attribute.value',
      correct: 'inline',
    },
  },
});
