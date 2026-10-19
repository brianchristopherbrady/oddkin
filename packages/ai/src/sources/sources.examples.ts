import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './sources.js';

const sources = [
  {
    type: 'source' as const,
    id: 's1',
    sourceId: 'wcag',
    title: 'Web Content Accessibility Guidelines 2.2',
    url: 'https://www.w3.org/TR/WCAG22/',
    publisher: 'W3C',
    kind: 'web' as const,
  },
  {
    type: 'source' as const,
    id: 's2',
    sourceId: 'notes',
    title: 'Design review notes',
    excerpt: 'Focus must stay visible in forced-colors mode.',
    kind: 'document' as const,
  },
];

export default defineExamples('odd-sources', {
  default: {
    label: 'Cited sources',
    props: { sources },
    recommended: true,
    guidance: 'Links are checked by the URL policy; titles and excerpts render as text.',
  },
  sourcesAttribute: {
    label: 'Sources as a JSON attribute',
    attributes: { sources: JSON.stringify(sources) },
    incorrect: {
      explanation:
        "`sources` is a property-only array: an attribute of the same name is ignored and nothing is listed. Set `.sources` from script, or use your framework's property binding.",
      diagnostic: 'usage.attribute.propertyOnly',
      correct: 'default',
    },
  },
});
