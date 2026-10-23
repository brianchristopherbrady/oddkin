/**
 * `@oddkin/core/controllers/form` — form participation for custom elements that opt in with
 * `static formAssociated = true`: the submitted value and validity mirrored from an inner native
 * control, the form owner, and reset, restore, and disabled-fieldset state. The element passes
 * its `ElementInternals` and forwards the four native form callbacks to the controller.
 * Unbranded and `Scope`-owned. Contract: docs/architecture/core-contracts.md §4.1.
 */
import { OddkinError } from '../diagnostics/index.js';
import { DEV } from '../internal/dev.js';
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
  /**
   * Inner native control whose validity flags, message, and anchor are mirrored while it is
   * subject to constraint validation; a disabled or read-only control counts as valid.
   */
  readonly control?: () => NativeControl | null | undefined;
  /** Custom error; while non-empty the element is invalid with this message. */
  readonly error?: () => string;
  /**
   * Where the browser points the validation message and moves focus on a blocked submission: a
   * focusable part of the element's shadow tree. Default: `control`. Give it when `control` is not
   * rendered (a detached native control that only supplies the flags and the message).
   */
  readonly anchor?: () => HTMLElement | null | undefined;
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
  readonly #form = signal<HTMLFormElement | null>(null);

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

  /**
   * The form owner: the form named by the element's `form` attribute, otherwise the nearest
   * ancestor form, otherwise `null`. Read on connect and updated by `formAssociatedCallback`.
   */
  get form(): Readable<HTMLFormElement | null> {
    return this.#form;
  }

  connect(scope: Scope): void {
    let owner: HTMLFormElement | null;
    try {
      owner = this.#options.internals().form;
    } catch (cause) {
      // ElementInternals throws NotSupportedError for elements that are not form-associated.
      throw new OddkinError(
        'controller.form.notAssociated',
        DEV ? 'FormValue needs a form-associated element: add `static formAssociated = true`.' : '',
        { cause },
      );
    }
    this.#form.value = owner;
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

  /** Forward from the element's `formAssociatedCallback`: the form owner changed. */
  formAssociatedCallback(form: HTMLFormElement | null): void {
    this.#form.value = form;
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
    const anchor = this.#options.anchor?.() ?? control;
    if (error) {
      internals.setValidity({ customError: true }, error, anchor);
    } else if (control?.willValidate && !control.validity.valid) {
      // A barred control (disabled, read-only) keeps failing flags but has no message.
      const flags: ValidityStateFlags = {};
      for (const flag of VALIDITY_FLAGS) if (control.validity[flag]) flags[flag] = true;
      internals.setValidity(flags, control.validationMessage, anchor);
    } else {
      internals.setValidity({});
    }
    this.#invalid.value = !internals.validity.valid;
  }
}
