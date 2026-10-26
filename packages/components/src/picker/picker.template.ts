import { html, nothing, repeat } from '@oddkin/core/template';
import { chipsTemplate, fieldEndTemplate } from '../collection/option-field.template.js';
import { optionListTemplate } from '../collection/option-rows.template.js';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { chevronDownGlyph, chevronUpGlyph } from '../styles/glyphs.js';
import { spinnerTemplate } from '../styles/spinner.styles.js';
import { treeItemTemplate } from '../tree/tree.template.js';
import type { OddkinPicker } from './picker.js';

/**
 * Anatomy: odd-combobox's field (the `label`, `description`, and `error` parts, the field box
 * `part="control"` with the chips before the trigger, the clear button, and the chevron, up while
 * open), where the `role="combobox"` element is `part="trigger"`, a `div` that keeps focus and
 * shows the chosen value (with `multiple`, the chips show it and the trigger names the values in
 * hidden text) or the placeholder. The popup (`part="popup"`, a manual popover on the overlay
 * surface, as wide as the field and joined to it) holds the content (`.content`, which scrolls):
 * the `role="listbox"` of option rows (option-row module) or, with `items`, the `role="tree"` of
 * odd-tree's rows (navigation-row module), the busy row, the empty state, and the `status` slot;
 * then the footer (`part="footer"`): the summary (the hint or the count), Clear with `multiple`, and Close (Done
 * with `multiple`), drawn by the native button module.
 */
export const pickerTemplate = (picker: OddkinPicker) => {
  const tree = picker.items !== undefined;
  const multiple = picker.multiple;
  const selected = picker._selected.value;
  const active = picker._activeIndex.value;
  const open = picker._open.value;
  const disabled = picker.disabled || picker._formDisabled.value;
  const strings = picker._strings;
  const rows = picker._rows.value;
  const options = picker._options.value;
  const count = tree ? rows.length : options.length;
  const text = multiple ? '' : picker._valueText;
  const content = tree
    ? html`<div
        part="tree"
        id="content"
        class="tree"
        role="tree"
        aria-labelledby=${picker.label ? 'label' : null}
        aria-multiselectable=${multiple ? 'true' : null}
        aria-busy=${picker.loading ? 'true' : null}
        aria-disabled=${disabled ? 'true' : null}
        ?hidden=${!count}
      >
        ${repeat(
          rows,
          (row) => row.item.id,
          (row, index) => treeItemTemplate(row, multiple, index === active),
        )}
      </div>`
    : html`<div
        part="listbox"
        id="content"
        class="listbox"
        role="listbox"
        aria-labelledby=${picker.label ? 'label' : null}
        aria-multiselectable=${multiple ? 'true' : null}
        aria-busy=${picker.loading ? 'true' : null}
        aria-disabled=${disabled ? 'true' : null}
        ?hidden=${!count}
      >
        ${optionListTemplate(options, selected, active)}
      </div>`;
  return html`<div part="field" class="field">
      <span
        part="label"
        id="label"
        class="label"
        ?hidden=${!picker.label}
        @click=${picker._onLabelClick}
        >${picker.label}</span
      >
      <div part="description" id="description" class="description" ?hidden=${!picker.description}>
        ${picker.description}
      </div>
      <div
        class="control-box"
        @pointerdown=${picker._onBoxPointerdown}
        @click=${picker._onBoxClick}
      >
        <div part="control" class=${multiple ? 'control box collapsed' : 'control box'}>
          ${multiple && selected.length ? chipsTemplate(picker, false, disabled) : nothing}
          <div
            part="trigger"
            id="control"
            class="combobox"
            role="combobox"
            tabindex=${disabled ? null : '0'}
            aria-labelledby=${picker.label ? 'label' : null}
            aria-haspopup=${tree ? 'tree' : null}
            aria-expanded=${String(open)}
            aria-controls="content"
            aria-required=${picker.required ? 'true' : null}
            aria-describedby=${picker._describedBy}
            aria-invalid=${picker._userInvalid.value ? 'true' : null}
            aria-disabled=${disabled ? 'true' : null}
            @keydown=${picker._onKeydown}
          >
            ${
              text
                ? html`<span class="value">${text}</span>`
                : selected.length
                  ? html`<span class="visually-hidden"
                      >${selected.map((value) => picker._labelOf(value)).join(', ')}</span
                    >`
                  : html`<span class="placeholder">${picker.placeholder}</span>`
            }
          </div>
        </div>
        ${fieldEndTemplate(picker, open ? chevronUpGlyph : chevronDownGlyph)}
      </div>
      <div part="error" id="error" class="error" ?hidden=${!picker.error}>${picker.error}</div>
      ${externalDescriptionTemplate(picker._externalDescription)}
    </div>
    <div
      part="popup"
      id="popup"
      class="overlay-surface popup"
      @pointerdown=${picker._onPopupPointerdown}
      @click=${picker._onPopupClick}
    >
      <div class="content root">
        ${content}
        <div part="loading" class="state" ?hidden=${!picker.loading}>
          ${spinnerTemplate}${strings.loading}
        </div>
        <div part="empty" class="state" ?hidden=${count > 0 || picker.loading}>
          <slot name="empty">${strings.empty}</slot>
        </div>
        <slot name="status"></slot>
      </div>
      <div part="footer" class="footer">
        <span part="summary" class="summary">${picker._summary}</span>
        ${
          multiple
            ? html`<button
                part="clear-all"
                class="odd-button"
                type="button"
                data-appearance="ghost"
                data-size="sm"
                @click=${picker._onClearAll}
              >
                ${strings.clear}
              </button>`
            : nothing
        }
        <button
          part="close"
          class="odd-button"
          type="button"
          data-appearance=${multiple ? 'primary' : 'ghost'}
          data-size="sm"
          @click=${picker._onDone}
        >
          ${multiple ? strings.done : strings.close}
        </button>
      </div>
    </div>`;
};
