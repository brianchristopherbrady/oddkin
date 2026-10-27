import { css } from '@oddkin/core/styles';
import { comboboxRecipeStyles } from './combobox.recipe.styles.js';

/**
 * What the combobox depends on beyond the field layout, the option rows, the listbox rows, the
 * overlay surface, and the chip and clear-button looks it shares: the popup at least as wide as the
 * field, the field box laying out chips and input in rows, and, while collapsed, one line where
 * the chips that do not fit leave the flow (still measurable, never shown or read) for the "+N"
 * chip. No brand tokens.
 */
export const comboboxStructuralStyles = css`
  ${comboboxRecipeStyles}
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
  .value {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    flex: none;
  }
  .avatars {
    min-inline-size: 0;
    overflow: hidden;
  }
  .avatar {
    flex: none;
  }
  .box.two-rows {
    flex-wrap: wrap;
  }
  .box.two-rows .chips {
    display: contents;
  }
  .avatar.overflow,
  .box.two-rows .chip.overflow {
    position: absolute;
    visibility: hidden;
  }
  .review .chips,
  .selected-list.all {
    max-block-size: 10rem;
    overflow-y: auto;
  }
  .selected-toggle,
  .select-all,
  .view-more {
    box-sizing: border-box;
    inline-size: 100%;
    margin: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  .select-all:disabled {
    cursor: not-allowed;
  }
  .selected-option .option-label {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
`;
