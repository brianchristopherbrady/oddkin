import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './message-branch.js';

export default defineExamples('odd-message-branch', {
  default: {
    label: 'Second of three answers',
    props: {
      messageId: 'm2',
      branch: { index: 2, count: 3, previousId: 'm2a', nextId: 'm2c' },
      capabilities: { switchBranch: { available: true } },
    },
    recommended: true,
  },
});
