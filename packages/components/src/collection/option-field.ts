import { ActiveDescendant } from '@oddkin/core/controllers/active-descendant';
import { ResizeController } from '@oddkin/core/controllers/observe';
import { format, formatNumber, langOf } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { composedContains, Overlay, type OverlayOptions } from '../overlay/overlay.js';
import { OddkinOptionControl } from './option-control.js';

/** The built-in text every option field shows (each element's `strings` extends it). */
export const OPTION_FIELD_STRINGS = {
  clear: 'Clear',
  remove: 'Remove {label}',
  selected: 'Selected',
  more: '{count} more',
};

/**
 * What a field that chooses from a popup shares (`odd-combobox`, `odd-picker`;
 * component-contracts.md §3.3): a `role="combobox"` element (`.combobox`) in the field box
 * (`part="control"`) that keeps DOM focus while the popup's rows (`option` or `treeitem`) are
 * its active descendant; the popup (`#popup`, a manual popover placed against the box, closed by
 * Escape, a press outside, or focus leaving); with `multiple`, the chosen values as chips that
 * collapse to "+N" ( `part="more"`) when they do not fit on one line, removable by pointer and by
 * keyboard; the clear button (`part="clear"`). Over `OddkinOptionControl`'s form semantics.
 * Internal to `@oddkin/components` (import it relatively).
 */
export class OddkinOptionField extends OddkinOptionControl {
  readonly #focusWithin = signal(false);
  readonly #overlay = new Overlay(this._overlayOptions());
  readonly #active = new ActiveDescendant({
    target: () => this._entry(),
    items: () => this._rowElements(),
    homeEnd: this._homeEnd(),
    onActiveChange: (index) => (this._activeIndex.value = index),
  });
  readonly #resize = new ResizeController(() => this.#measure(), {
    targets: () => [this._box()],
  });

  /** @internal The active row's index among the shown rows. */
  readonly _activeIndex = signal(-1);
  /** @internal Chips shown while collapsed (the rest are "+N"). */
  readonly _shown = signal(Number.POSITIVE_INFINITY);
  /** @internal Whether the popup is open, for `aria-expanded`. */
  readonly _open: Readable<boolean> = this.#overlay.open;
  /** @internal Whether focus is in the element. */
  readonly _focusWithin: Readable<boolean> = this.#focusWithin;
  /** @internal With `multiple`, the chips collapse to "+N" (by default while focus is outside). */
  readonly _collapsed: Readable<boolean> = computed(() => this._collapses());

  /** @internal Localized strings; an element with more text returns its own. */
  get _strings(): typeof OPTION_FIELD_STRINGS {
    return OPTION_FIELD_STRINGS;
  }

  /** @internal The popup wiring; an element may add placement hooks. */
  protected _overlayOptions(): OverlayOptions {
    return {
      host: this,
      surface: () => this._popup(),
      anchor: () => this._box(),
      mode: 'manual',
      dismiss: true,
      // The popup's opening is not the element's own state.
      relay: false,
      onToggle: (open) => {
        if (!open) this.#active.setActive(-1);
      },
    };
  }

  /** @internal Home and End move the active row (not in a text field). */
  protected _homeEnd(): boolean {
    return true;
  }

  /** @internal Whether the chips collapse now (a reactive read). */
  protected _collapses(): boolean {
    return !this.#focusWithin.value;
  }

  /** @internal The remove button's name for a chip. */
  _removeLabel(label: string): string {
    return format(this._strings.remove, { label });
  }

  /** @internal The "+N" chip's text for assistive technology. */
  _moreLabel(count: number): string {
    return format(this._strings.more, { count: formatNumber(count, langOf(this)) });
  }

  /** @internal The label of `value` among all options, or the value itself. */
  _labelOf(value: string): string {
    if (!value) return '';
    return this._options.value.find((option) => option.value === value)?.label ?? value;
  }

  /** @internal The value cannot change, though it is still submitted. */
  protected _readonly(): boolean {
    return false;
  }

  /** @internal The user may change the value now. */
  get _editable(): boolean {
    return !this._readonly() && !this._formDisabled.peek();
  }

  /** @internal The clear button shows while there is a value the user may clear. */
  get _clearable(): boolean {
    return !this._readonly() && !this._formDisabled.value && this._selected.value.length > 0;
  }

  /** @internal The `role="combobox"` element, which keeps focus. */
  _entry(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('.combobox');
  }

  /** @internal The field box the popup is placed against. */
  _box(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part~="control"]');
  }

  /** @internal The popup surface. */
  _popup(): HTMLElement | null | undefined {
    return this.shadowRoot?.getElementById('popup');
  }

  /** @internal The shown rows, in order. */
  _rowElements(): HTMLElement[] {
    return [
      ...(this.shadowRoot?.querySelectorAll<HTMLElement>('[role="option"], [role="treeitem"]') ??
        []),
    ];
  }

  /** @internal The active row's index, or -1. */
  get _active(): number {
    return this.#active.activeIndex;
  }

  /** @internal Whether the popup shows now (`_open` follows at its `toggle` event). */
  get _showing(): boolean {
    return !!this._popup()?.matches(':popover-open');
  }

  /** @internal Makes the row at `index` active (-1: none). */
  _setActive(index: number, options?: { scroll?: boolean }): void {
    this.#active.setActive(index, options);
  }

  /**
   * @internal Opens the popup, with the row at `at` active: the first or last usable row, or the
   * first selected one (else the first usable).
   */
  _show(at?: 'first' | 'last' | 'selected'): void {
    if (!this._editable) return;
    this.#overlay.show();
    if (!at) return;
    const rows = this._rowElements();
    const usable = (row: HTMLElement) => row.getAttribute('aria-disabled') !== 'true';
    const selected = rows.findIndex(
      (row) => row.getAttribute('aria-selected') === 'true' && usable(row),
    );
    this.#active.setActive(
      at === 'last'
        ? rows.findLastIndex(usable)
        : at === 'selected' && selected >= 0
          ? selected
          : rows.findIndex(usable),
    );
  }

  /** @internal Closes the popup. */
  _hide(): void {
    this.#overlay.hide();
  }

  /** @internal Removes one chosen value (multiple). */
  _remove(value: string): void {
    if (!this._editable) return;
    this._commit(this._selected.peek().filter((v) => v !== value));
  }

  #removeButtons(): HTMLElement[] {
    return [
      ...(this.shadowRoot?.querySelectorAll<HTMLElement>('[part~="chip-remove"]') ?? []),
    ].filter((button) => button.checkVisibility());
  }

  /** @internal Moves focus from the combobox to the last chip; false when there is none. */
  _focusChips(): boolean {
    const last = this.#removeButtons().at(-1);
    last?.focus();
    return !!last;
  }

  /** @internal Template handler: keys on a chip's remove button. */
  readonly _onChipKeydown = (event: KeyboardEvent, value: string): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = this.#removeButtons();
    const at = buttons.indexOf(event.currentTarget as HTMLElement);
    const rtl = getComputedStyle(event.currentTarget as Element).direction === 'rtl';
    const entry = this._entry();
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const back = event.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
        const next = buttons[at + (back ? -1 : 1)];
        if (next) next.focus();
        else if (!back) entry?.focus();
        break;
      }
      case 'Backspace':
      case 'Delete':
        this._remove(value);
        // The previous chip, or the combobox when none is left before it.
        (buttons[at - 1] ?? entry)?.focus();
        break;
      case 'Escape':
        entry?.focus();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /** @internal Template handler: a chip's remove button. */
  readonly _onChipRemove = (value: string): void => {
    this._remove(value);
    this._entry()?.focus();
  };

  /** @internal Clears the value, as a user's clear does. */
  _clear(): void {
    this._commit([]);
  }

  /** @internal Template handler: the clear button. */
  readonly _onClear = (): void => {
    if (!this._editable) return;
    this._clear();
    this._entry()?.focus();
  };

  /** @internal Template handler: presses in the popup keep focus in the combobox. */
  readonly _onPopupPointerdown = (event: PointerEvent): void => {
    event.preventDefault();
  };

  /** @internal After focus left the element and the popup closed. */
  protected _onLeave(): void {}

  /** Chips that fit beside the combobox on one line while collapsed; the rest become "+N". */
  #measure(): void {
    const box = this._box();
    const entry = this._entry();
    if (!this.multiple || !box || !entry) return;
    // Expanded, every chip shows (the template ignores `_shown`).
    if (!this._collapsed.peek()) return;
    const chips = [...box.querySelectorAll<HTMLElement>('[part~="chip"]')];
    const more = box.querySelector<HTMLElement>('[part~="more"]');
    const list = chips[0]?.parentElement;
    if (!list || !more) return;
    const boxStyle = getComputedStyle(box);
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const room =
      box.clientWidth -
      (parseFloat(boxStyle.paddingInlineStart) || 0) -
      (parseFloat(boxStyle.paddingInlineEnd) || 0) -
      (parseFloat(getComputedStyle(entry).minInlineSize) || 0) -
      (parseFloat(boxStyle.columnGap) || 0);
    const plus = more.getBoundingClientRect().width + gap;
    // Each chip at its full width: a chip in the flow may be cut short to the list's width, one
    // out of it is not, and the count must not depend on which it was at the last measure.
    const widths = chips.map((chip) => {
      const text = chip.querySelector<HTMLElement>('.chip-text');
      const width = chip.getBoundingClientRect().width;
      return text ? width - text.clientWidth + text.scrollWidth : width;
    });
    let used = 0;
    let shown = 0;
    for (; shown < widths.length; shown++) {
      const next = used + (shown ? gap : 0) + (widths[shown] ?? 0);
      if (next + (shown + 1 < widths.length ? plus : 0) > room) break;
      used = next;
    }
    this._shown.value = shown;
  }

  protected override connected(scope: Scope): void {
    super.connected(scope);
    scope.listen(this, 'focusin', () => (this.#focusWithin.value = true));
    scope.listen(this, 'focusout', (event: FocusEvent) => {
      const to = event.relatedTarget as Node | null;
      if (to && composedContains(this, to)) return;
      this.#focusWithin.value = false;
      this._hide();
      this._onLeave();
      this._onBlur();
    });
  }

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    scope.use(this.#overlay);
    scope.use(this.#active);
    scope.use(this.#resize);
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    super.updated(changes);
    this.#active.sync();
    this.#overlay.update();
    this.#measure();
  }
}
