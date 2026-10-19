import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './citation.js';

export default defineExamples('odd-citation', {
  default: {
    label: 'Resolved citation',
    props: {
      sourceId: 'wcag',
      index: 1,
      source: {
        type: 'source',
        id: 's1',
        sourceId: 'wcag',
        title: 'Web Content Accessibility Guidelines 2.2',
        url: 'https://www.w3.org/TR/WCAG22/',
        excerpt: 'Content can be presented without loss of information at 320 CSS pixels.',
      },
    },
    recommended: true,
  },
  unresolved: {
    label: 'Unresolved citation',
    props: { sourceId: 'missing', index: 2 },
    guidance: 'A citation without a source says so instead of inventing one.',
  },
});
