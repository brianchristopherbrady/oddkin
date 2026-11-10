/**
 * The diff view shared by the agent workflow elements (ADR 0049 §4; Figma page 08, DiffView): word
 * or line diffs with merged runs, and `<del>`/`<ins>` with visually hidden labels, so a change
 * never relies on colour or strikethrough. A word diff reads inline, as one line; a line diff, and
 * any split view, reads as a Before block and an After block (side by side when split, stacked
 * below 30rem). The unchanged text around a change opens from a disclosure (Show context), and a
 * long line diff waits behind its count, in a 240 px scroll region when open. `odd-change-review`
 * draws its proposals with it; the approval's `changes` follow with page 09 (row 21).
 */
import { css } from '@oddkin/core/styles';
import { html } from '@oddkin/core/template';
import { token } from '@oddkin/tokens/refs';
import { diffLines, diffWords, type DiffSegment } from '../controllers/diff.js';
import { format } from './strings.js';

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

/** The diff of two texts: by lines for code, by words for prose, with word runs merged. */
export const diffText = (
  before: string,
  after: string,
  granularity: 'words' | 'lines',
): readonly DiffSegment[] =>
  granularity === 'lines' ? diffLines(before, after) : mergeRuns(diffWords(before, after));

/**
 * A line diff is long above this many changed lines (a replaced line counted once): it waits
 * behind its count, and scrolls in a 240 px region when open. Word diffs never wait: prose
 * reflows. An Oddkin default (Agent 1, 2026-11-09), for the designer to change with page 11.
 */
export const LONG_DIFF_LINES = 10;

/** The lines a line diff changes: each run of changes counts the larger of its lines out and in. */
export function changedLines(diff: readonly DiffSegment[]): number {
  let total = 0;
  let removed = 0;
  let added = 0;
  for (const s of diff) {
    if (s.kind === 'equal') {
      total += Math.max(removed, added);
      removed = added = 0;
    } else {
      const lines = s.text.split('\n').length - (s.text.endsWith('\n') ? 1 : 0);
      if (s.kind === 'delete') removed += lines;
      else added += lines;
    }
  }
  return total + Math.max(removed, added);
}

/** What assistive technology hears around each change. */
export interface DiffLabels {
  readonly deleted: string;
  readonly inserted: string;
}

/** The change: its unchanged text with its deletions, its insertions (`show`), or both. */
export const diffView = (
  diff: readonly DiffSegment[],
  labels: DiffLabels,
  show: 'both' | 'before' | 'after' = 'both',
) =>
  html`<span class="segments"
    >${diff.map((s) =>
      s.kind === 'equal'
        ? s.text
        : s.kind === 'delete'
          ? show === 'after'
            ? null
            : html`<del
                ><span class="visually-hidden">[${labels.deleted}: </span>${s.text}<span
                  class="visually-hidden"
                  >]</span
                ></del
              >`
          : show === 'before'
            ? null
            : html`<ins
                ><span class="visually-hidden">[${labels.inserted}: </span>${s.text}<span
                  class="visually-hidden"
                  >]</span
                ></ins
              >`,
    )}</span
  >`;

/** What the diff view says beyond its changes. */
export interface DiffStrings extends DiffLabels {
  readonly before: string;
  readonly after: string;
  /** A diff that changes nothing. */
  readonly empty: string;
  /** The context's disclosure: needed only where a change has context. */
  readonly showContext?: string;
  readonly hideContext?: string;
  /** A long diff, collapsed; takes `{count}`. */
  readonly reviewLines: string;
  /** A long diff, open; takes `{count}`. */
  readonly hideLines: string;
  /** The scroll region of an open long diff; takes `{count}`. */
  readonly changedLines: string;
}

/**
 * The names of the opened disclosures once `event`, a diff disclosure's toggle, opened or closed
 * the one its `data-key` names.
 */
export const toggleOpened = (opened: ReadonlySet<string>, event: Event): ReadonlySet<string> => {
  const key = (event.currentTarget as HTMLElement).dataset['key']!;
  const next = new Set(opened);
  if ((event as ToggleEvent).newState === 'open') next.add(key);
  else next.delete(key);
  return next;
};

/** One change to draw, and which of its disclosures the person opened. */
export interface DiffSetup {
  readonly diff: readonly DiffSegment[];
  readonly granularity: 'words' | 'lines';
  readonly view: 'inline' | 'split';
  readonly context?:
    { readonly before?: string | undefined; readonly after?: string | undefined } | undefined;
  /**
   * The blocks a line or split diff shows: a value that is absent, not empty, has none (an
   * approval's change that adds or removes a value). Both by default.
   */
  readonly sides?: { readonly before: boolean; readonly after: boolean } | undefined;
  /** Names the change's disclosures: `<key>:context` and `<key>:lines`. */
  readonly key: string;
  /** The names of the disclosures the person opened. */
  readonly opened: ReadonlySet<string>;
  /** A disclosure was opened or closed; its `data-key` names it. */
  readonly onToggle: (event: Event) => void;
}

/**
 * One change (Figma page 08, DiffView). Its context and a long line diff open from an
 * `odd-disclosure`. While the context is open the change sits inside its disclosure, between the
 * context before and after it; otherwise it follows the closed disclosure, once.
 */
export const diffPart = (s: DiffSetup, t: DiffStrings) => {
  const sides = s.sides ?? { before: true, after: true };
  // With one side absent, its value is the change, even an empty one.
  if (sides.before && sides.after && !s.diff.some((segment) => segment.kind !== 'equal'))
    return html`<p class="diff-empty">${t.empty}</p>`;
  const code = s.granularity === 'lines';
  const text = code ? 'text code' : 'text';
  const change =
    code || s.view === 'split'
      ? html`<div class=${s.view === 'split' ? 'split' : 'sides'}>
          ${(['before', 'after'] as const).map((side) =>
            sides[side]
              ? html`<div class="side">
                  <p class="muted">${t[side]}</p>
                  <div class=${text}>${diffView(s.diff, t, side)}</div>
                </div>`
              : null,
          )}
        </div>`
      : html`<div class=${text}>${diffView(s.diff, t)}</div>`;
  const count = code ? changedLines(s.diff) : 0;
  if (count > LONG_DIFF_LINES) {
    const key = `${s.key}:lines`;
    const open = s.opened.has(key);
    const n = { count: String(count) };
    return html`<odd-disclosure
      class="long"
      data-key=${key}
      label=${format(open ? t.hideLines : t.reviewLines, n)}
      .open=${open}
      @toggle=${s.onToggle}
    >
      ${
        open
          ? html`<div
              class="scroll"
              role="region"
              aria-label=${format(t.changedLines, n)}
              tabindex="0"
            >
              ${change}
            </div>`
          : null
      }
    </odd-disclosure>`;
  }
  const { before, after } = s.context ?? {};
  if (!before && !after) return change;
  const key = `${s.key}:context`;
  const open = s.opened.has(key);
  const context = code ? 'context code' : 'context';
  return html`<odd-disclosure
      class="context-toggle"
      data-key=${key}
      label=${(open ? t.hideContext : t.showContext) ?? ''}
      .open=${open}
      @toggle=${s.onToggle}
    >
      ${
        open
          ? html`<p class=${context} ?hidden=${!before}>${before ?? ''}</p>
              ${change}
              <p class=${context} ?hidden=${!after}>${after ?? ''}</p>`
          : null
      }
    </odd-disclosure>
    ${open ? null : change}`;
};

/**
 * The diff's look. Only the segments and the context preserve whitespace (template whitespace
 * around them collapses); the context is muted; `.code` sets a line diff in the monospace face.
 * The caller's `.diff` is the container (`odd-diff`) a split view measures: below 30rem (Figma
 * page 08's compact density) its sides stack. An open long diff scrolls in a 240 px (15rem) region.
 */
export const diffViewStyles = css`
  .segments,
  .context {
    white-space: pre-wrap;
  }
  .context {
    color: ${token('color.text.secondary')};
  }
  .code {
    padding: ${token('space.xs')};
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.sunken')};
    font-family: ${token('font.family.mono')};
    font-size: ${token('font.size.sm')};
    overflow-x: auto;
  }
  .diff {
    container: odd-diff / inline-size;
  }
  @container odd-diff (inline-size < 30rem) {
    .split {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .scroll {
    max-block-size: 15rem;
    overflow: auto;
  }
  .diff-empty {
    font-size: ${token('font.size.sm')};
    color: ${token('color.text.secondary')};
  }
  del {
    background: ${token('color.danger.surface')};
    color: ${token('color.danger.foreground')};
  }
  ins {
    background: ${token('color.success.surface')};
    color: ${token('color.success.foreground')};
    text-decoration: underline;
  }
  @media (forced-colors: active) {
    del {
      text-decoration: line-through;
    }
  }
`;
