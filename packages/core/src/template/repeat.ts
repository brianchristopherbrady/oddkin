/**
 * Keyed reconciliation for `repeat()`. Lives apart from `ChildPart` so templates that never
 * use `repeat()` do not ship the move/LIS/focus-restoration code: the directive carries its
 * own reconciler and `ChildPart` only calls it.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError, reportOddkinError } from '../diagnostics/index.js';

/** @internal Marker key on repeat directives; its value is the reconciler. */
export const REPEAT: unique symbol = Symbol.for('oddkin.repeat') as never;

/** @internal What the reconciler needs from the owning child part. */
export interface RepeatItemPart {
  readonly startNode: Comment | null;
  readonly endNode: Node | null;
  setValue(value: unknown): void;
  remove(): void;
}

/** @internal Keyed list description produced by `repeat()`. */
export interface RepeatDirective<T = unknown> {
  readonly [REPEAT]: typeof reconcile;
  readonly items: Iterable<T>;
  readonly key: (item: T, index: number) => unknown;
  readonly template: (item: T, index: number) => unknown;
}

export function createRepeat<T>(
  items: Iterable<T>,
  key: (item: T, index: number) => unknown,
  template: (item: T, index: number) => unknown,
): RepeatDirective<T> {
  return { [REPEAT]: reconcile, items, key, template };
}

const supportsMoveBefore = typeof Element !== 'undefined' && 'moveBefore' in Element.prototype;

type Focusable = HTMLElement & {
  selectionStart?: number | null;
  selectionEnd?: number | null;
  setSelectionRange?(a: number, b: number): void;
};

/** The focused element inside `root`, following open shadow roots to the deepest one. */
function deepActiveElement(root: Node): Focusable | null {
  let active = (root.getRootNode() as Document | ShadowRoot).activeElement as Focusable | null;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement as Focusable;
  return active;
}

interface FocusSnapshot {
  readonly element: Focusable;
  readonly selection: [number, number] | undefined;
}

/** Remember the focused element (and text selection) under `parent` before fallback moves. */
function captureFocus(parent: Node): FocusSnapshot | null {
  const element = deepActiveElement(parent);
  if (!element || !parent.contains((parent.getRootNode() as Document | ShadowRoot).activeElement)) {
    return null;
  }
  let selection: [number, number] | undefined;
  try {
    if (typeof element.selectionStart === 'number' && typeof element.selectionEnd === 'number') {
      selection = [element.selectionStart, element.selectionEnd];
    }
  } catch {
    // Inputs without selection support.
  }
  return { element, selection };
}

/** Without moveBefore, removing a focused subtree blurs it: restore focus and selection. */
function restoreFocus(snapshot: FocusSnapshot, parent: Node): void {
  const { element, selection } = snapshot;
  if (!element.isConnected || deepActiveElement(parent) === element) return;
  element.focus({ preventScroll: true });
  try {
    if (selection) element.setSelectionRange?.(selection[0], selection[1]);
  } catch {
    // Selection unsupported.
  }
}

function rangeNodes(start: Node, end: Node): Node[] {
  const nodes: Node[] = [];
  for (let node: Node | null = start; node; node = node.nextSibling) {
    nodes.push(node);
    if (node === end) break;
  }
  return nodes;
}

/** State-preserving move (focus, iframes, animations) with moveBefore. */
function moveRange(start: Node, end: Node, before: Node | null): void {
  const parent = start.parentNode as ParentNode & Node;
  for (const node of rangeNodes(start, end)) {
    try {
      (parent as unknown as { moveBefore(n: Node, ref: Node | null): void }).moveBefore(
        node,
        before,
      );
    } catch {
      parent.insertBefore(node, before);
    }
  }
}

/**
 * Fallback without moveBefore: detach the moving ranges starting from the end of the list,
 * then insert each run of consecutive moved items before its stable anchor as one fragment.
 * Per-item insertBefore is quadratic in engines that renumber following list items on every
 * mutation (WebKit: ~300 ms to reverse 1,000 <li>; batched: ~6 ms).
 */
function moveBatched<P extends RepeatItemPart>(
  parent: Node,
  items: readonly P[],
  stable: ReadonlySet<number>,
  previousIndex: ReadonlyMap<P, number>,
  previousLength: number,
  end: Node | null,
): void {
  const focus = captureFocus(parent);
  // Current DOM position: kept parts by previous index; new parts were appended in order.
  const moving = items
    .map((part, i) => ({ part, i, position: previousIndex.get(part) ?? previousLength + i }))
    .filter(({ i }) => !stable.has(i))
    .sort((a, b) => b.position - a.position);
  const detached = new Map<P, Node[]>();
  for (const { part } of moving) {
    const nodes = rangeNodes(part.startNode as Comment, part.endNode as Node);
    for (let k = nodes.length - 1; k >= 0; k--) (nodes[k] as ChildNode).remove();
    detached.set(part, nodes);
  }
  const fragment = (parent.ownerDocument ?? (parent as Document)).createDocumentFragment();
  for (const part of items) {
    const nodes = detached.get(part);
    if (nodes) fragment.append(...nodes);
    else if (fragment.firstChild) parent.insertBefore(fragment, part.startNode);
  }
  if (fragment.firstChild) parent.insertBefore(fragment, end);
  if (focus) restoreFocus(focus, parent);
}

/** Indices (into `sequence`) of one longest strictly increasing subsequence, ignoring negatives. */
function longestIncreasing(sequence: readonly number[]): Set<number> {
  const tails: number[] = [];
  const previous: number[] = new Array<number>(sequence.length).fill(-1);
  sequence.forEach((value, i) => {
    if (value < 0) return;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((sequence[tails[mid] as number] as number) < value) low = mid + 1;
      else high = mid;
    }
    if (low > 0) previous[i] = tails[low - 1] as number;
    tails[low] = i;
  });
  const out = new Set<number>();
  for (let i = tails[tails.length - 1] ?? -1; i >= 0; i = previous[i] as number) out.add(i);
  return out;
}

/**
 * Reconcile `previous` item parts (with their `previousKeys`) against the directive. Returns
 * the new item parts and keys, and whether the DOM structure changed.
 */
function reconcile<P extends RepeatItemPart>(
  directive: RepeatDirective,
  previous: readonly P[],
  previousKeys: readonly unknown[],
  createItem: () => P,
  end: Node | null,
): { items: P[]; keys: unknown[]; changed: boolean } {
  const old = new Map<unknown, P>();
  previousKeys.forEach((key, i) => old.set(key, previous[i] as P));
  const previousIndex = new Map<P, number>(previous.map((part, i) => [part, i]));
  const items: P[] = [];
  const keys: unknown[] = [];
  const seen = new Set<unknown>();
  let index = 0;
  let changed = false;
  for (const item of directive.items) {
    let key = directive.key(item, index);
    if (seen.has(key)) {
      reportOddkinError(
        new OddkinError(
          'template.repeat.duplicateKey',
          DEV
            ? `repeat() received the key ${String(key)} more than once; later duplicates are rendered without DOM reuse. Keys must be unique and stable.`
            : '',
        ),
        { code: 'template.repeat.duplicateKey' },
      );
      key = { duplicate: key, index };
    }
    seen.add(key);
    let part = old.get(key);
    if (part) old.delete(key);
    else {
      part = createItem();
      changed = true;
    }
    part.setValue(directive.template(item, index));
    items.push(part);
    keys.push(key);
    index++;
  }
  for (const part of old.values()) {
    part.remove();
    changed = true;
  }
  // Keep a longest run of parts already in relative order where they are; move only the
  // rest (fewest moves, so focused or stateful items usually stay in place).
  const stable = longestIncreasing(items.map((part) => previousIndex.get(part) ?? -1));
  const firstMoved = items.find((_, i) => !stable.has(i));
  if (firstMoved) {
    const parent = (firstMoved.startNode as Comment).parentNode as Node;
    if (supportsMoveBefore && parent.isConnected) {
      let ref: Node | null = end;
      for (let i = items.length - 1; i >= 0; i--) {
        const part = items[i] as P;
        const start = part.startNode as Comment;
        const last = part.endNode as Node;
        if (!stable.has(i) && last.nextSibling !== ref) {
          moveRange(start, last, ref);
          changed = true;
        }
        ref = start;
      }
    } else {
      moveBatched(parent, items, stable, previousIndex, previous.length, end);
      changed = true;
    }
  }
  return { items, keys, changed };
}
