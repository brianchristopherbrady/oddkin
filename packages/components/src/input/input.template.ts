import { live } from '@oddkin/core/helpers/live';
import { html, nothing } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { closeGlyph, minusGlyph, plusGlyph, searchGlyph } from '../styles/glyphs.js';
import type { OddkinInput } from './input.js';

/**
 * Anatomy: a `label` part labelling the native `<input part="control">` in the same shadow
 * root, `description` and `error` parts referenced by `aria-describedby`, and the input's
 * `input`, `change`, and `blur` handlers. The control keeps its text through `live()`. A
 * search field is a text input with the `searchbox` role, a search glyph (part `icon`), and a
 * clear button (part `clear`): the engines' own cancel buttons cannot be hidden without
 * prefixed pseudo-elements. A number field is a text input with the `spinbutton` role and a
 * `stepper` segment of `decrement` and `increment` buttons, for the same reason (spin buttons).
 */
export const inputTemplate = (input: OddkinInput) => {
  const search = input.type === 'search';
  const spin = input.type === 'number' ? input._spin : undefined;
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
        type=${search || spin ? 'text' : input.type}
        role=${search ? 'searchbox' : spin ? 'spinbutton' : null}
        name=${input.name || null}
        placeholder=${input.placeholder || null}
        autocomplete=${input.autocomplete || null}
        min=${input.min ?? null}
        max=${input.max ?? null}
        step=${input.step ?? null}
        minlength=${input.minLength ?? null}
        maxlength=${input.maxLength ?? null}
        pattern=${input.pattern ?? null}
        aria-valuenow=${spin?.now ?? null}
        aria-valuetext=${spin?.text ?? null}
        aria-valuemin=${spin?.min ?? null}
        aria-valuemax=${spin?.max ?? null}
        inputmode=${input._hints.get('inputmode', spin ? 'decimal' : null)}
        enterkeyhint=${input._hints.get('enterkeyhint', search ? 'search' : null)}
        autocapitalize=${input._hints.get('autocapitalize')}
        autocorrect=${input._hints.get('autocorrect')}
        spellcheck=${input._hints.get('spellcheck')}
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
      ${
        spin
          ? html`<span part="stepper" class="stepper">
              <button
                part="decrement"
                class="step"
                type="button"
                tabindex="-1"
                data-step="-1"
                aria-label=${input._stepLabels.decrement}
                ?disabled=${!spin.down}
                @mousedown=${input._onStepPress}
                @click=${input._onStep}
              >
                ${minusGlyph}
              </button>
              <button
                part="increment"
                class="step"
                type="button"
                tabindex="-1"
                data-step="1"
                aria-label=${input._stepLabels.increment}
                ?disabled=${!spin.up}
                @mousedown=${input._onStepPress}
                @click=${input._onStep}
              >
                ${plusGlyph}
              </button>
            </span>`
          : nothing
      }
    </div>
    <div part="error" id="error" class="error" ?hidden=${!input.error}>${input.error}</div>
    ${externalDescriptionTemplate(input._externalDescription)}
  </div>`;
};
