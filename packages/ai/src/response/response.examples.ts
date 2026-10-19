import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './response.js';

const text =
  'Container queries respond to the **component**, not the viewport [^css].\n\n```css\n@container (min-inline-size: 40rem) {\n  .content { display: grid; }\n}\n```';

export default defineExamples('odd-response', {
  default: {
    label: 'Complete response',
    props: {
      text,
      status: 'complete',
      copyable: true,
      sources: [
        {
          type: 'source',
          id: 's1',
          sourceId: 'css',
          title: 'CSS Containment Module Level 3',
          url: 'https://www.w3.org/TR/css-contain-3/',
        },
      ],
    },
    recommended: true,
    guidance: 'Markdown renders inertly; copying uses the canonical source text.',
  },
  streaming: {
    label: 'Streaming',
    props: { text: 'Container queries respond to the', status: 'streaming' },
  },
  failed: {
    label: 'Failed with partial output',
    props: {
      text: 'Container queries respond to the',
      status: 'failed',
      error: { code: 'timeout', message: 'The answer took too long.', retryable: true },
    },
    guidance: 'Partial output stays visible next to the failure.',
  },
});
