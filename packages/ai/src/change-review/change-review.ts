import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { DiffSegment } from '../controllers/diff.js';
import type { EditProposal } from '../controllers/document.js';
import { announceEvent, changeAcceptEvent, changeRejectEvent, changeUndoEvent } from '../events.js';
import { DecisionController } from '../internal/decision.js';
import { diffText, toggleOpened } from '../internal/diff-view.js';
import { strings } from '../internal/strings.js';

export const CHANGE_REVIEW_STRINGS = {
  label: 'Proposed changes',
  reviewRequested: 'Review requested',
  revision: 'Revision {revision} · proposal {proposal}',
  empty: 'No proposed changes.',
  before: 'Before',
  after: 'After',
  deleted: 'deleted',
  inserted: 'inserted',
  showContext: 'Show context',
  hideContext: 'Hide context',
  reviewLines: '{count} changed lines · Review changes',
  hideLines: 'Hide {count} changed lines',
  changedLines: '{count} changed lines',
  accept: 'Accept',
  reject: 'Reject',
  dismiss: 'Dismiss',
  undo: 'Undo',
  applying: 'Applying…',
  recording: 'Recording your response…',
  applied: 'Applied',
  rejected: 'Rejected',
  dismissed: 'Dismissed',
  stale: 'Out of date: the text changed after this suggestion was made, so it cannot be applied.',
  undoing: 'Undoing…',
  undone: 'Undone',
  failed: 'Could not apply: {message}',
  undoFailed: 'Undo failed: {message}',
  notRecorded: 'The request could not be recorded.',
  announceApplied: 'Change applied.',
  announceStale: 'A suggestion is out of date and was not applied.',
  announceUndone: 'Change undone.',
  announceFailed: 'A change could not be applied.',
  announceUndoFailed: 'A change could not be undone.',
};

/** A request from this view: the action, and the record it was asked at. */
interface Ask {
  readonly action: string;
  readonly record: EditProposal;
}

/**
 * Review proposed edits as before/after or inline word or line diffs; accept, reject, or undo
 * each one. Every action is a request; statuses (applied, stale, undone) come from the records,
 * which only apply to the revision they were proposed for. A host that applies asynchronously
 * sets `applying` or `undoing` while it works ("Applying…", "Undoing…");
 * `DocumentSession` applies at once. Figma page 11: under its title, "Review requested" while a
 * proposal awaits review; each proposal names the revision it was made for. A proposal's
 * `context` opens around its change from a disclosure ("Show context"), and a line diff that
 * changes more than ten lines waits behind its count ("12 changed lines · Review changes") and
 * scrolls in a region of its own when open; a proposal that changes nothing says so. Undo is
 * offered on an applied proposal unless its `undoable` is `false`. An out-of-date proposal offers
 * Dismiss, which sends `odd-change-reject`. A failed proposal names what failed ("Undo failed:
 * …" when the host had applied it, `appliedRevision`, or Undo was asked; otherwise "Could not
 * apply: …") and keeps that request's buttons, so trying again is the same Accept or Undo; there
 * is no other Retry (ADR 0049, "Pages 10 to 14").
 *
 * @csspart list - Proposals.
 * @csspart proposal - One proposal.
 * @csspart label - A proposal's label.
 * @csspart diff - Diff view.
 * @csspart status - A proposal's status ("Applying…", "Applied", "Out of date: …"); none while it awaits review.
 * @csspart actions - A proposal's Accept, Reject or Dismiss, and Undo.
 * @a11y Deletions and insertions use `<del>`/`<ins>` with visually hidden "deleted"/"inserted" text, so meaning does not rely on colour or strikethrough. A line diff, and either diff side by side, reads as a Before block then an After block, each labelled. The context and a long line diff open from `odd-disclosure`s, whose summaries say what they show; an open long diff is a named scroll region in the Tab order. The review is a group named by its title; each proposal is a list item holding a group named by its label (without one, by the start of its new text), so its actions are announced with it.
 * @keyboard Tab through proposals' actions; Enter or Space activates. Focus stays on the chosen button while its request is in flight, and after it failed, since the button stays; when the button goes, focus moves to its proposal's status, never to Undo.
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
    description: 'Localized string overrides.',
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
  /**
   * @internal Requests from this view, by proposal: the action and the record it was asked at. One
   * is in flight while its proposal keeps that status; asked after a failure, until the host
   * replaces the record (a request that failed again).
   */
  readonly _asked = signal<ReadonlyMap<string, Ask>>(new Map());
  /** Each proposal's last action from this view, for the outcome's wording. */
  readonly #last = new Map<string, string>();
  /** @internal The diff disclosures the person opened: `<proposalId>:context` or `:lines`. */
  readonly _opened = signal<ReadonlySet<string>>(new Set());

  /** @internal A diff disclosure was opened or closed. */
  readonly _onDiffToggle = (event: Event): void => {
    this._opened.value = toggleOpened(this._opened.peek(), event);
  };

  /** @internal */
  _last(proposalId: string): string | undefined {
    return this.#last.get(proposalId);
  }

  /** @internal */
  get _strings(): typeof CHANGE_REVIEW_STRINGS {
    return strings(CHANGE_REVIEW_STRINGS, this.strings);
  }

  /** @internal Diff per proposal record (cached by record identity and granularity). */
  _diff(proposal: EditProposal): readonly DiffSegment[] {
    const cached = this.#diffs.get(proposal);
    if (cached?.granularity === this.granularity) return cached.diff;
    const diff = diffText(proposal.original, proposal.replacement, this.granularity);
    this.#diffs.set(proposal, { granularity: this.granularity, diff });
    return diff;
  }

  /** @internal Whether the request `ask` is still in flight for the record `p`. */
  _waiting(ask: Ask | undefined, p: EditProposal | undefined): boolean {
    return !!ask && ask.record.status === p?.status && (p.status !== 'failed' || ask.record === p);
  }

  /**
   * @internal What failed (ADR 0049, "Pages 10 to 14"): an Undo when the host had applied the
   * change (`appliedRevision`) or this view asked to undo it; this view's Reject or Dismiss;
   * otherwise applying it.
   */
  _failure(p: EditProposal): 'undo' | 'record' | 'apply' {
    const last = this.#last.get(p.proposalId);
    return p.appliedRevision !== undefined || last === 'undo'
      ? 'undo'
      : last === 'reject' || last === 'dismiss'
        ? 'record'
        : 'apply';
  }

  /**
   * @internal What the person can ask of a proposal now, its decision row's buttons: Accept and
   * Reject while it awaits review, Dismiss once out of date, Undo once applied unless the host says
   * it cannot, and after a failure the buttons of what failed, so trying again is the same request.
   */
  _actions(p: EditProposal): readonly string[] {
    const undo = p.undoable === false ? [] : ['undo'];
    if (p.status === 'failed') {
      const failure = this._failure(p);
      return failure === 'undo'
        ? undo
        : failure === 'record' && this.#last.get(p.proposalId) === 'dismiss'
          ? ['dismiss']
          : ['accept', 'reject'];
    }
    return p.status === 'requested'
      ? ['accept', 'reject']
      : p.status === 'stale'
        ? ['dismiss']
        : p.status === 'applied'
          ? undo
          : [];
  }

  /** @internal */
  readonly _act = (event: Event): void => {
    const el = event.currentTarget as HTMLElement;
    const proposalId = el.dataset['id'] as string;
    const action = el.dataset['action'] as string;
    const proposal = this.proposals.find((p) => p.proposalId === proposalId);
    if (
      !proposal ||
      this._waiting(this._asked.peek().get(proposalId), proposal) ||
      !this._actions(proposal).includes(action)
    )
      return;
    this.#last.set(proposalId, action);
    this._asked.value = new Map(this._asked.peek()).set(proposalId, { action, record: proposal });
    this.emit(
      action === 'accept'
        ? changeAcceptEvent
        : action === 'undo'
          ? changeUndoEvent
          : changeRejectEvent,
      { proposalId },
    );
  };

  protected override mounted(scope: Scope): void {
    // The proposal that last held focus: when its focused button goes (Accept once applied),
    // focus moves to its line, never to the Undo that replaced it.
    let within: Element | null = null;
    scope.listen(this.shadowRoot!, 'focusin', (event: Event) => {
      within =
        (event
          .composedPath()
          .find((node) => node instanceof Element && node.matches('li.proposal')) as
          Element | undefined) ?? null;
    });
    scope.use(
      new DecisionController(
        this,
        () =>
          (within?.isConnected
            ? within.querySelector<HTMLElement>('.state:not([hidden])')
            : undefined) ?? this.shadowRoot?.querySelector<HTMLElement>('[part="list"]'),
      ),
    );
    let previous = new Map<string, EditProposal>();
    scope.effect(
      () => {
        const next = new Map(this.proposals.map((p) => [p.proposalId, p]));
        // A request is over once its proposal leaves the status it was asked at, even if the
        // record later returns to it, or once the host answers a request made after a failure.
        const asked = this._asked.peek();
        const open = [...asked].filter(([id, ask]) => this._waiting(ask, next.get(id)));
        if (open.length !== asked.size) this._asked.value = new Map(open);
        if (this.announce !== 'none') {
          const t = this._strings;
          for (const [id, p] of next) {
            const { status } = p;
            const before = previous.get(id)?.status;
            if (!before || before === status) continue;
            const failure = status === 'failed' ? this._failure(p) : undefined;
            const text =
              status === 'applied'
                ? t.announceApplied
                : status === 'stale'
                  ? t.announceStale
                  : status === 'undone'
                    ? t.announceUndone
                    : failure === 'undo'
                      ? t.announceUndoFailed
                      : failure === 'record'
                        ? t.notRecorded
                        : failure
                          ? t.announceFailed
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
