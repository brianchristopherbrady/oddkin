import { RovingFocus } from '@oddkin/core/controllers/focus';
import { Typeahead } from '@oddkin/core/controllers/typeahead';
import { event, OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import {
  assignContent,
  CollectionSource,
  readMenuItems,
  type MenuActionRecord,
  type MenuItemRecord,
} from '../collection/collection.js';
import { composedContains, Overlay } from '../overlay/overlay.js';
import type { NavigationActionDetail } from '../side-nav/side-nav.js';

export type {
  MenuActionRecord,
  MenuGroupRecord,
  MenuItemRecord,
  MenuSeparatorRecord,
} from '../collection/collection.js';

/** An item was chosen; cancel it to keep the menu open. */
export const menuActionEvent = event<NavigationActionDetail>('odd-action', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'user',
  description:
    'An item was chosen: `detail.id` is its `id` and `detail.action` is `select`. Cancel it to keep the menu open.',
});

/** Items of `menu` itself, not of the submenus inside it. */
const itemsOf = (menu: Element | null | undefined): HTMLElement[] =>
  menu
    ? [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
        (item) => item.parentElement?.closest('[role="menu"]') === menu,
      )
    : [];
// Disabled items stay focusable and reachable by typing (APG menus).
const none = () => false;

/**
 * A menu button (APG): a button that opens a menu of actions, with groups, separators, and
 * submenus. Items come from `<option value>` (the value is the item's `id`), `<optgroup label>`,
 * and `<hr>` children, or from `items`.
 *
 * @slot - The trigger's content.
 * @csspart trigger - The button that opens the menu.
 * @csspart menu - Every menu surface: the menu and its submenus.
 * @csspart submenu - Each submenu surface.
 * @csspart item - Each menu item.
 * @csspart group - Each group's heading.
 * @csspart separator - Each separator.
 * @a11y The trigger has `aria-haspopup="menu"` and `aria-expanded`, and names the menu; `label` names a trigger that shows only a glyph. Items are `menuitem`s (disabled ones stay focusable, as APG recommends), groups are named by their heading, and an item with a submenu has `aria-haspopup` and `aria-expanded`. The danger tone is colour only: let the label say what the action does ("Delete project").
 * @keyboard On the trigger: Enter, Space, and Down open the menu on its first item, Up on its last. In the menu: Up and Down move (wrapping), Home and End go to the first and last item, typing moves to the next item starting with the typed characters, Enter and Space choose. Right opens a submenu on its first item; Left and Escape close one level and return focus to its item; Tab and Shift+Tab close every level as focus leaves.
 * @previewRole menu
 * @useFor A short list of actions behind one button: row actions, "more" actions, create menus.
 * @notFor Choosing a value in a form (use odd-select or odd-listbox); navigation between pages (use links or odd-side-nav); a searchable list of commands (use odd-command-palette).
 * @category Actions
 */
export class OddkinMenu extends OddkinElement.with({
  label: prop.string({
    default: '',
    description: 'Names the trigger when it shows only a glyph or icon.',
  }),
  items: prop.object<readonly MenuItemRecord[]>({
    description:
      'The entries; when set, `<option>`, `<optgroup>`, and `<hr>` children are ignored.',
  }),
  appearance: prop.enum(['primary', 'secondary', 'ghost'], {
    default: 'secondary',
    reflect: true,
    description: "The trigger's emphasis, as on odd-button.",
  }),
  size: prop.enum(['sm', 'md', 'lg'], {
    default: 'md',
    reflect: true,
    description: "The trigger's size, as on odd-button.",
  }),
  disabled: prop.boolean({ reflect: true, description: 'Disables the trigger.' }),
}) {
  // Manual assignment: the default slot takes the trigger's content, never the item children.
  static override shadowRootOptions: ShadowRootInit = {
    mode: 'open',
    delegatesFocus: true,
    slotAssignment: 'manual',
  };
  static override events = { 'odd-action': menuActionEvent };
  declare readonly _events?: ElementEvents<typeof OddkinMenu>;

  readonly #source = new CollectionSource<MenuItemRecord>({
    host: this,
    name: 'items',
    property: () => this.items,
    read: readMenuItems,
  });
  readonly #overlay = new Overlay({
    host: this,
    surface: () => this._menu(),
    anchor: () => this._trigger(),
    // Also after a press that did not focus the trigger (WebKit).
    returnFocus: () => this._trigger(),
    onToggle: (open) => this.#onToggle(open),
  });
  readonly #roving = new RovingFocus({
    target: () => this._menu(),
    items: () => itemsOf(this._menu()),
    orientation: 'vertical',
    skip: none,
  });
  readonly #typeahead = new Typeahead({
    items: () => itemsOf(this.#focusedMenu()),
    active: () => itemsOf(this.#focusedMenu()).findIndex((item) => item === this.#focused()),
    skip: none,
    onMatch: (_index, item) => item.focus(),
  });
  #scope: Scope | undefined;
  // Where focus lands when the menu opens, and whether it shows (opened from the keyboard).
  #landing: 'first' | 'last' = 'first';
  #keyboard = false;

  /** @internal The entries in use. */
  readonly _items: Readable<readonly MenuItemRecord[]> = this.#source.records;

  /** @internal Each action by its path (index within its list, joined with `-` for nested lists). */
  readonly _actions: Readable<ReadonlyMap<string, MenuActionRecord>> = computed(() => {
    const actions = new Map<string, MenuActionRecord>();
    const walk = (entries: readonly MenuItemRecord[], parent: string) =>
      entries.forEach((entry, index) => {
        const path = parent ? `${parent}-${index}` : String(index);
        if (entry.kind === 'group') walk(entry.items, path);
        else if (entry.kind !== 'separator') {
          actions.set(path, entry);
          if (entry.items) walk(entry.items, path);
        }
      });
    walk(this._items.value, '');
    return actions;
  });

  /** @internal Whether the menu is open, for the trigger's `aria-expanded`. */
  readonly _open: Readable<boolean> = this.#overlay.open;

  /** @internal Paths of the open submenus, for their items' `aria-expanded`. */
  readonly _openSubmenus = signal<ReadonlySet<string>>(new Set());

  /** @internal The trigger. */
  _trigger(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part~="trigger"]');
  }

  /** @internal The top-level menu surface. */
  _menu(): HTMLElement | null | undefined {
    return this.shadowRoot?.getElementById('menu');
  }

  /** Opens the menu and focuses its first item. */
  show(): void {
    this.#overlay.show();
  }

  /** Closes the menu and every submenu; focus inside returns to the trigger. */
  close(): void {
    this.#overlay.hide();
  }

  #focused(): HTMLElement | null {
    const active = this.shadowRoot?.activeElement;
    return active instanceof HTMLElement && active.getAttribute('role') === 'menuitem'
      ? active
      : null;
  }

  #focusedMenu(): Element | null | undefined {
    return this.#focused()?.parentElement?.closest('[role="menu"]');
  }

  #land(menu: HTMLElement | null | undefined, at: 'first' | 'last'): void {
    const items = itemsOf(menu);
    (at === 'first' ? items[0] : items.at(-1))?.focus({
      focusVisible: this.#keyboard,
    } as FocusOptions);
  }

  #onToggle(open: boolean): void {
    // The Tab stop moves to the landing item, so Tab leaves the menu forwards.
    this.#roving.sync();
    if (open) this.#land(this._menu(), this.#landing);
    else this.#typeahead.reset();
    this.#landing = 'first';
  }

  /** Opens the submenu of `item` (in its own child scope while open) and focuses its first item. */
  #openSubmenu(item: HTMLElement): void {
    const path = item.dataset['path'] as string;
    const surface = this.shadowRoot?.getElementById(`menu-${path}`);
    // A press elsewhere in the menu has light-dismissed an open submenu by now.
    if (!surface || !this.#scope) return;
    const scope = this.#scope.child({ name: `submenu ${path}` });
    const roving = new RovingFocus({
      target: () => surface,
      items: () => itemsOf(surface),
      orientation: 'vertical',
      skip: none,
    });
    const overlay = new Overlay({
      host: this,
      surface: () => surface,
      anchor: () => item,
      side: 'inline-end',
      // A submenu's opening and closing are not the menu's.
      relay: false,
      onToggle: (open) => {
        const next = new Set(this._openSubmenus.peek());
        if (open) next.add(path);
        else next.delete(path);
        this._openSubmenus.value = next;
        if (open) {
          roving.sync();
          this.#land(surface, 'first');
        } else scope.dispose();
      },
    });
    scope.use(overlay);
    scope.use(roving);
    overlay.show();
  }

  /** @internal Chooses an item: opens its submenu, or reports it and closes the menu. */
  _choose(item: HTMLElement): void {
    const action = this._actions.peek().get(item.dataset['path'] as string);
    if (!action || action.disabled) return;
    if (action.items) {
      this.#openSubmenu(item);
      return;
    }
    if (this.emit(menuActionEvent, { id: action.id, action: 'select' })) this.close();
  }

  /** @internal Template handler: the trigger toggles the menu. */
  readonly _onTriggerClick = (event: MouseEvent): void => {
    // Enter and Space click with no pointer detail.
    this.#keyboard = event.detail === 0;
    this.#overlay.toggle();
  };

  /** @internal Template handler: Up and Down open the menu on its last or first item. */
  readonly _onTriggerKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    this.#keyboard = true;
    this.#landing = event.key === 'ArrowUp' ? 'last' : 'first';
    this.show();
  };

  /** @internal Template handler: a click on an item chooses it. */
  readonly _onMenuClick = (event: MouseEvent): void => {
    const item = event
      .composedPath()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.getAttribute('role') === 'menuitem',
      );
    if (!item) return;
    this.#keyboard = event.detail === 0;
    this._choose(item);
  };

  /** @internal Template handler: choosing, submenus, and typeahead (arrows are the roving focus). */
  readonly _onMenuKeydown = (event: KeyboardEvent): void => {
    const item = this.#focused();
    if (!item || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = getComputedStyle(item).direction === 'rtl';
    const menu = item.parentElement?.closest<HTMLElement>('[role="menu"]');
    this.#keyboard = true;
    if (event.key === 'Enter' || (event.key === ' ' && !this.#typeahead.query)) this._choose(item);
    else if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) {
      if (item.getAttribute('aria-haspopup') !== 'menu') return;
      this._choose(item);
    } else if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) {
      if (!menu || menu === this._menu()) return;
      menu.hidePopover();
    } else if (!this.#typeahead.type(event.key)) return;
    event.preventDefault();
  };

  protected override connected(scope: Scope): void {
    scope.use(this.#source);
  }

  protected override mounted(scope: Scope): void {
    this.#scope = scope;
    assignContent(scope, this, () => this.shadowRoot?.querySelector('slot'));
    scope.use(this.#overlay);
    // Focus that has left every level (Tab, Shift+Tab) closes the menu, once it has moved, so
    // closing does not pull it back to the trigger. A move within the shadow root (to the
    // trigger) is not reported to the document.
    const leave = (event: FocusEvent) => {
      const menu = this._menu();
      const target = event.composedPath()[0] as Node;
      if (menu?.matches(':popover-open') && !composedContains(menu, target)) this.close();
    };
    scope.listen(document, 'focusin', leave, true);
    if (this.shadowRoot) scope.listen(this.shadowRoot, 'focusin', leave, true);
    scope.use(this.#roving);
    scope.use(this.#typeahead);
    scope.add(() => (this.#scope = undefined), 'menu scope');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-menu': OddkinMenu;
  }
}
