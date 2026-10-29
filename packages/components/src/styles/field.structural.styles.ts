import { css } from '@oddkin/core/styles';

/**
 * Layout of the field anatomy every Oddkin form control renders (`.field` holding `.label`,
 * `.description`, `.control`, and `.error`): stacked, wrapping, the control filling the field.
 * Adornments are positioned, so they paint above a positioned control box (combobox).
 * No brand tokens. The `.odd-field` recipe is generated from these rules.
 */
export const fieldStructuralStyles = css`
  .field {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    /* Long labels, help, and errors wrap instead of widening the field. */
    overflow-wrap: anywhere;
  }
  .control {
    box-sizing: border-box;
    inline-size: 100%;
    margin: 0;
    font: inherit;
  }
  /* A control with an adornment (a select's chevron) shares one grid cell with it. */
  .control-box {
    display: grid;
    align-items: center;
  }
  .control-box > * {
    grid-area: 1 / 1;
  }
  .control-start,
  .control-end {
    display: flex;
    position: relative;
    pointer-events: none;
  }
  .control-start {
    justify-self: start;
  }
  .control-end {
    justify-self: end;
  }
  /* The chevron replaces the engine's arrow, so every engine draws the same select. */
  .control-box > select.control {
    appearance: none;
  }
  @media (forced-colors: active) {
    .control {
      border: 1px solid FieldText;
    }
    .control[aria-invalid='true'] {
      border-width: 2px;
    }
  }
`;
