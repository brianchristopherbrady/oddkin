import { live } from '@oddkin/core/helpers/live';
import { html, nothing } from '@oddkin/core/template';
import { chipsTemplate, fieldEndTemplate } from '../collection/option-field.template.js';
import { optionListTemplate } from '../collection/option-rows.template.js';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { chevronDownGlyph, searchGlyph } from '../styles/glyphs.js';
import { spinnerTemplate } from '../styles/spinner.styles.js';
import type { OddkinCombobox } from './combobox.js';

/**
 * Anatomy: a `label` part labelling the `role="combobox"` input (`part="input"`) in the same
 * shadow root, `description` and `error` parts referenced by `aria-describedby`, and the field box
 * (`part="control"`, the control look) holding the input and, with `multiple`, the chips before it
 * (a list of `part="chip"` with `part="chip-remove"` buttons and the `part="more"` count). The
 * adornments follow Figma: a search glyph at the start of a single combobox, the chevron at the end
 * with `multiple`, and the clear button (`part="clear"`) at the end while there is a value. The popup (`part="popup"`,
 * a manual popover on the overlay surface) holds the `role="listbox"` with option rows (option-row
 * module; with `multiple`, a decorative check box at the start), the busy row, the empty state, and
 * the `status` slot. Rows are keyed by value, so the active option stays the same element while the
 * filter changes.
 */
export const comboboxTemplate = (combobox: OddkinCombobox) => {
  const options = combobox._shownOptions.value;
  const selected = combobox._selected.value;
  const multiple = combobox.multiple;
  const disabled = combobox.disabled || combobox._formDisabled.value;
  const strings = combobox._strings;
  const input = html`<input
    part="input"
    id="control"
    class="combobox"
    type="text"
    role="combobox"
    autocomplete="off"
    inputmode=${combobox._hints.get('inputmode')}
    enterkeyhint=${combobox._hints.get('enterkeyhint')}
    autocapitalize=${combobox._hints.get('autocapitalize')}
    autocorrect=${combobox._hints.get('autocorrect')}
    spellcheck=${combobox._hints.get('spellcheck', 'false')}
    .value=${live(combobox._text.value)}
    placeholder=${(multiple && selected.length) || !combobox.placeholder ? null : combobox.placeholder}
    ?disabled=${disabled}
    ?readonly=${combobox.readonly}
    aria-expanded=${String(combobox._open.value)}
    aria-controls="listbox"
    aria-autocomplete="list"
    aria-required=${combobox.required ? 'true' : null}
    aria-describedby=${combobox._describedBy}
    aria-invalid=${combobox._userInvalid.value ? 'true' : null}
    @input=${combobox._onInput}
    @click=${combobox._onInputClick}
    @keydown=${combobox._onKeydown}
  />`;
  const collapsed = combobox._collapsed.value;
  return html`<div part="field" class="field">
      <label part="label" id="label" class="label" for="control" ?hidden=${!combobox.label}
        >${combobox.label}</label
      >
      <div part="description" id="description" class="description" ?hidden=${!combobox.description}>
        ${combobox.description}
      </div>
      <div class="control-box">
        <div
          part="control"
          class=${multiple && collapsed ? 'control box collapsed' : 'control box'}
        >
          ${multiple && selected.length ? chipsTemplate(combobox, combobox.readonly, disabled) : nothing}${input}
        </div>
        ${multiple ? nothing : html`<span class="control-start" aria-hidden="true">${searchGlyph}</span>`}
        ${fieldEndTemplate(combobox, multiple ? chevronDownGlyph : undefined)}
      </div>
      <div part="error" id="error" class="error" ?hidden=${!combobox.error}>${combobox.error}</div>
      ${externalDescriptionTemplate(combobox._externalDescription)}
    </div>
    <div
      part="popup"
      id="popup"
      class="overlay-surface popup"
      @pointerdown=${combobox._onPopupPointerdown}
      @click=${combobox._onPopupClick}
    >
      <div
        part="listbox"
        id="listbox"
        class="listbox"
        role="listbox"
        aria-labelledby=${combobox.label ? 'label' : null}
        aria-multiselectable=${multiple ? 'true' : null}
        aria-busy=${combobox.loading ? 'true' : null}
        ?hidden=${!options.length}
      >
        ${optionListTemplate(options, selected, combobox._activeIndex.value, multiple)}
      </div>
      <div part="loading" class="state" ?hidden=${!combobox.loading}>
        ${spinnerTemplate}${strings.loading}
      </div>
      <div part="empty" class="state" ?hidden=${options.length > 0 || combobox.loading}>
        <slot name="empty">${strings.empty}</slot>
      </div>
      <slot name="status"></slot>
    </div>`;
};
