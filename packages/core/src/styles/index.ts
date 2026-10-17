/**
 * `@mote/core/styles` — trusted CSS fragments and per-document sheet reuse.
 * Contract: docs/architecture/core-contracts.md §6, docs/architecture/theming-and-styling.md.
 */
import { DEV } from '../internal/dev.js';
import { MoteError } from '../diagnostics/index.js';

const CSS_RESULT: unique symbol = Symbol.for('mote.cssResult') as never;

/** A trusted stylesheet fragment. Create with `css` or, for vetted strings, `unsafeCSS`. */
export class CSSResult {
  readonly [CSS_RESULT] = true;
  readonly cssText: string;
  readonly #sheets = new WeakMap<Document, CSSStyleSheet>();

  /** @internal Use `css` or `unsafeCSS`. */
  constructor(cssText: string, token: symbol) {
    if (token !== CONSTRUCT)
      throw new MoteError('style.construct', DEV ? 'Create CSS with css`` or unsafeCSS().' : '');
    this.cssText = cssText;
  }

  /**
   * The constructed sheet for `doc`, created once per document and shared by every
   * element in it. Returns undefined where constructable stylesheets are unavailable.
   */
  sheetFor(doc: Document): CSSStyleSheet | undefined {
    let sheet = this.#sheets.get(doc);
    if (sheet) return sheet;
    const view = doc.defaultView as (Window & typeof globalThis) | null;
    if (!view || !supportsAdoption(doc)) return undefined;
    sheet = new view.CSSStyleSheet();
    sheet.replaceSync(this.cssText);
    this.#sheets.set(doc, sheet);
    return sheet;
  }

  toString(): string {
    return this.cssText;
  }
}

const CONSTRUCT = Symbol('construct');

export function isCSSResult(value: unknown): value is CSSResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[CSS_RESULT] === true
  );
}

const VAR_REFERENCE = /^var\(\s*--[A-Za-z0-9_-]+\s*(?:,(.*))?\)$/s;
const FORBIDDEN_IN_FALLBACK =
  /[;{}<>\\"'@!]|\/\*|url\s*\(|image\s*\(|image-set\s*\(|expression\s*\(/i;

/**
 * True for a CSS custom-property reference such as `var(--mote-space-md)` or
 * `var(--x, 0.75rem)`: one `var()` whose fallback is a plain value (numbers, units,
 * keywords, colours, functions, nested `var()`) with balanced parentheses and no
 * declaration, block, string, comment, `url()`, or at-rule syntax.
 */
export function isCSSVariableReference(value: string): boolean {
  if (value.length > 512) return false;
  const match = VAR_REFERENCE.exec(value.trim());
  if (!match) return false;
  const fallback = match[1];
  if (fallback === undefined) return true;
  if (FORBIDDEN_IN_FALLBACK.test(fallback)) return false;
  let depth = 0;
  for (const ch of fallback) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Tagged CSS. Interpolations may be other `css` results, finite numbers, or custom-property
 * references (`var(--name)` / `var(--name, fallback)`, e.g. from `token()`); other strings
 * are rejected so runtime data cannot inject rules. Use custom properties for dynamic values.
 */
export function css(
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<CSSResult | number | string>
): CSSResult {
  let text = strings[0] ?? '';
  values.forEach((value, i) => {
    if (isCSSResult(value)) text += value.cssText;
    else if (typeof value === 'number' && Number.isFinite(value)) text += String(value);
    else if (typeof value === 'string' && isCSSVariableReference(value)) text += value.trim();
    else {
      throw new MoteError(
        'style.interpolation.untrusted',
        DEV
          ? `css\`\` interpolation ${i} (${typeof value === 'string' ? `"${value.slice(0, 40)}"` : typeof value}) is not allowed. Use css results, finite numbers, or var(--name[, fallback]) references; pass dynamic values through custom properties, or wrap vetted text with unsafeCSS().`
          : '',
      );
    }
    text += strings[i + 1] ?? '';
  });
  return new CSSResult(text, CONSTRUCT);
}
/** Wrap CSS text you have vetted. Never pass user input. */
export function unsafeCSS(cssText: string): CSSResult {
  return new CSSResult(String(cssText), CONSTRUCT);
}

export type StyleInput = CSSResult | readonly StyleInput[];

export function flattenStyles(styles: StyleInput | undefined): CSSResult[] {
  if (!styles) return [];
  if (isCSSResult(styles)) return [styles];
  const out: CSSResult[] = [];
  const seen = new Set<CSSResult>();
  const visit = (input: StyleInput) => {
    if (isCSSResult(input)) {
      if (!seen.has(input)) {
        seen.add(input);
        out.push(input);
      }
    } else for (const nested of input) visit(nested);
  };
  visit(styles);
  return out;
}

function supportsAdoption(doc: Document): boolean {
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  return !!view && 'adoptedStyleSheets' in doc && 'replaceSync' in view.CSSStyleSheet.prototype;
}

export interface AdoptOptions {
  /** CSP nonce for the `<style>` fallback. */
  readonly nonce?: string | undefined;
  /** Force the `<style>` fallback (tests, environments without constructable sheets). */
  readonly fallback?: boolean | undefined;
}

const adopted = new WeakMap<
  ShadowRoot | Document,
  { sheets: CSSStyleSheet[]; elements: HTMLStyleElement[] }
>();

/**
 * Apply styles to a shadow root or document, replacing styles Mote applied before and
 * keeping sheets adopted by others. Uses one shared constructed sheet per document,
 * falling back to `<style>` elements (with an optional nonce).
 */
export function adoptStyles(
  root: ShadowRoot | Document,
  styles: StyleInput | undefined,
  options: AdoptOptions = {},
): void {
  const doc = (root.nodeType === Node.DOCUMENT_NODE ? root : root.ownerDocument) as Document;
  const list = flattenStyles(styles);
  const previous = adopted.get(root);
  if (previous) {
    if (previous.sheets.length)
      root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => !previous.sheets.includes(s));
    for (const el of previous.elements) el.remove();
  }
  const record = { sheets: [] as CSSStyleSheet[], elements: [] as HTMLStyleElement[] };
  const sheets = options.fallback ? undefined : list.map((s) => s.sheetFor(doc));
  if (sheets && sheets.every((s): s is CSSStyleSheet => s !== undefined)) {
    record.sheets = sheets;
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...sheets];
  } else {
    const parent =
      root.nodeType === Node.DOCUMENT_NODE ? (root as Document).head : (root as ShadowRoot);
    let before = parent.firstChild;
    for (const style of list) {
      const el = doc.createElement('style');
      if (options.nonce) el.nonce = options.nonce;
      el.textContent = style.cssText;
      parent.insertBefore(el, before);
      before = el.nextSibling;
      record.elements.push(el);
    }
  }
  adopted.set(root, record);
}

interface Retained {
  count: number;
  sheet: CSSStyleSheet | undefined;
  element: HTMLStyleElement | undefined;
}

const retainedByRoot = new WeakMap<ShadowRoot | Document, Map<CSSResult, Retained>>();

/**
 * Add styles to a shared root (a document or shadow root) on behalf of one owner, such
 * as a light-DOM component instance. Each style is added once per root however many
 * owners retain it, and removed when the last owner releases it. Returns the release
 * function. Selectors are not scoped: light-DOM styles must scope themselves (e.g. by
 * tag name or class), because light DOM is not encapsulated.
 */
export function retainStyles(
  root: ShadowRoot | Document,
  styles: StyleInput | undefined,
  options: AdoptOptions = {},
): () => void {
  const isDocument = root.nodeType === Node.DOCUMENT_NODE;
  const doc = (isDocument ? root : root.ownerDocument) as Document;
  const list = flattenStyles(styles);
  let table = retainedByRoot.get(root);
  if (!table) {
    table = new Map();
    retainedByRoot.set(root, table);
  }
  for (const style of list) {
    let entry = table.get(style);
    if (!entry) {
      const sheet = options.fallback ? undefined : style.sheetFor(doc);
      entry = { count: 0, sheet, element: undefined };
      if (sheet) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      else {
        const el = doc.createElement('style');
        if (options.nonce) el.nonce = options.nonce;
        el.textContent = style.cssText;
        if (isDocument) (root as Document).head.append(el);
        else (root as ShadowRoot).prepend(el);
        entry.element = el;
      }
      table.set(style, entry);
    }
    entry.count++;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const style of list) {
      const entry = table.get(style);
      if (!entry || --entry.count > 0) continue;
      table.delete(style);
      if (entry.sheet)
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => s !== entry.sheet);
      entry.element?.remove();
    }
  };
}
