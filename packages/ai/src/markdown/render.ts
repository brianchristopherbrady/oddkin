/**
 * Markdown to DOM through `createElement` and text nodes only: no HTML parsing of untrusted
 * strings, no `innerHTML`, so every incremental insertion path is inert by construction.
 * Committed blocks keep their DOM (focus and selection survive streaming); the streaming block
 * is rebuilt, and an open code block grows by appending text. Links pass the URL policy, images
 * are links unless loading is enabled, raw HTML is text unless a sanitizer is configured (its
 * output is cleaned again here), and highlighting may only wrap the exact code text.
 */
import { parseBlocks, splitBlocks, type Block, type Inline } from './parse.js';
import { DEFAULT_URL_POLICY, safeUrl, type UrlPolicy } from './url.js';

export interface HighlightToken {
  readonly text: string;
  /** Token class (`keyword`, `string`, …); rendered as `tok-<kind>`. */
  readonly kind?: string | undefined;
}
/** Return tokens whose texts concatenate to exactly `code`, or undefined to skip highlighting. */
export type Highlighter = (code: string, language: string) => readonly HighlightToken[] | undefined;

export interface MarkdownOptions {
  readonly url?: UrlPolicy;
  /** `text` (default): raw HTML is shown literally. `sanitize`: passed through `sanitize`. */
  readonly html?: 'text' | 'sanitize';
  /** Host sanitizer for raw HTML blocks (e.g. DOMPurify with `RETURN_DOM_FRAGMENT`). */
  readonly sanitize?: (html: string) => Node | null;
  readonly highlight?: Highlighter;
  /** `link` (default): images become links. `load`: https images load (no referrer). */
  readonly images?: 'link' | 'load';
  /** Render `[^id]` markers; default renders the marker text. */
  readonly citation?: (id: string) => Node;
  /** Extra controls after each code block (e.g. a copy button). Receives canonical code. */
  readonly codeActions?: (code: string, language: string) => Node | null;
  /** `#` renders as `h(1 + headingOffset)`, capped at h6. Default 2 (inside a message). */
  readonly headingOffset?: number;
  readonly linkTarget?: '_blank' | '_self';
  readonly imageLabel?: string;
}

interface Rendered {
  source: string;
  repaired: boolean;
  blocks: readonly Block[];
  nodes: Node[];
  /** Text node of a trailing open code block (for append-only growth). */
  codeText?: Text | undefined;
}

const KIND = /^[a-z][a-z-]{0,23}$/;
const REMOVE = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'frame',
  'frameset',
  'template',
  'svg',
  'math',
  'noscript',
]);
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'poster', 'cite', 'srcset']);

export class MarkdownView {
  readonly #container: Element | DocumentFragment;
  readonly #doc: Document;
  #options: MarkdownOptions;
  #rendered: Rendered[] = [];
  #source = '';

  constructor(container: Element | DocumentFragment, options: MarkdownOptions = {}) {
    this.#container = container;
    this.#doc = container.ownerDocument ?? document;
    this.#options = options;
  }

  /** Canonical source last rendered (copy/export use this, never the DOM). */
  get source(): string {
    return this.#source;
  }

  /** Change options; the next update rebuilds every block. */
  configure(options: MarkdownOptions): void {
    this.#options = options;
    for (const block of this.#rendered) block.nodes.forEach((n) => n.parentNode?.removeChild(n));
    this.#rendered = [];
    this.update(this.#source, false, true);
  }

  /** Render `source`. While `streaming`, the last block shows presentation repairs. */
  update(source: string, streaming: boolean, force = false): void {
    if (!force && source === this.#source && !streaming && this.#rendered.every((r) => !r.repaired))
      return;
    this.#source = source;
    const slices = splitBlocks(source);
    const next: Rendered[] = [];
    for (let k = 0; k < slices.length; k++) {
      const slice = slices[k] as string;
      const repaired = streaming && k === slices.length - 1;
      const previous = this.#rendered[k];
      if (previous && previous.source === slice && previous.repaired === repaired) {
        next.push(previous);
        continue;
      }
      const blocks = parseBlocks(slice, { repair: repaired });
      // A block whose repairs changed nothing keeps its DOM when it stops being the last block.
      if (
        previous &&
        previous.source === slice &&
        JSON.stringify(previous.blocks) === JSON.stringify(blocks)
      ) {
        previous.repaired = repaired;
        next.push(previous);
        continue;
      }
      if (previous && this.#grow(previous, slice, blocks, repaired)) {
        next.push(previous);
        continue;
      }
      const nodes = blocks.map((b) => this.#block(b));
      const rendered: Rendered = { source: slice, repaired, blocks, nodes };
      const last = blocks[blocks.length - 1];
      if (last?.type === 'code' && last.open)
        rendered.codeText = this.#lastCodeText(nodes[nodes.length - 1]);
      if (previous) {
        const anchor = previous.nodes[0] ?? null;
        for (const node of nodes) this.#container.insertBefore(node, anchor);
        for (const node of previous.nodes) node.parentNode?.removeChild(node);
      } else {
        const anchor = this.#rendered[k + 1]?.nodes[0] ?? null;
        for (const node of nodes) this.#container.insertBefore(node, anchor);
      }
      next.push(rendered);
    }
    for (const stale of this.#rendered.slice(slices.length))
      for (const node of stale.nodes) node.parentNode?.removeChild(node);
    this.#rendered = next;
  }

  dispose(): void {
    for (const block of this.#rendered)
      for (const node of block.nodes) node.parentNode?.removeChild(node);
    this.#rendered = [];
  }

  /** Append-only growth of a streaming code block keeps its text node (and any selection). */
  #grow(previous: Rendered, slice: string, blocks: readonly Block[], repaired: boolean): boolean {
    const before = previous.blocks[previous.blocks.length - 1];
    const after = blocks[blocks.length - 1];
    if (!previous.codeText || before?.type !== 'code' || after?.type !== 'code' || !after.open)
      return false;
    if (
      blocks.length !== previous.blocks.length ||
      before.lang !== after.lang ||
      !after.text.startsWith(before.text)
    )
      return false;
    if (!slice.startsWith(previous.source)) return false;
    previous.codeText.appendData(after.text.slice(before.text.length));
    previous.source = slice;
    previous.repaired = repaired;
    previous.blocks = blocks;
    return true;
  }

  #lastCodeText(node: Node | undefined): Text | undefined {
    const code = node instanceof Element ? node.querySelector('code') : undefined;
    const text = code?.firstChild;
    return text && text.nodeType === 3 && !text.nextSibling ? (text as Text) : undefined;
  }

  #el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
    const el = this.#doc.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  #block(block: Block): Node {
    switch (block.type) {
      case 'heading': {
        const level = Math.min(6, block.level + (this.#options.headingOffset ?? 2));
        const el = this.#el(`h${level}` as 'h3');
        this.#inlines(el, block.children);
        return el;
      }
      case 'paragraph': {
        const el = this.#el('p');
        this.#inlines(el, block.children);
        return el;
      }
      case 'code': {
        const wrapper = this.#el('div', 'code-block');
        const pre = this.#el('pre');
        const code = this.#el('code');
        if (block.lang) code.dataset['language'] = block.lang.slice(0, 32);
        const tokens =
          !block.open && this.#options.highlight
            ? this.#options.highlight(block.text, block.lang)
            : undefined;
        if (tokens && tokens.map((t) => t.text).join('') === block.text) {
          for (const token of tokens) {
            if (token.kind && KIND.test(token.kind)) {
              const span = this.#el('span', `tok-${token.kind}`);
              span.textContent = token.text;
              code.append(span);
            } else code.append(this.#doc.createTextNode(token.text));
          }
        } else code.append(this.#doc.createTextNode(block.text));
        pre.append(code);
        wrapper.append(pre);
        if (!block.open) {
          const actions = this.#options.codeActions?.(block.text, block.lang);
          if (actions) wrapper.append(actions);
        }
        return wrapper;
      }
      case 'quote': {
        const el = this.#el('blockquote');
        for (const child of block.children) el.append(this.#block(child));
        return el;
      }
      case 'list': {
        const el = this.#el(block.ordered ? 'ol' : 'ul');
        if (block.ordered && block.start !== 1) el.setAttribute('start', String(block.start));
        for (const item of block.items) {
          const li = this.#el('li');
          // A single paragraph item renders inline (tight list).
          if (item.length === 1 && item[0]?.type === 'paragraph')
            this.#inlines(li, item[0].children);
          else for (const child of item) li.append(this.#block(child));
          el.append(li);
        }
        return el;
      }
      case 'table': {
        const scroll = this.#el('div', 'table-scroll');
        const table = this.#el('table');
        const head = this.#el('thead');
        const headRow = this.#el('tr');
        block.head.forEach((cell, c) => {
          const th = this.#el('th');
          th.scope = 'col';
          const align = block.align[c];
          if (align) th.dataset['align'] = align;
          this.#inlines(th, cell);
          headRow.append(th);
        });
        head.append(headRow);
        const body = this.#el('tbody');
        for (const row of block.rows) {
          const tr = this.#el('tr');
          for (let c = 0; c < block.head.length; c++) {
            const td = this.#el('td');
            const align = block.align[c];
            if (align) td.dataset['align'] = align;
            this.#inlines(td, row[c] ?? []);
            tr.append(td);
          }
          body.append(tr);
        }
        table.append(head, body);
        scroll.append(table);
        // Scrollable region must be reachable by keyboard.
        scroll.tabIndex = 0;
        return scroll;
      }
      case 'rule':
        return this.#el('hr');
      case 'html': {
        if (this.#options.html === 'sanitize' && this.#options.sanitize) {
          const clean = this.#options.sanitize(block.raw);
          if (clean) {
            const wrapper = this.#el('div', 'html-block');
            wrapper.append(this.#doc.importNode(clean, true));
            this.#clean(wrapper);
            return wrapper;
          }
        }
        const el = this.#el('p', 'raw-html');
        el.textContent = block.raw;
        return el;
      }
    }
  }

  #inlines(parent: Element, nodes: readonly Inline[]): void {
    for (const node of nodes) parent.append(this.#inline(node));
  }

  #inline(node: Inline): Node {
    switch (node.type) {
      case 'text':
        return this.#doc.createTextNode(node.text);
      case 'code': {
        const el = this.#el('code');
        el.textContent = node.text;
        return el;
      }
      case 'em':
      case 'strong':
      case 'del': {
        const el = this.#el(node.type);
        this.#inlines(el, node.children);
        return el;
      }
      case 'break':
        return this.#el('br');
      case 'citation':
        return this.#options.citation?.(node.id) ?? this.#doc.createTextNode(`[${node.id}]`);
      case 'link': {
        const href = safeUrl(node.href, this.#options.url ?? DEFAULT_URL_POLICY);
        if (!href) {
          const span = this.#el('span', 'unsafe-link');
          this.#inlines(span, node.children);
          return span;
        }
        const a = this.#el('a');
        a.href = href;
        a.rel = 'noopener noreferrer nofollow';
        if (this.#options.linkTarget === '_blank') a.target = '_blank';
        if (node.title) a.title = node.title;
        this.#inlines(a, node.children);
        return a;
      }
      case 'image': {
        const src = safeUrl(node.src, this.#options.url ?? DEFAULT_URL_POLICY);
        if (src && this.#options.images === 'load' && src.startsWith('https:')) {
          const img = this.#el('img');
          img.alt = node.alt;
          img.loading = 'lazy';
          img.referrerPolicy = 'no-referrer';
          img.src = src;
          return img;
        }
        const label = `${this.#options.imageLabel ?? 'Image'}: ${node.alt || src || ''}`.trim();
        if (!src) return this.#doc.createTextNode(label);
        const a = this.#el('a', 'image-link');
        a.href = src;
        a.rel = 'noopener noreferrer nofollow';
        a.textContent = label;
        return a;
      }
    }
  }

  /** Defense in depth over sanitizer output: no active content, handlers, styles, or unsafe URLs. */
  #clean(root: Element): void {
    const policy = this.#options.url ?? DEFAULT_URL_POLICY;
    for (const el of [...root.querySelectorAll('*')]) {
      if (REMOVE.has(el.localName)) {
        el.remove();
        continue;
      }
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'style' || name === 'srcdoc' || name === 'formaction')
          el.removeAttribute(attr.name);
        else if (URL_ATTRS.has(name)) {
          const url = name === 'srcset' ? undefined : safeUrl(attr.value, policy);
          if (url) el.setAttribute(attr.name, url);
          else el.removeAttribute(attr.name);
        }
      }
      if (el.localName === 'a') el.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  }
}

/** Plain text of a Markdown source for previews (no markup, citations as markers). */
export function toPlainText(source: string): string {
  const out: string[] = [];
  const inline = (nodes: readonly Inline[]): string =>
    nodes
      .map((n) =>
        n.type === 'text' || n.type === 'code'
          ? n.text
          : n.type === 'break'
            ? '\n'
            : n.type === 'citation'
              ? `[${n.id}]`
              : n.type === 'image'
                ? n.alt
                : inline(n.children),
      )
      .join('');
  const walk = (blocks: readonly Block[]) => {
    for (const b of blocks) {
      if (b.type === 'heading' || b.type === 'paragraph') out.push(inline(b.children));
      else if (b.type === 'code') out.push(b.text);
      else if (b.type === 'quote') walk(b.children);
      else if (b.type === 'list') for (const item of b.items) walk(item);
      else if (b.type === 'table')
        out.push(...[b.head, ...b.rows].map((r) => r.map(inline).join(' | ')));
      else if (b.type === 'html') out.push(b.raw);
    }
  };
  walk(parseBlocks(source));
  return out.join('\n');
}
