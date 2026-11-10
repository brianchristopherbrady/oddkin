import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { can, scopesValid, unavailableReason } from '../contracts/normalize.js';
import type { ApprovalRecord, ApprovalStatus, Capabilities } from '../contracts/types.js';
import { diffLines, type DiffSegment } from '../controllers/diff.js';
import { announceEvent, approvalDecideEvent, approvalEditEvent } from '../events.js';
import { DecisionController } from '../internal/decision.js';
import { toggleOpened } from '../internal/diff-view.js';
import { format, strings } from '../internal/strings.js';

/** One of an approval's proposed changes. */
type ApprovalChange = NonNullable<ApprovalRecord['changes']>[number];

export const APPROVAL_STRINGS = {
  approve: 'Approve',
  reject: 'Reject',
  edit: 'Edit',
  reason: 'Reason (optional)',
  reasonPlaceholder: 'Add a reason',
  target: 'Affects',
  changes: 'Proposed changes',
  before: 'Before',
  after: 'After',
  deleted: 'deleted',
  inserted: 'inserted',
  empty: 'No proposed changes.',
  reviewLines: '{count} changed lines · Review changes',
  hideLines: 'Hide {count} changed lines',
  changedLines: '{count} changed lines',
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
  scopeApproved: 'Approved scope: {scope}',
  scopeActionOnly: 'This action only',
  scopeActionOnlyHelp: 'No additional actions are authorized.',
  scopeMissing: 'Scope details were not supplied.',
  scopeMissingHelp: 'The approved scope cannot be inferred from this view.',
  recordedReason: 'Reason: {reason}',
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
 * @csspart changes - The proposed changes: each one's label over its Before and After blocks.
 * @csspart scope - What an approval covers: the one scope explained, or a choice among several; once approved, what the host confirms.
 * @csspart actions - Decision controls.
 * @a11y A labelled group. Decision buttons are `odd-button`s; while a decision is pending the chosen one shows it is loading, the others are disabled, and the pending line explains why. Each change reads as a Before block then an After block, each labelled, whose deletions and insertions carry visually hidden "deleted"/"inserted" labels; an absent value has no block, and a change of more than ten lines waits behind an `odd-disclosure` that says how many. The risk and the expiry are badges with their text. Two to four scopes are native radio buttons in a fieldset whose legend says what they choose and whose hint says to choose; more are a labelled native select with the chosen scope's description below it. Nothing is chosen because it comes first, and Approve stays disabled until a scope is chosen; a valid host default is chosen and says so. The optional reason is a native textarea in an `odd-disclosure`, named by the label the disclosure's summary shows: collapsed while empty, open once written, and empty again for a new revision.
 * @keyboard Tab through a long change, the scope (arrow keys choose), and the reason to Approve, Reject, and Edit; Enter or Space activates the focused control, and Enter in the reason adds a line.
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
  /** @internal The person's reason, and whether they opened its field, for the revision it was written on. */
  readonly _reason = signal<{ key: string; text: string; open: boolean } | undefined>(undefined);
  /** @internal The scope the person chose, for the revision it was chosen on. */
  readonly _scope = signal<{ key: string; id: string } | undefined>(undefined);
  /** @internal The long changes the person opened: `<approvalId>:<revision>:<index>:lines`. */
  readonly _opened = signal<ReadonlySet<string>>(new Set());
  readonly #diffs = new WeakMap<ApprovalChange, readonly DiffSegment[]>();

  /** @internal A change's line diff (cached by change record): a Before block and an After block. */
  _diff(change: ApprovalChange): readonly DiffSegment[] {
    let diff = this.#diffs.get(change);
    if (!diff) this.#diffs.set(change, (diff = diffLines(change.before ?? '', change.after ?? '')));
    return diff;
  }

  /** @internal A long change was opened or closed. */
  readonly _onDiffToggle = (event: Event): void => {
    this._opened.value = toggleOpened(this._opened.peek(), event);
  };

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

  /** @internal The reason for this revision: a new revision starts empty, its field collapsed. */
  _reasonOf(approval: ApprovalRecord): { text: string; open: boolean } {
    const own = this._reason.value;
    return own?.key === this._key(approval) ? own : { text: '', open: false };
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
      reason: this._reasonOf(approval).text || undefined,
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
  /**
   * @internal The person wrote (the field stays open for this revision), or opened or closed the
   * field's disclosure.
   */
  readonly _onReason = (event: Event): void => {
    const approval = this.approval;
    const input = event.type === 'input';
    if (approval)
      this._reason.value = {
        key: this._key(approval),
        text: input ? (event.target as HTMLTextAreaElement).value : this._reasonOf(approval).text,
        open: input || (event as ToggleEvent).newState === 'open',
      };
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
