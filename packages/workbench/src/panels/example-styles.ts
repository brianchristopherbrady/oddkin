/**
 * The component page's interactive example: the example card, its controls (segmented choices,
 * switches, grouped API rows), and the code. Separate from the panels' content sheet, so only
 * the component panel and the shell's component page load them.
 */
import { css } from '@oddkin/core/styles';

export const exampleStyles = css`
  .wb-content .wb-example {
    border: var(--odd-border-width-default) solid var(--odd-color-border-default);
    border-radius: var(--odd-radius-md);
    background: var(--odd-color-surface-default);
  }
  .wb-content .wb-example-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--odd-space-xs) var(--odd-space-sm);
    padding: var(--odd-space-sm) var(--odd-space-md);
    border-block-end: var(--odd-border-width-default) solid var(--odd-color-border-default);
  }
  .wb-content .wb-example-bar label {
    display: flex;
    align-items: center;
    gap: var(--odd-space-2xs);
    font-size: var(--odd-font-size-sm);
  }
  .wb-content .wb-example-bar select {
    max-inline-size: 14rem;
  }
  .wb-content .wb-example-title {
    margin: 0;
    margin-inline-end: auto;
    font-weight: var(--odd-font-weight-medium);
  }
  .wb-content .wb-quiet {
    border-color: transparent;
    background: transparent;
  }
  .wb-content .wb-share {
    display: block;
    padding: var(--odd-space-xs) var(--odd-space-md);
  }
  .wb-content .wb-example-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .wb-content .wb-example-stage {
    display: grid;
    align-content: start;
    gap: var(--odd-space-sm);
    min-inline-size: 0;
    padding: var(--odd-space-md);
    background: var(--odd-color-surface-specimen);
  }
  .wb-content .wb-example-controls {
    min-inline-size: 0;
    padding: var(--odd-space-md);
  }
  .wb-content .wb-example-controls h3 {
    margin-block-start: 0;
  }
  .wb-content .wb-example-code {
    padding: var(--odd-space-md);
    border-block-start: var(--odd-border-width-default) solid var(--odd-color-border-default);
  }
  .wb-content .wb-example-code[hidden] {
    display: none;
  }
  @container wb-content (width >= 56rem) {
    .wb-content .wb-example-body {
      grid-template-columns: minmax(16rem, 2fr) minmax(0, 3fr);
    }
    /* The controls scroll beside the preview, which stays in view. */
    .wb-content .wb-example-controls {
      max-block-size: 40rem;
      overflow: auto;
    }
  }
  .wb-content .wb-api th[scope='row'] small {
    display: block;
    font-weight: var(--odd-font-weight-regular);
  }
  .wb-content .wb-group-row th {
    background: var(--odd-color-surface-sunken);
  }
  .wb-content .wb-segmented {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--odd-space-2xs);
  }
  .wb-content .wb-segmented label {
    position: relative;
  }
  .wb-content .wb-segmented input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .wb-content .wb-segmented span {
    display: inline-block;
    padding: var(--odd-space-2xs) var(--odd-space-sm);
    border: var(--odd-border-width-default) solid var(--odd-color-border-strong);
    border-radius: var(--odd-radius-sm);
  }
  .wb-content .wb-segmented input:checked + span {
    border-color: var(--odd-color-action-default);
    box-shadow: inset 0 calc(-1 * var(--odd-focus-width)) 0 var(--odd-color-action-default);
    font-weight: var(--odd-font-weight-medium);
  }
  .wb-content .wb-segmented input:focus-visible + span {
    outline: var(--odd-focus-width) solid var(--odd-color-focus-ring);
    outline-offset: var(--odd-focus-offset);
  }
  .wb-content input.wb-switch {
    position: relative;
    inline-size: 2.25rem;
    block-size: 1.25rem;
    margin: 0;
    appearance: none;
    background: var(--odd-color-border-strong);
    border-radius: var(--odd-radius-full);
    cursor: pointer;
  }
  .wb-content input.wb-switch::before {
    content: '';
    position: absolute;
    inset-block-start: 0.125rem;
    inset-inline-start: 0.125rem;
    inline-size: 1rem;
    block-size: 1rem;
    background: var(--odd-color-surface-default);
    border-radius: var(--odd-radius-full);
  }
  .wb-content input.wb-switch:checked {
    background: var(--odd-color-action-default);
  }
  .wb-content input.wb-switch:checked::before {
    inset-inline-start: calc(100% - 1.125rem);
  }
  @media (forced-colors: active) {
    .wb-content input.wb-switch {
      appearance: auto;
    }
    .wb-content .wb-segmented input:checked + span {
      border-width: calc(2 * var(--odd-border-width-default));
    }
  }
`;
