import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-calendar> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './calendar.js';

export default defineExamples('odd-calendar', {
  default: {
    label: 'Default',
    props: { label: 'Publish date', name: 'publish', value: '2026-10-26', firstDay: 1 },
    previewRoles: ['calendar'],
    recommended: true,
    preset: true,
    guidance:
      'Weeks start on the page language’s first day; `first-day` sets it (1 is Monday). The value is a `YYYY-MM-DD` date, whatever the language shows.',
  },
  restricted: {
    label: 'Restricted dates',
    props: {
      label: 'Delivery date',
      description: 'Weekdays from 5 October to 20 November.',
      name: 'delivery',
      value: '2026-10-26',
      min: '2026-10-05',
      max: '2026-11-20',
      firstDay: 1,
    },
    preset: true,
    guidance:
      '`min` and `max` bound the dates; `isDateDisabled` (a property) disables others, here weekends. Say which dates are allowed in the description: the disabled dates alone do not explain why.',
    fixture({ element }) {
      element.isDateDisabled = (date) => [0, 6].includes(new Date(date).getUTCDay());
    },
  },
  required: {
    label: 'Required',
    props: { label: 'Start date', name: 'start', required: true },
    guidance:
      'Without a value the calendar shows the current month. A blocked submission focuses the date that holds the grid’s Tab stop.',
  },
  invalid: {
    label: 'Invalid',
    props: {
      label: 'Publish date',
      name: 'publish',
      value: '2026-10-26',
      firstDay: 1,
      error: 'Choose a date after the review on 28 October.',
    },
    preset: true,
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Publish date', value: '2026-10-26', firstDay: 1, disabled: true },
  },
  requiredFalse: {
    label: 'required="false"',
    attributes: { required: 'false' },
    props: { label: 'Start date', name: 'start' },
    incorrect: {
      explanation:
        '`required` is a boolean attribute: any value, "false" too, makes a date required. Leave the attribute out when a date is optional.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
});
