import { defineExamples, type ExampleFixtureContext } from '@oddkin/workbench/examples';
import type { AttemptRecord } from '../contracts/types.js';
import type { OddkinActivity } from './activity.js';

const attempt = {
  attemptId: 'at1',
  runId: 'run1',
  conversationId: 'c1',
  messageId: 'm2',
  promptId: 'm1',
  relation: 'new',
  connection: 'open',
  stop: 'none',
} as const;
const capabilities = {
  stop: { available: true },
  resume: { available: true },
  retry: { available: true },
};

/**
 * The host both examples share. Stop, Resume, and Retry only ask; the host changes the attempt:
 * a stop is confirmed a moment later, a resumed stream reconnects, and a retry starts a new
 * attempt that streams again.
 */
function host({ scope, element }: ExampleFixtureContext<OddkinActivity>): void {
  let attempts = 1;
  const change = (next: Partial<AttemptRecord>) => {
    if (element.attempt) element.attempt = { ...element.attempt, ...next };
  };
  scope.listen<GlobalEventHandlersEventMap['odd-prompt-stop']>(element, 'odd-prompt-stop', () => {
    change({ stop: 'requested' });
    scope.timeout(
      () => change({ status: 'cancelled', stop: 'confirmed', connection: 'closed' }),
      600,
    );
  });
  scope.listen<GlobalEventHandlersEventMap['odd-attempt-resume']>(
    element,
    'odd-attempt-resume',
    () => {
      change({ connection: 'reconnecting' });
      scope.timeout(() => change({ connection: 'open' }), 600);
    },
  );
  scope.listen<GlobalEventHandlersEventMap['odd-attempt-retry']>(
    element,
    'odd-attempt-retry',
    ({ detail }) => {
      element.attempt = {
        ...attempt,
        attemptId: `at${++attempts}`,
        relation: 'retry',
        parentAttemptId: detail.attemptId,
        status: 'submitted',
        connection: 'connecting',
      };
      scope.timeout(() => change({ status: 'streaming', connection: 'open' }), 600);
    },
  );
}

export default defineExamples('odd-activity', {
  default: {
    label: 'Streaming, can stop',
    props: {
      attempt: { ...attempt, status: 'streaming' },
      capabilities,
    },
    recommended: true,
    guidance:
      'Status is text, so it is announced and readable without colour. Stop, Resume, and Retry only ask (`odd-prompt-stop`, `odd-attempt-resume`, `odd-attempt-retry`); here the host confirms a stop a moment later, and Retry starts a new attempt.',
    fixture: host,
  },
  interrupted: {
    label: 'Connection lost',
    props: {
      attempt: { ...attempt, status: 'streaming', connection: 'disconnected' },
      capabilities,
    },
    fixture: host,
  },
});
