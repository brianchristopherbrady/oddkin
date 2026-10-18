import { OddkinElement, prop } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { can, unavailableReason } from '../contracts/normalize.js';
import type { ApprovalRecord, ApprovalStatus, Capabilities } from '../contracts/types.js';
import { announceEvent, approvalDecideEvent, approvalEditEvent } from '../events.js';
import { FocusRecovery } from '@oddkin/core/controllers/focus';
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
 * @category AI
 */
export class OddkinActionApproval extends OddkinElement.with({
  approval: prop.object<ApprovalRecord>({
    description: 'The approval record (replace to update; never mutate).',
  }),
  capabilities: prop.object<Capabilities>({
    description: '`respondToApproval` and `editApproval` decide which controls are enabled.',
  }),
  announce: prop.boolean({
    description: 'Announce status changes (only when no surrounding surface announces them).',
  }),
  strings: prop.object<Partial<typeof APPROVAL_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'approval-decide': approvalDecideEvent,
    'approval-edit': approvalEditEvent,
    'ai-announce': announceEvent,
  };

  /** @internal `approvalId:revision:decision` requested from this view, until the record changes. */
  readonly _requested = signal<string | undefined>(undefined);
  /** @internal Local draft of the rejection reason. */
  readonly _reason = signal('');

  /** @internal */
  get _strings(): typeof APPROVAL_STRINGS {
    return strings(APPROVAL_STRINGS, this.strings);
  }

  /** @internal Whether a decision can be requested now, and why not otherwise. */
  get _blocked(): string | undefined {
    const approval = this.approval;
    if (!approval) return this._strings.unavailable;
    if (!can(this.capabilities, 'respondToApproval'))
      return unavailableReason(this.capabilities, 'respondToApproval') ?? this._strings.unavailable;
    if (approval.status !== 'requested' && approval.status !== 'decision-failed') return '';
    if (this._requested.value?.startsWith(`${approval.approvalId}:${approval.revision}:`))
      return '';
    return undefined;
  }

  /** @internal */
  readonly _decide = (decision: 'approve' | 'reject'): void => {
    const approval = this.approval;
    if (!approval || this._blocked !== undefined) return;
    this._requested.value = `${approval.approvalId}:${approval.revision}:${decision}`;
    this.emit(approvalDecideEvent, {
      approvalId: approval.approvalId,
      revision: approval.revision,
      toolCallId: approval.toolCallId,
      decision,
      reason: decision === 'reject' ? this._reason.peek() || undefined : undefined,
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
    scope.use(
      new FocusRecovery({
        root: () => this.shadowRoot,
        fallback: () => this.shadowRoot?.querySelector<HTMLElement>('.state'),
      }),
    );
    let seen: { key: string; status: ApprovalStatus } | undefined;
    scope.effect(
      () => {
        const approval = this.approval;
        if (!approval) return;
        const key = `${approval.approvalId}:${approval.revision}`;
        // A different proposal (or a failed decision) releases the local duplicate guard.
        const requested = this._requested.peek();
        if (
          requested &&
          (!requested.startsWith(`${key}:`) || approval.status === 'decision-failed')
        )
          this._requested.value = undefined;
        const changed = !seen || seen.key !== key || seen.status !== approval.status;
        const announceNew = !seen ? approval.status === 'requested' : changed;
        seen = { key, status: approval.status };
        if (!this.announce || !announceNew) return;
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
