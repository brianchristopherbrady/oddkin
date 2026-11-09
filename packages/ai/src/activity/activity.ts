import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { listFormat, plural } from '@oddkin/core/i18n';
import { can } from '../contracts/normalize.js';
import type { AttemptRecord, Capabilities, ToolCallRecord } from '../contracts/types.js';
import { attemptResumeEvent, attemptRetryEvent, promptStopEvent } from '../events.js';
import { format, formatNumber, langOf, strings } from '../internal/strings.js';
import { isActive } from '../controllers/transitions.js';

export const ACTIVITY_STRINGS = {
  submitted: 'Sending…',
  accepted: 'Request accepted. Waiting for the response…',
  streaming: 'Responding…',
  tools: 'Running {count} tools: {names}',
  tool: 'Running {names}',
  'awaiting-input': 'Waiting for your input',
  sending: 'Sending your response…',
  continuing: 'Waiting for the assistant to continue…',
  approvals: '{count} approvals',
  approvalsOne: '{count} approval',
  questions: '{count} questions',
  questionsOne: '{count} question',
  needResponse: '{requests} need your response.',
  needResponseOne: '{requests} needs your response.',
  recorded: '{count} responses recorded.',
  recordedOne: '{count} response recorded.',
  stillNeed: '{count} requests still need your input.',
  stillNeedOne: '{count} request still needs your input.',
  sendingDetail: 'Your response is being recorded. No further action is needed yet.',
  continuingDetail: 'Responses recorded. The paused run has not resumed yet.',
  completed: 'Done',
  cancelled: 'Stopped',
  failed: 'Failed: {message}',
  interrupted: 'Connection ended before the response finished. The assistant may still be working.',
  disconnected: 'Disconnected. The response may still be generating.',
  reconnecting: 'Reconnecting…',
  stopping: 'Stopping… waiting for confirmation.',
  tooLate: 'The response finished before it could be stopped.',
  stopUnknown: 'Stop could not be confirmed. The response may still be running.',
  stop: 'Stop',
  resume: 'Resume',
  retry: 'Retry',
};

/**
 * Status of the current attempt, separating the work's state from the connection: running tools,
 * waiting for the person, stopping, disconnection, and interruption, with the recovery actions the
 * adapter actually supports (stop, resume, retry).
 *
 * @csspart base - The status bar.
 * @csspart actions - Stop, resume, and retry.
 * @a11y Plain text, not a live region; the surrounding announcer reports outcomes once. Actions are native buttons that only appear when available.
 * @keyboard Tab to the actions.
 * @useFor Run status under a conversation or agent panel.
 * @notFor Per-message status (messages show their own).
 * @customization 1 2
 * @category AI
 */
export class OddkinActivity extends OddkinElement.with({
  attempt: prop.object<AttemptRecord>({ description: 'The attempt to describe.' }),
  tools: prop.array<ToolCallRecord>({
    description: "The attempt's tool calls, to name the running ones.",
  }),
  capabilities: prop.object<Capabilities>({ description: 'Which recovery actions to offer.' }),
  strings: prop.object<Partial<typeof ACTIVITY_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'odd-prompt-stop': promptStopEvent,
    'odd-attempt-resume': attemptResumeEvent,
    'odd-attempt-retry': attemptRetryEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinActivity>;

  /** @internal */
  get _strings(): typeof ACTIVITY_STRINGS {
    return strings(ACTIVITY_STRINGS, this.strings);
  }

  /** @internal A stop, connection, or failure notice, which comes before the wait. */
  _notice(): string | undefined {
    const t = this._strings;
    const a = this.attempt;
    if (!a) return undefined;
    if (a.stop === 'requested') return t.stopping;
    if (a.stop === 'too-late') return t.tooLate;
    if ((a.stop === 'unknown' || a.stop === 'failed') && !(a.status === 'cancelled'))
      return t.stopUnknown;
    if (a.connection === 'reconnecting') return t.reconnecting;
    if (a.connection === 'disconnected' && isActive(a.status)) return t.disconnected;
    if (a.status === 'failed') return format(t.failed, { message: a.error?.message ?? '' });
    return undefined;
  }

  /**
   * @internal The attempt's wait as page 08's Waiting part: who acts next (the status badge) and
   * the counts. Requests for the person come first, then responses on their way.
   */
  _wait(): { status: string; label: string; detail: string } | undefined {
    const t = this._strings;
    const a = this.attempt;
    const wait =
      a && (a.status === 'streaming' || a.status === 'awaiting-input') ? a.wait : undefined;
    if (!wait || this._notice() !== undefined) return undefined;
    const lang = langOf(this);
    const count = (n: number, one: string, other: string) =>
      format(plural(n, { one, other }, lang), { count: formatNumber(n, lang) });
    const { action, submitting } = wait;
    if (action.length && submitting.length)
      return {
        status: 'needs-input',
        label: t['awaiting-input'],
        detail: `${count(submitting.length, t.recordedOne, t.recorded)} ${count(action.length, t.stillNeedOne, t.stillNeed)}`,
      };
    if (action.length) {
      const approvals = action.filter((r) => r.kind === 'approval').length;
      const questions = action.length - approvals;
      const requests = listFormat(lang).format([
        ...(approvals ? [count(approvals, t.approvalsOne, t.approvals)] : []),
        ...(questions ? [count(questions, t.questionsOne, t.questions)] : []),
      ]);
      return {
        status: 'needs-input',
        label: t['awaiting-input'],
        detail: format(
          plural(action.length, { one: t.needResponseOne, other: t.needResponse }, lang),
          {
            requests,
          },
        ),
      };
    }
    if (submitting.length)
      return { status: 'submitting', label: t.sending, detail: t.sendingDetail };
    if (a!.status === 'awaiting-input')
      return { status: 'waiting', label: t.continuing, detail: t.continuingDetail };
    return undefined;
  }

  /** @internal The status line. */
  _text(): string {
    const t = this._strings;
    const a = this.attempt;
    if (!a) return '';
    const notice = this._notice();
    if (notice !== undefined) return notice;
    const wait = this._wait();
    if (wait) return wait.label;
    if (a.status === 'streaming') {
      const running = this.tools.filter(
        (tool) => tool.status === 'executing' || tool.status === 'input-streaming',
      );
      if (running.length)
        return format(running.length > 1 ? t.tools : t.tool, {
          count: running.length,
          names: running.map((tool) => tool.title ?? tool.toolName).join(', '),
        });
    }
    return t[a.status];
  }

  /** @internal */
  _actions(): { stop: boolean; resume: boolean; retry: boolean } {
    const a = this.attempt;
    const caps = this.capabilities;
    if (!a) return { stop: false, resume: false, retry: false };
    const lost = a.connection === 'disconnected' || a.status === 'interrupted';
    return {
      stop:
        can(caps, 'stop') &&
        (isActive(a.status) || a.status === 'interrupted') &&
        a.stop !== 'requested',
      resume:
        can(caps, 'resume') && lost && a.connection !== 'reconnecting' && a.status !== 'completed',
      retry:
        can(caps, 'retry') &&
        (a.status === 'failed' || a.status === 'interrupted' || a.status === 'cancelled'),
    };
  }

  /** @internal */
  readonly _act = (event: Event): void => {
    const button = event.currentTarget as HTMLElement;
    const action = button.dataset['action'];
    const a = this.attempt;
    if (!a) return;
    if (action === 'stop') this.emit(promptStopEvent, { attemptId: a.attemptId });
    if (action === 'resume') this.emit(attemptResumeEvent, { attemptId: a.attemptId });
    if (action === 'retry') this.emit(attemptRetryEvent, { attemptId: a.attemptId });
    // The activated action may no longer be offered (Stop while stopping): keep focus nearby.
    void this.updateComplete.then(() => {
      if (!button.isConnected && this.isConnected)
        this.shadowRoot?.querySelector<HTMLElement>('.text')?.focus({ preventScroll: true });
    });
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-activity': OddkinActivity;
  }
}
