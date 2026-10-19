import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './question.js';

export default defineExamples('odd-question', {
  default: {
    label: 'Choice',
    props: {
      question: {
        questionId: 'q1',
        revision: 1,
        prompt: 'Which audience is this summary for?',
        kind: 'choice',
        options: [
          { id: 'exec', label: 'Executives' },
          { id: 'eng', label: 'Engineers', description: 'Keeps technical detail.' },
        ],
        allowCustom: true,
        status: 'requested',
      },
    },
    recommended: true,
  },
  form: {
    label: 'Form',
    props: {
      question: {
        questionId: 'q2',
        revision: 1,
        prompt: 'Details for the meeting',
        kind: 'form',
        fields: [
          { id: 'title', label: 'Title', type: 'text', required: true },
          { id: 'length', label: 'Minutes', type: 'number' },
        ],
        status: 'requested',
      },
    },
  },
});
