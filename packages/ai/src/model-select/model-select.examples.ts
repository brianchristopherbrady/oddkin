import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './model-select.js';

export default defineExamples('odd-model-select', {
  default: {
    label: 'Model choice',
    props: {
      models: [
        {
          id: 'fast',
          label: 'Fast',
          description: 'Quick answers for short tasks.',
          available: true,
        },
        {
          id: 'deep',
          label: 'Thorough',
          description: 'Slower, for long documents.',
          available: true,
        },
        {
          id: 'vision',
          label: 'Vision',
          available: false,
          reason: 'Not enabled for this workspace.',
        },
      ],
      value: 'fast',
    },
    recommended: true,
    guidance: 'A user change is cancelable; setting `value` from code is silent.',
  },
});
