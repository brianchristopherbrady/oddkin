import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-progress> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './progress.js';

export default defineExamples('odd-progress', {
  default: {
    label: 'Determinate',
    previewRoles: ['progress'],
    props: { label: 'Uploading files', value: 8, max: 12, description: '8 of 12 files' },
    recommended: true,
    preset: true,
  },
  indeterminate: {
    label: 'Indeterminate',
    props: { label: 'Preparing upload', description: 'Please wait…' },
    guidance: 'Without `value` the bar shows activity and never a percentage.',
    preset: true,
  },
  fraction: {
    label: 'Fraction of one',
    props: { label: 'Indexing', value: 0.25 },
    guidance: '`max` defaults to 1, as on a native progress element.',
  },
  counted: {
    label: 'Custom value text',
    props: { label: 'Importing', value: 120, max: 400 },
    guidance: '`renderValue` formats the text shown and announced, such as "120 of 400 rows".',
    fixture({ element }) {
      element.renderValue = (value, max) => `${value} of ${max} rows`;
    },
  },
  percentAttribute: {
    label: 'percent="40"',
    attributes: { percent: '40' },
    props: { label: 'Uploading files' },
    incorrect: {
      explanation:
        'There is no `percent`; the bar shows activity instead of progress. Set `value` and `max` (value="40" max="100").',
      diagnostic: 'usage.attribute.unknown',
      correct: 'default',
    },
  },
});
