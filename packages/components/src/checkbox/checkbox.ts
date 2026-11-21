import { event, prop, type Conversion, type ElementEvents } from '@oddkin/core/element';
import type { Scope } from '@oddkin/core/scope';
import { OddkinCheckable, changeEvent, inputEvent } from '../form-control/checkable.js';

export { changeEvent, inputEvent };

export type CheckboxSelection =
  | { readonly mode: 'uncontrolled'; readonly checked?: never; readonly indeterminate?: never }
  | { readonly mode: 'controlled'; readonly checked: boolean; readonly indeterminate?: boolean };

export interface CheckboxCheckedRequestDetail {
  readonly checked: boolean;
  readonly indeterminate: false;
}

/** Proposes checkedness after activation in controlled mode. */
export const checkedRequestEvent = event<CheckboxCheckedRequestDetail>('odd-checked-request', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
});

function checkedState(value: unknown): Conversion<CheckboxSelection | undefined> {
  if (value === undefined) return { ok: true, value };
  if (typeof value === 'object' && value !== null) {
    const { mode, checked, indeterminate } = value as Record<string, unknown>;
    if (mode === 'uncontrolled' && checked === undefined && indeterminate === undefined) {
      return { ok: true, value: Object.freeze({ mode }) };
    }
    if (
      mode === 'controlled' &&
      typeof checked === 'boolean' &&
      (indeterminate === undefined || typeof indeterminate === 'boolean')
    ) {
      return {
        ok: true,
        value: Object.freeze({ mode, checked, indeterminate: indeterminate ?? false }),
      };
    }
  }
  return {
    ok: false,
    reason: 'expected an uncontrolled mode or a controlled mode with boolean checkedness',
  };
}

/**
 * A checkbox that participates in forms like a native one: a native checkbox in the shadow root,
 * drawn by the shared control-indicator module, labelled by the slotted text.
 *
 * @slot - The label; names the checkbox.
 * @csspart field - Wrapper of the checkbox row, description, and error.
 * @csspart label - The label text beside the box.
 * @csspart control - The native checkbox (the drawn box).
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The checkbox shows its error: `error` is set, or a required box is unchecked after the user left it or a validity check failed. Style it with `odd-checkbox:state(user-invalid)`.
 * @a11y The slotted text names the native checkbox through its `<label>`; description and error are announced through `aria-describedby`. `indeterminate` is exposed as mixed and cleared when the user toggles, as on native checkboxes.
 * @keyboard Space toggles; Tab order as a native checkbox.
 * @previewRole checkbox
 * @useFor A single yes-or-no choice, or one option among several that can each be on or off.
 * @notFor An immediate on/off setting (use odd-switch); one choice among several (use odd-radio-group).
 * @limitation Validation bubbles anchor to the inner checkbox.
 * @category Forms
 * @customization 1 2 3
 */
export class OddkinCheckbox extends OddkinCheckable.with({
  size: prop.enum(['sm', 'md', 'lg'], {
    default: 'md',
    reflect: true,
    description: 'Indicator size. The minimum target and inherited theme density still apply.',
  }),
  indeterminate: prop.boolean({
    reflect: true,
    description: 'Shows the mixed state; cleared when the user toggles, as on native checkboxes.',
  }),
  checkedState: prop.custom<CheckboxSelection | undefined>({
    default: () => undefined,
    coerce: checkedState,
    description: 'Optional controlled snapshot. Omit it to use native local checkedness.',
  }),
}) {
  static override events = {
    input: inputEvent,
    change: changeEvent,
    'odd-checked-request': checkedRequestEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinCheckbox>;

  #activationScope: Scope | undefined;

  /** Effective checkedness. Writes affect local state only. */
  override get checked(): boolean {
    const state = this.checkedState;
    return state?.mode === 'controlled' ? state.checked : super.checked;
  }

  override set checked(value: boolean) {
    if (this.checkedState?.mode !== 'controlled') super.checked = value;
  }

  /** @internal Effective mixed state for the native input and its indicator. */
  get _displayIndeterminate(): boolean {
    const state = this.checkedState;
    return state?.mode === 'controlled' ? (state.indeterminate ?? false) : this.indeterminate;
  }

  protected override connected(scope: Scope): void {
    super.connected(scope);
    this.#activationScope = scope;
    scope.add(() => {
      this.#activationScope = undefined;
    }, 'checkbox activation scope');
  }

  /** @internal Keep the committed snapshot when a controlled checkbox is activated. */
  readonly _onActivate = (event: MouseEvent): void => {
    const state = this.checkedState;
    if (
      state?.mode !== 'controlled' ||
      event.defaultPrevented ||
      !event.cancelable ||
      this.disabled ||
      this._formDisabled.value
    ) {
      return;
    }
    event.preventDefault();
    // A task runs after native canceled activation has restored checked and mixed state.
    this.#activationScope?.timeout(() => {
      if (this.checkedState === state && !this.disabled && !this._formDisabled.value) {
        this.emit(checkedRequestEvent, { checked: !state.checked, indeterminate: false });
      }
    }, 0);
  };

  /** @internal Also preserve ownership for an uncancelable synthetic click on the native input. */
  readonly _onCheckboxInput = (event: Event): void => {
    if (this.checkedState?.mode !== 'controlled') {
      this._onInput(event);
      return;
    }
    event.stopPropagation();
    const input = event.currentTarget as HTMLInputElement;
    input.checked = this.checked;
    input.indeterminate = this._displayIndeterminate;
  };

  /** @internal Forward native change only when the checkbox owns its state. */
  readonly _onCheckboxChange = (): void => {
    if (this.checkedState?.mode !== 'controlled') this._onChange();
  };

  protected override _toggled(): void {
    this.indeterminate = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-checkbox': OddkinCheckbox;
  }
  interface GlobalEventHandlersEventMap {
    'odd-checked-request': CustomEvent<CheckboxCheckedRequestDetail>;
  }
}
