import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-badge> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './badge.js';

export default defineExamples('odd-badge', {
  default: {
    label: 'Neutral',
    slots: { default: 'Draft' },
    previewRoles: ['badge'],
    recommended: true,
    preset: true,
  },
  success: {
    label: 'Success',
    props: { tone: 'success' },
    slots: { default: 'Published' },
    preset: true,
  },
  warning: {
    label: 'Warning',
    props: { tone: 'warning' },
    slots: { default: 'Expires soon' },
    preset: true,
  },
  danger: {
    label: 'Danger',
    props: { tone: 'danger' },
    slots: { default: 'Failed' },
    preset: true,
  },
  info: {
    label: 'Info',
    props: { tone: 'info' },
    slots: { default: 'Beta' },
  },
  count: {
    label: 'Count',
    props: { noMarker: true },
    slots: { default: '12' },
    guidance: 'A count needs no glyph; say what is counted nearby ("12 unread").',
  },
  pill: {
    label: 'Pill radius',
    props: { tone: 'info' },
    styles: { '--odd-badge-radius': 'var(--odd-radius-full)' },
    slots: { default: 'Beta' },
    guidance: 'Set --odd-badge-radius: var(--odd-radius-full) on the badge to use the pill radius.',
  },
  wrapping: {
    label: 'Narrow status',
    props: { tone: 'warning' },
    styles: { 'inline-size': '112px' },
    slots: { default: 'Waiting for accessibility review' },
    guidance:
      'The label wraps within this 112 px grant and the marker stays beside its first line. The parent owns the row and any adjacent actions.',
  },
  colorOnly: {
    label: 'Unknown tone "error"',
    attributes: { tone: 'error' },
    slots: { default: 'Failed' },
    incorrect: {
      explanation:
        '`tone` accepts neutral, info, success, warning, or danger. Other values are reported and the badge stays neutral; use `danger` for failures.',
      diagnostic: 'usage.attribute.value',
      correct: 'danger',
    },
  },
});
