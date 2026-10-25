import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-relative-time> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './relative-time.js';

export default defineExamples('odd-relative-time', {
  default: {
    label: 'Past',
    previewRoles: ['relativeTime'],
    props: { datetime: '2026-10-24T09:30:00-07:00' },
    recommended: true,
    preset: true,
    guidance:
      'Give `datetime` an ISO 8601 date and time with its offset. The text is relative to the reader’s clock, in the page’s language; the exact time is the tooltip.',
  },
  detail: {
    label: 'Absolute detail',
    props: { datetime: '2026-10-24T09:30:00-07:00', detail: true },
    preset: true,
    guidance:
      'Show the absolute date and time where people compare or act on the exact moment: keyboard and touch users cannot open the tooltip.',
  },
  future: { label: 'Future', props: { datetime: '2030-01-01T09:00:00Z' } },
  unavailable: {
    label: 'Unavailable',
    guidance:
      'Without a `datetime` it says "Time unavailable" (`strings.unavailable`), never a blank.',
  },
  detailFalse: {
    label: 'detail="false"',
    attributes: { datetime: '2026-10-24T09:30:00-07:00', detail: 'false' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: detail="false" shows the absolute date. Leave the attribute out.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
});
