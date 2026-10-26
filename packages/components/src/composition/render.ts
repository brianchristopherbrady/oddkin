/**
 * `renderComposition()`: builds a validated composition with `document.createElement` only:
 * allow-listed, registered elements, attributes and properties by their declared kind, and text
 * as text. Events reach the host as action names. Contract: docs/architecture/data-composition.md §8.
 */
import type { JsonValue } from '@oddkin/core/model';
import { CATALOG } from './catalog.js';
import {
  validateComposition,
  type CompositionDiagnostic,
  type CompositionDocument,
  type CompositionElement,
  type CompositionLimits,
  type CompositionNode,
} from './validate.js';

/** An event of a rendered element, mapped to an action name by the composition. */
export interface CompositionAction {
  readonly action: string;
  readonly event: Event;
  readonly element: Element;
  /** The element's composition `id`, if it has one. */
  readonly id: string | undefined;
}

export interface RenderCompositionOptions {
  /** Every tag the renderer may create, natives included; anything else is refused. */
  readonly allow: readonly string[];
  /** Called for each mapped event; the composition never carries a handler. */
  readonly onAction?: (action: CompositionAction) => void;
  readonly limits?: CompositionLimits;
}

export interface RenderedComposition {
  /** False when the document was refused; nothing was rendered then. */
  readonly ok: boolean;
  readonly diagnostics: readonly CompositionDiagnostic[];
  /** The top-level nodes appended to the target. */
  readonly nodes: readonly Node[];
  /** Removes the nodes and their action listeners. */
  dispose(): void;
}

const refused = (diagnostics: readonly CompositionDiagnostic[]): RenderedComposition => ({
  ok: false,
  diagnostics,
  nodes: [],
  dispose() {},
});

/** Validate `document`, then append it to `target`; refuse it whole if any check fails. */
export function renderComposition(
  document: unknown,
  target: ParentNode,
  options: RenderCompositionOptions,
): RenderedComposition {
  const validation = validateComposition(document, { limits: options.limits ?? {} });
  if (!validation.ok) return refused(validation.diagnostics);
  const root = (document as CompositionDocument).root;
  const owner = (target as Node).ownerDocument ?? (target as unknown as Document);
  // The target's own registry: a frame registers its own elements.
  const registry = owner.defaultView?.customElements;
  const diagnostics: CompositionDiagnostic[] = [];
  const walk = (nodes: readonly CompositionNode[], path: string) =>
    nodes.forEach((node, i) => {
      if (typeof node === 'string') return;
      const at = `${path}/${i}/element`;
      if (!options.allow.includes(node.element))
        diagnostics.push({
          code: 'composition.element.notAllowed',
          severity: 'error',
          path: at,
          message: `"${node.element}" is not in this renderer's allow-list.`,
        });
      else if (Object.hasOwn(CATALOG, node.element) && !registry?.get(node.element))
        diagnostics.push({
          code: 'composition.element.unregistered',
          severity: 'error',
          path: at,
          message: `"${node.element}" is not registered.`,
          suggestion: `Import its registration entry first, e.g. @oddkin/components/define/${node.element.slice(4)}.`,
        });
      walk(node.children ?? [], `${path}/${i}/children`);
    });
  walk(root, '/root');
  if (diagnostics.length) return refused(diagnostics);

  const listeners = new AbortController();
  const create = (node: CompositionNode): Node => {
    if (typeof node === 'string') return owner.createTextNode(node);
    return element(node);
  };
  const element = (node: CompositionElement): Element => {
    const el = owner.createElement(node.element);
    if (node.id !== undefined) el.id = node.id;
    if (node.slot !== undefined) el.setAttribute('slot', node.slot);
    for (const [name, value] of Object.entries(node.attributes ?? {}))
      setAttribute(el, name, value);
    // After the attributes, as script after markup: a property such as `value` wins.
    for (const [name, value] of Object.entries(node.properties ?? {}))
      (el as unknown as Record<string, unknown>)[name] = value;
    for (const [event, action] of Object.entries(node.actions ?? {}))
      el.addEventListener(
        event,
        (e) => options.onAction?.({ action, event: e, element: el, id: node.id }),
        { signal: listeners.signal },
      );
    el.append(...(node.children ?? []).map(create));
    return el;
  };
  const nodes = root.map(create);
  target.append(...nodes);
  return {
    ok: true,
    diagnostics: validation.diagnostics,
    nodes,
    dispose() {
      listeners.abort();
      for (const node of nodes) node.parentNode?.removeChild(node);
    },
  };
}

function setAttribute(el: Element, name: string, value: JsonValue): void {
  if (value === false) return;
  el.setAttribute(name, value === true ? '' : String(value));
}
