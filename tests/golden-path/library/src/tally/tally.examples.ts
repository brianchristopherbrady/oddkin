import { defineExamples } from '@oddkin/workbench/examples';
// Brings <acme-tally> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './tally.js';

export default defineExamples('acme-tally', {
  default: {
    label: 'Default',
    previewRoles: ['primaryAction'],
    recommended: true,
    preset: true,
  },
  byFive: {
    label: 'Counts by five',
    props: { step: 5, label: 'Points' },
    preset: true,
  },
});
