import { ActiveDescendant } from '@oddkin/core/controllers/active-descendant';
import { event, OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { queryChangeEvent, type CommandRecord } from '../collection/collection.js';
import { TextHints } from '../form-control/text-hints.js';
import { ModalDialog } from '../overlay/dialog.js';
import type { NavigationActionDetail } from '../side-nav/side-nav.js';

export type { CommandRecord, QueryChangeDetail } from '../collection/collection.js';

export const COMMAND_PALETTE_STRINGS = {
  search: 'Search commands',
  empty: 'No matching commands',
  loading: 'Loading…',
  navigate: 'Navigate',
  choose: 'Open',
  close: 'Close',
};

/** A command was chosen; cancel it to keep the palette open. */
export const commandActionEvent = event<NavigationActionDetail>('odd-action', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'user',
  description:
    'A command was chosen: `detail.id` is its `id` and `detail.action` is `select`. Cancel it to keep the palette open.',
});

/**
 * A command palette: a modal dialog with a search input and the matching commands below it
 * (APG combobox with a listbox popup that is always shown). Typing filters the commands by label
 * and makes the first match active; Enter or a click runs it (`odd-action`) and closes the palette;
 * Escape or a press on the backdrop closes it, and focus returns to where it was.
 *
 * @slot empty - Shown when no command matches and nothing is loading (default `strings.empty`).
 * @slot status - Status content such as an error and a retry button.
 * @csspart dialog - The `<dialog>` surface.
 * @csspart search - The search field around the input.
 * @csspart input - The search input (`role="combobox"`).
 * @csspart listbox - The `role="listbox"` of commands.
 * @csspart item - Each command row.
 * @csspart group - Each group's heading.
 * @csspart loading - The busy row while `loading`.
 * @csspart empty - The wrapper of the empty slot.
 * @csspart footer - The keyboard hints under the results.
 * @cssprop --odd-command-palette-inline-size - Its width, within the viewport (default 40rem).
 * @a11y A modal `dialog` named by `label`. Focus starts in the search input, a `combobox` named by `strings.search` that controls the `listbox` of commands and names the active one with `aria-activedescendant` (the active row also has `aria-selected`). Groups are named by their heading. Everything outside is inert while it is open, and closing returns focus to the element that had it.
 * @keyboard Typing filters the commands; Up and Down move the active command (wrapping); Enter runs it. Escape closes the palette.
 * @a11y The global `inputmode`, `enterkeyhint`, `autocapitalize`, `autocorrect`, and `spellcheck` attributes on the host are forwarded to the search input; `spellcheck` defaults to `false`, as a query is not prose.
 * @previewRole commandPalette
 * @useFor Finding and running any command or destination by name, from anywhere in an app (typically opened with Ctrl+K or Cmd+K).
 * @notFor A few actions behind a button (use odd-menu); choosing a value in a form (use odd-combobox); site search results (use a page).
 * @category Actions
 */
export class OddkinCommandPalette extends OddkinElement.with({
  label: prop.string({ default: '', description: 'Names the dialog. Required.' }),
  placeholder: prop.string({ default: '', description: 'Text shown in the empty search input.' }),
  items: prop.object<readonly CommandRecord[]>({
    description:
      'The commands: `{ id, label, description?, icon?, shortcut?, group?, disabled? }`.',
  }),
  open: prop.boolean({ reflect: true, description: 'Whether it is open.' }),
  loading: prop.boolean({
    reflect: true,
    description: 'Shows a busy row and marks the results busy.',
  }),
  noFilter: prop.boolean({
    reflect: true,
    description:
      'The element does not filter: listen to `odd-query-change` and replace `items` with the matches.',
  }),
  strings: prop.object<Partial<typeof COMMAND_PALETTE_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'odd-action': commandActionEvent,
    'odd-query-change': queryChangeEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinCommandPalette>;

  /** @internal The host's text-entry hints for the search input. */
  readonly _hints = new TextHints(this);
  readonly #query = signal('');
  readonly #dialog = new ModalDialog({
    host: this,
    dialog: () => this.shadowRoot?.querySelector('dialog'),
    closedBy: 'any',
    initialFocus: () => this._input(),
    onToggle: (open) => this.#onToggle(open),
  });
  readonly #active = new ActiveDescendant({
    target: () => this._input(),
    items: () => this._rows(),
    homeEnd: false,
    wrap: true,
    onActiveChange: (index) => (this._activeIndex.value = index),
  });
  // Activate the first match once the filtered rows have rendered.
  #activateFirst = false;

  /** @internal The active row's index among the shown commands. */
  readonly _activeIndex = signal(-1);

  /** @internal The commands the results show: all, or those whose label contains the text. */
  readonly _shown: Readable<readonly CommandRecord[]> = computed(() => {
    const items = this.items ?? [];
    const query = this.#query.value.trim().toLocaleLowerCase();
    if (this.noFilter || !query) return items;
    return items.filter((item) => item.label.toLocaleLowerCase().includes(query));
  });

  /** The text in the search input, as the user typed it (read-only). */
  get query(): string {
    return this.#query.value;
  }

  /** @internal Localized strings. */
  get _strings(): typeof COMMAND_PALETTE_STRINGS {
    return strings(COMMAND_PALETTE_STRINGS, this.strings);
  }

  /** @internal The search input. */
  _input(): HTMLInputElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLInputElement>('[part~="input"]');
  }

  /** @internal The command rows, in the order of `_shown`. */
  _rows(): HTMLElement[] {
    return [...(this.shadowRoot?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  }

  /** Opens it with the search input focused. */
  show(): void {
    this.#dialog.show();
  }

  /** Closes it; focus returns to where it was when it opened. */
  close(): void {
    this.#dialog.close();
  }

  #onToggle(open: boolean): void {
    this.open = open;
    if (open) {
      this.#activateFirst = true;
      return;
    }
    // Each opening starts from an empty search.
    this.#query.value = '';
    this.#active.setActive(-1);
  }

  /** @internal Runs the shown command at `index`: reports it and closes, unless cancelled. */
  _choose(index: number): void {
    const item = this._shown.peek()[index];
    if (!item || item.disabled) return;
    if (this.emit(commandActionEvent, { id: item.id, action: 'select' })) this.close();
  }

  /** @internal Template handler: typing filters and makes the first match active. */
  readonly _onInput = (event: Event): void => {
    // The search text is not a value of the element.
    event.stopPropagation();
    const query = (event.target as HTMLInputElement).value;
    this.#query.value = query;
    this.#activateFirst = true;
    this.emit(queryChangeEvent, { query });
  };

  /** @internal Template handler: Enter runs the active command (arrows are the controller's). */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return;
    event.preventDefault();
    const index = this.#active.activeIndex;
    if (index >= 0) this._choose(index);
  };

  /** @internal Template handler: presses on the results keep focus in the input. */
  readonly _onResultsPointerdown = (event: PointerEvent): void => {
    event.preventDefault();
  };

  /** @internal Template handler: a click on a command runs it. */
  readonly _onResultsClick = (event: MouseEvent): void => {
    const index = this._rows().findIndex((row) => event.composedPath().includes(row));
    if (index < 0) return;
    this.#active.setActive(index, { scroll: false });
    this._choose(index);
  };

  protected override connected(scope: Scope): void {
    scope.use(this._hints);
  }

  protected override mounted(scope: Scope): void {
    scope.use(this.#dialog);
    scope.use(this.#active);
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    if (changes.has('open')) {
      if (this.open) this.#dialog.show();
      else this.#dialog.close();
    }
    this.#active.sync();
    if (this.#activateFirst && this.open) {
      this.#activateFirst = false;
      this.#active.setActive(this._shown.peek().findIndex((item) => !item.disabled));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-command-palette': OddkinCommandPalette;
  }
}
