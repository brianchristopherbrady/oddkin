import { css } from '@oddkin/core/styles';

/**
 * Option rows (component-catalog.md §6 "option-row"), shared by listbox, select's enhanced picker,
 * combobox, menu, split button, and command palette rows. Anatomy inside a row (`.option`, the
 * element with `role="option"` or `role="menuitem"`): `.option-start` (icon or indicator),
 * `.option-label` with an optional `.option-description` under it, `.option-end` (shortcut or
 * submenu glyph), and `.option-check` (the selected mark, shown with `aria-selected` or
 * `aria-checked`). States: `aria-selected`/`aria-checked`, `.active` (the active descendant),
 * `:focus-visible` (roving focus), `aria-disabled`, and `.danger`. Token-free; the look is
 * `optionRowStyles`.
 */
export const optionRowStructuralStyles = css`
  .option {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    inline-size: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
  }
  .option-start,
  .option-end,
  .option-check {
    display: inline-flex;
    flex: none;
    align-items: center;
  }
  .option-label {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .option-check {
    visibility: hidden;
  }
  .option[aria-selected='true'] .option-check,
  .option[aria-checked='true'] .option-check {
    visibility: visible;
  }
  .option[aria-disabled='true'] {
    cursor: not-allowed;
  }
  /* Prefixed with :host to outrank the skin's state rules, which load later. The focus ring's
     colour is forced to a system colour already. */
  @media (forced-colors: active) {
    :host .option[aria-selected='true'],
    :host .option[aria-checked='true'] {
      background: Highlight;
      color: HighlightText;
    }
    :host .option[aria-disabled='true'] {
      color: GrayText;
    }
  }
`;
