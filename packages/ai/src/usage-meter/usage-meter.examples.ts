import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './usage-meter.js';

export default defineExamples('odd-usage-meter', {
  default: {
    label: 'Usage with a limit',
    props: {
      usage: [
        {
          kind: 'context',
          label: 'Context window',
          used: 48_000,
          limit: 128_000,
          unit: 'tokens',
          precision: 'measured',
        },
        {
          kind: 'output-tokens',
          label: 'Output',
          used: 1_200,
          unit: 'tokens',
          precision: 'estimated',
        },
        { kind: 'cost', label: 'Cost', precision: 'unknown' },
      ],
    },
    recommended: true,
    guidance: 'Measured, estimated, and unknown values are shown as the host supplied them.',
  },
});
