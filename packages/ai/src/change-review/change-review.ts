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
  dismiss: 'Dismiss',
  undo: 'Undo',
  /** @deprecated Unused: a proposal awaiting review shows no status. Removed at the next major release. */
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
 * A run of word changes that only whitespace separates, as one deletion followed by one insertion,
 * so the old phrase reads whole, then the new one.
 */
function mergeRuns(diff: readonly DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (let i = 0; i < diff.length;) {
    const first = diff[i]!;
    if (first.kind === 'equal') {
      out.push(first);
      i++;
      continue;
    }
    // The run: changes, and the whitespace between two of them.
    let end = i;
    while (
      end < diff.length &&
      (diff[end]!.kind !== 'equal' ||
        (/^\s+$/u.test(diff[end]!.text) &&
          end + 1 < diff.length &&
          diff[end + 1]!.kind !== 'equal'))
    )
      end++;
    const run = diff.slice(i, end);
    const removed = run.filter((s) => s.kind !== 'insert');
    const added = run.filter((s) => s.kind !== 'delete');
    if (removed.length < run.length && added.length < run.length) {
      out.push({ kind: 'delete', text: removed.map((s) => s.text).join('') });
      out.push({ kind: 'insert', text: added.map((s) => s.text).join('') });
    } else out.push(...run);
    i = end;
  }
  return out;
}

/**
 * Review proposed edits as before/after or inline word or line diffs; accept, reject, or undo
 * each one. Every action is a request; statuses (applied, stale, undone) come from the records,
 * which only apply to the revision they were proposed for. A host that applies asynchronously
 * sets `accept-pending` or `undo-pending` while it works ("Applying…", "Undoing…");
 * `DocumentSession` applies at once. A proposal's `context` shows muted around its change; Undo
 * is offered on an applied proposal unless its `undoable` is `false`. An out-of-date proposal
 * offers Dismiss, which sends `odd-change-reject`.
 *
 * @csspart list - Proposals.
 * @csspart proposal - One proposal.
 * @csspart label - A proposal's label.
 * @csspart diff - Diff view.
 * @csspart status - A proposal's status ("Applied", "Out of date: …"); none while it awaits review.
 * @csspart actions - A proposal's Accept, Reject or Dismiss, and Undo.
 * @a11y Deletions and insertions use `<del>`/`<ins>` with visually hidden "deleted"/"inserted" text, so meaning does not rely on colour or strikethrough. Each proposal is a list item holding a group named by its label (without one, by the start of its new text), so its actions are announced with it.
 * @keyboard Tab through proposals' actions; Enter or Space activates.
 * @useFor Reviewing AI-proposed edits to text or code before they change the document.
 * @notFor Version-control diffs of whole files.
 * @customization 1 2
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
  announce: prop.enum(['none', 'important'], {
    default: 'none',
    empty: 'important',
    description: 'Announce outcomes (when no surrounding surface does).',
  }),
  strings: prop.object<Partial<typeof CHANGE_REVIEW_STRINGS>>({
    description: 'Localized string overrides; `proposed` is unused (deprecated).',
  }),
}) {
  static override events = {
    'odd-change-accept': changeAcceptEvent,
    'odd-change-reject': changeRejectEvent,
    'odd-change-undo': changeUndoEvent,
    'odd-announce': announceEvent,
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
    const diff =
      this.granularity === 'lines'
        ? diffLines(proposal.original, proposal.replacement)
        : mergeRuns(diffWords(proposal.original, proposal.replacement));
    this.#diffs.set(proposal, { granularity: this.granularity, diff });
    return diff;
  }

  /** @internal The status text; none while a proposal awaits review. */
  _status(status: ProposalStatus, message?: string): string {
    const t = this._strings;
    if (status === 'proposed') return '';
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
    if (action === 'undo' && proposal.status === 'applied' && proposal.undoable !== false)
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
        if (this.announce !== 'none') {
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
