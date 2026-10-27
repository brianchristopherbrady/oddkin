/**
 * `@oddkin/components/autoload` (ADR 0046 D9): opt-in registration on first use. Importing it
 * registers every `odd-*` element in the document that is not yet defined, and each one added
 * later, by importing that tag's `define/<name>` entry (once per tag), resolved relative to this
 * module so import maps and CDNs serve the same files. `observe(root)` does the same inside a
 * shadow root the page creates. An `odd-*` tag that is not an Oddkin element is reported once
 * (`autoload.tag.unknown`).
 *
 * Explicit `define/<name>` imports stay the recommended production path: a bundler sees them,
 * the browser can preload them, and nothing is fetched after first render. No other entry
 * imports this module.
 */
import { OddkinError, reportOddkinError } from '@oddkin/core/diagnostics';
import { DEFINED_NAMES } from './names.js';

const known = new Set<string>(DEFINED_NAMES);
const requested = new Map<string, Promise<void>>();

/**
 * Register `tag` if it is an Oddkin element not yet defined: resolves once its definition (and
 * those it depends on) is registered. Unknown `odd-*` tags are reported once and resolve at once.
 */
export function load(tag: string): Promise<void> {
  const name = tag.toLowerCase();
  const pending = requested.get(name);
  if (pending) return pending;
  let promise: Promise<void>;
  if (customElements.get(name)) promise = Promise.resolve();
  else if (!name.startsWith('odd-') || !known.has(name.slice(4))) {
    if (name.startsWith('odd-'))
      reportOddkinError(
        new OddkinError(
          'autoload.tag.unknown',
          `<${name}> is not an element of @oddkin/components; check the tag name, or import its definition.`,
        ),
        { code: 'autoload.tag.unknown', origin: name },
      );
    promise = Promise.resolve();
  } else {
    const entry = name.slice(4);
    promise = import(new URL(`../${entry}/${entry}.define.js`, import.meta.url).href).then(
      () => undefined,
    );
  }
  requested.set(name, promise);
  return promise;
}

function scan(root: ParentNode): void {
  for (const element of root.querySelectorAll(':not(:defined)'))
    if (element.localName.startsWith('odd-')) void load(element.localName);
}

/**
 * Register the `odd-*` elements in `root` (a document, a shadow root, or an element) and every one
 * added under it later. Returns a function that stops observing.
 */
export function observe(root: Document | ShadowRoot | Element): () => void {
  scan(root);
  const observer = new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (node instanceof Element) {
          if (node.localName.startsWith('odd-') && !customElements.get(node.localName))
            void load(node.localName);
          scan(node);
        }
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}

observe(document);
