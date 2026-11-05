import { defineExamples, type ExampleFixtureContext } from '@oddkin/workbench/examples';
import type {} from './action-approval.js';

// The host: records a decision made on the current revision of the approval.
const recordDecisions = ({
  scope,
  element,
}: ExampleFixtureContext<HTMLElementTagNameMap['odd-action-approval']>) => {
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
};

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
    fixture: recordDecisions,
  },
  edit: {
    label: 'Edit before deciding',
    props: {
      approval: {
        approvalId: 'ap2',
        revision: 1,
        title: 'Send email',
        summary: 'Sends the release notes to the team.',
        target: 'team@example.com',
        changes: [{ label: 'Subject', before: 'Draft', after: 'Release 2.0' }],
        risk: 'medium',
        status: 'requested',
      },
      capabilities: { respondToApproval: { available: true }, editApproval: { available: true } },
    },
    guidance:
      'Edit asks the host to let the user change the proposal (`odd-approval-edit`). The host passes back its next revision, here with a new subject, and a decision then applies to that revision.',
    // The host: records decisions, and on Edit passes back the next revision of the proposal.
    fixture(context) {
      recordDecisions(context);
      const { scope, element } = context;
      scope.listen<GlobalEventHandlersEventMap['odd-approval-edit']>(
        element,
        'odd-approval-edit',
        ({ detail }) => {
          const approval = element.approval;
          if (!approval || approval.revision !== detail.revision) return;
          element.approval = {
            ...approval,
            revision: approval.revision + 1,
            changes: [{ label: 'Subject', before: 'Draft', after: 'Release 2.0 notes' }],
          };
        },
      );
    },
  },
  failed: {
    label: 'Decision not recorded',
    props: {
      approval: {
        approvalId: 'ap3',
        revision: 1,
        title: 'Send email',
        target: 'team@example.com',
        risk: 'medium',
        status: 'decision-failed',
        decision: 'approve',
        error: { code: 'approval.unreachable', message: 'The approval service did not answer.' },
      },
      capabilities: { respondToApproval: { available: true } },
    },
    guidance:
      'The host could not record the decision: the element says why and offers the decision again.',
  },
  expired: {
    label: 'Expired',
    props: {
      approval: {
        approvalId: 'ap4',
        revision: 1,
        title: 'Send email',
        target: 'team@example.com',
        status: 'expired',
      },
    },
  },
  superseded: {
    label: 'Replaced by a new proposal',
    props: {
      approval: {
        approvalId: 'ap5',
        revision: 1,
        title: 'Send email',
        target: 'team@example.com',
        status: 'superseded',
      },
    },
    guidance: 'The agent changed its proposal; the host shows the new revision for a decision.',
  },
});
