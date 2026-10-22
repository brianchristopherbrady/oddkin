/**
 * `@oddkin/workbench/preview` — isolated preview frames and preview-owned stylesheets. Each
 * frame has its own registry and module realm. `reload()` advances its generation for reset or
 * registration replacement; frames execute trusted project code and are not a security sandbox.
 * A shared component stylesheet is never mutated: inside one preview scope it is swapped for a
 * copy, and edits replace the copy's rules without remounting elements (theming-and-styling.md §11).
 */
import type { CSSResult } from '@oddkin/core/styles';

export interface PreviewStyles {
  /** The preview-owned copy adopted in place of the shared sheet. */
  readonly sheet: CSSStyleSheet;
  /** Replace the copy's rules, e.g. with a recipe regenerated from edited conditions. */
  update(cssText: string): void;
  /** Swap the copy into roots added to the scope since the last call; returns how many. */
  refresh(): number;
  /** Put the shared sheet back everywhere the copy was adopted. */
  restore(): void;
}

/** Open shadow roots under `scope`, nested ones included. */
function shadowRoots(scope: Element): ShadowRoot[] {
  const roots: ShadowRoot[] = [];
  const visit = (node: Element | ShadowRoot) => {
    for (const element of node.querySelectorAll('*')) {
      if (element.shadowRoot) {
        roots.push(element.shadowRoot);
        visit(element.shadowRoot);
      }
    }
  };
  if (scope.shadowRoot) {
    roots.push(scope.shadowRoot);
    visit(scope.shadowRoot);
  }
  visit(scope);
  return roots;
}

/**
 * Within `scope`, adopt a preview-owned copy of `shared` wherever the shared sheet is adopted.
 * Roots outside the scope, and the shared sheet itself, are left exactly as they were.
 */
export function previewStyles(shared: CSSResult, scope: Element): PreviewStyles {
  const doc = scope.ownerDocument;
  const original = shared.sheetFor(doc);
  if (!original)
    throw new Error('previewStyles: constructable stylesheets are unavailable in this document.');
  const view = doc.defaultView as Window & typeof globalThis;
  const sheet = new view.CSSStyleSheet();
  sheet.replaceSync(shared.cssText);
  const swapped = new Set<ShadowRoot>();
  const swap = (root: ShadowRoot, from: CSSStyleSheet, to: CSSStyleSheet) => {
    root.adoptedStyleSheets = root.adoptedStyleSheets.map((s) => (s === from ? to : s));
  };
  const refresh = () => {
    let count = 0;
    for (const root of shadowRoots(scope))
      if (!swapped.has(root) && root.adoptedStyleSheets.includes(original)) {
        swap(root, original, sheet);
        swapped.add(root);
        count++;
      }
    return count;
  };
  refresh();
  return {
    sheet,
    update: (cssText) => sheet.replaceSync(cssText),
    refresh,
    restore() {
      for (const root of swapped) swap(root, sheet, original);
      swapped.clear();
    },
  };
}

export { createIsolatedPreview, PreviewFrameError, previewProtocolStats } from './frame.js';
export type { IsolatedPreview, IsolatedPreviewOptions } from './frame.js';
