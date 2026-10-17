/**
 * Collections: keyed, nested data with reconciliation, diagnostics, and per-entry
 * ownership. DOM-free. Contract: docs/architecture/data-composition.md §3.
 */
import { DEV } from '../internal/dev.js';
import { MoteError, reportMoteError } from '../diagnostics/index.js';
import { computed, signal, untracked, type Readable } from '../reactive/index.js';
import type { Scope } from '../scope/index.js';

export type Key = string | number;

/** One item in document order, with its place in the tree. */
export interface Entry<T> {
  readonly key: Key;
  readonly item: T;
  readonly depth: number;
  readonly parentKey: Key | undefined;
  /** Index among siblings. */
  readonly index: number;
  /** Index in the flattened, document-ordered list. */
  readonly position: number;
  readonly hasChildren: boolean;
  readonly disabled: boolean;
  /** JSON pointer of the item in the source data, e.g. `/2/items/0`. */
  readonly path: string;
}

export interface CollectionDiagnostic {
  readonly code: 'collection.key.duplicate' | 'collection.key.missing';
  readonly path: string;
  readonly message: string;
}

export interface CollectionOptions<T> {
  /** Stable, unique key for an item. */
  readonly key: (item: T, index: number) => Key | null | undefined;
  /** Child items, for nested collections. */
  readonly children?: (item: T) => readonly T[] | null | undefined;
  readonly disabled?: (item: T) => boolean;
  /** Owner for per-entry scopes (`scopeFor`); entries' scopes end with it. */
  readonly owner?: Scope;
  /** Child path segment used in diagnostics (default `items`). */
  readonly childrenPath?: string;
}

export interface Collection<T> {
  /** Replace the data; entries are reconciled by key. Never mutate items in place. */
  set(items: readonly T[]): void;
  readonly items: Readable<readonly T[]>;
  /** Every entry in document order (depth-first). Entries whose key and item are unchanged keep their identity. */
  readonly flat: Readable<readonly Entry<T>[]>;
  readonly diagnostics: Readable<readonly CollectionDiagnostic[]>;
  byKey(key: Key): Entry<T> | undefined;
  /** Children of `key` (or top-level entries for `undefined`). */
  childrenOf(key: Key | undefined): readonly Entry<T>[];
  /** Ancestor keys of `key`, nearest first. */
  ancestorsOf(key: Key): readonly Key[];
  /**
   * The scope owned by an entry, disposed when its key leaves the collection or the owner ends.
   * Item templates re-run when their entry changes; put one-time setup in `init`, which runs
   * only when the scope is created, so it is not registered again on every re-run.
   */
  scopeFor(key: Key, init?: (scope: Scope) => void): Scope;
}

const isKey = (value: unknown): value is Key =>
  (typeof value === 'string' && value !== '') ||
  (typeof value === 'number' && Number.isFinite(value));

/** Create a keyed collection. */
export function collection<T>(options: CollectionOptions<T>): Collection<T> {
  const source = signal<readonly T[]>([]);
  let previous = new Map<Key, Entry<T>>();
  const childSegment = options.childrenPath ?? 'items';

  const model = computed(() => {
    const items = source.value;
    const flat: Entry<T>[] = [];
    const byKey = new Map<Key, Entry<T>>();
    const children = new Map<Key | undefined, Entry<T>[]>();
    const diagnostics: CollectionDiagnostic[] = [];

    const visit = (list: readonly T[], depth: number, parentKey: Key | undefined, path: string) => {
      list.forEach((item, index) => {
        const at = `${path}/${index}`;
        const key = options.key(item, index);
        if (!isKey(key)) {
          diagnostics.push({
            code: 'collection.key.missing',
            path: at,
            message: `Item at ${at} has no key; it is not rendered.`,
          });
          return;
        }
        if (byKey.has(key)) {
          diagnostics.push({
            code: 'collection.key.duplicate',
            path: at,
            message: `Key ${JSON.stringify(key)} at ${at} duplicates ${byKey.get(key)?.path}; the later item is not rendered. Keys must be unique across the whole collection.`,
          });
          return;
        }
        const nested = options.children?.(item) ?? undefined;
        const disabled = options.disabled?.(item) ?? false;
        const position = flat.length;
        const hasChildren = !!nested && nested.length > 0;
        const old = previous.get(key);
        const entry: Entry<T> =
          old &&
          old.item === item &&
          old.depth === depth &&
          old.parentKey === parentKey &&
          old.index === index &&
          old.position === position &&
          old.hasChildren === hasChildren &&
          old.disabled === disabled &&
          old.path === at
            ? old
            : Object.freeze({
                key,
                item,
                depth,
                parentKey,
                index,
                position,
                hasChildren,
                disabled,
                path: at,
              });
        flat.push(entry);
        byKey.set(key, entry);
        const siblings = children.get(parentKey) ?? [];
        siblings.push(entry);
        children.set(parentKey, siblings);
        if (nested) visit(nested, depth + 1, key, `${at}/${childSegment}`);
      });
    };
    visit(items, 0, undefined, '');
    previous = byKey;
    return { flat: Object.freeze(flat), byKey, children, diagnostics: Object.freeze(diagnostics) };
  });

  const scopes = new Map<Key, Scope>();
  let ownerRelease: (() => void) | undefined;

  const reconcileScopes = () => {
    if (scopes.size === 0) return;
    const { byKey } = untracked(() => model.value);
    for (const [key, scope] of scopes) {
      if (!byKey.has(key)) {
        scopes.delete(key);
        scope.dispose();
      }
    }
  };

  return {
    set(items) {
      source.value = items;
      const { diagnostics } = untracked(() => model.value);
      for (const d of diagnostics)
        reportMoteError(new MoteError(d.code, DEV ? d.message : ''), { code: d.code });
      reconcileScopes();
    },
    items: source,
    flat: computed(() => model.value.flat),
    diagnostics: computed(() => model.value.diagnostics),
    byKey: (key) => model.value.byKey.get(key),
    childrenOf: (key) => model.value.children.get(key) ?? [],
    ancestorsOf(key) {
      const out: Key[] = [];
      const { byKey } = model.value;
      for (
        let parent = byKey.get(key)?.parentKey;
        parent !== undefined;
        parent = byKey.get(parent)?.parentKey
      )
        out.push(parent);
      return out;
    },
    scopeFor(key, init) {
      const owner = options.owner;
      if (!owner)
        throw new MoteError(
          'collection.owner.missing',
          DEV ? 'scopeFor() needs an owner scope: collection({ owner: scope, … }).' : '',
        );
      if (!untracked(() => model.value.byKey.has(key))) {
        throw new MoteError(
          'collection.key.unknown',
          DEV ? `No entry with key ${JSON.stringify(key)}.` : '',
        );
      }
      let scope = scopes.get(key);
      if (!scope || scope.disposed) {
        scope = owner.child({ name: `entry ${String(key)}` });
        scopes.set(key, scope);
        ownerRelease ??= owner.add(() => scopes.clear(), 'collection entry scopes');
        init?.(scope);
      }
      return scope;
    },
  };
}
