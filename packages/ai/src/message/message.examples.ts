import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './message.js';

export default defineExamples('odd-message', {
  default: {
    label: 'Assistant message with a source',
    props: {
      message: {
        id: 'm2',
        role: 'assistant',
        parentId: 'm1',
        parts: [
          { type: 'text', id: 't1', text: 'Use a container query on the card [^spec].' },
          {
            type: 'source',
            id: 's1',
            sourceId: 'spec',
            title: 'CSS Containment Module Level 3',
            url: 'https://www.w3.org/TR/css-contain-3/',
          },
        ],
        provenance: { kind: 'generated', model: 'Example model' },
      },
      capabilities: { feedback: { available: true }, regenerate: { available: true } },
    },
    recommended: true,
    guidance: 'Parts render in order; unknown parts and missing records render explicit fallbacks.',
  },
  user: {
    label: 'User message',
    props: {
      message: {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', id: 't0', text: 'How do I make the card responsive?' }],
      },
    },
  },
});
