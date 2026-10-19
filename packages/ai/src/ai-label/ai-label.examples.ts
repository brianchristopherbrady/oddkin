import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './ai-label.js';

export default defineExamples('odd-ai-label', {
  default: {
    label: 'Generated',
    props: {
      provenance: {
        kind: 'generated',
        model: 'Example model',
        provider: 'Example provider',
        generatedAt: '2026-10-19T09:30:00Z',
      },
    },
    recommended: true,
    guidance: 'Shows origin information exactly as the host supplied it; it is never verified.',
  },
  edited: {
    label: 'Edited by a person',
    props: { provenance: { kind: 'edited', notes: 'Reviewed and edited by the author.' } },
  },
});
