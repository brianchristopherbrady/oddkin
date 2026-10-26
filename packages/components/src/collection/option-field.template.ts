import { html, nothing, repeat, type TemplateResult } from '@oddkin/core/template';
import { closeGlyph } from '../styles/glyphs.js';
import type { OddkinOptionField } from './option-field.js';

/**
 * The chosen values of a multiple option field as chips (chip module; component-contracts.md
 * §3.3): a list named by `strings.selected` of `part="chip"` items, each with a
 * `part="chip-remove"` button unless `readonly`, and the `part="more"` count ("+N", read as
 * `strings.more`) that stands for the chips that do not fit while collapsed.
 */
export const chipsTemplate = (field: OddkinOptionField, readonly: boolean, disabled: boolean) => {
  const selected = field._selected.value;
  const collapsed = field._collapsed.value;
  const shown = collapsed ? field._shown.value : Number.POSITIVE_INFINITY;
  const hidden = Math.max(0, selected.length - shown);
  return html`<span class="chips" role="list" aria-label=${field._strings.selected}
    >${repeat(
      selected,
      (value) => value,
      (value, index) => {
        const label = field._labelOf(value);
        return html`<span
          role="listitem"
          part="chip"
          class=${index < shown ? 'chip' : 'chip overflow'}
          ><span class="chip-text">${label}</span>${
            readonly
              ? nothing
              : html`<button
                  part="chip-remove"
                  class="remove"
                  type="button"
                  tabindex="-1"
                  aria-label=${field._removeLabel(label)}
                  ?disabled=${disabled}
                  @click=${() => field._onChipRemove(value)}
                  @keydown=${(event: KeyboardEvent) => field._onChipKeydown(event, value)}
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
      ><span class="visually-hidden">${field._moreLabel(hidden)}</span></span
    ></span
  >`;
};

/**
 * The end of the field box: the clear button (`part="clear"`, shown while there is a value the
 * user may clear; out of the Tab order, as the keyboard clears otherwise) and an optional chevron.
 */
export const fieldEndTemplate = (field: OddkinOptionField, chevron?: TemplateResult) =>
  html`<span class="control-end">
    <button
      part="clear"
      class="clear"
      type="button"
      tabindex="-1"
      aria-label=${field._strings.clear}
      ?hidden=${!field._clearable}
      @click=${field._onClear}
    >
      ${closeGlyph}</button
    >${chevron ? html`<span class="chevron" aria-hidden="true">${chevron}</span>` : nothing}
  </span>`;
