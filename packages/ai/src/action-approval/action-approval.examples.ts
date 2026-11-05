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
    guidance:
      'Approve or Reject sends a request; the host records the decision and passes back the record, and only then the element shows it. Approving never means the action succeeded; that is reported separately.',
    // The host: records a decision made on the current revision of the approval.
    fixture({ scope, element }) {
      scope.listen<GlobalEventHandlersEventMap['odd-approval-decide']>(
        element,
        'odd-approval-decide',
        ({ detail }) => {
          const approval = element.approval;
          if (!approval || approval.revision !== detail.revision) return;
          element.approval = {
            ...approval,
            status: detail.decision === 'approve' ? 'approved' : 'rejected',
            decision: detail.decision,
            ...(detail.reason ? { reason: detail.reason } : {}),
          };
        },
      );
    },
  },
});
