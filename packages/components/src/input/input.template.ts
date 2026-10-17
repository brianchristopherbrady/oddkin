import { live } from '@mote/core/helpers/live';
import { html } from '@mote/core/template';
import type { MoteInput } from './input.js';

/**
 * Anatomy: a `label` part labelling the native `<input part="control">` in the same shadow
 * root, `description` and `error` parts referenced by `aria-describedby`, and the input's
 * `input`, `change`, and `blur` handlers. The control keeps its value through `live()`.
 */
export const inputTemplate = (input: MoteInput) => {
  const invalid = !!input.error || (input._touched.value && input._invalid.value);
  const describedBy =
    [input.description ? 'description' : '', input.error ? 'error' : '']
      .filter(Boolean)
      .join(' ') || null;
  return html`<div part="field" class="field">
    <label part="label" class="label" for="control" ?hidden=${!input.label}>${input.label}</label>
    <div part="description" id="description" class="description" ?hidden=${!input.description}>
      ${input.description}
    </div>
    <input
      part="control"
      id="control"
      class="control"
      .value=${live(input._currentValue)}
      type=${input.type}
      name=${input.name || null}
      placeholder=${input.placeholder || null}
      autocomplete=${input.autocomplete || null}
      ?required=${input.required}
      ?disabled=${input.disabled || input._formDisabled.value}
      ?readonly=${input.readonly}
      aria-describedby=${describedBy}
      aria-invalid=${invalid ? 'true' : null}
      @input=${input._onInput}
      @change=${input._onChange}
      @blur=${input._onBlur}
    />
    <div part="error" id="error" class="error" ?hidden=${!input.error}>${input.error}</div>
  </div>`;
};
