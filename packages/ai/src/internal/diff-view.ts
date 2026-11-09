/**
 * The diff view shared by the agent workflow elements (ADR 0049 §4): word or line diffs with
 * merged runs, muted context, and `<del>`/`<ins>` with visually hidden labels, so a change never
 * relies on colour or strikethrough. `odd-change-review` draws its proposals with it; the
 * approval's `changes` follow with the redesign.
 */
import { css } from '@oddkin/core/styles';
import { html } from '@oddkin/core/template';
import { token } from '@oddkin/tokens/refs';
import { diffLines, diffWords, type DiffSegment } from '../controllers/diff.js';

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

/** What assistive technology hears around each change. */
export interface DiffLabels {
  readonly deleted: string;
  readonly inserted: string;
}

/**
 * The change between its muted context; `show` leaves out the deletions or the insertions (the
 * two sides of a split view).
 */
export const diffView = (
  diff: readonly DiffSegment[],
  labels: DiffLabels,
  context: { readonly before?: string | undefined; readonly after?: string | undefined } = {},
  show: 'both' | 'before' | 'after' = 'both',
) =>
  html`<span class="segments"
    ><span class="context">${context.before ?? ''}</span>${diff.map((s) =>
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
    )}<span class="context">${context.after ?? ''}</span></span
  >`;

/**
 * The diff's look. Only the segments preserve whitespace (template whitespace around them
 * collapses); the context is muted; `.code` sets a line diff in the monospace face.
 */
export const diffViewStyles = css`
  .segments {
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
