import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { can, unavailableReason } from '../contracts/normalize.js';
import type { ApprovalRecord, ApprovalStatus, Capabilities } from '../contracts/types.js';
import { announceEvent, approvalDecideEvent, approvalEditEvent } from '../events.js';
import { DecisionController } from '../internal/decision.js';
import { format, formatTime, langOf, strings } from '../internal/strings.js';

export const APPROVAL_STRINGS = {
  approve: 'Approve',
  reject: 'Reject',
  edit: 'Edit',
  reason: 'Reason (optional)',
  target: 'Affects',
  changes: 'Proposed changes',
  before: 'Before',
  after: 'After',
  risk: 'Risk: {risk}',
  low: 'low',
  medium: 'medium',
  high: 'high',
  expires: 'Expires {time}',
  requested: 'Waiting for your decision',
  'decision-pending': 'Submitting your decision…',
  approved: 'Approved. The action runs separately; its result appears with the action.',
  rejected: 'Rejected. The action will not run.',
  expired: 'This request expired before a decision was recorded.',
  superseded: 'This proposal changed. Review the new version before deciding.',
  'decision-failed': 'Your decision was not recorded: {message}',
  unavailable: 'Decisions are not available here.',
  announceRequested: 'Approval needed: {title}',
  announceApproved: 'Approved: {title}',
  announceRejected: 'Rejected: {title}',
  announceExpired: 'Approval expired: {title}',
  announceFailed: 'Decision not recorded: {title}',
};

/**
 * Review an action, its target, and its changes, then approve or reject it. The decision is a
 * request: the element shows it as pending until the authoritative record changes, refuses
 * repeated activation for the same revision, and never presents approval as success of the
 * action.
 *
 * @csspart base - The approval surface.
 * @csspart changes - Before/after list.
 * @csspart actions - Decision controls.
 * @a11y A labelled group. Decision buttons are native buttons; while a decision is pending they are disabled and the status text explains why. Before/after values carry visually hidden "Before"/"After" labels.
 * @keyboard Tab to the controls; Enter or Space decides.
 * @useFor Human approval of agent actions (tool calls, writes, purchases).
 * @notFor Confirming the user's own direct actions; use a dialog.
 * @limitation Authorization and execution are enforced by the host; this element only collects intent.
 * @customization 1 2
 * @category AI
 */
export class OddkinActionApproval extends OddkinElement.with({
  approval: prop.object<ApprovalRecord>({
    description: 'The approval record (replace to update; never mutate).',
  }),
  capabilities: prop.object<Capabilities>({
    description: '`respondToApproval` and `editApproval` decide which controls are enabled.',
  }),
  announce: prop.enum(['none', 'important'], {
    default: 'none',
    empty: 'important',
    description: 'Announce status changes (only when no surrounding surface announces them).',
  }),
  strings: prop.object<Partial<typeof APPROVAL_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'odd-approval-decide': approvalDecideEvent,
    'odd-approval-edit': approvalEditEvent,
    'odd-announce': announceEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinActionApproval>;

  /** @internal The decision requested from this view, until the record changes; focus recovery. */
  readonly _decisions = new DecisionController(this, () =>
    this.shadowRoot?.querySelector<HTMLElement>('.state'),
  );
  /** @internal Local draft of the rejection reason. */
  readonly _reason = signal('');

  /** @internal */
  get _strings(): typeof APPROVAL_STRINGS {
    return strings(APPROVAL_STRINGS, this.strings);
  }

  /** @internal The guard's key: an approval and its revision. */
  _key(approval: ApprovalRecord): string {
    return `${approval.approvalId}:${approval.revision}`;
  }

  /** @internal Whether a decision can be requested now, and why not otherwise. */
  get _blocked(): string | undefined {
    const approval = this.approval;
    if (!approval) return this._strings.unavailable;
    if (!can(this.capabilities, 'respondToApproval'))
      return unavailableReason(this.capabilities, 'respondToApproval') ?? this._strings.unavailable;
    if (approval.status !== 'requested' && approval.status !== 'decision-failed') return '';
    if (this._decisions.asked(this._key(approval))) return '';
    return undefined;
  }

  /** @internal */
  readonly _decide = (decision: 'approve' | 'reject'): void => {
    const approval = this.approval;
    if (!approval || this._blocked !== undefined) return;
    this._decisions.request(this._key(approval), decision);
    this.emit(approvalDecideEvent, {
      approvalId: approval.approvalId,
      revision: approval.revision,
      toolCallId: approval.toolCallId,
      decision,
      reason: this._reason.peek() || undefined,
    });
  };
  /** @internal */
  readonly _approve = (): void => this._decide('approve');
  /** @internal */
  readonly _reject = (): void => this._decide('reject');
  /** @internal */
  readonly _edit = (): void => {
    const approval = this.approval;
    if (approval)
      this.emit(approvalEditEvent, {
        approvalId: approval.approvalId,
        revision: approval.revision,
      });
  };
  /** @internal */
  readonly _onReason = (event: Event): void => {
    this._reason.value = (event.target as HTMLTextAreaElement).value;
  };

  /** @internal */
  _expires(): string | undefined {
    const time = formatTime(this.approval?.expiresAt, langOf(this));
    return time ? format(this._strings.expires, { time }) : undefined;
  }

  protected override mounted(scope: Scope): void {
    scope.use(this._decisions);
    let seen: { key: string; status: ApprovalStatus } | undefined;
    scope.effect(
      () => {
        const approval = this.approval;
        if (!approval) return;
        const key = this._key(approval);
        // A different proposal (or a failed decision) releases the local duplicate guard.
        this._decisions.settle(key, approval.status === 'decision-failed');
        const changed = !seen || seen.key !== key || seen.status !== approval.status;
        const announceNew = !seen ? approval.status === 'requested' : changed;
        seen = { key, status: approval.status };
        if (this.announce === 'none' || !announceNew) return;
        const t = this._strings;
        const text =
          approval.status === 'requested'
            ? t.announceRequested
            : approval.status === 'approved'
              ? t.announceApproved
              : approval.status === 'rejected'
                ? t.announceRejected
                : approval.status === 'expired'
                  ? t.announceExpired
                  : approval.status === 'decision-failed'
                    ? t.announceFailed
                    : undefined;
        if (text)
          this.emit(announceEvent, {
            text: format(text, { title: approval.title }),
            priority: 'polite',
            key: `approval:${key}:${approval.status}`,
          });
      },
      { phase: 'post', name: '<odd-action-approval> status' },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-action-approval': OddkinActionApproval;
  }
}
