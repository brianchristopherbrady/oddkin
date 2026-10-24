import { css } from '@oddkin/core/styles';

/**
 * Layout of the drawn checkbox box and its marks (component-contracts.md §2.9 "control
 * indicator"): `.indicator` stacks a `.indicator-box` (a native checkbox or radio with
 * `appearance: none`, or a decorative `<span>`) and its `.indicator-check` and `.indicator-mixed`
 * glyphs in one cell; a mark shows only in its state. `data-state="checked" | "mixed"` gives a
 * span its state and a native checkbox its mixed state: `:indeterminate` also matches every radio
 * of a group with none checked, so it is never used. A `.choice` label row
 * holds an indicator (or a switch track) beside its `.label`. No brand tokens.
 */
export const controlIndicatorStructuralStyles = css`
  .choice {
    display: inline-flex;
    align-items: center;
    max-inline-size: 100%;
    cursor: pointer;
  }
  .choice > .label {
    min-inline-size: 0;
  }
  .choice:has(:disabled) {
    cursor: not-allowed;
  }
  .indicator {
    display: inline-grid;
    flex: none;
    place-items: center;
  }
  .indicator > * {
    grid-area: 1 / 1;
  }
  .indicator-box {
    box-sizing: border-box;
    display: block;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    margin: 0;
    appearance: none;
    cursor: inherit;
  }
  .indicator-mark {
    pointer-events: none;
    visibility: hidden;
  }
  .indicator-box:is(:checked:not([data-state]), [data-state='checked']) ~ .indicator-check,
  .indicator-box[data-state='mixed'] ~ .indicator-mixed {
    visibility: visible;
  }
  /* One class more than the skin's state rules, so the system colours win in forced colours. */
  @media (forced-colors: active) {
    .indicator > .indicator-box {
      border: 1px solid CanvasText;
    }
    .indicator > .indicator-box:is(:checked, [data-state]) {
      border-color: Highlight;
      background: Highlight;
    }
    .indicator > .indicator-box:is(:checked, [data-state]) ~ .indicator-mark {
      color: HighlightText;
    }
    .indicator > .indicator-box:disabled {
      border-color: GrayText;
    }
  }
`;
