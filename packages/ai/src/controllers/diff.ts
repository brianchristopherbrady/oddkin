/**
 * Word- and line-level diffs for change review (LCS over tokens). Bounded: above `maxCells`
 * comparisons the diff degrades to one deletion and one insertion instead of stalling the page.
 * DOM-free.
 */
export interface DiffSegment {
  readonly kind: 'equal' | 'insert' | 'delete';
  readonly text: string;
}

/** Words and whitespace runs, so joined segments reproduce both inputs exactly. */
export const wordTokens = (text: string): string[] => text.match(/\s+|[^\s]+/gu) ?? [];
/** Lines including their terminators. */
export const lineTokens = (text: string): string[] => text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];

export function diffTokens(
  before: readonly string[],
  after: readonly string[],
  maxCells = 250_000,
): DiffSegment[] {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endB = before.length;
  let endA = after.length;
  while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) {
    endB--;
    endA--;
  }
  const out: DiffSegment[] = [];
  const push = (kind: DiffSegment['kind'], text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last?.kind === kind) out[out.length - 1] = { kind, text: last.text + text };
    else out.push({ kind, text });
  };
  push('equal', before.slice(0, start).join(''));
  const b = before.slice(start, endB);
  const a = after.slice(start, endA);
  if (b.length * a.length > maxCells) {
    push('delete', b.join(''));
    push('insert', a.join(''));
  } else {
    // lengths[i][j]: LCS of b[i..] and a[j..]
    const width = a.length + 1;
    const lengths = new Uint32Array((b.length + 1) * width);
    for (let i = b.length - 1; i >= 0; i--)
      for (let j = a.length - 1; j >= 0; j--)
        lengths[i * width + j] =
          b[i] === a[j]
            ? (lengths[(i + 1) * width + j + 1] as number) + 1
            : Math.max(
                lengths[(i + 1) * width + j] as number,
                lengths[i * width + j + 1] as number,
              );
    let i = 0;
    let j = 0;
    while (i < b.length && j < a.length) {
      if (b[i] === a[j]) {
        push('equal', b[i++] as string);
        j++;
      } else if ((lengths[(i + 1) * width + j] as number) >= (lengths[i * width + j + 1] as number))
        push('delete', b[i++] as string);
      else push('insert', a[j++] as string);
    }
    while (i < b.length) push('delete', b[i++] as string);
    while (j < a.length) push('insert', a[j++] as string);
  }
  push('equal', before.slice(endB).join(''));
  return out;
}

export const diffWords = (before: string, after: string): DiffSegment[] =>
  diffTokens(wordTokens(before), wordTokens(after));
export const diffLines = (before: string, after: string): DiffSegment[] =>
  diffTokens(lineTokens(before), lineTokens(after));
