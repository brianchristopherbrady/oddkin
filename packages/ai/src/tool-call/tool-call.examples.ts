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
    guidance:
      'Retry sends a request; the host runs the call again and passes back the record with its result.',
    // The host: runs the call again, this time with a result.
    fixture({ scope, element }) {
      scope.listen(element, 'odd-tool-retry', () => {
        element.tool = {
          toolCallId: 't3',
          toolName: 'search',
          status: 'output-available',
          output: { results: 3 },
        };
      });
    },
  },
  approval: {
    label: 'Waiting for approval',
    props: {
      tool: {
        toolCallId: 't4',
        toolName: 'send_email',
        title: 'Send email',
        purpose: 'Share the release notes.',
        status: 'input-available',
        input: { to: 'team@example.com', subject: 'Release 2.0' },
        approvalId: 'ap1',
      },
      approval: {
        approvalId: 'ap1',
        toolCallId: 't4',
        revision: 1,
        title: 'Send the release notes',
        target: 'team@example.com',
        risk: 'medium',
        status: 'requested',
      },
      capabilities: { respondToApproval: { available: true } },
    },
    guidance:
      'A call that needs approval links it and shows it after the call; until the call runs, the approval words its status. The decision is a request: the host records it, then runs the call (Running…, then Finished) or reports it denied (Not run: denied).',
    // The host: records the decision, then runs the call, or does not.
    fixture({ scope, element }) {
      scope.listen<GlobalEventHandlersEventMap['odd-approval-decide']>(
        element,
        'odd-approval-decide',
        ({ detail }) => {
          const { approval, tool } = element;
          if (!approval || !tool || approval.revision !== detail.revision) return;
          const approved = detail.decision === 'approve';
          element.approval = {
            ...approval,
            status: approved ? 'approved' : 'rejected',
            decision: detail.decision,
          };
          element.tool = { ...tool, status: approved ? 'executing' : 'denied' };
          if (approved)
            scope.timeout(() => {
              element.tool = { ...tool, status: 'output-available', output: { sent: 1 } };
            }, 600);
        },
      );
    },
  },
  streaming: {
    label: 'Preparing arguments',
    props: {
      tool: {
        toolCallId: 't5',
        toolName: 'search',
        title: 'Web search',
        status: 'input-streaming',
        inputText: '{"q": "container que',
      },
    },
    guidance: 'Arguments stream in as the model writes them; partial text is shown as it is.',
  },
  cancelled: {
    label: 'Cancelled',
    props: {
      tool: {
        toolCallId: 't6',
        toolName: 'search',
        title: 'Web search',
        status: 'cancelled',
        input: { q: 'weather' },
      },
    },
  },
});
