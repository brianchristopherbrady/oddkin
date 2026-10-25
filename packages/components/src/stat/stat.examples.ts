import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-stat> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './stat.js';

export default defineExamples('odd-stat', {
  default: {
    label: 'Increase',
    previewRoles: ['stat'],
    props: { label: 'Active members', value: '1,284', trend: 'increase' },
    slots: { default: '+8.2% this month' },
    recommended: true,
    preset: true,
    guidance:
      'Format `value` yourself and put the signed change and its period in the context: the arrow only shows the direction, never whether it is good.',
  },
  decrease: {
    label: 'Decrease',
    props: { label: 'Active members', value: '1,284', trend: 'decrease' },
    slots: { default: '−3.4% this month' },
    preset: true,
  },
  neutral: {
    label: 'Neutral',
    props: { label: 'Active members', value: '1,284' },
    slots: { default: 'Across 12 teams' },
  },
  loading: {
    label: 'Loading',
    props: { label: 'Active members', loading: true },
    guidance: 'While loading, a placeholder stands in for the value and the stat is busy.',
  },
  unavailable: {
    label: 'Unavailable',
    props: { label: 'Active members' },
    guidance: 'Without a value it says "Data not available", never a blank or a zero.',
  },
  trendUp: {
    label: 'trend="up"',
    attributes: { label: 'Active members', value: '1,284', trend: 'up' },
    slots: { default: '+8.2% this month' },
    incorrect: {
      explanation:
        '`trend` takes increase, decrease, or none. "up" is reported and no arrow is shown; use increase.',
      diagnostic: 'usage.attribute.value',
      correct: 'default',
    },
  },
});
