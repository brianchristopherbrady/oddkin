/**
 * One-time template preparation: lex the static strings to locate each binding,
 * produce marker HTML, parse it once into a `<template>`, and record part positions.
 * Prepared templates are cached by strings identity.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError } from '../diagnostics/index.js';
import type { TemplateKind } from './result.js';

export type AttributePartType = 'attribute' | 'boolean' | 'property' | 'event';

export interface AttributeDescriptor {
  readonly type: AttributePartType;
  /** Name as written in the source (case preserved), without the prefix. */
  readonly name: string;
  /** Static text around the bindings; length is binding count + 1. */
  readonly strings: readonly string[];
}

export type PartDescriptor =
  | { readonly kind: 'child'; readonly node: number }
  | { readonly kind: 'attribute'; readonly node: number; readonly attribute: AttributeDescriptor };

export interface PreparedTemplate {
  readonly kind: TemplateKind;
  readonly element: HTMLTemplateElement;
  readonly parts: readonly PartDescriptor[];
}

const MARKER = `oddkin-${Math.random().toString(36).slice(2, 9)}`;
const ATTRIBUTE_MARKER = `${MARKER}-a`;
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);
const UNSAFE_PROPERTIES = new Set(['innerHTML', 'outerHTML', 'srcdoc']);

// Lexer states.
const TEXT = 0;
const COMMENT = 1;
const BOGUS = 2;
const TAG_NAME = 3;
const TAG = 4;
const ATTR_NAME = 5;
const AFTER_ATTR_NAME = 6;
const BEFORE_VALUE = 7;
const VALUE_DQ = 8;
const VALUE_SQ = 9;
const VALUE_UQ = 10;
const RAW = 11;

const isSpace = (ch: string) =>
  ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f';
const isLetter = (ch: string | undefined) => !!ch && /[a-zA-Z]/.test(ch);

function location(strings: readonly string[], index: number): string {
  const before = strings.slice(0, index + 1).join('${…}');
  const tail = before.slice(-60).replace(/\s+/g, ' ').trim();
  return `binding ${index} (after "…${tail}")`;
}

interface OpenAttribute {
  start: number;
  name: string;
  segments: string[];
  current: string;
  bound: boolean;
}

/** Produce the marker HTML and attribute descriptors for a template's strings. */
export function buildTemplateHtml(strings: readonly string[]): {
  html: string;
  attributes: AttributeDescriptor[];
} {
  let out = '';
  let state = TEXT;
  let tagName = '';
  let closing = false;
  let rawEnd = '';
  let attr: OpenAttribute | undefined;
  const attributes: AttributeDescriptor[] = [];

  const finishAttribute = () => {
    if (!attr) return;
    if (attr.bound) {
      attr.segments.push(attr.current);
      const written = attr.name;
      const prefix = written[0];
      const type: AttributePartType =
        prefix === '?'
          ? 'boolean'
          : prefix === '.'
            ? 'property'
            : prefix === '@'
              ? 'event'
              : 'attribute';
      const name = type === 'attribute' ? written : written.slice(1);
      const index = attributes.length;
      if (
        type !== 'attribute' &&
        (attr.segments.length !== 2 || attr.segments.some((s) => s !== ''))
      ) {
        throw new OddkinError(
          'template.binding.mixed',
          DEV
            ? `The "${written}" binding must be a single interpolation with no surrounding text, e.g. ${written}=\${value}.`
            : '',
        );
      }
      if (type === 'attribute' && /^on/i.test(name)) {
        throw new OddkinError(
          'template.attribute.unsafe',
          DEV
            ? `Binding the "${name}" event-handler attribute is not allowed. Use @${name.slice(2)}=\${handler}.`
            : '',
        );
      }
      if (
        UNSAFE_PROPERTIES.has(name) ||
        (type === 'attribute' && name.toLowerCase() === 'srcdoc')
      ) {
        throw new OddkinError(
          'template.sink.unsafe',
          DEV
            ? `Binding "${written}" would parse a string as markup. Render a template or node in a child position instead.`
            : '',
        );
      }
      out = out.slice(0, attr.start) + `${ATTRIBUTE_MARKER}${index}`;
      attributes.push({ type, name, strings: attr.segments });
    }
    attr = undefined;
  };

  const endTag = () => {
    out += '>';
    const lower = tagName.toLowerCase();
    if (!closing && RAW_TEXT.has(lower)) {
      state = RAW;
      rawEnd = `</${lower}`;
    } else {
      state = TEXT;
    }
  };

  for (let i = 0; i < strings.length; i++) {
    const chunk = strings[i] ?? '';
    for (let j = 0; j < chunk.length; j++) {
      const ch = chunk[j] as string;
      switch (state) {
        case TEXT:
          if (ch === '<') {
            const next = chunk[j + 1];
            if (chunk.startsWith('<!--', j)) {
              state = COMMENT;
              out += '<!--';
              j += 3;
              continue;
            }
            if (next === '!' || next === '?') {
              state = BOGUS;
            } else if (next === '/' && isLetter(chunk[j + 2])) {
              state = TAG_NAME;
              closing = true;
              tagName = '';
              out += '</';
              j += 1;
              continue;
            } else if (isLetter(next)) {
              state = TAG_NAME;
              closing = false;
              tagName = '';
            }
          }
          out += ch;
          break;
        case COMMENT:
          if (chunk.startsWith('-->', j)) {
            out += '-->';
            j += 2;
            state = TEXT;
            continue;
          }
          out += ch;
          break;
        case BOGUS:
          out += ch;
          if (ch === '>') state = TEXT;
          break;
        case RAW:
          if (chunk.slice(j, j + rawEnd.length).toLowerCase() === rawEnd) {
            state = TAG_NAME;
            closing = true;
            tagName = rawEnd.slice(2);
            out += chunk.slice(j, j + rawEnd.length);
            j += rawEnd.length - 1;
            continue;
          }
          out += ch;
          break;
        case TAG_NAME:
          if (isSpace(ch) || ch === '/') {
            state = TAG;
            out += ch;
          } else if (ch === '>') {
            endTag();
          } else {
            tagName += ch;
            out += ch;
          }
          break;
        case TAG:
          if (ch === '>') endTag();
          else if (isSpace(ch) || ch === '/') out += ch;
          else {
            attr = { start: out.length, name: ch, segments: [], current: '', bound: false };
            state = ATTR_NAME;
            out += ch;
          }
          break;
        case ATTR_NAME:
          if (isSpace(ch)) {
            state = AFTER_ATTR_NAME;
            out += ch;
          } else if (ch === '=') {
            state = BEFORE_VALUE;
            out += ch;
          } else if (ch === '>') {
            finishAttribute();
            endTag();
          } else if (ch === '/') {
            finishAttribute();
            state = TAG;
            out += ch;
          } else {
            (attr as OpenAttribute).name += ch;
            out += ch;
          }
          break;
        case AFTER_ATTR_NAME:
          if (isSpace(ch)) out += ch;
          else if (ch === '=') {
            state = BEFORE_VALUE;
            out += ch;
          } else {
            finishAttribute();
            state = TAG;
            j--;
          }
          break;
        case BEFORE_VALUE:
          if (isSpace(ch)) out += ch;
          else if (ch === '"') {
            state = VALUE_DQ;
            out += ch;
          } else if (ch === "'") {
            state = VALUE_SQ;
            out += ch;
          } else if (ch === '>') {
            finishAttribute();
            endTag();
          } else {
            state = VALUE_UQ;
            j--;
          }
          break;
        case VALUE_DQ:
        case VALUE_SQ:
          out += ch;
          if (ch === (state === VALUE_DQ ? '"' : "'")) {
            finishAttribute();
            state = TAG;
          } else {
            (attr as OpenAttribute).current += ch;
          }
          break;
        case VALUE_UQ:
          if (isSpace(ch) || ch === '>') {
            finishAttribute();
            state = TAG;
            j--;
          } else {
            (attr as OpenAttribute).current += ch;
            out += ch;
          }
          break;
      }
    }

    if (i === strings.length - 1) break;

    // A binding follows this chunk.
    switch (state) {
      case TEXT:
        if (/<\/?$/.test(chunk)) {
          throw new OddkinError(
            'template.binding.position',
            DEV
              ? `${location(strings, i)} is in a tag-name position. Dynamic tag names are not supported; branch with when() or match() between static tags.`
              : '',
          );
        }
        out += `<!--${MARKER}-->`;
        break;
      case BEFORE_VALUE:
      case VALUE_DQ:
      case VALUE_SQ:
      case VALUE_UQ: {
        if (state === BEFORE_VALUE) state = VALUE_UQ;
        const open = attr as OpenAttribute;
        open.bound = true;
        open.segments.push(open.current);
        open.current = '';
        break;
      }
      case RAW:
        throw new OddkinError(
          'template.binding.rawText',
          DEV
            ? `${location(strings, i)} is inside <${tagName.toLowerCase()}>, whose text is not parsed as markup. Bind its content as a property (e.g. .value=\${…} on <textarea>) or use css\`\` for styles.`
            : '',
        );
      case COMMENT:
      case BOGUS:
        throw new OddkinError(
          'template.binding.position',
          DEV ? `${location(strings, i)} is inside a comment.` : '',
        );
      default:
        throw new OddkinError(
          'template.binding.position',
          DEV
            ? `${location(strings, i)} is in a tag-name or attribute-name position. Bind attribute values (name=\${…}) or child content instead; dynamic tag and attribute names are not supported.`
            : '',
        );
    }
  }
  if (state !== TEXT && state !== RAW) {
    throw new OddkinError(
      'template.parse.unclosed',
      DEV ? 'The template ends inside a tag, attribute, or comment.' : '',
    );
  }
  return { html: out, attributes };
}

let policy: { createHTML(input: string): unknown } | undefined | null;

function toHTML(markup: string): string {
  if (policy === undefined) {
    const trustedTypes = (
      globalThis as { trustedTypes?: { createPolicy(name: string, rules: object): typeof policy } }
    ).trustedTypes;
    try {
      // The input is author-written template source with markers, never runtime values.
      policy =
        trustedTypes?.createPolicy('oddkin-template', { createHTML: (input: string) => input }) ??
        null;
    } catch {
      policy = null;
    }
  }
  return (policy ? policy.createHTML(markup) : markup) as string;
}

const caches: Record<TemplateKind, WeakMap<TemplateStringsArray, PreparedTemplate>> = {
  html: new WeakMap(),
  svg: new WeakMap(),
};

export function prepareTemplate(
  strings: TemplateStringsArray,
  kind: TemplateKind,
): PreparedTemplate {
  const cache = caches[kind];
  const cached = cache.get(strings);
  if (cached) return cached;

  const { html, attributes } = buildTemplateHtml(strings);
  const element = document.createElement('template');
  element.innerHTML = toHTML(kind === 'svg' ? `<svg>${html}</svg>` : html);
  if (kind === 'svg') {
    const root = element.content.firstChild as Element;
    root.replaceWith(...root.childNodes);
  }

  const parts: PartDescriptor[] = [];
  const walker = document.createTreeWalker(
    element.content,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
  );
  let index = -1;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    index++;
    if (node.nodeType === Node.COMMENT_NODE) {
      if ((node as Comment).data === MARKER) parts.push({ kind: 'child', node: index });
      continue;
    }
    const el = node as Element;
    const found: number[] = [];
    for (const name of el.getAttributeNames()) {
      if (name.startsWith(ATTRIBUTE_MARKER)) {
        found.push(Number(name.slice(ATTRIBUTE_MARKER.length)));
        el.removeAttribute(name);
      }
    }
    found.sort((a, b) => a - b);
    for (const n of found) {
      parts.push({
        kind: 'attribute',
        node: index,
        attribute: attributes[n] as AttributeDescriptor,
      });
    }
  }

  const expected = strings.length - 1;
  const actual = parts.reduce(
    (sum, p) => sum + (p.kind === 'child' ? 1 : p.attribute.strings.length - 1),
    0,
  );
  if (actual !== expected) {
    throw new OddkinError(
      'template.parse.mismatch',
      DEV
        ? `Found ${actual} of ${expected} bindings after parsing. Bindings inside a nested <template> element or in markup the HTML parser moves (e.g. text directly inside <table>) are not supported.`
        : '',
    );
  }

  const prepared: PreparedTemplate = { kind, element, parts };
  cache.set(strings, prepared);
  return prepared;
}
