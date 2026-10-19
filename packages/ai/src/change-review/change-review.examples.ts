import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './change-review.js';

export default defineExamples('odd-change-review', {
  default: {
    label: 'Proposed edit',
    props: {
      proposals: [
        {
          proposalId: 'p1',
          baseRevision: 'v1',
          range: { start: 0, end: 23 },
          original: 'The build is very slow.',
          replacement: 'Builds take 40% less time.',
          label: 'Make it specific',
          status: 'proposed',
        },
      ],
    },
    recommended: true,
    guidance: 'A proposal applies only to the revision it was made for; later edits mark it stale.',
  },
});
