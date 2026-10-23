import { live } from '@oddkin/core/helpers/live';
import { html } from '@oddkin/core/template';
import type { OddkinSwitch } from './switch.js';

/**
 * Anatomy: a `<label>` row holding the drawn track (the native checkbox with `role="switch"`,
 * `part="control"`, and its `thumb`), the slotted label text (`part="label"`), and the on/off text
 * (`part="state"`, hidden from assistive technology); `description` and `error` parts below,
 * referenced by `aria-describedby`.
 */
export const switchTemplate = (toggle: OddkinSwitch) =>
  html`<div part="field" class="field">
    <label class="choice">
      <span class="indicator">
        <input
          part="control"
          id="control"
          class="switch-track"
          type="checkbox"
          role="switch"
          .checked=${live(toggle._currentChecked)}
          ?required=${toggle.required}
          ?disabled=${toggle.disabled || toggle._formDisabled.value}
          aria-describedby=${toggle._describedBy}
          aria-invalid=${toggle._userInvalid.value ? 'true' : null}
          @input=${toggle._onInput}
          @change=${toggle._onChange}
          @blur=${toggle._onBlur}
        />
        <span part="thumb" class="switch-thumb"></span>
      </span>
      <span part="label" class="label"><slot></slot></span>
      <span part="state" class="state" aria-hidden="true">${toggle._stateText}</span>
    </label>
    <div part="description" id="description" class="description" ?hidden=${!toggle.description}>
      ${toggle.description}
    </div>
    <div part="error" id="error" class="error" ?hidden=${!toggle.error}>${toggle.error}</div>
  </div>`;
