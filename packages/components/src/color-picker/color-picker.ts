import { event, prop, type ElementEvents } from '@oddkin/core/element';
import { format, strings } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { CollectionSource, readOptions, type OptionRecord } from '../collection/collection.js';
import { OddkinFormControl, type FormControlOptions } from '../form-control/form-control.js';
import { keyValue, pointerDrag, type NumberRange } from '../form-control/range.js';
import { Overlay } from '../overlay/overlay.js';
import {
  BLACK,
  hexText,
  parseColor,
  parseHex,
  serializeColor,
  toHsva,
  toRgba,
  type Hsva,
  type Rgba,
} from './color.js';

export type { OptionRecord };

export const COLOR_PICKER_STRINGS = {
  choose: 'Choose color',
  change: 'Change color, {color}',
  invalid: 'Enter a six-digit hex color, such as #2563EB.',
  area: 'Saturation and brightness',
  areaValue: 'Saturation {saturation}%, brightness {brightness}%',
  hue: 'Hue',
  hex: 'Hex',
  opacity: 'Opacity',
  rgb: 'RGB {r}, {g}, {b}',
  swatches: 'Suggested colors',
  cancel: 'Cancel',
  apply: 'Apply',
};

/** Dispatched with `change` for each colour the user commits (typed, or applied in the popup). */
export const colorPickerInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'value',
  intent: 'user',
});
/** Dispatched after `input` for each colour the user commits. */
export const colorPickerChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

const PERCENT: NumberRange = { min: 0, max: 100, step: 1, base: 0 };
const DEGREES: NumberRange = { min: 0, max: 360, step: 1, base: 0 };
const percent = (fraction: number) => Math.round(fraction * 100);

/**
 * One colour, typed as hex or chosen in a popup: a saturation-and-brightness area, a hue slider,
 * hex and opacity entry, the RGB values, and suggested swatches, applied or cancelled. The value is
 * a native colour input's: `#rrggbb`, or with `alpha`, the CSS form color(srgb r g b / a); it is always a
 * colour (black by default).
 *
 * @csspart field - The field: label, description, control box, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart swatch - The colour, at the start of the field.
 * @csspart control - The text input with the colour as hex.
 * @csspart button - Opens the popup.
 * @csspart popup - The popup (a non-modal dialog).
 * @csspart area - Saturation (across) and brightness (up) for the hue.
 * @csspart area-thumb - The area's handle (`role="slider"`); takes focus.
 * @csspart hue - The hue slider's track.
 * @csspart hue-thumb - The hue handle (`role="slider"`).
 * @csspart hex - The popup's hex input.
 * @csspart opacity - The opacity input, in percent (with `alpha`).
 * @csspart rgb - The red, green, and blue values.
 * @csspart swatches - The suggested colours (`<option>` children or `options`).
 * @csspart option-swatch - One suggested colour: a radio, checked while it is the colour.
 * @csspart cancel - Closes the popup without a change.
 * @csspart apply - Commits the popup's colour and closes it.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The field shows its error: `error` is set, or the typed text is not a colour after the user left the field or a validity check failed.
 * @cssstate open - The popup is open.
 * @a11y The text input is named by the label. The button after it is named "Choose color", or "Change color," with the hex, and has `aria-haspopup="dialog"` and `aria-expanded`; it opens a non-modal dialog named "Choose color". The area is one `role="slider"` (WAI-ARIA has no two-axis slider) whose `aria-valuenow` is the saturation and whose `aria-valuetext` names saturation and brightness; the hue is a slider in degrees; the opacity input is a spinbutton; the suggested colours are native radios named by their labels. Typed text that is not a hex colour makes the field invalid.
 * @keyboard The input and the button are Tab stops; in the popup, the area, the hue, the hex and opacity inputs, the suggested colours (one stop, arrow keys between them), Cancel, and Apply. Area: Left and Right saturation (swapped right to left), Up and Down brightness, Page Up and Page Down brightness by ten, Home and End saturation to 0 and 100. Hue: the slider keys, Page Up and Page Down by ten degrees. Opacity: Up and Down by one, Page Up and Page Down by ten. Escape closes without a change, as Cancel does.
 * @previewRole colorPicker
 * @useFor A colour the user chooses for their own content: a layer, a label, a highlight.
 * @notFor Theme colours (use design tokens); one colour from a short fixed set (use odd-radio-group or odd-segmented-control).
 * @limitation The value is sRGB, 8 bits per channel (HTML's limited-srgb colour space); HTML's display-p3 colour space is not offered. Typed colours are hex; the value also takes any CSS colour from script.
 * @category Forms
 */
export class OddkinColorPicker extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible label; names the field.' }),
  defaultValue: prop.string({
    default: '',
    attribute: 'value',
    description: 'Initial colour; the `value` attribute, as on a native colour input.',
  }),
  alpha: prop.boolean({
    reflect: true,
    description: 'The colour takes an opacity, as HTML’s `alpha` on a colour input.',
  }),
  options: prop.object<readonly OptionRecord[]>({
    description: 'Suggested colours; when set, `<option>` children are ignored.',
  }),
  strings: prop.object<Partial<typeof COLOR_PICKER_STRINGS>>({
    description:
      'Localized string overrides: `choose`, `change` (`{color}`), `invalid`, `area`, `areaValue` (`{saturation}`, `{brightness}`), `hue`, `hex`, `opacity`, `rgb` (`{r}`, `{g}`, `{b}`), `swatches`, `cancel`, `apply`.',
  }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { input: colorPickerInputEvent, change: colorPickerChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinColorPicker>;

  // undefined until set or committed ("dirty"), then independent of `defaultValue`.
  readonly #value = signal<string | undefined>(undefined);
  // What the user typed in the field and has not committed as a colour.
  readonly #typed = signal<string | undefined>(undefined);
  // The popup's colour while it is open; HSV keeps the hue at no saturation.
  readonly #draft = signal<Hsva>(toHsva(BLACK));
  // The popup's hex and opacity text while the user types them.
  readonly #hexTyped = signal<string | undefined>(undefined);
  readonly #opacityTyped = signal<string | undefined>(undefined);
  readonly #source = new CollectionSource<OptionRecord>({
    host: this,
    name: 'options',
    property: () => this.options,
    read: readOptions,
  });
  readonly #overlay = new Overlay({
    host: this,
    surface: () => this.shadowRoot?.querySelector<HTMLElement>('[part~="popup"]'),
    anchor: () => this.shadowRoot?.querySelector<HTMLElement>('.control-box'),
    offset: 0,
    onToggle: (open) => {
      this.setState('open', open);
      if (open) this.shadowRoot?.querySelector<HTMLElement>('[part~="area-thumb"]')?.focus();
    },
    onPlace: (placement) => {
      const popup = this.shadowRoot?.querySelector<HTMLElement>('[part~="popup"]');
      if (popup) popup.dataset.side = placement.side;
    },
  });

  constructor() {
    super();
    // A value assigned before the element was defined becomes the dirty value.
    if (Object.hasOwn(this, 'value')) {
      const early = (this as { value?: unknown }).value;
      delete (this as { value?: unknown }).value;
      this.value = String(early ?? '');
    }
  }

  /** @internal The popup is open; the button's `aria-expanded`. */
  readonly _open: Readable<boolean> = this.#overlay.open;
  /** @internal The suggested colours in use. */
  readonly _options: Readable<readonly OptionRecord[]> = this.#source.records;

  /** @internal The colour, as a native colour input sanitizes its value (black for no colour). */
  readonly _color: Readable<Rgba> = computed(() => {
    const color = parseColor(this.#value.value ?? this.defaultValue) ?? BLACK;
    return this.alpha ? color : { ...color, a: 1 };
  });

  /** The colour: `#rrggbb`, or with `alpha`, color(srgb r g b / a). Setting it detaches it from `defaultValue`. */
  get value(): string {
    return serializeColor(this._color.value, this.alpha);
  }
  set value(value: string) {
    this.#value.value = String(value ?? '');
    this.#typed.value = undefined;
  }

  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof COLOR_PICKER_STRINGS> = computed(() =>
    strings(COLOR_PICKER_STRINGS, this.strings),
  );

  /** @internal The field's text: what the user typed, or the colour as hex. */
  get _text(): string {
    return this.#typed.value ?? hexText(this._color.value);
  }

  // Hex the field and the popup take: three or six digits, four or eight with `alpha`.
  #parseHex(text: string): Rgba | undefined {
    const color = parseHex(text);
    return color && (this.alpha || color.a === 1) ? color : undefined;
  }

  /** @internal The message for typed text that is not a colour; empty when there is none. */
  readonly _badInput: Readable<string> = computed(() => {
    const typed = this.#typed.value;
    return typed !== undefined && !this.#parseHex(typed) ? this._strings.value.invalid : '';
  });

  /** @internal The button's name: "Change color, …" with the hex. */
  get _buttonLabel(): string {
    return format(this._strings.value.change, { color: hexText(this._color.value) });
  }

  /** @internal Disabled by its attribute or a disabled fieldset. */
  get _inactive(): boolean {
    return this._formDisabled.value;
  }

  protected override _formOptions(): FormControlOptions {
    return {
      value: () => this.value,
      badInput: () => (this._inactive ? '' : this._badInput.value),
      anchor: () => this.shadowRoot?.querySelector<HTMLElement>('[part~="control"]'),
      onReset: () => {
        this.#value.value = undefined;
        this.#typed.value = undefined;
      },
      onRestore: (state) => {
        if (typeof state === 'string') this.value = state;
      },
    };
  }

  #commit(color: Rgba): void {
    this.#typed.value = undefined;
    const before = this.value;
    this.#value.value = serializeColor(color, this.alpha);
    if (this.value === before) return;
    this.emit(colorPickerInputEvent);
    this.emit(colorPickerChangeEvent);
  }

  /** @internal Template handler: typing in the field. The host's `input` waits for a commit. */
  readonly _onInput = (event: Event): void => {
    event.stopPropagation();
    this.#typed.value = (event.target as HTMLInputElement).value;
  };

  /** @internal Template handler: the typed text is committed (Enter, or focus left the input). */
  readonly _onChange = (): void => {
    const typed = this.#typed.peek();
    const color = typed === undefined ? undefined : this.#parseHex(typed);
    // Text that is not a colour stays for the user to correct; the colour stays too.
    if (color) this.#commit(color);
  };

  /** @internal Template handler: the field's button opens the popup on the colour. */
  readonly _onButton = (event: Event): void => {
    (event.currentTarget as HTMLElement).focus();
    if (!this._open.peek()) this.#startDraft();
    this.#overlay.toggle();
  };

  #startDraft(): void {
    this.#draft.value = toHsva(this._color.peek());
    this.#hexTyped.value = undefined;
    this.#opacityTyped.value = undefined;
  }

  // ---- The popup's colour ----

  /** @internal The popup's colour. */
  get _draft(): Hsva {
    return this.#draft.value;
  }
  /** @internal The popup's colour as red, green, and blue. */
  get _draftRgba(): Rgba {
    return toRgba(this.#draft.value);
  }
  /** @internal The popup's hex text: what the user typed, or the colour. */
  get _hexText(): string {
    return this.#hexTyped.value ?? hexText(this._draftRgba);
  }
  /** @internal The popup's hex text is not a colour. */
  get _hexInvalid(): boolean {
    const typed = this.#hexTyped.value;
    return typed !== undefined && !this.#parseHex(typed);
  }
  /** @internal The popup's opacity text: what the user typed, or the percentage. */
  get _opacityText(): string {
    return this.#opacityTyped.value ?? `${percent(this.#draft.value.a)}%`;
  }
  /** @internal The area thumb's `aria-valuetext`. */
  get _areaText(): string {
    const { s, v } = this.#draft.value;
    return format(this._strings.value.areaValue, {
      saturation: String(percent(s)),
      brightness: String(percent(v)),
    });
  }
  /** @internal The RGB readout. */
  get _rgbText(): string {
    const { r, g, b } = this._draftRgba;
    return format(this._strings.value.rgb, { r: String(r), g: String(g), b: String(b) });
  }
  /** @internal A suggested colour is the popup's colour. */
  _isDraft(option: OptionRecord): boolean {
    const color = parseColor(option.value);
    return !!color && hexText(color) === hexText(this._draftRgba);
  }

  #draw(change: Partial<Hsva>): void {
    this.#draft.value = { ...this.#draft.peek(), ...change };
    this.#hexTyped.value = undefined;
    this.#opacityTyped.value = undefined;
  }

  /** @internal Template handler: keys on the area thumb. */
  readonly _onAreaKeydown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const { s, v } = this.#draft.peek();
    if (/^(ArrowUp|ArrowDown|PageUp|PageDown)$/.test(event.key)) {
      this.#draw({ v: keyValue(event.key, percent(v), PERCENT, { page: 10 })! / 100 });
    } else {
      const rtl = getComputedStyle(this).direction === 'rtl';
      const next = keyValue(event.key, percent(s), PERCENT, { page: 10, horizontal: true, rtl });
      if (next === undefined) return;
      this.#draw({ s: next / 100 });
    }
    event.preventDefault();
  };

  /** @internal Template handler: keys on the hue thumb. */
  readonly _onHueKeydown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const hue = keyValue(event.key, Math.round(this.#draft.peek().h), DEGREES, {
      page: 10,
      horizontal: true,
      rtl,
    });
    if (hue === undefined) return;
    event.preventDefault();
    this.#draw({ h: hue });
  };

  // A colour for the popup; a grey keeps the hue the popup had.
  #fromColor(color: Rgba): Hsva {
    const hsva = toHsva(this.alpha ? color : { ...color, a: 1 });
    return hsva.s ? hsva : { ...hsva, h: this.#draft.peek().h };
  }

  /** @internal Template handler: the popup's hex input. */
  readonly _onHexInput = (event: Event): void => {
    const text = (event.target as HTMLInputElement).value;
    const color = this.#parseHex(text);
    if (color) this.#draft.value = this.#fromColor(color);
    this.#hexTyped.value = text;
  };

  /** @internal Template handler: the opacity input. */
  readonly _onOpacityInput = (event: Event): void => {
    const text = (event.target as HTMLInputElement).value;
    const number = Number(text.replace(/%\s*$/, '').trim());
    if (text.trim() && Number.isFinite(number))
      this.#draft.value = { ...this.#draft.peek(), a: Math.min(100, Math.max(0, number)) / 100 };
    this.#opacityTyped.value = text;
  };

  /** @internal Template handler: keys on the opacity input. */
  readonly _onOpacityKeydown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = keyValue(event.key, percent(this.#draft.peek().a), PERCENT, { page: 10 });
    if (next === undefined) return;
    event.preventDefault();
    this.#draw({ a: next / 100 });
  };

  /** @internal Template handler: a suggested colour was checked. It takes focus (WebKit does not on a click). */
  readonly _onSwatch = (event: Event): void => {
    const radio = event.target as HTMLInputElement;
    radio.focus();
    const color = parseColor(radio.value);
    if (color) this.#draw(this.#fromColor(color));
  };

  /** @internal Template handler: Apply (disabled while the hex text is not a colour). The button takes focus, so focus returns to the opener. */
  readonly _onApply = (event: Event): void => {
    (event.currentTarget as HTMLElement).focus();
    this.#commit(this._draftRgba);
    this.#overlay.hide();
  };
  /** @internal Template handler: Cancel. */
  readonly _onCancel = (event: Event): void => {
    (event.currentTarget as HTMLElement).focus();
    this.#overlay.hide();
  };

  protected override connected(scope: Scope): void {
    super.connected(scope);
    scope.use(this.#source);
  }

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    scope.use(this.#overlay);
    const press = (part: string, move: (x: number, y: number) => void) => {
      const area = this.shadowRoot?.querySelector<HTMLElement>(`[part~="${part}"]`);
      if (!area) return;
      scope.listen(area, 'pointerdown', (event: PointerEvent) => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        const thumb = area.querySelector<HTMLElement>('[role="slider"]')!;
        thumb.focus({ preventScroll: true });
        pointerDrag(scope, area, event, {
          inset: part === 'hue' ? thumb.offsetWidth / 2 : 0,
          move,
        });
      });
    };
    press('area', (x, y) => this.#draw({ s: x, v: 1 - y }));
    press('hue', (x) => this.#draw({ h: Math.round(x * 360) }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-color-picker': OddkinColorPicker;
  }
}
