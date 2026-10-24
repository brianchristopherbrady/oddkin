import { event, OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import type { Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import {
  assignContent,
  CollectionSource,
  readMenuItems,
  type MenuItemRecord,
} from '../collection/collection.js';
import type { NavigationActionDetail } from '../side-nav/side-nav.js';

export type { MenuItemRecord } from '../collection/collection.js';

export const SPLIT_BUTTON_STRINGS = { more: 'More actions' };

/** The primary half was pressed, or a menu item was chosen (cancel that to keep the menu open). */
export const splitActionEvent = event<NavigationActionDetail>('odd-action', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'user',
  description:
    'The primary half reports `{ id: value, action: "primary" }`; a menu item reports `{ id, action: "select" }`, and cancelling that keeps the menu open.',
});

/**
 * A primary action with a menu of related actions beside it: two independent targets in one
 * element, a primary button and a menu button (odd-menu, whose parts it forwards). Menu items come from `<option value>`
 * (the value is the item's `id`), `<optgroup label>`, and `<hr>` children, or from `items`; other
 * children are the primary button's content.
 *
 * @slot - The primary button's content.
 * @csspart primary - The primary button.
 * @csspart spinner - The loading indicator in the primary button.
 * @csspart trigger - The button that opens the menu.
 * @csspart menu - Every menu surface: the menu and its submenus.
 * @csspart submenu - Each submenu surface.
 * @csspart item - Each menu item.
 * @csspart group - Each group's heading.
 * @csspart separator - Each separator.
 * @a11y Two buttons in the Tab order: the primary action, named by its content, and the menu button, named by `strings.more` (with `aria-haspopup="menu"` and `aria-expanded`). `loading` keeps the primary button focusable and sets `aria-disabled`; announce progress separately if it matters.
 * @keyboard Tab moves between the two buttons. The menu button follows odd-menu: Enter, Space, and Down open the menu on its first item, Up on its last.
 * @previewRole splitAction
 * @useFor A frequent action with a few alternatives: "Save" with "Save as" and "Save a copy", "Merge" with merge strategies.
 * @notFor Unrelated actions (use separate buttons or odd-toolbar); only a list of actions (use odd-menu).
 * @category Actions
 */
export class OddkinSplitButton extends OddkinElement.with({
  value: prop.string({
    default: '',
    description: 'Reported as the `odd-action` detail `id` when the primary half is pressed.',
  }),
  items: prop.object<readonly MenuItemRecord[]>({
    description:
      "The menu's entries; when set, `<option>`, `<optgroup>`, and `<hr>` children are ignored.",
  }),
  appearance: prop.enum(['primary', 'secondary', 'ghost'], {
    default: 'secondary',
    reflect: true,
    description: 'Visual emphasis of both halves, as on odd-button.',
  }),
  size: prop.enum(['sm', 'md', 'lg'], {
    default: 'md',
    reflect: true,
    description: 'Size of both halves, as on odd-button.',
  }),
  disabled: prop.boolean({ reflect: true, description: 'Disables both halves.' }),
  loading: prop.boolean({
    reflect: true,
    description: 'Shows a busy indicator in the primary half, which then ignores presses.',
  }),
  strings: prop.object<Partial<typeof SPLIT_BUTTON_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  // Manual assignment: the default slot takes the primary content, never the item children.
  static override shadowRootOptions: ShadowRootInit = {
    mode: 'open',
    delegatesFocus: true,
    slotAssignment: 'manual',
  };
  static override events = { 'odd-action': splitActionEvent };
  declare readonly _events?: ElementEvents<typeof OddkinSplitButton>;

  readonly #source = new CollectionSource<MenuItemRecord>({
    host: this,
    name: 'items',
    property: () => this.items,
    read: readMenuItems,
  });

  /** @internal The menu's entries. */
  readonly _items: Readable<readonly MenuItemRecord[]> = this.#source.records;

  /** @internal The menu button's name. */
  get _moreLabel(): string {
    return strings(SPLIT_BUTTON_STRINGS, this.strings).more;
  }

  /** @internal Template handler: the primary half reports its action. */
  readonly _onPrimaryClick = (): void => {
    if (this.disabled || this.loading) return;
    this.emit(splitActionEvent, { id: this.value, action: 'primary' });
  };

  protected override connected(scope: Scope): void {
    scope.use(this.#source);
  }

  protected override mounted(scope: Scope): void {
    assignContent(scope, this, () => this.shadowRoot?.querySelector('slot'));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-split-button': OddkinSplitButton;
  }
}
