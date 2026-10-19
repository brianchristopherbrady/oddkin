import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './action-approval.js';

export default defineExamples('odd-action-approval', {
  default: {
    label: 'Approval requested',
    props: {
      approval: {
        approvalId: 'ap1',
        revision: 1,
        title: 'Send email',
        summary: 'Sends the release notes to the team.',
        target: 'team@example.com',
        changes: [{ label: 'Subject', before: 'Draft', after: 'Release 2.0' }],
        risk: 'medium',
        status: 'requested',
      },
      capabilities: { respondToApproval: { available: true } },
    },
    recommended: true,
    guidance: 'Approving never means the action succeeded; that is reported separately.',
  },
});
