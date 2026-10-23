import { live } from '@oddkin/core/helpers/live';
import { html, nothing } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { closeGlyph, searchGlyph } from '../styles/glyphs.js';
import type { OddkinInput } from './input.js';

/**
 * Anatomy: a `label` part labelling the native `<input part="control">` in the same shadow
 * root, `description` and `error` parts referenced by `aria-describedby`, and the input's
 * `input`, `change`, and `blur` handlers. The control keeps its value through `live()`. A
 * search field is a text input with the `searchbox` role, a search glyph (part `icon`), and a
 * clear button (part `clear`): the engines' own cancel buttons cannot be hidden without
 * prefixed pseudo-elements.
 */
export const inputTemplate = (input: OddkinInput) => {
  const search = input.type === 'search';
  return html`<div part="field" class="field">
    <label part="label" class="label" for="control" ?hidden=${!input.label}>${input.label}</label>
    <div part="description" id="description" class="description" ?hidden=${!input.description}>
      ${input.description}
    </div>
    <div class="control-box">
      <input
        part="control"
        id="control"
        class="control"
        .value=${live(input._currentValue)}
        type=${search ? 'text' : input.type}
        role=${search ? 'searchbox' : null}
        enterkeyhint=${search ? 'search' : null}
        name=${input.name || null}
        placeholder=${input.placeholder || null}
        autocomplete=${input.autocomplete || null}
        min=${input.min ?? null}
        max=${input.max ?? null}
        step=${input.step ?? null}
        minlength=${input.minLength ?? null}
        maxlength=${input.maxLength ?? null}
        pattern=${input.pattern ?? null}
        inputmode=${input._inputMode}
        ?required=${input.required}
        ?disabled=${input.disabled || input._formDisabled.value}
        ?readonly=${input.readonly}
        aria-describedby=${input._describedBy}
        aria-invalid=${input._userInvalid.value ? 'true' : null}
        @input=${input._onInput}
        @change=${input._onChange}
        @blur=${input._onBlur}
        @keydown=${input._onKeydown}
      />
      ${
        search
          ? html`<span part="icon" class="control-start" aria-hidden="true">${searchGlyph}</span>
              <span class="control-end">
                <button
                  part="clear"
                  class="clear"
                  type="button"
                  tabindex="-1"
                  aria-label=${input._clearLabel}
                  ?hidden=${!input._clearable}
                  @click=${input._onClear}
                >
                  ${closeGlyph}
                </button>
              </span>`
          : nothing
      }
    </div>
    <div part="error" id="error" class="error" ?hidden=${!input.error}>${input.error}</div>
    ${externalDescriptionTemplate(input._externalDescription)}
  </div>`;
};
