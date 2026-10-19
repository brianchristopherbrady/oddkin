import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './suggestions.js';

export default defineExamples('odd-suggestions', {
  default: {
    label: 'Suggested prompts',
    props: {
      suggestions: [
        { id: 'summarize', label: 'Summarize', prompt: 'Summarize this page in three bullets.' },
        { id: 'risks', label: 'List risks', prompt: 'What are the main risks in this plan?' },
      ],
    },
    recommended: true,
    guidance:
      'Choosing a suggestion inserts it; the send button submits it. They are separate intents.',
  },
});
