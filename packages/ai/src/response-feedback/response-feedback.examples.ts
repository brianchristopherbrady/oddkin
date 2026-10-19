import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './response-feedback.js';

export default defineExamples('odd-response-feedback', {
  default: {
    label: 'Rate a response',
    props: {
      messageId: 'm2',
      reasons: ['Inaccurate', 'Not helpful', 'Unsafe'],
    },
    recommended: true,
  },
  negative: {
    label: 'Negative rating with reasons',
    props: {
      messageId: 'm2',
      reasons: ['Inaccurate', 'Not helpful', 'Unsafe'],
      feedback: { messageId: 'm2', rating: 'negative', status: 'idle' },
    },
  },
});
