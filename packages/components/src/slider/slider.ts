import { event, prop, type ElementEvents } from '@oddkin/core/element';
import { formatNumber, langOf } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { OddkinFormControl, type FormControlOptions } from '../form-control/form-control.js';
import { keyValue, pointerDrag, snapNumber, type NumberRange } from '../form-control/range.js';

/** Dispatched for every change the user makes (a key, a drag step), as on a native range. */
export const inputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'value',
  intent: 'user',
});
/** Dispatched when the user commits a change: after each key, and when a drag ends. */
export const changeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

/** Formats a value for the output and the endpoint labels; its text is also announced. */
export type SliderValueRenderer = (value: number) => string;

/**
 * A number from a bounded range, chosen by dragging a thumb along a track or with the keys, with
 * the current value and both endpoints shown. Drawn as an ARIA slider rather than a native
 * `<input type="range">`, whose track and thumb can only be styled through engine-prefixed
 * pseudo-elements. Values follow the native range: snapped to `step` from `min`, clamped to the
 * range; without a `value` attribute the default is halfway.
 *
 * @csspart field - Wrapper of the label row, description, slider, endpoints, and error.
 * @csspart label - The visible label.
 * @csspart output - The current value, beside the label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The area that takes pointer input: track and thumb.
 * @csspart track - The full range.
 * @csspart fill - The part of the track up to the value.
 * @csspart thumb - The handle (`role="slider"`); takes focus.
 * @csspart min-label - The lowest value, under the start of the track.
 * @csspart max-label - The highest value, under the end of the track.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The slider shows its error: `error` is set.
 * @a11y The thumb is a `role="slider"` named by `label`, with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and, with `renderValue`, `aria-valuetext`; description and error are announced through `aria-describedby`. The output and endpoint labels repeat the values visually and are hidden from assistive technology.
 * @keyboard Right and Up increase by `step`, Left and Down decrease (Left and Right swap in right-to-left text); Page Up and Page Down move by a tenth of the range, in whole steps; Home and End go to `min` and `max`. Each key dispatches `input` and `change`.
 * @previewRole slider
 * @useFor A setting within a known range where the approximate position matters more than the exact number: a zoom level, a volume, a preview scale.
 * @notFor An exact number (use odd-input type="number"); one of a few named values (use odd-segmented-control); progress of a task (use odd-progress).
 * @category Forms
 */
export class OddkinSlider extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible label; names the slider.' }),
  defaultValue: prop.string({
    default: '',
    attribute: 'value',
    description: 'Initial value; the `value` attribute, as on a native range (default: halfway).',
  }),
  min: prop.number({ default: 0, description: 'Lowest value.' }),
  max: prop.number({ default: 100, description: 'Highest value.' }),
  step: prop.number({ default: 1, description: 'Granularity, counted from `min`.' }),
  renderValue: prop.custom<SliderValueRenderer | undefined>({
    default: () => undefined,
    coerce: (value) =>
      value === undefined || typeof value === 'function'
        ? { ok: true, value: value as SliderValueRenderer | undefined }
        : { ok: false, reason: 'expected a function or undefined' },
    description:
      'Formats the value, `min`, and `max` for display and announcement (default: the number in the element language).',
  }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { input: inputEvent, change: changeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinSlider>;

  // undefined until set or moved ("dirty"), then independent of `defaultValue`.
  readonly #value = signal<string | undefined>(undefined);

  constructor() {
    super();
    // A value assigned before the element was defined becomes the dirty value.
    if (Object.hasOwn(this, 'value')) {
      const early = (this as { value?: unknown }).value;
      delete (this as { value?: unknown }).value;
      this.value = String(early ?? '');
    }
  }

  /** @internal `max`, or `min` when `max` is below it (as native). */
  get _max(): number {
    return Math.max(this.min, this.max);
  }
  // The grid: `step` (1 when it is not positive) from `min`, within `min` and `max`.
  get #range(): NumberRange & { readonly step: number } {
    return { min: this.min, max: this._max, step: this.step > 0 ? this.step : 1, base: this.min };
  }

  /** @internal The current value as a number on the grid. */
  readonly _number: Readable<number> = computed(() => {
    const parsed = Number.parseFloat(this.#value.value ?? this.defaultValue);
    const value = Number.isFinite(parsed) ? parsed : (this.min + this._max) / 2;
    return snapNumber(value, this.#range);
  });

  /** The current value, as a string (native range). Setting it detaches it from `defaultValue`. */
  get value(): string {
    return String(this._number.value);
  }
  set value(value: string) {
    this.#value.value = String(value ?? '');
  }

  /** The current value as a number. */
  get valueAsNumber(): number {
    return this._number.value;
  }
  set valueAsNumber(value: number) {
    this.value = String(value);
  }

  /** @internal Display text for a value. */
  _text(value: number): string {
    return this.renderValue ? this.renderValue(value) : formatNumber(value, langOf(this));
  }
  /** @internal The value's position along the track, from 0 to 1. */
  get _fraction(): number {
    const span = this._max - this.min;
    return span > 0 ? (this._number.value - this.min) / span : 0;
  }

  protected override _formOptions(): FormControlOptions {
    return {
      value: () => this.value,
      anchor: () => this.shadowRoot?.querySelector<HTMLElement>('.thumb'),
      onReset: () => {
        this.#value.value = undefined;
      },
      onRestore: (state) => {
        if (typeof state === 'string') this.value = state;
      },
    };
  }

  get #disabled(): boolean {
    return this.disabled || this._formDisabled.value;
  }

  // Sets the value the user chose; true when it changed.
  #move(value: number): boolean {
    const next = snapNumber(value, this.#range);
    if (next === this._number.peek()) return false;
    this.value = String(next);
    this.emit(inputEvent);
    return true;
  }

  /** @internal Template handler: keys on the thumb. */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    if (this.#disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const range = this.#range;
    // A tenth of the range, in whole steps.
    const page = Math.max(1, Math.round((this._max - this.min) / 10 / range.step));
    const rtl = getComputedStyle(this).direction === 'rtl';
    const next = keyValue(event.key, this._number.peek(), range, { page, horizontal: true, rtl });
    if (next === undefined) return;
    event.preventDefault();
    if (this.#move(next)) this.emit(changeEvent);
  };

  // A press on the track or thumb moves the value there and starts a drag that follows the pointer.
  #press(event: PointerEvent, area: HTMLElement, scope: Scope): void {
    if (this.#disabled || event.button !== 0 || !event.isPrimary) return;
    const thumb = area.querySelector<HTMLElement>('.thumb');
    if (!thumb) return;
    // No text selection starts; focus moves to the thumb so the keys continue from here.
    event.preventDefault();
    thumb.focus({ preventScroll: true });
    const start = this._number.peek();
    pointerDrag(scope, area, event, {
      inset: thumb.offsetWidth / 2,
      move: (x) => this.#move(this.min + x * (this._max - this.min)),
      end: () => {
        if (this._number.peek() !== start) this.emit(changeEvent);
      },
    });
  }

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    const area = this.shadowRoot?.querySelector<HTMLElement>('.slider');
    if (area)
      scope.listen(area, 'pointerdown', (event: PointerEvent) => this.#press(event, area, scope));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-slider': OddkinSlider;
  }
}
