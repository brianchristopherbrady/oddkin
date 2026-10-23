import { css } from '@oddkin/core/styles';

/**
 * Layout of the drawn checkbox box and its marks (component-contracts.md §2.9 "control
 * indicator"): `.indicator` stacks a `.indicator-box` (a native checkbox with `appearance: none`,
 * or a decorative `<span>` with `data-state="checked" | "mixed"`) and its `.indicator-check` and
 * `.indicator-mixed` glyphs in one cell; a mark shows only in its state. No brand tokens.
 */
export const controlIndicatorStructuralStyles = css`
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
  .indicator-box:is(:checked:not(:indeterminate), [data-state='checked']) ~ .indicator-check,
  .indicator-box:is(:indeterminate, [data-state='mixed']) ~ .indicator-mixed {
    visibility: visible;
  }
  /* One class more than the skin's state rules, so the system colours win in forced colours. */
  @media (forced-colors: active) {
    .indicator > .indicator-box {
      border: 1px solid CanvasText;
    }
    .indicator
      > .indicator-box:is(:checked, :indeterminate, [data-state='checked'], [data-state='mixed']) {
      border-color: Highlight;
      background: Highlight;
    }
    .indicator
      > .indicator-box:is(:checked, :indeterminate, [data-state='checked'], [data-state='mixed'])
      ~ .indicator-mark {
      color: HighlightText;
    }
    .indicator > .indicator-box:disabled {
      border-color: GrayText;
    }
  }
`;
