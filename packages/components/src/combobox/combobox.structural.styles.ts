import { css } from '@oddkin/core/styles';

/**
 * What the combobox depends on beyond the field layout, the option rows, the listbox rows, the
 * overlay surface, and the chip and clear-button looks it shares: the popup at least as wide as the
 * field, the field box laying out chips and input in rows, and, while collapsed, one line where
 * the chips that do not fit leave the flow (still measurable, never shown or read) for the "+N"
 * chip. No brand tokens.
 */
export const comboboxStructuralStyles = css`
  :host {
    display: block;
  }
  /* Above the positioned box that shares its grid cell, so the clear button takes clicks. */
  .control-end {
    position: relative;
    align-items: center;
  }
  .chevron {
    display: inline-flex;
  }
  .popup {
    min-inline-size: var(--_anchor-inline-size, auto);
  }
  .popup .option:not([aria-disabled='true']) {
    cursor: pointer;
  }
  .box {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    cursor: text;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  .box.collapsed,
  .box.collapsed .chips {
    flex-wrap: nowrap;
    overflow: hidden;
  }
  .chip {
    flex: none;
    max-inline-size: 100%;
  }
  .chip-text {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .box.collapsed .chip.overflow,
  .chip.more.empty {
    position: absolute;
    visibility: hidden;
  }
  .combobox {
    flex: 1 1 4em;
    min-inline-size: 4em;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
  }
  .combobox:focus-visible {
    outline: none;
  }
`;
