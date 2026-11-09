import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { can, scopesValid, unavailableReason } from '../contracts/normalize.js';
import type { ApprovalRecord, ApprovalStatus, Capabilities } from '../contracts/types.js';
import { announceEvent, approvalDecideEvent, approvalEditEvent } from '../events.js';
import { DecisionController } from '../internal/decision.js';
import { format, strings } from '../internal/strings.js';

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
  scope: 'Approval covers',
  scopeNone: 'Applies to this action only.',
  scopeRequired: 'Choose what your approval covers.',
  scopeDefaulted: 'Selected by the app. You can change this.',
  scopeReset: 'This proposal changed. Choose the scope again.',
  scopeSelect: 'Choose scope',
  scopeSelectHelp: 'Select a scope to enable Approve.',
  scopeInvalid: 'Its choices are not valid; it cannot be approved.',
  scopeUnavailable: 'Approving with these choices is not available here.',
  requested: 'Waiting for your decision',
  submitting: 'Submitting your decision…',
  approved: 'Approved. The action runs separately; its result appears with the action.',
  rejected: 'Rejected. The action will not run.',
  expired: 'This request expired before a decision was recorded.',
  superseded: 'This proposal changed. Review the new version before deciding.',
  failed: 'Your decision was not recorded: {message}',
  cancelled: 'This request was withdrawn; there is nothing to decide.',
  unavailable: 'Decisions are not available here.',
  announceRequested: 'Approval needed: {title}',
  announceApproved: 'Approved: {title}',
  announceRejected: 'Rejected: {title}',
  announceExpired: 'Approval expired: {title}',
  announceFailed: 'Decision not recorded: {title}',
  announceCancelled: 'Approval withdrawn: {title}',
};

/**
 * Review an action, its target, and its changes, then approve or reject it. The decision is a
 * request: the element shows it as pending until the authoritative record changes, refuses
 * repeated activation for the same revision, and never presents approval as success of the
 * action.
 *
 * @csspart base - The approval surface.
 * @csspart changes - Before/after list.
 * @csspart scope - What an approval covers: the one scope explained, or a choice among several.
 * @csspart actions - Decision controls.
 * @a11y A labelled group. Decision buttons are `odd-button`s; while a decision is pending the chosen one shows it is loading, the others are disabled, and the pending line explains why. Before/after values carry visually hidden "Before"/"After" labels. Two to four scopes are native radio buttons in a fieldset whose legend says what they choose and whose hint says to choose; more are a labelled native select with the chosen scope's description below it. Nothing is chosen because it comes first, and Approve stays disabled until a scope is chosen; a valid host default is chosen and says so.
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
    this.shadowRoot?.querySelector<HTMLElement>('.outcome'),
  );
  /** @internal Local draft of the rejection reason. */
  readonly _reason = signal('');
  /** @internal The scope the person chose, for the revision it was chosen on. */
  readonly _scope = signal<{ key: string; id: string } | undefined>(undefined);

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
    if (approval.status !== 'requested' && approval.status !== 'failed') return '';
    if (this._decisions.asked(this._key(approval))) return '';
    return undefined;
  }

  /**
   * @internal The scope Approve sends: the person's choice for this revision, else the only scope,
   * else the host's valid default. Nothing is chosen because it comes first, and a new revision
   * drops the person's choice.
   */
  _scopeOf(approval: ApprovalRecord): string | undefined {
    const own = this._scope.value;
    const scopes = approval.scopes ?? [];
    return own?.key === this._key(approval)
      ? own.id
      : scopes.length === 1
        ? scopes[0]?.id
        : approval.defaultScopeId;
  }

  /** @internal Whether the host's valid default is the scope chosen, not the person. */
  _scopeDefaulted(approval: ApprovalRecord): boolean {
    return (
      (approval.scopes?.length ?? 0) > 1 &&
      approval.defaultScopeId !== undefined &&
      scopesValid(approval) &&
      this._scope.value?.key !== this._key(approval)
    );
  }

  /** @internal Whether a new revision of this approval dropped the person's choice, no default standing. */
  _scopeReset(approval: ApprovalRecord): boolean {
    const own = this._scope.value;
    return (
      approval.defaultScopeId === undefined &&
      own !== undefined &&
      own.key !== this._key(approval) &&
      own.key.startsWith(`${approval.approvalId}:`)
    );
  }

  /** @internal Why Approve cannot be requested now: as `_blocked`, or for want of a valid scope. */
  get _approveBlocked(): string | undefined {
    const blocked = this._blocked;
    const approval = this.approval;
    if (blocked !== undefined || !approval?.scopes?.length) return blocked;
    const t = this._strings;
    if (!scopesValid(approval)) return t.scopeInvalid;
    if (!can(this.capabilities, 'approvalScopes'))
      return unavailableReason(this.capabilities, 'approvalScopes') ?? t.scopeUnavailable;
    return this._scopeOf(approval) === undefined ? t.scopeRequired : undefined;
  }

  /** @internal */
  readonly _decide = (decision: 'approve' | 'reject'): void => {
    const approval = this.approval;
    if (!approval || (decision === 'approve' ? this._approveBlocked : this._blocked) !== undefined)
      return;
    this._decisions.request(this._key(approval), decision);
    this.emit(approvalDecideEvent, {
      approvalId: approval.approvalId,
      revision: approval.revision,
      decision,
      reason: this._reason.peek() || undefined,
      scope: decision === 'approve' ? this._scopeOf(approval) : undefined,
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
  readonly _onScope = (event: Event): void => {
    const approval = this.approval;
    if (approval)
      this._scope.value = {
        key: this._key(approval),
        id: (event.target as HTMLInputElement | HTMLSelectElement).value,
      };
  };

  protected override mounted(scope: Scope): void {
    scope.use(this._decisions);
    let seen: { key: string; status: ApprovalStatus } | undefined;
    scope.effect(
      () => {
        const approval = this.approval;
        if (!approval) return;
        const key = this._key(approval);
        // A different proposal (or a failed decision) releases the local duplicate guard.
        this._decisions.settle(key, approval.status === 'failed');
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
                  : approval.status === 'failed'
                    ? t.announceFailed
                    : approval.status === 'cancelled'
                      ? t.announceCancelled
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
