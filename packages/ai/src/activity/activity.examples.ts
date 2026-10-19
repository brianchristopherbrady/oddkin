import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './activity.js';

const attempt = {
  attemptId: 'at1',
  runId: 'run1',
  conversationId: 'c1',
  messageId: 'm2',
  promptId: 'm1',
  relation: 'new',
  connection: 'open',
  stop: 'none',
} as const;

export default defineExamples('odd-activity', {
  default: {
    label: 'Streaming, can stop',
    props: {
      attempt: { ...attempt, status: 'streaming' },
      capabilities: { stop: { available: true } },
    },
    recommended: true,
    guidance: 'Status is text, so it is announced and readable without colour.',
  },
  interrupted: {
    label: 'Connection lost',
    props: {
      attempt: { ...attempt, status: 'streaming', connection: 'disconnected' },
      capabilities: { reconnect: { available: true } },
    },
  },
});
