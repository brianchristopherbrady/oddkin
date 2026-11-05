import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './checkpoint.js';

export default defineExamples('odd-checkpoint', {
  default: {
    label: 'Available checkpoint',
    props: {
      checkpoint: {
        checkpointId: 'c1',
        label: 'Before the rewrite',
        description: 'The document and its open proposals as they were at 09:30.',
        restores: ['Document text', 'Open proposals'],
        status: 'available',
      },
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
        checkpointId: 'c2',
        label: 'Before the rewrite',
        description: 'The document and its open proposals as they were at 09:30.',
        restores: ['Document text', 'Open proposals'],
        status: 'restored',
        outcome: 'Restored the document to 09:30.',
      },
    },
  },
  failed: {
    label: 'Restore failed',
    props: {
      checkpoint: {
        checkpointId: 'c3',
        label: 'Before the rewrite',
        description: 'The document and its open proposals as they were at 09:30.',
        restores: ['Document text', 'Open proposals'],
        status: 'restore-failed',
        error: { code: 'checkpoint.conflict', message: 'The document is open in another tab.' },
      },
      capabilities: { restoreCheckpoint: { available: true } },
    },
    guidance: 'The host could not restore: the element says why, and Restore… can be tried again.',
  },
  unavailable: {
    label: 'Cannot be restored',
    props: {
      checkpoint: {
        checkpointId: 'c4',
        label: 'Before the import',
        description: 'The workspace as it was before the import.',
        restores: ['Imported files'],
        createdAt: '2026-11-05T08:00:00Z',
        status: 'unavailable',
      },
    },
  },
});
