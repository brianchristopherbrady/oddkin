import { live } from '@oddkin/core/helpers/live';
import { html } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { checkGlyph, minusGlyph } from '../styles/glyphs.js';
import type { OddkinCheckbox } from './checkbox.js';

/**
 * Anatomy: a `<label>` row holding the drawn box (the native checkbox, `part="control"`, with
 * its check and minus marks) and the slotted label text (`part="label"`); `description` and
 * `error` parts below, referenced by `aria-describedby`.
 */
export const checkboxTemplate = (checkbox: OddkinCheckbox) =>
  html`<div part="field" class="field">
    <label class="choice">
      <span class="indicator">
        <input
          part="control"
          id="control"
          class="indicator-box"
          type="checkbox"
          .checked=${live(checkbox._currentChecked)}
          .indeterminate=${checkbox.indeterminate}
          ?required=${checkbox.required}
          ?disabled=${checkbox.disabled || checkbox._formDisabled.value}
          aria-describedby=${checkbox._describedBy}
          aria-invalid=${checkbox._userInvalid.value ? 'true' : null}
          @input=${checkbox._onInput}
          @change=${checkbox._onChange}
          @blur=${checkbox._onBlur}
        />
        <span class="indicator-mark indicator-check">${checkGlyph}</span>
        <span class="indicator-mark indicator-mixed">${minusGlyph}</span>
      </span>
      <span part="label" class="label"><slot></slot></span>
    </label>
    <div part="description" id="description" class="description" ?hidden=${!checkbox.description}>
      ${checkbox.description}
    </div>
    <div part="error" id="error" class="error" ?hidden=${!checkbox.error}>${checkbox.error}</div>
    ${externalDescriptionTemplate(checkbox._externalDescription)}
  </div>`;
