import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './tool-call.js';

export default defineExamples('odd-tool-call', {
  default: {
    label: 'Finished with a result',
    props: {
      tool: {
        toolCallId: 't1',
        toolName: 'search',
        title: 'Web search',
        purpose: 'Find current browser support data.',
        status: 'output-available',
        input: { q: 'container queries support' },
        output: { results: 3 },
      },
    },
    recommended: true,
  },
  ready: {
    label: 'Arguments ready, not run',
    props: {
      tool: {
        toolCallId: 't2',
        toolName: 'search',
        title: 'Web search',
        status: 'input-available',
        input: { q: 'weather' },
      },
    },
    guidance: 'Finished arguments are not a result: the call has not run yet.',
  },
  failed: {
    label: 'Failed, retryable',
    props: {
      tool: {
        toolCallId: 't3',
        toolName: 'search',
        status: 'output-error',
        error: { code: 'timeout', message: 'The search timed out.' },
        retryable: true,
      },
      capabilities: { retry: { available: true } },
    },
  },
});
