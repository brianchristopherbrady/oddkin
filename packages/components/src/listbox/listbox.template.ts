import { html } from '@oddkin/core/template';
import { optionListTemplate } from '../collection/option-rows.template.js';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { spinnerTemplate } from '../styles/spinner.styles.js';
import type { OddkinListbox } from './listbox.js';

/**
 * Anatomy: the field (`label`, `description`, and `error` parts) around `part="base"`, the surface
 * holding the `part="listbox"` focus target with its option rows (option-row module; a group's
 * options in a `role="group"` named by its `part="group"` heading), the `part="loading"` busy
 * row, the `part="empty"` state, and the `status` slot. Rows are keyed by value, so the active
 * option stays the same element when options change.
 */
export const listboxTemplate = (listbox: OddkinListbox) => {
  const options = listbox._options.value;
  const disabled = listbox.disabled || listbox._formDisabled.value;
  const strings = listbox._strings;
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
        ${optionListTemplate(options, listbox._selected.value, listbox._activeIndex.value)}
      </div>
      <div part="loading" class="state" ?hidden=${!listbox.loading}>
        ${spinnerTemplate}${strings.loading}
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
