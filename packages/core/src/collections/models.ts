/**
 * Interaction-state models for collections: selection, expansion, disabled, and active
 * (roving focus target). Each is either controlled (the caller owns the value and the
 * model only reports intent) or uncontrolled (the model owns it) — never both.
 * Keyboard handling is not here; components compose controllers per WAI-ARIA pattern.
 */
import { computed, signal, untracked, type Readable } from '../reactive/index.js';
import type { Collection, Entry, Key } from './collection.js';

export interface ControlledValue<V> {
  /** The caller-owned value. The model never changes it. */
  readonly value: Readable<V>;
  /** Called with the requested next value; the caller decides whether to apply it. */
  readonly onChange: (next: V) => void;
}

function state<V>(
  controlled: ControlledValue<V> | undefined,
  initial: V,
): { read: Readable<V>; request: (next: V) => void } {
  if (controlled) return { read: controlled.value, request: controlled.onChange };
  const own = signal(initial);
  return {
    read: own,
    request: (next) => {
      own.value = next;
    },
  };
}

const isDisabled = <T>(collection: Collection<T> | undefined, key: Key) =>
  collection ? (untracked(() => collection.byKey(key))?.disabled ?? true) : false;

// ---------------------------------------------------------------------------

export interface SelectionModel {
  readonly mode: 'none' | 'single' | 'multiple';
  readonly selected: Readable<ReadonlySet<Key>>;
  isSelected(key: Key): boolean;
  select(key: Key): void;
  toggle(key: Key): void;
  clear(): void;
}

export interface SelectionOptions<T> {
  readonly mode: 'none' | 'single' | 'multiple';
  /** Ignore disabled and unknown keys. */
  readonly collection?: Collection<T>;
  readonly initial?: Iterable<Key>;
  readonly controlled?: ControlledValue<ReadonlySet<Key>>;
}

export function selectionModel<T>(options: SelectionOptions<T>): SelectionModel {
  const { read, request } = state<ReadonlySet<Key>>(
    options.controlled,
    new Set(options.initial ?? []),
  );
  const current = () => untracked(() => read.value);
  const model: SelectionModel = {
    mode: options.mode,
    selected: read,
    isSelected: (key) => read.value.has(key),
    select(key) {
      if (options.mode === 'none' || isDisabled(options.collection, key)) return;
      if (options.mode === 'single') {
        if (!(current().size === 1 && current().has(key))) request(new Set([key]));
      } else if (!current().has(key)) request(new Set([...current(), key]));
    },
    toggle(key) {
      if (options.mode === 'none' || isDisabled(options.collection, key)) return;
      if (current().has(key)) {
        const next = new Set(current());
        next.delete(key);
        request(next);
      } else model.select(key);
    },
    clear() {
      if (current().size) request(new Set());
    },
  };
  return model;
}

// ---------------------------------------------------------------------------

export interface ExpansionModel {
  readonly expanded: Readable<ReadonlySet<Key>>;
  isExpanded(key: Key): boolean;
  expand(key: Key): void;
  collapse(key: Key): void;
  toggle(key: Key): void;
}

export interface ExpansionOptions<T> {
  readonly collection?: Collection<T>;
  /** Uncontrolled initial state, e.g. from item `expanded` flags. */
  readonly initial?: Iterable<Key>;
  readonly controlled?: ControlledValue<ReadonlySet<Key>>;
}

export function expansionModel<T>(options: ExpansionOptions<T> = {}): ExpansionModel {
  const { read, request } = state<ReadonlySet<Key>>(
    options.controlled,
    new Set(options.initial ?? []),
  );
  const current = () => untracked(() => read.value);
  const expandable = (key: Key) =>
    !options.collection || !!untracked(() => options.collection?.byKey(key))?.hasChildren;
  const model: ExpansionModel = {
    expanded: read,
    isExpanded: (key) => read.value.has(key),
    expand(key) {
      if (expandable(key) && !current().has(key)) request(new Set([...current(), key]));
    },
    collapse(key) {
      if (!current().has(key)) return;
      const next = new Set(current());
      next.delete(key);
      request(next);
    },
    toggle(key) {
      if (current().has(key)) model.collapse(key);
      else model.expand(key);
    },
  };
  return model;
}

/** Entries whose ancestors are all expanded (what a tree or nested navigation shows). */
export function visibleEntries<T>(
  collection: Collection<T>,
  expansion: ExpansionModel,
): Readable<readonly Entry<T>[]> {
  return computed(() => {
    const expanded = expansion.expanded.value;
    return collection.flat.value.filter((entry) =>
      collection.ancestorsOf(entry.key).every((key) => expanded.has(key)),
    );
  });
}

// ---------------------------------------------------------------------------

export interface DisabledModel {
  readonly disabled: Readable<ReadonlySet<Key>>;
  isDisabled(key: Key): boolean;
}

/** Disabled keys derived from the collection's `disabled` accessor. */
export function disabledModel<T>(collection: Collection<T>): DisabledModel {
  const disabled = computed(
    () => new Set(collection.flat.value.filter((e) => e.disabled).map((e) => e.key)),
  );
  return { disabled, isDisabled: (key) => disabled.value.has(key) };
}

// ---------------------------------------------------------------------------

export interface ActiveModel {
  /** The entry that should hold the roving focus target. Never a disabled or hidden entry. */
  readonly active: Readable<Key | undefined>;
  setActive(key: Key): void;
  first(): void;
  last(): void;
  next(): void;
  previous(): void;
}

export interface ActiveOptions<T> {
  /** Navigable entries in order, e.g. `visibleEntries(…)` or `collection.flat`. */
  readonly entries: Readable<readonly Entry<T>[]>;
  readonly initial?: Key;
  readonly controlled?: ControlledValue<Key | undefined>;
  /** Wrap from last to first and back. Default false. */
  readonly wrap?: boolean;
}

export function activeModel<T>(options: ActiveOptions<T>): ActiveModel {
  const { read, request } = state<Key | undefined>(options.controlled, options.initial);
  const enabled = computed(() => options.entries.value.filter((e) => !e.disabled));
  // If the stored key is hidden, disabled, or removed, fall back to the first enabled entry.
  const active = computed(() => {
    const keys = enabled.value;
    const key = read.value;
    return keys.some((e) => e.key === key) ? key : keys[0]?.key;
  });
  const move = (pick: (keys: readonly Entry<T>[], index: number) => Entry<T> | undefined) => {
    const keys = untracked(() => enabled.value);
    const index = keys.findIndex((e) => e.key === untracked(() => active.value));
    const target = pick(keys, index);
    if (target && target.key !== untracked(() => active.value)) request(target.key);
  };
  return {
    active,
    setActive(key) {
      if (untracked(() => enabled.value).some((e) => e.key === key)) request(key);
    },
    first: () => move((keys) => keys[0]),
    last: () => move((keys) => keys[keys.length - 1]),
    next: () => move((keys, i) => keys[i + 1] ?? (options.wrap ? keys[0] : undefined)),
    previous: () =>
      move((keys, i) => (i > 0 ? keys[i - 1] : options.wrap ? keys[keys.length - 1] : undefined)),
  };
}
