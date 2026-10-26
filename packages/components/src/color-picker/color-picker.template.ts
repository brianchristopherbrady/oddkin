import { live } from '@oddkin/core/helpers/live';
import { styleMap } from '@oddkin/core/helpers/style-map';
import { html, nothing } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { checkGlyph, chevronDownGlyph } from '../styles/glyphs.js';
import { hexText, isLight, parseColor } from './color.js';
import type { OddkinColorPicker } from './color-picker.js';

const percent = (fraction: number) => String(Math.round(fraction * 100));

/**
 * Anatomy: the `label` for the text input (part `control`) in the field box, the colour's `swatch`
 * before it and the `button` after it; the `description` and `error`; and the `popup` (a
 * non-modal dialog joined under the field box): the saturation-and-brightness `area` with its
 * `area-thumb`, the `hue` slider (the shared slider area) with its `hue-thumb`, the `hex` and
 * (with `alpha`) `opacity` inputs, the `rgb` values, the suggested `swatches` (native radios, part
 * `option-swatch`), and the `cancel` and `apply` buttons. The inputs keep their text through
 * `live()`.
 */
export const colorPickerTemplate = (picker: OddkinColorPicker) => {
  const text = picker._strings.value;
  const inactive = picker._inactive;
  const color = picker._color.value;
  const draft = picker._draft;
  const options = picker._options.value;
  return html`<div part="field" class="field">
    <label part="label" class="label" for="control" ?hidden=${!picker.label}>${picker.label}</label>
    <div part="description" id="description" class="description" ?hidden=${!picker.description}>
      ${picker.description}
    </div>
    <div class="control-box">
      <input
        part="control"
        id="control"
        class="control"
        type="text"
        autocomplete="off"
        spellcheck="false"
        .value=${live(picker._text)}
        ?disabled=${inactive}
        aria-describedby=${picker._describedBy}
        aria-invalid=${picker._userInvalid.value ? 'true' : null}
        @input=${picker._onInput}
        @change=${picker._onChange}
        @blur=${picker._onBlur}
      />
      <span
        part="swatch"
        class="control-start swatch"
        aria-hidden="true"
        style=${styleMap({ '--_color': hexText(color) })}
      ></span>
      <span class="control-end">
        <button
          part="button"
          class="button"
          type="button"
          aria-label=${picker._buttonLabel}
          aria-haspopup="dialog"
          aria-expanded=${picker._open.value ? 'true' : 'false'}
          ?disabled=${inactive}
          @click=${picker._onButton}
        >
          ${chevronDownGlyph}
        </button>
      </span>
    </div>
    <div part="error" id="error" class="error" ?hidden=${!picker.error}>${picker.error}</div>
    <div
      part="popup"
      class="overlay-surface popup"
      role="dialog"
      aria-label=${text.choose}
      @input=${(event: Event) => event.stopPropagation()}
    >
      <div class="controls">
        <div
          part="area"
          class="area"
          style=${styleMap({
            '--_hue': String(draft.h),
            '--_s': String(draft.s),
            '--_v': String(draft.v),
          })}
        >
          <div
            part="area-thumb"
            class="area-thumb"
            role="slider"
            tabindex="0"
            aria-label=${text.area}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow=${percent(draft.s)}
            aria-valuetext=${picker._areaText}
            @keydown=${picker._onAreaKeydown}
          ></div>
        </div>
        <div
          part="hue"
          class="slider hue"
          style=${styleMap({ '--_fraction': String(draft.h / 360) })}
        >
          <div class="track"></div>
          <div
            part="hue-thumb"
            class="thumb"
            role="slider"
            tabindex="0"
            aria-label=${text.hue}
            aria-valuemin="0"
            aria-valuemax="360"
            aria-valuenow=${String(Math.round(draft.h))}
            @keydown=${picker._onHueKeydown}
          ></div>
        </div>
        <div class="entries">
          <label class="entry">
            <span class="entry-label">${text.hex}</span>
            <input
              part="hex"
              class="control"
              type="text"
              autocomplete="off"
              spellcheck="false"
              .value=${live(picker._hexText)}
              aria-invalid=${picker._hexInvalid ? 'true' : null}
              @input=${picker._onHexInput}
            />
          </label>
          ${
            picker.alpha
              ? html`<label class="entry">
                  <span class="entry-label">${text.opacity}</span>
                  <input
                    part="opacity"
                    class="control"
                    type="text"
                    role="spinbutton"
                    inputmode="numeric"
                    autocomplete="off"
                    .value=${live(picker._opacityText)}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow=${percent(draft.a)}
                    aria-valuetext=${`${percent(draft.a)}%`}
                    @input=${picker._onOpacityInput}
                    @keydown=${picker._onOpacityKeydown}
                  />
                </label>`
              : nothing
          }
        </div>
        <p part="rgb" class="rgb">${picker._rgbText}</p>
        ${
          options.length
            ? html`<div part="swatches" class="swatches">
                <p id="swatches-label" class="swatches-label">${text.swatches}</p>
                <div class="swatch-row" role="radiogroup" aria-labelledby="swatches-label">
                  ${options.map((option) => {
                    const optionColor = parseColor(option.value);
                    return html`<label
                      part="option-swatch"
                      class=${optionColor && isLight(optionColor) ? 'option-swatch light' : 'option-swatch'}
                      style=${styleMap({ '--_color': optionColor ? hexText(optionColor) : null })}
                    >
                      <input
                        class="option-radio"
                        type="radio"
                        name="swatch"
                        .value=${option.value}
                        .checked=${live(picker._isDraft(option))}
                        ?disabled=${option.disabled}
                        aria-label=${option.label || (optionColor ? hexText(optionColor) : option.value)}
                        @change=${picker._onSwatch}
                      />
                      ${checkGlyph}
                    </label>`;
                  })}
                </div>
              </div>`
            : nothing
        }
        <div class="actions">
          <button
            part="cancel"
            class="odd-button"
            data-size="sm"
            type="button"
            @click=${picker._onCancel}
          >
            ${text.cancel}
          </button>
          <button
            part="apply"
            class="odd-button"
            data-appearance="primary"
            data-size="sm"
            type="button"
            ?disabled=${picker._hexInvalid}
            @click=${picker._onApply}
          >
            ${text.apply}
          </button>
        </div>
      </div>
    </div>
    ${externalDescriptionTemplate(picker._externalDescription)}
  </div>`;
};
