import { live } from '@oddkin/core/helpers/live';
import { html } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { calendarGlyph } from '../styles/glyphs.js';
import type { OddkinDatePicker } from './date-picker.js';

/**
 * Anatomy: the `label` for the text input (part `control`) in the field box, with the calendar
 * `button` at its end; the `description` and `error`; and the `popup` (a popover dialog anchored
 * under the field box) holding an `odd-calendar` that shares the picker's value, bounds, first
 * day, disabled-date hook, read-only state, and strings. The input keeps its text through
 * `live()`.
 */
export const datePickerTemplate = (picker: OddkinDatePicker) => {
  const text = picker._strings.value;
  const inactive = picker._inactive;
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
        inputmode="numeric"
        autocomplete="off"
        .value=${live(picker._text)}
        placeholder=${picker.placeholder || null}
        ?required=${picker.required}
        ?readonly=${picker.readonly}
        ?disabled=${inactive}
        aria-describedby=${picker._describedBy}
        aria-invalid=${picker._userInvalid.value ? 'true' : null}
        @input=${picker._onInput}
        @change=${picker._onChange}
        @blur=${picker._onBlur}
      />
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
          ${calendarGlyph}
        </button>
      </span>
    </div>
    <div part="error" id="error" class="error" ?hidden=${!picker.error}>${picker.error}</div>
    <div part="popup" class="overlay-surface popup" role="dialog" aria-label=${text.choose}>
      <odd-calendar
        .value=${picker.value}
        .min=${picker.min}
        .max=${picker.max}
        .firstDay=${picker.firstDay}
        .isDateDisabled=${picker.isDateDisabled}
        .readonly=${picker.readonly}
        .strings=${text}
        @change=${picker._onCalendarChange}
        @input=${(event: Event) => event.stopPropagation()}
      ></odd-calendar>
    </div>
    ${externalDescriptionTemplate(picker._externalDescription)}
  </div>`;
};
