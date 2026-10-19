import { OddkinError } from '@oddkin/core/diagnostics';
import type { ObjectNode } from '@oddkin/core/model';
import type { NavigationItem } from '../models/navigation.js';

/** What a label renderer knows about the entry besides its data. */
export interface NavigationLabelContext {
  /** The entry is the current link. */
  readonly current: boolean;
  /** Nesting depth: 0 for top-level entries. */
  readonly depth: number;
}

/**
 * An entry of a project kind. Project kind names contain a hyphen, like custom element names, so
 * they never collide with a built-in kind (`link`, `action`, `group`) or a future one.
 */
export interface CustomNavigationItem {
  readonly id: string;
  readonly kind: `${string}-${string}`;
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly [field: string]: unknown;
}
/** A built-in entry or an entry of a registered project kind. */
export type NavigationEntry = NavigationItem | CustomNavigationItem;

/**
 * A project kind: the model of its entries (an `m.object` with `id` and `label`, plus `href`
 * for links or `action` for actions), the built-in wrapper it reuses, and its label content. A
 * `link` entry is a native link with the wrapper's `href`, `target`, `rel`, `disabled`, and
 * `aria-current` handling; an `action` entry is a button that emits `odd-action` with its
 * `action`. The element keeps the wrapper, its ARIA, and keyboard behavior, so the content
 * cannot remove them.
 */
export interface NavigationKind {
  readonly semantics: 'link' | 'action';
  readonly model: ObjectNode;
  readonly render: (item: CustomNavigationItem, context: NavigationLabelContext) => unknown;
}

/** An immutable set of project kinds, passed to one element as `.kinds`. */
export interface NavigationKinds {
  /** Registered project kind names, in registration order. */
  readonly names: readonly string[];
  get(kind: string): NavigationKind | undefined;
  /** A new registry with these kinds added; this one is unchanged. */
  extend(kinds: Readonly<Record<string, NavigationKind>>): NavigationKinds;
}

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
const registries = new WeakSet<NavigationKinds>();

/** True for registries made by `navigationKinds` and its `extend()`. */
export const isNavigationKinds = (value: unknown): value is NavigationKinds =>
  typeof value === 'object' && value !== null && registries.has(value as NavigationKinds);

function registry(kinds: ReadonlyMap<string, NavigationKind>): NavigationKinds {
  const value: NavigationKinds = Object.freeze({
    names: Object.freeze([...kinds.keys()]),
    get: (kind: string) => kinds.get(kind),
    extend(added: Readonly<Record<string, NavigationKind>>) {
      const next = new Map(kinds);
      for (const [name, kind] of Object.entries(added)) {
        const shape = kind?.model?.kind === 'object' ? kind.model.shape : {};
        const field = { link: 'href', action: 'action' }[kind?.semantics];
        if (
          !NAME.test(name) ||
          next.has(name) ||
          !shape['id'] ||
          !shape['label'] ||
          !field ||
          !shape[field] ||
          typeof kind.render !== 'function'
        )
          throw new OddkinError(
            'navigation.kind.invalid',
            `Navigation kind "${name}" needs a new hyphenated name, an m.object model with id, label, and href (semantics "link") or action (semantics "action"), and a render function.`,
          );
        next.set(name, Object.freeze({ ...kind }));
      }
      return registry(next);
    },
  });
  registries.add(value);
  return value;
}

/**
 * The navigation's built-in kinds (`link`, `action`, `group`) need no registration. Extend this
 * registry with project kinds and pass the result to one element as `.kinds`; nothing is global.
 */
export const navigationKinds: NavigationKinds = registry(new Map());
