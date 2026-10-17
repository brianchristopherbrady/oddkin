/**
 * `@mote/core/styles` — trusted CSS fragments and per-document sheet reuse.
 * Contract: docs/architecture/core-contracts.md §6, docs/architecture/theming-and-styling.md.
 */
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
      throw new MoteError('style.construct', 'Create CSS with css`` or unsafeCSS().');
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

/**
 * Tagged CSS. Interpolations may be other `css` results or finite numbers; strings are
 * rejected so runtime data cannot inject rules. Use custom properties for dynamic values.
 */
export function css(
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<CSSResult | number>
): CSSResult {
  let text = strings[0] ?? '';
  values.forEach((value, i) => {
    if (isCSSResult(value)) text += value.cssText;
    else if (typeof value === 'number' && Number.isFinite(value)) text += String(value);
    else {
      throw new MoteError(
        'style.interpolation.untrusted',
        `css\`\` interpolation ${i} is a ${typeof value}. Only css results and finite numbers are allowed; pass dynamic values through custom properties, or wrap vetted text with unsafeCSS().`,
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
