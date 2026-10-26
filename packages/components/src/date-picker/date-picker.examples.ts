import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-date-picker> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './date-picker.js';

export default defineExamples('odd-date-picker', {
  default: {
    label: 'Default',
    props: {
      label: 'Publish date',
      description: 'Type the date or choose it in the calendar.',
      name: 'publish',
      placeholder: 'Choose a date',
    },
    previewRoles: ['datePicker'],
    recommended: true,
    preset: true,
    guidance:
      'The field takes the date in the page language’s numeric order (26/10/2026 in British English, 10/26/2026 in American English); the button opens the calendar. The value is `YYYY-MM-DD` either way.',
  },
  selected: {
    label: 'Selected',
    props: { label: 'Publish date', name: 'publish', value: '2026-10-26', firstDay: 1 },
    preset: true,
  },
  restricted: {
    label: 'Restricted dates',
    props: {
      label: 'Delivery date',
      description: 'From 5 October to 20 November.',
      name: 'delivery',
      min: '2026-10-05',
      max: '2026-11-20',
      required: true,
    },
    guidance:
      '`min` and `max` bound both the calendar and the typed date; a typed date outside them is reported as a native date input reports it.',
  },
  invalid: {
    label: 'Invalid',
    props: {
      label: 'Publish date',
      name: 'publish',
      value: '2026-10-26',
      error: 'Choose a date after the review on 28 October.',
    },
    preset: true,
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Publish date', value: '2026-10-26', disabled: true },
  },
  requiredFalse: {
    label: 'required="false"',
    attributes: { required: 'false' },
    props: { label: 'Publish date', name: 'publish' },
    incorrect: {
      explanation:
        '`required` is a boolean attribute: any value, "false" too, makes a date required. Leave the attribute out when a date is optional.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
});
