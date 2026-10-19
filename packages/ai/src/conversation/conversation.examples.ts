import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './conversation.js';

export default defineExamples('odd-conversation', {
  default: {
    label: 'Conversation',
    props: {
      label: 'Assistant',
      state: {
        conversationId: 'c1',
        revision: 1,
        messages: [
          {
            id: 'm1',
            role: 'user',
            parts: [{ type: 'text', id: 't1', text: 'Summarize the release notes.' }],
          },
          {
            id: 'm2',
            role: 'assistant',
            parentId: 'm1',
            parts: [
              {
                type: 'text',
                id: 't2',
                text: 'Builds are faster and the side navigation gained project kinds.',
              },
            ],
          },
        ],
        tools: {},
        approvals: {},
        artifacts: {},
        attempts: {},
        branches: {},
        capabilities: { send: { available: true } },
        history: 'complete',
        hasMoreHistory: false,
        feedback: {},
      },
    },
    slots: { composer: 'Composer goes here', status: 'Connected' },
    recommended: true,
    guidance: 'Give it a source (or a state snapshot); it never fetches or sends by itself.',
  },
  empty: {
    label: 'Empty',
    props: {
      label: 'Assistant',
      state: {
        conversationId: 'c2',
        revision: 1,
        messages: [],
        tools: {},
        approvals: {},
        artifacts: {},
        attempts: {},
        branches: {},
        capabilities: {},
        history: 'complete',
        hasMoreHistory: false,
        feedback: {},
      },
    },
    slots: { empty: 'Ask a question to start.' },
  },
});
