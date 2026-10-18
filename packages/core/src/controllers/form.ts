/**
 * `@oddkin/core/controllers/form` — form participation for form-associated custom elements
 * (`static formAssociated = true`): the submitted value and validity mirrored from an inner
 * native control, plus reset, restore, and disabled-fieldset state. The element forwards the
 * native form callbacks to the controller. Unbranded and `Scope`-owned.
 * Contract: docs/architecture/core-contracts.md §4.1.
 */
import { signal, untracked, type Readable } from '../reactive/index.js';
import type { Controller, Scope } from '../scope/index.js';

export type FormState = string | File | FormData | null;

type NativeControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface FormValueOptions {
  readonly internals: () => ElementInternals;
  /** Submitted value. Read in a tracked effect after each commit, so signals keep it current. */
  readonly value: () => FormState;
  /** State to restore after navigation, when it differs from the value. */
  readonly state?: () => FormState;
  /** Inner native control whose validity flags, message, and anchor are mirrored. */
  readonly control?: () => NativeControl | null | undefined;
  /** Custom error; while non-empty the element is invalid with this message. */
  readonly error?: () => string;
  /** Other reactive inputs that change validity (`required`, `type`, …), read for tracking. */
  readonly watch?: () => unknown;
  readonly onReset?: () => void;
  readonly onRestore?: (state: FormState, mode: 'restore' | 'autocomplete') => void;
}

const VALIDITY_FLAGS = [
  'valueMissing',
  'typeMismatch',
  'patternMismatch',
  'tooLong',
  'tooShort',
  'rangeUnderflow',
  'rangeOverflow',
  'stepMismatch',
  'badInput',
] as const;

export class FormValue implements Controller {
  readonly #options: FormValueOptions;
  readonly #disabled = signal(false);
  readonly #invalid = signal(false);

  constructor(options: FormValueOptions) {
    this.#options = options;
  }

  /** Disabled by an ancestor `<fieldset disabled>`. */
  get disabled(): Readable<boolean> {
    return this.#disabled;
  }

  /** The element currently fails validation (custom error or the control's constraints). */
  get invalid(): Readable<boolean> {
    return this.#invalid;
  }

  connect(scope: Scope): void {
    scope.effect(
      () => {
        const options = this.#options;
        const value = options.value();
        const state = options.state?.();
        const error = options.error?.() ?? '';
        options.watch?.();
        void this.#disabled.value;
        untracked(() => this.#sync(value, state, error));
      },
      { phase: 'post', name: 'form value' },
    );
  }

  /** Forward from the element's `formDisabledCallback`. */
  formDisabledCallback(disabled: boolean): void {
    this.#disabled.value = disabled;
  }

  /** Forward from the element's `formResetCallback`. */
  formResetCallback(): void {
    this.#options.onReset?.();
  }

  /** Forward from the element's `formStateRestoreCallback`. */
  formStateRestoreCallback(state: FormState, mode: 'restore' | 'autocomplete'): void {
    this.#options.onRestore?.(state, mode);
  }

  #sync(value: FormState, state: FormState | undefined, error: string): void {
    const internals = this.#options.internals();
    if (state === undefined) internals.setFormValue(value);
    else internals.setFormValue(value, state);
    const control = this.#options.control?.() ?? undefined;
    if (error) {
      internals.setValidity({ customError: true }, error, control);
    } else if (control && !control.validity.valid) {
      const flags: ValidityStateFlags = {};
      for (const flag of VALIDITY_FLAGS) if (control.validity[flag]) flags[flag] = true;
      internals.setValidity(flags, control.validationMessage, control);
    } else {
      internals.setValidity({});
    }
    this.#invalid.value = !internals.validity.valid;
  }
}
