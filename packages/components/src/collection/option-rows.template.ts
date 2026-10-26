import { html, nothing, repeat } from '@oddkin/core/template';
import { checkGlyph } from '../styles/glyphs.js';
import { groupsOf, type OptionRecord, type OptionRow } from './collection.js';

/**
 * The option rows of a listbox (`odd-listbox`, `odd-combobox`, `odd-picker`; option-row module):
 * each `role="option"` row (`part="option"`) with its label, description, and the check of a
 * selected row, or with `indicator` the control indicator's decorative box at the start instead;
 * a group's rows in a `role="group"` named by its `part="group"` heading. `active` is the index of
 * the active row (`.active`). Rows are keyed by value, so the active option stays the same element
 * while the options change.
 */
export const optionListTemplate = (
  options: readonly OptionRecord[],
  selected: readonly string[],
  active: number,
  indicator = false,
) => {
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
            indicator
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
          >${indicator ? nothing : html`<span class="option-check">${checkGlyph}</span>`}
        </div>`;
      },
    );
  return html`${repeat(
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
  )}`;
};
