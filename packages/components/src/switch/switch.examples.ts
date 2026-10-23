import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-switch> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './switch.js';

export default defineExamples('odd-switch', {
  default: {
    label: 'Default',
    previewRoles: ['switch'],
    slots: { default: 'Notifications' },
    preset: true,
    recommended: true,
  },
  checked: {
    label: 'On',
    attributes: { checked: '' },
    slots: { default: 'Notifications' },
    preset: true,
  },
  description: {
    label: 'With description',
    props: { description: 'A summary of the week, every Monday.' },
    slots: { default: 'Weekly digest' },
  },
  disabled: {
    label: 'Disabled',
    props: { disabled: true },
    attributes: { checked: '' },
    slots: { default: 'Managed by your workspace' },
  },
  strings: {
    label: 'Localized state text',
    props: { strings: { on: 'Activé', off: 'Désactivé' } },
    slots: { default: 'Notifications' },
    guidance:
      'The visible on/off text comes from `strings`; assistive technology announces the state from the switch role in the user’s language.',
  },
  onAttribute: {
    label: '"on" instead of "checked"',
    attributes: { on: '' },
    slots: { default: 'Notifications' },
    incorrect: {
      explanation:
        'A switch is on when `checked`, as a checkbox; `on` is not an attribute of `odd-switch`, so it starts off.',
      diagnostic: 'usage.attribute.unknown',
      correct: 'checked',
    },
  },
});
