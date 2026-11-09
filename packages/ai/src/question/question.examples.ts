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
    guidance:
      'Answer or Skip sends a request for this revision of the question; the host passes back the record, answered or skipped.',
    // The host: records the answer, or the skip, for the current revision of the question.
    fixture({ scope, element }) {
      scope.listen<GlobalEventHandlersEventMap['odd-question-answer']>(
        element,
        'odd-question-answer',
        ({ detail }) => {
          const question = element.question;
          if (!question || question.revision !== detail.revision) return;
          element.question = { ...question, status: 'answered', answer: detail.answer };
        },
      );
      scope.listen<GlobalEventHandlersEventMap['odd-question-skip']>(
        element,
        'odd-question-skip',
        ({ detail }) => {
          const question = element.question;
          if (!question || question.revision !== detail.revision) return;
          element.question = { ...question, status: 'skipped' };
        },
      );
    },
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
  multiple: {
    label: 'Several choices',
    props: {
      question: {
        questionId: 'q3',
        revision: 1,
        prompt: 'Which formats should the export include?',
        kind: 'multi-choice',
        options: [
          { id: 'pdf', label: 'PDF' },
          { id: 'docx', label: 'Word' },
          { id: 'md', label: 'Markdown' },
        ],
        status: 'requested',
      },
    },
  },
  text: {
    label: 'Free text',
    props: {
      question: {
        questionId: 'q4',
        revision: 1,
        prompt: 'What should the summary emphasize?',
        kind: 'text',
        status: 'requested',
      },
    },
  },
  failed: {
    label: 'Answer not sent',
    props: {
      question: {
        questionId: 'q5',
        revision: 1,
        prompt: 'Which audience is this summary for?',
        kind: 'choice',
        options: [
          { id: 'exec', label: 'Executives' },
          { id: 'eng', label: 'Engineers' },
        ],
        status: 'failed',
        error: { code: 'question.offline', message: 'The assistant is offline.' },
      },
    },
    guidance:
      'The host could not deliver the answer: the element says why and lets the user answer again.',
  },
});
