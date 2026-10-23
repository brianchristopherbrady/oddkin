import { html, nothing } from '@oddkin/core/template';
import { groupsOf, type OptionRecord } from '../collection/collection.js';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { chevronDownGlyph } from '../styles/glyphs.js';
import type { OddkinSelect } from './select.js';

/**
 * Anatomy: a `label` part labelling the native `<select part="control">` in the same shadow root,
 * `description` and `error` parts referenced by `aria-describedby`, and the select's `input`,
 * `change`, and `blur` handlers. A placeholder is a disabled first option with an empty value
 * (the native placeholder option, so `required` works); grouped options sit in `<optgroup>`. Each
 * option's `selected` property follows `value`, so the selection is set before validity is read.
 * The chevron (`.control-end`) replaces the engine's arrow.
 */
export const selectTemplate = (select: OddkinSelect) => {
  const value = select.value;
  const option = ({ option }: { option: OptionRecord }) =>
    html`<option
      .value=${option.value}
      .selected=${option.value === value}
      ?disabled=${option.disabled}
      title=${option.description ?? null}
    >
      ${option.label}
    </option>`;
  return html`<div part="field" class="field">
    <label part="label" class="label" for="control" ?hidden=${!select.label}>${select.label}</label>
    <div part="description" id="description" class="description" ?hidden=${!select.description}>
      ${select.description}
    </div>
    <div class="control-box">
      <select
        part="control"
        id="control"
        class="control"
        name=${select.name || null}
        ?required=${select.required}
        ?disabled=${select.disabled || select._formDisabled.value}
        aria-describedby=${select._describedBy}
        aria-invalid=${select._userInvalid.value ? 'true' : null}
        @input=${select._onInput}
        @change=${select._onChange}
        @blur=${select._onBlur}
      >
        ${
          select.placeholder
            ? html`<option class="placeholder" value="" disabled .selected=${value === ''}>
                ${select.placeholder}
              </option>`
            : nothing
        }
        ${groupsOf(select._options.value).map((group) =>
          group.label === undefined
            ? group.rows.map(option)
            : html`<optgroup label=${group.label}>${group.rows.map(option)}</optgroup>`,
        )}
      </select>
      <span class="control-end" aria-hidden="true">${chevronDownGlyph}</span>
    </div>
    <div part="error" id="error" class="error" ?hidden=${!select.error}>${select.error}</div>
    ${externalDescriptionTemplate(select._externalDescription)}
  </div>`;
};
