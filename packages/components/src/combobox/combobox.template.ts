import { live } from '@oddkin/core/helpers/live';
import { html, nothing, repeat } from '@oddkin/core/template';
import { groupsOf, type OptionRow } from '../collection/collection.js';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { checkGlyph, chevronDownGlyph, closeGlyph, searchGlyph } from '../styles/glyphs.js';
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
  const active = combobox._activeIndex.value;
  const multiple = combobox.multiple;
  const disabled = combobox.disabled || combobox._formDisabled.value;
  const strings = combobox._strings;
  const rows = (each: readonly OptionRow[]) =>
    repeat(
      each,
      ({ option }) => option.value,
      ({ option, index }) => {
        const chosen = selected.includes(option.value);
        return html`<div
          role="option"
          part="option"
          class=${index === active ? 'option active' : 'option'}
          aria-selected=${chosen ? 'true' : 'false'}
          aria-disabled=${option.disabled ? 'true' : null}
        >
          ${
            multiple
              ? html`<span class="option-start indicator" aria-hidden="true"
                  ><span class="indicator-box" data-state=${chosen ? 'checked' : null}></span
                  ><span class="indicator-mark indicator-check">${checkGlyph}</span></span
                >`
              : nothing
          }<span class="option-label"
            ><span class="option-text">${option.label}</span>${
              option.description
                ? html`<span class="option-description">${option.description}</span>`
                : nothing
            }</span
          >${multiple ? nothing : html`<span class="option-check">${checkGlyph}</span>`}
        </div>`;
      },
    );
  const input = html`<input
    part="input"
    id="control"
    class="entry"
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
  const shown = collapsed ? combobox._shown.value : Number.POSITIVE_INFINITY;
  const hidden = Math.max(0, selected.length - shown);
  const chips = html`<span class="chips" role="list" aria-label=${strings.selected}
    >${repeat(
      selected,
      (value) => value,
      (value, index) => {
        const label = combobox._labelOf(value);
        return html`<span
          role="listitem"
          part="chip"
          class=${index < shown ? 'chip' : 'chip overflow'}
          ><span class="chip-text">${label}</span>${
            combobox.readonly
              ? nothing
              : html`<button
                  part="chip-remove"
                  class="remove"
                  type="button"
                  tabindex="-1"
                  aria-label=${combobox._removeLabel(label)}
                  ?disabled=${disabled}
                  @click=${() => combobox._onChipRemove(value)}
                  @keydown=${(event: KeyboardEvent) => combobox._onChipKeydown(event, value)}
                >
                  ${closeGlyph}
                </button>`
          }</span
        >`;
      },
    )}<span
      role="listitem"
      part="more"
      class=${hidden ? 'chip more' : 'chip more empty'}
      ?hidden=${!collapsed}
      ><span aria-hidden="true">+${hidden}</span
      ><span class="visually-hidden">${combobox._moreLabel(hidden)}</span></span
    ></span
  >`;
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
          ${multiple && selected.length ? chips : nothing}${input}
        </div>
        ${multiple ? nothing : html`<span class="control-start" aria-hidden="true">${searchGlyph}</span>`}
        <span class="control-end">
          <button
            part="clear"
            class="clear"
            type="button"
            tabindex="-1"
            aria-label=${strings.clear}
            ?hidden=${!combobox._clearable}
            @click=${combobox._onClear}
          >
            ${closeGlyph}</button
          >${multiple ? html`<span class="chevron" aria-hidden="true">${chevronDownGlyph}</span>` : nothing}
        </span>
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
        ${repeat(
          groupsOf(options),
          (group, n) =>
            group.label === undefined ? `option ${group.rows[0]!.option.value}` : `group ${n}`,
          (group, n) =>
            group.label === undefined
              ? rows(group.rows)
              : html`<div role="group" class="group" aria-labelledby=${`group-${n}`}>
                  <div part="group" id=${`group-${n}`} class="group-label">${group.label}</div>
                  ${rows(group.rows)}
                </div>`,
        )}
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
