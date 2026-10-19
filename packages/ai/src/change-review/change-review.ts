import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import type { Scope } from '@oddkin/core/scope';
import { diffLines, diffWords, type DiffSegment } from '../controllers/diff.js';
import type { EditProposal, ProposalStatus } from '../controllers/document.js';
import { announceEvent, changeAcceptEvent, changeRejectEvent, changeUndoEvent } from '../events.js';
import { FocusRecovery } from '@oddkin/core/controllers/focus';
import { format, strings } from '../internal/strings.js';

export const CHANGE_REVIEW_STRINGS = {
  label: 'Proposed changes',
  empty: 'No proposed changes.',
  before: 'Before',
  after: 'After',
  deleted: 'deleted',
  inserted: 'inserted',
  accept: 'Accept',
  reject: 'Reject',
  undo: 'Undo',
  proposed: 'Proposed',
  'accept-pending': 'Applying…',
  applied: 'Applied',
  rejected: 'Rejected',
  stale: 'Out of date: the text changed after this suggestion was made, so it cannot be applied.',
  'undo-pending': 'Undoing…',
  undone: 'Undone',
  failed: 'Could not apply: {message}',
  announceApplied: 'Change applied.',
  announceStale: 'A suggestion is out of date and was not applied.',
  announceUndone: 'Change undone.',
};

/**
 * Review proposed edits as before/after or inline word or line diffs; accept, reject, or undo
 * each one. Every action is a request; statuses (applied, stale, undone) come from the records,
 * which only apply to the revision they were proposed for.
 *
 * @csspart list - Proposals.
 * @csspart proposal - One proposal.
 * @csspart diff - Diff view.
 * @a11y Deletions and insertions use `<del>`/`<ins>` with visually hidden "deleted"/"inserted" text, so meaning does not rely on colour or strikethrough. Each proposal is a labelled group.
 * @keyboard Tab through proposals' actions; Enter or Space activates.
 * @useFor Reviewing AI-proposed edits to text or code before they change the document.
 * @notFor Version-control diffs of whole files.
 * @category AI
 */
export class OddkinChangeReview extends OddkinElement.with({
  proposals: prop.array<EditProposal>({
    description: 'Proposal records (host-owned; e.g. from `DocumentSession`).',
  }),
  view: prop.enum(['inline', 'split'], {
    default: 'inline',
    reflect: true,
    description: 'Inline diff or side-by-side before/after.',
  }),
  granularity: prop.enum(['words', 'lines'], {
    default: 'words',
    description: 'Diff by words (prose) or lines (code).',
  }),
  announce: prop.boolean({ description: 'Announce outcomes (when no surrounding surface does).' }),
  strings: prop.object<Partial<typeof CHANGE_REVIEW_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'change-accept': changeAcceptEvent,
    'change-reject': changeRejectEvent,
    'change-undo': changeUndoEvent,
    'ai-announce': announceEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinChangeReview>;

  readonly #diffs = new WeakMap<
    EditProposal,
    { granularity: string; diff: readonly DiffSegment[] }
  >();

  /** @internal */
  get _strings(): typeof CHANGE_REVIEW_STRINGS {
    return strings(CHANGE_REVIEW_STRINGS, this.strings);
  }

  /** @internal Diff per proposal record (cached by record identity and granularity). */
  _diff(proposal: EditProposal): readonly DiffSegment[] {
    const cached = this.#diffs.get(proposal);
    if (cached?.granularity === this.granularity) return cached.diff;
    const diff = (this.granularity === 'lines' ? diffLines : diffWords)(
      proposal.original,
      proposal.replacement,
    );
    this.#diffs.set(proposal, { granularity: this.granularity, diff });
    return diff;
  }

  /** @internal */
  _status(status: ProposalStatus, message?: string): string {
    const t = this._strings;
    return status === 'failed' ? format(t.failed, { message: message ?? '' }) : t[status];
  }

  /** @internal */
  readonly _act = (event: Event): void => {
    const el = event.currentTarget as HTMLElement;
    const proposalId = el.dataset['id'] as string;
    const action = el.dataset['action'];
    const proposal = this.proposals.find((p) => p.proposalId === proposalId);
    if (!proposal) return;
    if (action === 'accept' && proposal.status === 'proposed')
      this.emit(changeAcceptEvent, { proposalId });
    if (action === 'reject' && (proposal.status === 'proposed' || proposal.status === 'stale'))
      this.emit(changeRejectEvent, { proposalId });
    if (action === 'undo' && proposal.status === 'applied')
      this.emit(changeUndoEvent, { proposalId });
    // The activated button may be replaced (Accept → Undo); keep focus on this proposal.
    const state = el.closest('li')?.querySelector<HTMLElement>('.state');
    void this.updateComplete.then(() => {
      if (!el.isConnected && state?.isConnected) {
        state.tabIndex = -1;
        state.focus({ preventScroll: true });
      }
    });
  };

  protected override mounted(scope: Scope): void {
    scope.use(
      new FocusRecovery({
        root: () => this.shadowRoot,
        fallback: () => this.shadowRoot?.querySelector<HTMLElement>('[part="list"]'),
      }),
    );
    let previous = new Map<string, ProposalStatus>();
    scope.effect(
      () => {
        const next = new Map(this.proposals.map((p) => [p.proposalId, p.status]));
        if (this.announce) {
          const t = this._strings;
          for (const [id, status] of next) {
            const before = previous.get(id);
            if (!before || before === status) continue;
            const text =
              status === 'applied'
                ? t.announceApplied
                : status === 'stale'
                  ? t.announceStale
                  : status === 'undone'
                    ? t.announceUndone
                    : undefined;
            if (text)
              this.emit(announceEvent, { text, priority: 'polite', key: `change:${id}:${status}` });
          }
        }
        previous = next;
      },
      { phase: 'post', name: '<odd-change-review> status' },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-change-review': OddkinChangeReview;
  }
}
