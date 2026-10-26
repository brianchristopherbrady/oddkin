import { css } from '@oddkin/core/styles';

/**
 * What the picker depends on beyond odd-combobox's field, chips, and popup width, the option and
 * navigation rows, and the tree's indentation: a trigger that fills the field box and cuts its
 * value short on one line, the whole field box as the press target, and a popup as wide as the
 * field (`--_anchor-inline-size`) that stacks the scrolling content above the footer. The popup
 * does not clip, so its focus ring can surround the field above it. No visual tokens.
 */
export const pickerStructuralStyles = css`
  .box,
  .control-box {
    cursor: pointer;
  }
  /* As wide as the host: a long value is cut short rather than widening the field. */
  .box {
    min-inline-size: 0;
  }
  .combobox {
    display: flex;
    align-items: center;
    align-self: stretch;
    min-inline-size: 0;
  }
  .value,
  .placeholder {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .popup {
    inline-size: var(--_anchor-inline-size, auto);
    overflow: visible;
  }
  .popup:popover-open {
    display: flex;
    flex-direction: column;
  }
  .content {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-y: auto;
  }
  .footer {
    display: flex;
    flex: none;
    align-items: center;
  }
  .summary {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  .popup::before {
    position: absolute;
    pointer-events: none;
  }
`;
