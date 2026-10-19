import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './task-plan.js';

export default defineExamples('odd-task-plan', {
  default: {
    label: 'Plan in progress',
    props: {
      plan: {
        planId: 'p1',
        title: 'Prepare the release',
        steps: [
          { id: 'a', title: 'Collect changes', status: 'done' },
          {
            id: 'b',
            title: 'Run checks',
            status: 'active',
            tasks: [
              { id: 'b1', title: 'Unit tests', status: 'done' },
              { id: 'b2', title: 'Browser tests', status: 'active' },
            ],
          },
          {
            id: 'c',
            title: 'Choose a version',
            status: 'needs-input',
            inputRequest: 'Major or minor?',
          },
          { id: 'd', title: 'Publish', status: 'blocked', blocker: 'Waiting for the version.' },
        ],
      },
    },
    recommended: true,
  },
});
