import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './inline-assist.js';

const selection = { start: 4, end: 9, revision: 'v1', text: 'build' };
const actions = [
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'explain', label: 'Explain' },
  { id: 'summarize', label: 'Summarize' },
];

export default defineExamples('odd-inline-assist', {
  default: {
    label: 'Actions for a selection',
    props: { selection, documentRevision: 'v1', actions },
    recommended: true,
    guidance:
      'Requests carry the selection and its revision, so results can be checked against it.',
  },
  result: {
    label: 'Explanation ready',
    props: {
      selection,
      documentRevision: 'v1',
      actions,
      status: 'complete',
      result: 'A **build** turns sources into the files that ship.',
    },
  },
});
