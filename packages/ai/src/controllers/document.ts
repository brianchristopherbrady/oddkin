/**
 * Revision-bound text editing for inline assistance and change review. Offsets are UTF-16 code
 * unit indices into the canonical text of one revision (the unit of DOM selections, `<textarea>`
 * `selectionStart`, and `String.prototype.slice`); helpers convert to Unicode code point offsets
 * for backends that count scalar values. A range never splits a surrogate pair. Proposals apply
 * only to the revision they were made for. DOM-free.
 * Contract: docs/architecture/ai-interaction.md §8.3.
 */
import { signal, type Readable, type Signal } from '@oddkin/core/reactive';
import type { PublicError } from '../contracts/types.js';

export interface TextRange {
  /** Inclusive start, UTF-16 code units. */
  readonly start: number;
  /** Exclusive end, UTF-16 code units. */
  readonly end: number;
}

export interface TextSelection extends TextRange {
  /** Revision of the text the range was captured against. */
  readonly revision: string;
  /** The selected text at capture time. */
  readonly text: string;
}

const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** True when `offset` does not fall between the two halves of a surrogate pair. */
export function isBoundary(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) return offset === 0 || offset === text.length;
  return !(isHigh(text.charCodeAt(offset - 1)) && isLow(text.charCodeAt(offset)));
}

export function isValidRange(text: string, range: TextRange): boolean {
  return (
    Number.isInteger(range.start) &&
    Number.isInteger(range.end) &&
    range.start >= 0 &&
    range.end >= range.start &&
    range.end <= text.length &&
    isBoundary(text, range.start) &&
    isBoundary(text, range.end)
  );
}

/** UTF-16 offset → code point offset. */
export function toCodePointOffset(text: string, offset: number): number {
  let points = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (!(isLow(text.charCodeAt(i)) && i > 0 && isHigh(text.charCodeAt(i - 1)))) points++;
  }
  return points;
}

/** Code point offset → UTF-16 offset. */
export function fromCodePointOffset(text: string, points: number): number {
  let offset = 0;
  for (let p = 0; p < points && offset < text.length; p++) {
    offset += isHigh(text.charCodeAt(offset)) && isLow(text.charCodeAt(offset + 1)) ? 2 : 1;
  }
  return offset;
}

/** Capture a selection from a text control (or any `selectionStart`/`selectionEnd` owner). */
export function captureSelection(
  control: {
    readonly value: string;
    readonly selectionStart: number | null;
    readonly selectionEnd: number | null;
  },
  revision: string,
): TextSelection | undefined {
  const start = control.selectionStart ?? 0;
  const end = control.selectionEnd ?? start;
  if (end <= start) return undefined;
  const range = { start, end };
  if (!isValidRange(control.value, range)) return undefined;
  return { revision, start, end, text: control.value.slice(start, end) };
}

export type ProposalStatus =
  | 'proposed'
  | 'accept-pending'
  | 'applied'
  | 'rejected'
  | 'stale'
  | 'undo-pending'
  | 'undone'
  | 'failed';

export interface EditProposal {
  readonly proposalId: string;
  /** Revision the replacement was computed against. */
  readonly baseRevision: string;
  readonly range: TextRange;
  /** Text expected at `range` in `baseRevision`. */
  readonly original: string;
  readonly replacement: string;
  readonly label?: string | undefined;
  /**
   * The text around `range` in `baseRevision`, which the review shows muted around the change so
   * the reader sees where it applies. `DocumentSession.propose` fills it when the host does not.
   */
  readonly context?: { readonly before: string; readonly after: string } | undefined;
  readonly status: ProposalStatus;
  /**
   * Whether Undo can revert this applied proposal; `false` hides Undo, and absent offers it.
   * `DocumentSession` sets it on every applied proposal: `true` only on the most recent change,
   * while nothing has changed since.
   */
  readonly undoable?: boolean | undefined;
  /** Revision produced by applying this proposal. */
  readonly appliedRevision?: string | undefined;
  readonly error?: PublicError | undefined;
}

export interface DocumentState {
  readonly text: string;
  readonly revision: string;
  readonly proposals: readonly EditProposal[];
}

/** About how many characters of context `DocumentSession.propose` keeps on each side. */
const CONTEXT = 40;
const isSpace = (char: string | undefined) => char !== undefined && /\s/u.test(char);

/**
 * The text around `range` on its lines: up to `CONTEXT` characters on each side, cut at a word
 * boundary, with an ellipsis where it was cut.
 */
function contextAround(text: string, range: TextRange): { before: string; after: string } {
  const lineStart = text.lastIndexOf('\n', range.start - 1) + 1;
  const newline = text.indexOf('\n', range.end);
  // A range that takes its line break ends there: the next line is not its context.
  const lineEnd =
    range.end > range.start && text[range.end - 1] === '\n'
      ? range.end
      : newline === -1
        ? text.length
        : newline;
  let from = Math.max(lineStart, range.start - CONTEXT);
  if (from > lineStart && !isSpace(text[from - 1])) {
    const space = text.slice(from, range.start).search(/\s/u);
    from = space === -1 ? (isBoundary(text, from) ? from : from + 1) : from + space;
  }
  while (from < range.start && from > lineStart && isSpace(text[from])) from++;
  let to = Math.min(lineEnd, range.end + CONTEXT);
  if (to < lineEnd && !isSpace(text[to])) {
    const space = text.slice(range.end, to).search(/\s\S*$/u);
    to = space === -1 ? (isBoundary(text, to) ? to : to - 1) : range.end + space;
  }
  while (to > range.end && to < lineEnd && isSpace(text[to - 1])) to--;
  return {
    before: `${from > lineStart ? '…' : ''}${text.slice(from, range.start)}`,
    after: `${text.slice(range.end, to)}${to < lineEnd ? '…' : ''}`,
  };
}

export type ApplyResult =
  | { readonly ok: true; readonly revision: string }
  | {
      readonly ok: false;
      readonly reason: 'stale' | 'conflict' | 'invalid' | 'not-found' | 'not-applied';
    };

/**
 * A host-owned document with revision tracking. Accepting a proposal applies it only when the
 * document is still at the proposal's base revision; otherwise it becomes `stale` and the newer
 * content is never overwritten. Undo reverts only the most recent applied change when the
 * document has not changed since; each applied proposal's `undoable` says whether it is that one.
 * A proposal gets the text around its range as `context` unless the host gives its own.
 */
export class DocumentSession {
  readonly #state: Signal<DocumentState>;
  readonly state: Readable<DocumentState>;
  #counter = 0;
  readonly #prefix: string;
  readonly #undo: {
    proposalId: string;
    before: DocumentState['text'];
    beforeRevision: string;
    afterRevision: string;
  }[] = [];

  constructor(text: string, options: { revisionPrefix?: string } = {}) {
    this.#prefix = options.revisionPrefix ?? 'rev';
    this.#state = signal<DocumentState>({ text, revision: this.#nextRevision(), proposals: [] });
    this.state = this.#state;
  }

  getSnapshot(): DocumentState {
    return this.#state.peek();
  }

  /** A user edit. Proposals for older revisions become stale. */
  setText(text: string): string {
    const now = this.#state.peek();
    if (text === now.text) return now.revision;
    const revision = this.#nextRevision();
    this.#undo.length = 0;
    this.#set({
      text,
      revision,
      proposals: now.proposals.map((p) =>
        p.status === 'proposed' ? { ...p, status: 'stale' } : p,
      ),
    });
    return revision;
  }

  /** Register a proposal from the assistant. Invalid ranges are rejected; stale ones recorded as stale. */
  propose(proposal: Omit<EditProposal, 'status'>): EditProposal {
    const now = this.#state.peek();
    let status: ProposalStatus = 'proposed';
    if (proposal.baseRevision !== now.revision) status = 'stale';
    else if (
      !isValidRange(now.text, proposal.range) ||
      now.text.slice(proposal.range.start, proposal.range.end) !== proposal.original
    )
      status = 'failed';
    const record: EditProposal = {
      ...proposal,
      ...(status === 'proposed' && !proposal.context
        ? { context: contextAround(now.text, proposal.range) }
        : {}),
      status,
      ...(status === 'failed'
        ? { error: { code: 'ai.edit.range', message: 'The proposal does not match the text.' } }
        : {}),
    };
    this.#set({
      ...now,
      proposals: [...now.proposals.filter((p) => p.proposalId !== record.proposalId), record],
    });
    return this.#state.peek().proposals.find((p) => p.proposalId === record.proposalId)!;
  }

  /** Accept and apply a proposal to its base revision. */
  accept(proposalId: string): ApplyResult {
    const now = this.#state.peek();
    const proposal = now.proposals.find((p) => p.proposalId === proposalId);
    if (!proposal) return { ok: false, reason: 'not-found' };
    if (proposal.status !== 'proposed')
      return { ok: false, reason: proposal.status === 'stale' ? 'stale' : 'invalid' };
    if (proposal.baseRevision !== now.revision) {
      this.#setStatus(proposalId, 'stale');
      return { ok: false, reason: 'stale' };
    }
    if (now.text.slice(proposal.range.start, proposal.range.end) !== proposal.original) {
      this.#setStatus(proposalId, 'failed');
      return { ok: false, reason: 'conflict' };
    }
    const text =
      now.text.slice(0, proposal.range.start) +
      proposal.replacement +
      now.text.slice(proposal.range.end);
    const revision = this.#nextRevision();
    this.#undo.push({
      proposalId,
      before: now.text,
      beforeRevision: now.revision,
      afterRevision: revision,
    });
    this.#set({
      text,
      revision,
      proposals: now.proposals.map((p) =>
        p.proposalId === proposalId
          ? { ...p, status: 'applied', appliedRevision: revision }
          : p.status === 'proposed'
            ? { ...p, status: 'stale' }
            : p,
      ),
    });
    return { ok: true, revision };
  }

  reject(proposalId: string): ApplyResult {
    const proposal = this.#state.peek().proposals.find((p) => p.proposalId === proposalId);
    if (!proposal) return { ok: false, reason: 'not-found' };
    if (proposal.status !== 'proposed' && proposal.status !== 'stale')
      return { ok: false, reason: 'invalid' };
    this.#setStatus(proposalId, 'rejected');
    return { ok: true, revision: this.#state.peek().revision };
  }

  /** Undo an applied proposal if it is the latest change and nothing changed since. */
  undo(proposalId: string): ApplyResult {
    const now = this.#state.peek();
    const last = this.#undo[this.#undo.length - 1];
    if (!last || last.proposalId !== proposalId) return { ok: false, reason: 'not-applied' };
    if (last.afterRevision !== now.revision) return { ok: false, reason: 'stale' };
    this.#undo.pop();
    const revision = this.#nextRevision();
    this.#set({
      text: last.before,
      revision,
      proposals: now.proposals.map((p) =>
        p.proposalId === proposalId ? { ...p, status: 'undone' } : p,
      ),
    });
    return { ok: true, revision };
  }

  #setStatus(proposalId: string, status: ProposalStatus): void {
    const now = this.#state.peek();
    this.#set({
      ...now,
      proposals: now.proposals.map((p) => (p.proposalId === proposalId ? { ...p, status } : p)),
    });
  }

  /** The next state, each applied proposal marked whether Undo can revert it. */
  #set(next: DocumentState): void {
    const last = this.#undo[this.#undo.length - 1];
    const latest = last?.afterRevision === next.revision ? last.proposalId : undefined;
    this.#state.value = {
      ...next,
      proposals: next.proposals.map((p) => {
        if (p.status !== 'applied') {
          if (p.undoable === undefined) return p;
          const { undoable: _, ...rest } = p;
          return rest;
        }
        const undoable = p.proposalId === latest;
        return p.undoable === undoable ? p : { ...p, undoable };
      }),
    };
  }

  #nextRevision(): string {
    return `${this.#prefix}-${++this.#counter}`;
  }
}
