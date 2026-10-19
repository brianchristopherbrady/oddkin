import { FocusRecovery } from '@oddkin/core/controllers/focus';
import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { NavigationItem } from '../models/navigation.js';
import {
  isNavigationKinds,
  navigationKinds,
  type CustomNavigationItem,
  type NavigationEntry,
  type NavigationKinds,
  type NavigationLabelContext,
} from './kinds.js';

export type { NavigationLabelContext } from './kinds.js';

export interface NavigationActionDetail {
  readonly id: string;
  readonly action: string;
}
export interface NavigationToggleDetail {
  readonly id: string;
  readonly expanded: boolean;
}

/**
 * Renders the content of an entry's label. The element keeps the link, button, or disclosure
 * wrapper and its ARIA; the content must include the entry's visible name.
 */
export type NavigationLabelRenderer = (
  item: NavigationItem,
  context: NavigationLabelContext,
) => unknown;

/** The user activated an action entry. The host runs it; nothing happens implicitly. */
export const actionEvent = event<NavigationActionDetail>('odd-action', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'An action entry was activated; `detail.action` names it.',
});
/** The user asked to expand or collapse a group. Cancel it to keep the current state. */
export const toggleEvent = event<NavigationToggleDetail>('odd-toggle', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'user',
  description: 'A group is about to expand or collapse; cancelable in uncontrolled mode.',
});

type Group = Extract<NavigationItem, { kind: 'group' }>;
type LinkEntry = Extract<NavigationItem, { kind: 'link' }> | CustomNavigationItem;
type ActionEntry = Extract<NavigationItem, { kind: 'action' }> | CustomNavigationItem;

const UNSAFE_SCHEME = /^(?:javascript|vbscript|data):/;

/**
 * Side navigation: links, actions, and expandable groups from `.items` (or native links in the
 * default slot), arranged by the `side-nav` layout recipe, which responds to the element's own
 * width with container queries only.
 *
 * @slot header - Content above the entries, e.g. a product name.
 * @slot - Declarative entries (native links or lists) when `items` is not set.
 * @slot footer - Content below the entries.
 * @csspart base - The `<nav>` landmark.
 * @csspart header - Wrapper of the header slot.
 * @csspart list - The list of entries.
 * @csspart link - A link entry.
 * @csspart action - An action entry.
 * @csspart group-toggle - The button that expands or collapses a group.
 * @csspart group - The list inside a group.
 * @csspart badge - A link's badge.
 * @csspart footer - Wrapper of the footer slot.
 * @a11y A `<nav>` landmark named by `label`. Links are native, so modified clicks, new tabs, and context menus work; the current link has `aria-current="page"` and a visible marker, not colour alone. Groups follow the disclosure pattern (`aria-expanded`, `aria-controls`).
 * @keyboard Tab moves through links, actions, and group toggles in order; Enter follows a link; Enter or Space activates an action or toggles a group.
 * @previewRole navigation
 * @useFor Primary or section navigation with links, a few actions, and one or two levels of groups.
 * @notFor Menus of commands (use a menu), tabs, or trees with selection; page layout.
 * @limitation Entries are replaced, not mutated: assign a new `items` array to change them.
 * @category Navigation
 * @customization 1 2 3
 */
export class OddkinSideNav extends OddkinElement.with({
  label: prop.string({
    default: '',
    description: 'Accessible name of the navigation landmark, e.g. "Primary".',
  }),
  items: prop.object<readonly NavigationEntry[]>({
    description:
      'Entries. When set (even to an empty array) it is the only source; slotted entries are not rendered.',
  }),
  current: prop.string({
    default: '',
    description: 'Id of the current link; it gets `aria-current="page"`.',
  }),
  expanded: prop.object<readonly string[]>({
    description:
      'Ids of expanded groups, owned by the caller. Omit it to let the element track expansion.',
  }),
  renderLabel: prop.custom<NavigationLabelRenderer | undefined>({
    default: () => undefined,
    coerce: (value) =>
      value === undefined || typeof value === 'function'
        ? { ok: true, value: value as NavigationLabelRenderer | undefined }
        : { ok: false, reason: 'expected a function or undefined' },
    description:
      'Renders label content for each entry; signals it reads stay live. The element keeps the link, button, or disclosure semantics.',
  }),
  kinds: prop.custom<NavigationKinds>({
    default: () => navigationKinds,
    coerce: (value) =>
      isNavigationKinds(value)
        ? { ok: true, value }
        : { ok: false, reason: 'expected a registry from navigationKinds.extend()' },
    description:
      'Project entry kinds for this element, from `navigationKinds.extend()`; built-in kinds need none.',
  }),
}) {
  static override events = { 'odd-action': actionEvent, 'odd-toggle': toggleEvent };
  declare readonly _events?: ElementEvents<typeof OddkinSideNav>;

  /** @internal True while the header slot has content; read by the template. */
  readonly _hasHeader = signal(false);
  /** @internal True while the footer slot has content; read by the template. */
  readonly _hasFooter = signal(false);
  // Groups the user toggled in uncontrolled mode; others follow their defaults.
  readonly #toggled = signal<ReadonlyMap<string, boolean>>(new Map());
  readonly #groupIds = new Map<string, string>();
  readonly #unknownKinds = new Set<string>();
  #warnedConflict = false;

  /** @internal Whether a group is expanded (controlled, toggled, or its default). */
  _isExpanded(group: Group): boolean {
    const controlled = this.expanded;
    if (controlled) return controlled.includes(group.id);
    return (
      this.#toggled.value.get(group.id) ?? (group.expanded || containsCurrent(group, this.current))
    );
  }

  /** @internal A stable element id for a group's list (data ids may contain spaces). */
  _groupId(id: string): string {
    let value = this.#groupIds.get(id);
    if (!value) this.#groupIds.set(id, (value = `group-${this.#groupIds.size + 1}`));
    return value;
  }

  /** @internal The link's `href`, or `null` for disabled entries, script URLs, and non-strings. */
  _href(item: LinkEntry): string | null {
    if (item.disabled || typeof item.href !== 'string') return null;
    // Browsers ignore control characters and spaces inside a scheme ("java\tscript:").
    const scheme = item.href.replace(/[\u0000-\u0020]/g, '').toLowerCase();
    return UNSAFE_SCHEME.test(scheme) ? null : item.href;
  }

  /** @internal Template handler: an action entry was activated. */
  _action(item: ActionEntry): void {
    if (!item.disabled) this.emit(actionEvent, { id: item.id, action: String(item.action) });
  }

  /** @internal An entry whose kind is neither built in nor registered: reported once per kind. */
  _unknownKind(kind: string): void {
    if (this.#unknownKinds.has(kind)) return;
    this.#unknownKinds.add(kind);
    console.warn(
      `[model.kind.unknown] <${this.localName}> has entries of kind "${kind}", which is not built in or registered in \`kinds\`; they are not rendered.`,
    );
  }

  /** @internal Template handler: a group toggle was activated. */
  _toggle(group: Group): void {
    const next = !this._isExpanded(group);
    const allowed = this.emit(toggleEvent, { id: group.id, expanded: next });
    if (!allowed || this.expanded) return;
    const toggled = new Map(this.#toggled.peek());
    toggled.set(group.id, next);
    this.#toggled.value = toggled;
  }

  /** @internal Slot change handler used by the template. */
  readonly _onSlotChange = (): void => this.#refresh();

  protected override mounted(scope: Scope): void {
    // A focused entry that is removed, or hidden in a collapsing group, hands focus to the
    // landmark instead of the document body; the next Tab continues with the entries.
    scope.use(
      new FocusRecovery({
        root: () => this.shadowRoot,
        fallback: () => this.shadowRoot?.querySelector('nav'),
      }),
    );
    scope.effect(() => {
      this.items;
      this.#refresh();
    });
  }

  #refresh(): void {
    const filled = (name: string | undefined) => {
      const selector = name ? `slot[name="${name}"]` : 'slot:not([name])';
      const slot = this.shadowRoot?.querySelector<HTMLSlotElement>(selector);
      return (
        slot
          ?.assignedNodes({ flatten: true })
          .some((n) => n.nodeType === Node.ELEMENT_NODE || !!n.textContent?.trim()) ?? false
      );
    };
    this._hasHeader.value = filled('header');
    this._hasFooter.value = filled('footer');
    // With `items` set the default slot is not rendered; look at the light DOM instead.
    const declarative = [...this.childNodes].some(
      (n) =>
        (n.nodeType === Node.ELEMENT_NODE && !(n as Element).hasAttribute('slot')) ||
        (n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim()),
    );
    if (this.items && declarative && !this.#warnedConflict) {
      this.#warnedConflict = true;
      console.warn(
        '[collection.source.conflict] <odd-side-nav> has both `items` and slotted entries; `items` wins and the slotted entries are not rendered.',
      );
    }
  }
}

function containsCurrent(group: Group, current: string): boolean {
  if (!current) return false;
  return (group.items as readonly NavigationEntry[]).some((item) =>
    item.kind === 'group' ? containsCurrent(item as Group, current) : item.id === current,
  );
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-side-nav': OddkinSideNav;
  }
  // Typed listeners on the element, its ancestors, document, and window (events bubble, composed).
  interface GlobalEventHandlersEventMap {
    'odd-action': CustomEvent<NavigationActionDetail>;
    'odd-toggle': CustomEvent<NavigationToggleDetail>;
  }
}
