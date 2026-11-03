/**
 * Theme Studio's save to file (workbench.md §9): the draft written in the theme file's own layout,
 * and the diff the reader confirms before the dev server writes it. Node only.
 */
import { createHash } from 'node:crypto';

const pointer = (base: string, key: string) =>
  `${base}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;

/** Whether each object and array of a JSON text is written on one line, by JSON pointer. */
function layout(text: string): Map<string, boolean> {
  const oneLine = new Map<string, boolean>();
  let i = 0;
  let line = 0;
  const space = () => {
    while (/\s/.test(text[i] ?? '')) if (text[i++] === '\n') line++;
  };
  const string = () => {
    const start = i++;
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    return JSON.parse(text.slice(start, ++i)) as string;
  };
  const value = (at: string): void => {
    space();
    const open = text[i];
    if (open !== '{' && open !== '[') {
      if (open === '"') string();
      else while (/[^\s,\]}]/.test(text[i] ?? ' ')) i++;
      return;
    }
    const first = line;
    i++;
    space();
    let index = 0;
    for (; text[i] !== (open === '{' ? '}' : ']'); index++) {
      if (i >= text.length) throw new SyntaxError('Unterminated JSON container.');
      let key = String(index);
      if (open === '{') {
        key = string();
        space();
        i++;
      }
      value(pointer(at, key));
      space();
      if (text[i] === ',') i++;
      space();
    }
    i++;
    // An empty container says nothing about how its members would be laid out.
    if (index) oneLine.set(at, line === first);
  };
  try {
    value('');
  } catch {
    // Text that does not parse keeps the layout of the containers read before the error.
  }
  return oneLine;
}

const WIDTH = 80;

/** A JSON value on one line, as a formatter writes it: `{ "a": 1 }`, `[1, 2]`. */
function inline(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  const entries = Object.entries(value);
  return entries.length
    ? `{ ${entries.map(([key, item]) => `${JSON.stringify(key)}: ${inline(item)}`).join(', ')} }`
    : '{}';
}

/**
 * `model` as the theme file `original` would have it: each object and array keeps its line
 * layout there, and a new one goes on one line when it holds only scalars and fits in 80
 * columns. The original's indentation, line ending, and final newline are kept.
 */
export function formatThemeFile(original: string, model: unknown): string {
  const lines = layout(original);
  const unit = /^([ \t]+)\S/m.exec(original)?.[1] ?? '  ';
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const write = (value: unknown, at: string, depth: number, column: number): string => {
    const flat = inline(value);
    if (value === null || typeof value !== 'object' || flat === '{}' || flat === '[]') return flat;
    const array = Array.isArray(value);
    const entries: [string, unknown][] = array
      ? (value as unknown[]).map((item, index) => [String(index), item])
      : Object.entries(value);
    const scalars = entries.every(([, item]) => item === null || typeof item !== 'object');
    // The trailing comma counts toward the width; a new file's top level always opens.
    if (lines.get(at) ?? (at !== '' && scalars && column + flat.length + 1 <= WIDTH)) return flat;
    const inner = unit.repeat(depth + 1);
    const body = entries.map(([key, item]) => {
      const prefix = `${inner}${array ? '' : `${JSON.stringify(key)}: `}`;
      return prefix + write(item, pointer(at, key), depth + 1, prefix.length);
    });
    return `${array ? '[' : '{'}\n${body.join(',\n')}\n${unit.repeat(depth)}${array ? ']' : '}'}`;
  };
  const text = write(model, '', 0, 0);
  return (text + (/\n$/.test(original) || !original ? '\n' : '')).replace(/\n/g, eol);
}

/** Identifies one content of the file, so a write confirms the diff the reader saw. */
export const fileVersion = (text: string): string =>
  createHash('sha256').update(text).digest('hex').slice(0, 16);

/**
 * A unified diff of two texts by line, without the file headers: `@@ -a,b +c,d @@` hunk headers,
 * then each line prefixed with ` `, `-`, or `+`. Empty when they have the same lines.
 */
export function diffLines(before: string, after: string, context = 3): string[] {
  const a = before.replace(/\r?\n$/, '').split(/\r?\n/);
  const b = after.replace(/\r?\n$/, '').split(/\r?\n/);
  const n = a.length;
  const m = b.length;
  // Lengths of the longest common subsequence of each pair of suffixes.
  const lcs = new Uint32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => lcs[i * (m + 1) + j] as number;
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i * (m + 1) + j] =
        a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
  const ops: { readonly op: ' ' | '-' | '+'; readonly text: string }[] = [];
  for (let i = 0, j = 0; i < n || j < m;) {
    if (i < n && j < m && a[i] === b[j]) {
      ops.push({ op: ' ', text: a[i] as string });
      i++;
      j++;
    } else if (i < n && (j === m || at(i + 1, j) >= at(i, j + 1)))
      ops.push({ op: '-', text: a[i++] as string });
    else ops.push({ op: '+', text: b[j++] as string });
  }
  const changes = ops.flatMap((o, index) => (o.op === ' ' ? [] : [index]));
  const count = (list: typeof ops, skip: string) => list.filter((o) => o.op !== skip).length;
  const out: string[] = [];
  for (let c = 0; c < changes.length; c++) {
    let last = changes[c] as number;
    const start = Math.max(0, last - context);
    // Changes closer than twice the context share a hunk.
    while (c + 1 < changes.length && (changes[c + 1] as number) - last - 1 <= 2 * context)
      last = changes[++c] as number;
    const head = ops.slice(0, start);
    const hunk = ops.slice(start, Math.min(ops.length, last + 1 + context));
    out.push(
      `@@ -${count(head, '+') + 1},${count(hunk, '+')} +${count(head, '-') + 1},${count(hunk, '-')} @@`,
      ...hunk.map((o) => `${o.op}${o.text}`),
    );
  }
  return out;
}
