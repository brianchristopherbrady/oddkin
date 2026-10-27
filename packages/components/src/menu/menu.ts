import { RovingFocus } from '@oddkin/core/controllers/focus';
import { Typeahead } from '@oddkin/core/controllers/typeahead';
import { event, OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { computed, signal, untracked, type Readable } from '@oddkin/core/reactive';
import type { Release, Scope } from '@oddkin/core/scope';
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
 * and `<hr>` children, or from `items`. With `context`, it is also the context menu of another
 * element.
 *
 * @slot - The trigger's content.
 * @csspart trigger - The button that opens the menu.
 * @csspart menu - Every menu surface: the menu and its submenus.
 * @csspart submenu - Each submenu surface.
 * @csspart item - Each menu item.
 * @csspart group - Each group's heading.
 * @csspart separator - Each separator.
 * @a11y The trigger has `aria-haspopup="menu"` and `aria-expanded`, and names the menu; `label` names a trigger that shows only a glyph. Items are `menuitem`s (disabled ones stay focusable, as APG recommends), groups are named by their heading, and an item with a submenu has `aria-haspopup` and `aria-expanded`. The danger tone is colour only: let the label say what the action does ("Delete project"). A context menu is hidden from people who cannot right-click or do not know Shift+F10: keep the trigger visible as the way to the same actions.
 * @keyboard On the trigger: Enter, Space, and Down open the menu on its first item, Up on its last. With `context`, Shift+F10 or the Menu key while focus is in that element opens the menu on its first item. In the menu: Up and Down move (wrapping), Home and End go to the first and last item, typing moves to the next item starting with the typed characters, Enter and Space choose. Right opens a submenu on its first item; Left and Escape close one level and return focus to its item; Escape on the menu returns focus to the trigger, or to where it was when a context menu opened; Tab and Shift+Tab close every level as focus leaves.
 * @previewRole menu
 * @useFor A short list of actions behind one button: row actions, "more" actions, create menus.
 * @notFor Choosing a value in a form (use odd-select or odd-listbox); navigation between pages (use links or odd-side-nav); a searchable list of commands (use odd-command-palette).
 * @category Actions
 * @customization 1 2 3
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
  context: prop.string({
    default: '',
    description:
      'The ID of an element, in the same document or shadow root, whose context menu it also is: a right-click or long press on it opens the menu at the pointer, and Shift+F10 or the Menu key while focus is in it opens the menu beside the focused element. The browser keeps its own menu while the trigger is disabled.',
  }),
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
    anchor: () => this.#at ?? this._trigger(),
    // Also after a press that did not focus the trigger (WebKit). A context menu returns focus
    // to where it was when it opened.
    returnFocus: () => (this.#at ? null : this._trigger()),
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
  // What a context menu opened against (the pointer's point, or the focused element); null when
  // the trigger opened it. Kept after it closes, until the next open, for the focus return.
  #at: Element | null = null;
  // Shift+F10 or the Menu key opened it, so the `contextmenu` event a browser may send for the
  // same key does not open it again at the pointer.
  #byKey = false;

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

  /** Opens the menu below its trigger and focuses its first item. */
  show(): void {
    this.#at = null;
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
    if (!this._open.peek()) this.#at = null;
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

  /** Opens the menu as the context menu, against the pointer's point or the focused element. */
  #openAt(at: Element, keyboard: boolean): void {
    if (this.disabled) return;
    this.#keyboard = keyboard;
    this.#landing = 'first';
    // Open again at the new place when it is already open.
    if (this._open.peek()) this.#overlay.hide();
    this.#at = at;
    this.#overlay.show();
  }

  /** Places the zero-size `point` element at the viewport point `x`, `y`. */
  #pointAt(x: number, y: number): HTMLElement | null {
    const point = this.shadowRoot?.getElementById('point');
    if (!point) return null;
    // Inline offsets run from the right in right-to-left text.
    const sign = getComputedStyle(point).direction === 'rtl' ? -1 : 1;
    const place = (inline: number, block: number) => {
      point.style.setProperty('--_point-inline', `${inline}px`);
      point.style.setProperty('--_point-block', `${block}px`);
    };
    const inline = sign > 0 ? x : document.documentElement.clientWidth - x;
    place(inline, y);
    // A transformed or contained ancestor is the fixed box's containing block: correct for it.
    const box = point.getBoundingClientRect();
    if (box.left !== x || box.top !== y) place(inline + sign * (x - box.left), 2 * y - box.top);
    return point;
  }

  /** Listens on the `context` element while it is set and found. */
  #attachContext(target: Element, run: Scope): void {
    // The menu may be inside its target: keys and presses in the open menu are the menu's.
    const inMenu = (event: Event) => {
      const menu = this._menu();
      return !!menu && event.composedPath().includes(menu);
    };
    run.listen<KeyboardEvent>(target, 'keydown', (event) => {
      const key = event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);
      if (!key || event.defaultPrevented || this.disabled || inMenu(event)) return;
      event.preventDefault();
      this.#byKey = true;
      const focused = event.composedPath()[0];
      this.#openAt(focused instanceof Element ? focused : target, true);
    });
    run.listen<MouseEvent>(target, 'contextmenu', (event) => {
      if (event.defaultPrevented || this.disabled) return;
      event.preventDefault();
      if (inMenu(event)) return;
      if (this.#byKey && this._open.peek()) {
        this.#byKey = false;
        return;
      }
      this.#byKey = false;
      const point = this.#pointAt(event.clientX, event.clientY);
      if (!point) return;
      if (!event.buttons) {
        this.#openAt(point, false);
        return;
      }
      // Firefox, WebKit, and browsers on macOS and Linux send it while the button is still down;
      // the pointerup would light-dismiss a popover opened now, so it opens after that.
      const releases: Release[] = [];
      const open = () => {
        for (const release of releases.splice(0)) release();
        run.timeout(() => this.#openAt(point, false), 0);
      };
      releases.push(
        run.listen(document, 'pointerup', open, true),
        run.listen(document, 'pointercancel', open, true),
      );
    });
  }

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
    scope.effect((run) => {
      const id = this.context;
      if (!id) return;
      const target = (this.getRootNode() as Document | ShadowRoot).getElementById(id);
      if (target) untracked(() => this.#attachContext(target, run));
    });
    scope.add(() => (this.#scope = undefined), 'menu scope');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-menu': OddkinMenu;
  }
}
