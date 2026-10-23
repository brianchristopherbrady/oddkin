import { css } from '@oddkin/core/styles';

/**
 * The select is a block; its field layout is the shared `fieldStructuralStyles`. Where
 * `appearance: base-select` and `::picker(select)` are supported, the select and its picker opt
 * into the customizable select: the engine's arrow gives way to the element's chevron and each
 * option's check moves to the row's end, as on the option rows. Rows size their borders in; a
 * placeholder stays out of the open picker; in forced colours the chosen option and disabled text
 * keep system colours, as on the option rows. No brand tokens.
 */
export const selectStructuralStyles = css`
  :host {
    display: block;
  }
  @supports (appearance: base-select) and selector(::picker(select)) {
    .control-box > select.control,
    .control::picker(select) {
      appearance: base-select;
    }
    .control option {
      box-sizing: border-box;
    }
    .control > .placeholder {
      display: none;
    }
    @supports selector(::picker-icon) {
      .control::picker-icon {
        display: none;
      }
    }
    @supports selector(::checkmark) {
      .control option::checkmark {
        order: 1;
        margin-inline-start: auto;
      }
    }
    @media (forced-colors: active) {
      :host .control option:checked {
        background: Highlight;
        color: HighlightText;
      }
      :host .control option:disabled {
        color: GrayText;
      }
    }
  }
`;
