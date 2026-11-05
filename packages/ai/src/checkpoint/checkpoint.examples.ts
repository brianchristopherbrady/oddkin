import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './checkpoint.js';

const checkpoint = {
  checkpointId: 'c1',
  label: 'Before the rewrite',
  description: 'The document and its open proposals as they were at 09:30.',
  restores: ['Document text', 'Open proposals'],
} as const;

export default defineExamples('odd-checkpoint', {
  default: {
    label: 'Available checkpoint',
    props: {
      checkpoint: { ...checkpoint, restores: [...checkpoint.restores], status: 'available' },
      capabilities: { restoreCheckpoint: { available: true } },
    },
    recommended: true,
    guidance:
      'Restore… asks for confirmation, then sends a request; the host restores its state and passes back the record, and only then the element shows it restored.',
    // The host: restores, then reports the outcome on the record.
    fixture({ scope, element }) {
      scope.listen(element, 'odd-checkpoint-restore', () => {
        element.checkpoint = {
          ...element.checkpoint!,
          status: 'restored',
          outcome: 'Restored the document to 09:30.',
        };
      });
    },
  },
  restored: {
    label: 'Restored',
    props: {
      checkpoint: {
        ...checkpoint,
        restores: [...checkpoint.restores],
        status: 'restored',
        outcome: 'Restored the document to 09:30.',
      },
    },
  },
});
