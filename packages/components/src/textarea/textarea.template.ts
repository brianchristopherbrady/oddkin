import { live } from '@oddkin/core/helpers/live';
import { html } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import type { OddkinTextarea } from './textarea.js';

/**
 * Anatomy: the shared field over a native `<textarea part="control">` labelled in the same
 * shadow root, `description` and `error` parts, and a `count` part under the field while
 * `maxlength` is set (Figma draws one line there: the count, or the error that replaces it).
 */
export const textareaTemplate = (textarea: OddkinTextarea) =>
  html`<div part="field" class="field">
    <label part="label" class="label" for="control" ?hidden=${!textarea.label}>
      ${textarea.label}
    </label>
    <div part="description" id="description" class="description" ?hidden=${!textarea.description}>
      ${textarea.description}
    </div>
    <textarea
      part="control"
      id="control"
      class="control"
      .value=${live(textarea._currentValue)}
      name=${textarea.name || null}
      placeholder=${textarea.placeholder || null}
      autocomplete=${textarea.autocomplete || null}
      rows=${textarea.rows}
      minlength=${textarea.minLength ?? null}
      maxlength=${textarea.maxLength ?? null}
      ?required=${textarea.required}
      ?disabled=${textarea.disabled || textarea._formDisabled.value}
      ?readonly=${textarea.readonly}
      aria-describedby=${textarea._describedBy}
      aria-invalid=${textarea._userInvalid.value ? 'true' : null}
      @input=${textarea._onInput}
      @change=${textarea._onChange}
      @blur=${textarea._onBlur}
    ></textarea>
    <div part="error" id="error" class="error" ?hidden=${!textarea.error}>${textarea.error}</div>
    <div part="count" id="count" class="description" ?hidden=${!textarea._countShown}>
      ${textarea._count}
    </div>
    ${externalDescriptionTemplate(textarea._externalDescription)}
  </div>`;
