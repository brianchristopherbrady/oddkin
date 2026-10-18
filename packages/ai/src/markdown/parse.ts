/**
 * Parser for Oddkin's streaming Markdown dialect: a CommonMark-inspired subset plus GFM tables
 * and strikethrough, footnote-style citation markers (`[^source-id]`), and literal raw HTML (as
 * text unless a sanitizer is configured). Produces a small AST; never produces HTML strings.
 * Incremental use: `splitBlocks` cuts the source into top-level blocks whose source text is
 * stable once followed by more content, so renderers reuse committed DOM. Presentation repairs
 * for incomplete streaming syntax (`repair: true`) change only the AST, never the source.
 * DOM-free. Dialect: docs/architecture/ai-interaction.md §9.1.
 */

export type Inline =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'code'; readonly text: string }
  | { readonly type: 'em' | 'strong' | 'del'; readonly children: readonly Inline[] }
  | {
      readonly type: 'link';
      readonly href: string;
      readonly title?: string | undefined;
      readonly children: readonly Inline[];
    }
  | { readonly type: 'image'; readonly src: string; readonly alt: string }
  | { readonly type: 'citation'; readonly id: string }
  | { readonly type: 'break' };

export type Align = 'left' | 'center' | 'right' | null;

export type Block =
  | {
      readonly type: 'heading';
      readonly level: 1 | 2 | 3 | 4 | 5 | 6;
      readonly children: readonly Inline[];
    }
  | { readonly type: 'paragraph'; readonly children: readonly Inline[] }
  | { readonly type: 'code'; readonly lang: string; readonly text: string; readonly open: boolean }
  | { readonly type: 'quote'; readonly children: readonly Block[] }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly start: number;
      readonly items: readonly (readonly Block[])[];
    }
  | {
      readonly type: 'table';
      readonly align: readonly Align[];
      readonly head: readonly (readonly Inline[])[];
      readonly rows: readonly (readonly (readonly Inline[])[])[];
    }
  | { readonly type: 'rule' }
  | { readonly type: 'html'; readonly raw: string };

export interface ParseOptions {
  /** Hide dangling delimiters and incomplete link syntax at the end (streaming display only). */
  readonly repair?: boolean;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const BULLET = /^( {0,3})([-*+])([ \t]+|$)(.*)$/;
const ORDERED = /^( {0,3})(\d{1,9})([.)])([ \t]+|$)(.*)$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const TABLE_DELIMITER = /^ *\|? *:?-+:? *(?:\| *:?-+:? *)*\|? *$/;
const HTML_BLOCK = /^ {0,3}<(?:[a-zA-Z][\w-]*|\/[a-zA-Z][\w-]*|!--)/;

const isBlank = (line: string) => /^[ \t]*$/.test(line);

/** Top-level block source slices. Every slice but the last is final once more text arrives. */
export function splitBlocks(source: string): string[] {
  const lines = source.split(/\r\n|\r|\n/);
  const blocks: string[] = [];
  let current: string[] = [];
  let fence: string | undefined;
  let kind: 'bullet' | 'ordered' | 'other' | undefined;
  const flush = () => {
    if (current.length) blocks.push(current.join('\n'));
    current = [];
    kind = undefined;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (fence) {
      current.push(line);
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1]?.[0] === fence[0] && (close[1]?.length ?? 0) >= fence.length) {
        fence = undefined;
        flush();
      }
      continue;
    }
    const open = FENCE.exec(line);
    if (open && !(open[1]?.startsWith('`') && open[2]?.includes('`'))) {
      flush();
      fence = open[1];
      current.push(line);
      continue;
    }
    if (isBlank(line)) {
      // A blank line inside a list continues it when the next content is still part of the same
      // list (same marker type, or indented continuation).
      const next = lines.slice(i + 1).find((l) => !isBlank(l));
      const continues =
        next !== undefined &&
        ((kind === 'bullet' && BULLET.test(next)) ||
          (kind === 'ordered' && ORDERED.test(next)) ||
          ((kind === 'bullet' || kind === 'ordered') && /^ {2,}\S/.test(next)));
      if (continues) {
        current.push(line);
        continue;
      }
      flush();
      continue;
    }
    if (!current.length)
      kind = BULLET.test(line) ? 'bullet' : ORDERED.test(line) ? 'ordered' : 'other';
    else if (HEADING.test(line) || RULE.test(line)) {
      flush();
      blocks.push(line);
      continue;
    }
    if (!current.length && (HEADING.test(line) || RULE.test(line))) {
      blocks.push(line);
      kind = undefined;
      continue;
    }
    current.push(line);
  }
  flush();
  return blocks;
}

/** Parse a whole document (or one block slice). */
export function parseBlocks(source: string, options: ParseOptions = {}): Block[] {
  return parseLines(source.split(/\r\n|\r|\n/), options);
}

function parseLines(lines: readonly string[], options: ParseOptions): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (isBlank(line)) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence && !(fence[1]?.startsWith('`') && fence[2]?.includes('`'))) {
      const marker = fence[1] as string;
      const lang = (fence[2] ?? '').trim().split(/\s+/)[0] ?? '';
      const body: string[] = [];
      let open = true;
      i++;
      while (i < lines.length) {
        const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(lines[i] as string);
        if (close && close[1]?.[0] === marker[0] && (close[1]?.length ?? 0) >= marker.length) {
          open = false;
          i++;
          break;
        }
        body.push(lines[i] as string);
        i++;
      }
      blocks.push({ type: 'code', lang, text: body.join('\n'), open });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: (heading[1]?.length ?? 1) as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(heading[2] ?? '', options),
      });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && !isBlank(lines[i] as string)) {
        const match = QUOTE.exec(lines[i] as string);
        inner.push(match ? (match[1] ?? '') : (lines[i] as string));
        i++;
      }
      blocks.push({ type: 'quote', children: parseLines(inner, options) });
      continue;
    }
    if (BULLET.test(line) || ORDERED.test(line)) {
      const [list, next] = parseList(lines, i, options);
      blocks.push(list);
      i = next;
      continue;
    }
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      TABLE_DELIMITER.test(lines[i + 1] as string) &&
      (lines[i + 1] as string).includes('-')
    ) {
      const head = cells(line);
      const align = cells(lines[i + 1] as string).map((c): Align => {
        const left = c.startsWith(':');
        const right = c.endsWith(':');
        return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
      });
      const rows: Inline[][][] = [];
      i += 2;
      while (
        i < lines.length &&
        !isBlank(lines[i] as string) &&
        (lines[i] as string).includes('|')
      ) {
        rows.push(
          cells(lines[i] as string)
            .slice(0, head.length)
            .map((c) => parseInline(c, options)),
        );
        i++;
      }
      blocks.push({ type: 'table', align, head: head.map((c) => parseInline(c, options)), rows });
      continue;
    }
    if (HTML_BLOCK.test(line)) {
      const raw: string[] = [];
      while (i < lines.length && !isBlank(lines[i] as string)) raw.push(lines[i++] as string);
      blocks.push({ type: 'html', raw: raw.join('\n') });
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length) {
      const l = lines[i] as string;
      if (
        isBlank(l) ||
        HEADING.test(l) ||
        RULE.test(l) ||
        QUOTE.test(l) ||
        FENCE.test(l) ||
        (paragraph.length && (BULLET.test(l) || ORDERED.test(l)))
      )
        break;
      paragraph.push(l);
      i++;
    }
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n'), options) });
  }
  return blocks;
}

function cells(row: string): string[] {
  let text = row.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  const out: string[] = [];
  let cell = '';
  for (let k = 0; k < text.length; k++) {
    const ch = text[k] as string;
    if (ch === '\\' && text[k + 1] === '|') {
      cell += '|';
      k++;
    } else if (ch === '|') {
      out.push(cell.trim());
      cell = '';
    } else cell += ch;
  }
  out.push(cell.trim());
  return out;
}

function parseList(
  lines: readonly string[],
  start: number,
  options: ParseOptions,
): [Block, number] {
  const first = lines[start] as string;
  const ordered = ORDERED.test(first);
  const firstMatch = ordered ? ORDERED.exec(first) : BULLET.exec(first);
  const indent = (firstMatch?.[1] ?? '').length;
  const startNumber = ordered ? Number(firstMatch?.[2] ?? 1) : 1;
  const items: Block[][] = [];
  let current: string[] | undefined;
  let contentIndent = 0;
  let i = start;
  for (; i < lines.length; i++) {
    const line = lines[i] as string;
    const match = ordered ? ORDERED.exec(line) : BULLET.exec(line);
    if (match && (match[1] ?? '').length === indent) {
      if (current) items.push(parseLines(current, options));
      const marker = ordered ? `${match[2]}${match[3]}` : (match[2] as string);
      const gap = ordered ? match[4] : match[3];
      contentIndent = indent + marker.length + Math.max(1, (gap ?? ' ').length);
      current = [(ordered ? match[5] : match[4]) ?? ''];
      continue;
    }
    if (isBlank(line)) {
      const next = lines.slice(i + 1).find((l) => !isBlank(l));
      if (next === undefined) break;
      const nextMatch = ordered ? ORDERED.exec(next) : BULLET.exec(next);
      const continues =
        (nextMatch && (nextMatch[1] ?? '').length === indent) ||
        next.search(/\S/) >= Math.min(contentIndent, indent + 2);
      if (!continues) break;
      current?.push('');
      continue;
    }
    const lead = line.search(/\S/);
    if (lead >= Math.min(contentIndent, indent + 2)) {
      current?.push(line.slice(Math.min(lead, contentIndent)));
      continue;
    }
    // A lazy continuation line of the last paragraph.
    if (
      !BULLET.test(line) &&
      !ORDERED.test(line) &&
      !HEADING.test(line) &&
      !RULE.test(line) &&
      !FENCE.test(line) &&
      !QUOTE.test(line)
    ) {
      current?.push(line);
      continue;
    }
    break;
  }
  if (current) items.push(parseLines(current, options));
  return [{ type: 'list', ordered, start: startNumber, items }, i];
}

// ---- Inline ----

const PUNCTUATION = /[!-/:-@[-`{-~]/;
const AUTOLINK = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*)>/;
const BARE_URL = /^https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"*_~\]]/;
const CITATION = /^\[\^([A-Za-z0-9][\w.:-]*)\]/;

export function parseInline(text: string, options: ParseOptions = {}): Inline[] {
  const out = inline(text, options, true);
  return merge(out);
}

function merge(nodes: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (node.type === 'text' && last?.type === 'text')
      out[out.length - 1] = { type: 'text', text: last.text + node.text };
    else if (node.type !== 'text' || node.text) out.push(node);
  }
  return out;
}

function inline(text: string, options: ParseOptions, atEnd: boolean): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  const flushText = () => {
    if (buffer) out.push({ type: 'text', text: buffer });
    buffer = '';
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    const rest = text.slice(i);
    if (ch === '\\') {
      const next = text[i + 1];
      if (next === '\n') {
        flushText();
        out.push({ type: 'break' });
        i += 2;
        continue;
      }
      if (next !== undefined && PUNCTUATION.test(next)) {
        buffer += next;
        i += 2;
        continue;
      }
    }
    if (ch === '\n') {
      if (buffer.endsWith('  ')) {
        buffer = buffer.replace(/ +$/, '');
        flushText();
        out.push({ type: 'break' });
      } else {
        buffer = buffer.replace(/ +$/, '');
        buffer += ' ';
      }
      i++;
      while (text[i] === ' ') i++;
      continue;
    }
    if (ch === '`') {
      const run = /^`+/.exec(rest)?.[0] as string;
      const close = text.indexOf(run, i + run.length);
      if (close !== -1 && text[close + run.length] !== '`') {
        flushText();
        let code = text.slice(i + run.length, close).replace(/\n/g, ' ');
        if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ')) code = code.slice(1, -1);
        out.push({ type: 'code', text: code });
        i = close + run.length;
        continue;
      }
      if (options.repair && atEnd) {
        // Unclosed code span while streaming: show its content as code without the backticks.
        flushText();
        out.push({ type: 'code', text: text.slice(i + run.length) });
        i = text.length;
        continue;
      }
      buffer += run;
      i += run.length;
      continue;
    }
    if (ch === '[') {
      const citation = CITATION.exec(rest);
      if (citation) {
        flushText();
        out.push({ type: 'citation', id: citation[1] as string });
        i += citation[0].length;
        continue;
      }
      const link = matchLink(text, i);
      if (link) {
        flushText();
        out.push({
          type: 'link',
          href: link.href,
          title: link.title,
          children: inline(link.label, options, false),
        });
        i = link.end;
        continue;
      }
      if (options.repair && atEnd) {
        const partial = /^\[([^\]]*)(?:\]\(?[^)\s]*)?$/.exec(rest);
        if (partial) {
          // Incomplete link while streaming: show the label as text, hide the syntax.
          buffer += partial[1] ?? '';
          i = text.length;
          continue;
        }
      }
    }
    if (ch === '!' && text[i + 1] === '[') {
      const link = matchLink(text, i + 1);
      if (link) {
        flushText();
        out.push({ type: 'image', src: link.href, alt: link.label });
        i = link.end;
        continue;
      }
    }
    if (ch === '<') {
      const auto = AUTOLINK.exec(rest);
      if (auto) {
        flushText();
        out.push({
          type: 'link',
          href: auto[1] as string,
          children: [{ type: 'text', text: auto[1] as string }],
        });
        i += auto[0].length;
        continue;
      }
    }
    if ((ch === 'h' || ch === 'H') && /[\s(]$|^$/.test(text.slice(Math.max(0, i - 1), i))) {
      const url = BARE_URL.exec(rest);
      if (url) {
        flushText();
        out.push({ type: 'link', href: url[0], children: [{ type: 'text', text: url[0] }] });
        i += url[0].length;
        continue;
      }
    }
    if (ch === '*' || ch === '_' || ch === '~') {
      const run = new RegExp(`^\\${ch}+`).exec(rest)?.[0] as string;
      const size = ch === '~' ? (run.length >= 2 ? 2 : 0) : Math.min(run.length, 2);
      const before = text[i - 1];
      const after = text[i + run.length];
      const canOpen =
        size > 0 &&
        after !== undefined &&
        !/\s/.test(after) &&
        !(ch === '_' && before !== undefined && /[\p{L}\p{N}]/u.test(before));
      if (canOpen) {
        const marker = ch.repeat(size);
        const close = findClose(text, i + size, marker);
        if (close !== -1) {
          flushText();
          const children = inline(text.slice(i + size, close), options, false);
          out.push({ type: ch === '~' ? 'del' : size === 2 ? 'strong' : 'em', children });
          i = close + size;
          continue;
        }
        if (
          options.repair &&
          atEnd &&
          /^[*_~]+$/.test(run) &&
          !text.slice(i + run.length).includes(ch)
        ) {
          // Dangling opener while streaming: hide the delimiter until it closes.
          i += run.length;
          continue;
        }
      }
      if (options.repair && atEnd && i + run.length === text.length) {
        i += run.length;
        continue;
      }
      buffer += run;
      i += run.length;
      continue;
    }
    buffer += ch;
    i++;
  }
  flushText();
  return out;
}

function findClose(text: string, from: number, marker: string): number {
  let k = from;
  while (k < text.length) {
    const ch = text[k];
    if (ch === '\\') {
      k += 2;
      continue;
    }
    if (ch === '`') {
      const run = /^`+/.exec(text.slice(k))?.[0] as string;
      const end = text.indexOf(run, k + run.length);
      if (end !== -1) {
        k = end + run.length;
        continue;
      }
    }
    if (text.startsWith(marker, k)) {
      const before = text[k - 1];
      const after = text[k + marker.length];
      const runLength = (/^[*_~]+/.exec(text.slice(k))?.[0] ?? '').length;
      if (
        before !== undefined &&
        !/\s/.test(before) &&
        k > from &&
        !(marker[0] === '_' && after !== undefined && /[\p{L}\p{N}]/u.test(after)) &&
        !(marker.length === 1 && runLength === 2)
      )
        return k;
      k += Math.max(runLength, 1);
      continue;
    }
    k++;
  }
  return -1;
}

function matchLink(
  text: string,
  start: number,
): { label: string; href: string; title?: string; end: number } | undefined {
  let depth = 0;
  let k = start;
  for (; k < text.length; k++) {
    const ch = text[k];
    if (ch === '\\') {
      k++;
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0 || text[k + 1] !== '(') return undefined;
  const target =
    /^\(\s*(<[^>\n]*>|[^\s()]*(?:\([^\s()]*\)[^\s()]*)*)(?:\s+("[^"]*"|'[^']*'))?\s*\)/.exec(
      text.slice(k + 1),
    );
  if (!target) return undefined;
  let href = target[1] ?? '';
  if (href.startsWith('<')) href = href.slice(1, -1);
  const title = target[2]?.slice(1, -1);
  return {
    label: text.slice(start + 1, k),
    href,
    ...(title !== undefined ? { title } : {}),
    end: k + 1 + target[0].length,
  };
}
