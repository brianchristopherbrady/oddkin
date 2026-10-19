import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './artifact.js';

const artifact = {
  artifactId: 'a1',
  title: 'Release notes',
  kind: 'markdown',
  currentRevisionId: 'r2',
  revisions: [
    { revisionId: 'r1', number: 1, content: '# Release notes\n\nDraft.' },
    {
      revisionId: 'r2',
      number: 2,
      summary: 'Added highlights',
      content: '# Release notes\n\n- Faster builds',
    },
  ],
};

export default defineExamples('odd-artifact', {
  default: {
    label: 'Preview',
    props: { artifact },
    recommended: true,
    guidance: 'The artifact keeps its identity across revisions; choose a revision to compare.',
  },
  source: {
    label: 'Source',
    props: { artifact, mode: 'source' },
  },
  codeMode: {
    label: 'Unsupported mode',
    props: { artifact },
    attributes: { mode: 'code' },
    incorrect: {
      explanation:
        '`mode` accepts preview or source. Other values are reported and the preview is shown; use `source` for the raw content.',
      diagnostic: 'usage.attribute.value',
      correct: 'source',
    },
  },
});
