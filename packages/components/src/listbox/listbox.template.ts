import { html, repeat } from '@oddkin/core/template';
import { groupsOf, type OptionRow } from '../collection/collection.js';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { checkGlyph } from '../styles/glyphs.js';
import type { OddkinListbox } from './listbox.js';

const spinner = html`<span class="spinner"></span>`;

/**
 * Anatomy: the field (`label`, `description`, and `error` parts) around `part="base"`, the surface
 * holding the `part="listbox"` focus target with its option rows (option-row module; a group's
 * options in a `role="group"` named by its `part="group"` heading), the `part="loading"` busy
 * row, the `part="empty"` state, and the `status` slot. Rows are keyed by value, so the active
 * option stays the same element when options change.
 */
export const listboxTemplate = (listbox: OddkinListbox) => {
  const options = listbox._options.value;
  const selected = listbox._selected.value;
  const active = listbox._activeIndex.value;
  const disabled = listbox.disabled || listbox._formDisabled.value;
  const strings = listbox._strings;
  const rows = (each: readonly OptionRow[]) =>
    repeat(
      each,
      ({ option }) => option.value,
      ({ option, index }) =>
        html`<div
          role="option"
          part="option"
          class=${index === active ? 'option active' : 'option'}
          aria-selected=${selected.includes(option.value) ? 'true' : 'false'}
          aria-disabled=${option.disabled ? 'true' : null}
        >
          <span class="option-label"
            ><span class="option-text">${option.label}</span>${
              option.description
                ? html`<span class="option-description">${option.description}</span>`
                : null
            }</span
          ><span class="option-check">${checkGlyph}</span>
        </div>`,
    );
  return html`<div part="field" class="field">
    <span part="label" id="label" class="label">${listbox.label}</span>
    <div part="description" id="description" class="description" ?hidden=${!listbox.description}>
      ${listbox.description}
    </div>
    <div part="base" class="surface">
      <div
        part="listbox"
        class="listbox"
        role="listbox"
        tabindex=${disabled ? null : '0'}
        aria-labelledby="label"
        aria-describedby=${listbox._describedBy}
        aria-multiselectable=${listbox.multiple ? 'true' : null}
        aria-required=${listbox.required ? 'true' : null}
        aria-invalid=${listbox._userInvalid.value ? 'true' : null}
        aria-disabled=${disabled ? 'true' : null}
        aria-busy=${listbox.loading ? 'true' : null}
        ?hidden=${!options.length}
        @keydown=${listbox._onKeydown}
        @click=${listbox._onClick}
        @focus=${listbox._onFocus}
        @blur=${listbox._onListboxBlur}
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
      <div part="loading" class="state" ?hidden=${!listbox.loading}>
        ${spinner}${strings.loading}
      </div>
      <div part="empty" class="state" ?hidden=${options.length > 0 || listbox.loading}>
        <slot name="empty">${strings.empty}</slot>
      </div>
      <slot name="status"></slot>
    </div>
    <div part="error" id="error" class="error" ?hidden=${!listbox.error}>${listbox.error}</div>
    ${externalDescriptionTemplate(listbox._externalDescription)}
  </div>`;
};
