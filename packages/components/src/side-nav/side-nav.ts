import { OddkinElement, event, prop } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { NavigationItem } from '../models/navigation.js';

export interface NavigationActionDetail {
  readonly id: string;
  readonly action: string;
}
export interface NavigationToggleDetail {
  readonly id: string;
  readonly expanded: boolean;
}

/** The user activated an action entry. The host runs it; nothing happens implicitly. */
export const actionEvent = event<NavigationActionDetail>('odd-action', {
  bubbles: true,
  composed: true,
  cancelable: false,
  description: 'An action entry was activated; `detail.action` names it.',
});
/** The user asked to expand or collapse a group. Cancel it to keep the current state. */
export const toggleEvent = event<NavigationToggleDetail>('odd-toggle', {
  bubbles: true,
  composed: true,
  cancelable: true,
  description: 'A group is about to expand or collapse; cancelable in uncontrolled mode.',
});

type Group = Extract<NavigationItem, { kind: 'group' }>;

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
 */
export class OddkinSideNav extends OddkinElement.with({
  label: prop.string({
    default: '',
    description: 'Accessible name of the navigation landmark, e.g. "Primary".',
  }),
  items: prop.object<readonly NavigationItem[]>({
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
}) {
  static override events = { action: actionEvent, toggle: toggleEvent };

  /** @internal True while the header slot has content; read by the template. */
  readonly _hasHeader = signal(false);
  /** @internal True while the footer slot has content; read by the template. */
  readonly _hasFooter = signal(false);
  // Groups the user toggled in uncontrolled mode; others follow their defaults.
  readonly #toggled = signal<ReadonlyMap<string, boolean>>(new Map());
  readonly #groupIds = new Map<string, string>();
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

  /** @internal The link's `href`, or `null` for disabled entries and script URLs. */
  _href(item: Extract<NavigationItem, { kind: 'link' }>): string | null {
    if (item.disabled) return null;
    // Browsers ignore control characters and spaces inside a scheme ("java\tscript:").
    const scheme = item.href.replace(/[\u0000-\u0020]/g, '').toLowerCase();
    return UNSAFE_SCHEME.test(scheme) ? null : item.href;
  }

  /** @internal Template handler: an action entry was activated. */
  _action(item: Extract<NavigationItem, { kind: 'action' }>): void {
    if (!item.disabled) this.emit(actionEvent, { id: item.id, action: item.action });
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
  return group.items.some((item) =>
    item.kind === 'group' ? containsCurrent(item, current) : item.id === current,
  );
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-side-nav': OddkinSideNav;
  }
}
