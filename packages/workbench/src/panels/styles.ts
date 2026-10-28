/**
 * Styles for panel content (catalog, component and foundation details). Every rule is scoped to
 * `.wb-content`, so the same sheet works inside a panel's shadow root and in the shell's light DOM.
 * Values come from Oddkin tokens, inherited from the host document.
 */
import { css } from '@oddkin/core/styles';

export const panelHostStyles = css`
  :host {
    display: block;
    color: var(--odd-color-text-primary);
    font-family: var(--odd-font-family-sans);
    font-size: var(--odd-font-size-md);
    line-height: var(--odd-line-height-normal);
  }
`;

export const contentStyles = css`
  .wb-content {
    container: wb-content / inline-size;
    min-inline-size: 0;
  }
  .wb-content :focus-visible {
    outline: var(--odd-focus-width) solid var(--odd-color-focus-ring);
    outline-offset: var(--odd-focus-offset);
  }
  .wb-content a {
    color: var(--odd-color-link);
  }
  .wb-content code,
  .wb-content pre {
    font-family: var(--odd-font-family-mono);
    font-size: 0.9em;
  }
  .wb-content input,
  .wb-content select,
  .wb-content textarea,
  .wb-content button {
    font: inherit;
    color: inherit;
  }
  .wb-content input:not([type='checkbox']),
  .wb-content select,
  .wb-content textarea {
    max-inline-size: 100%;
    padding: var(--odd-space-2xs) var(--odd-space-xs);
    background: var(--odd-color-surface-default);
    border: var(--odd-border-width-default) solid var(--odd-color-border-strong);
    border-radius: var(--odd-radius-sm);
  }
  .wb-content button {
    padding: var(--odd-space-2xs) var(--odd-space-sm);
    background: var(--odd-color-surface-default);
    border: var(--odd-border-width-default) solid var(--odd-color-border-strong);
    border-radius: var(--odd-radius-sm);
    cursor: pointer;
  }
  .wb-content > section + section {
    margin-block-start: var(--odd-space-2xl);
  }
  .wb-content h2 {
    margin: 0 0 var(--odd-space-sm);
    font-size: var(--odd-font-size-xl);
    font-weight: var(--odd-font-weight-semibold);
  }
  .wb-content h3 {
    margin: var(--odd-space-lg) 0 var(--odd-space-xs);
    font-size: var(--odd-font-size-lg);
    font-weight: var(--odd-font-weight-semibold);
  }
  .wb-content .wb-muted,
  .wb-content .wb-meta {
    color: var(--odd-color-text-secondary);
  }
  .wb-content .wb-meta {
    font-size: var(--odd-font-size-sm);
  }
  .wb-content .wb-not-documented {
    color: var(--odd-color-text-secondary);
    font-style: italic;
  }
  /* Coverage markers (data-coverage) wrap an item without adding layout. */
  .wb-content [data-coverage] {
    display: contents;
  }
  .wb-content .wb-visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Tables: stacked rows on narrow containers. */
  .wb-content .wb-table-wrap {
    overflow-x: auto;
  }
  .wb-content table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--odd-font-size-sm);
  }
  .wb-content caption {
    padding-block-end: var(--odd-space-xs);
    color: var(--odd-color-text-secondary);
    text-align: start;
  }
  .wb-content th,
  .wb-content td {
    padding: var(--odd-space-xs);
    border-block-end: var(--odd-border-width-default) solid var(--odd-color-border-default);
    text-align: start;
    vertical-align: top;
  }
  .wb-content th {
    font-weight: var(--odd-font-weight-semibold);
  }
  .wb-content td small {
    display: block;
    color: var(--odd-color-text-secondary);
  }
  @container wb-content (width < 40rem) {
    .wb-content .wb-stack thead {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    .wb-content .wb-stack tr {
      display: grid;
      gap: var(--odd-space-2xs);
      padding-block: var(--odd-space-sm);
      border-block-end: var(--odd-border-width-default) solid var(--odd-color-border-default);
    }
    .wb-content .wb-stack td {
      display: grid;
      grid-template-columns: 7rem minmax(0, 1fr);
      gap: var(--odd-space-xs);
      padding: 0;
      border: 0;
    }
    .wb-content .wb-stack td::before {
      content: attr(data-label);
      color: var(--odd-color-text-secondary);
      font-weight: var(--odd-font-weight-semibold);
    }
  }

  /* Interactive example */
  .wb-content .wb-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--odd-space-sm) var(--odd-space-md);
    margin-block-end: var(--odd-space-sm);
  }
  .wb-content .wb-toolbar label {
    display: grid;
    gap: var(--odd-space-2xs);
    color: var(--odd-color-text-secondary);
    font-size: var(--odd-font-size-sm);
  }
  .wb-content .wb-previews {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--odd-space-md);
  }
  .wb-content .wb-previews.wb-pair {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  }
  .wb-content .wb-preview {
    min-inline-size: 0;
    border: var(--odd-border-width-default) solid var(--odd-color-border-default);
    border-radius: var(--odd-radius-md);
    background: var(--odd-color-surface-default);
  }
  .wb-content .wb-preview > p {
    margin: 0;
    padding: var(--odd-space-2xs) var(--odd-space-xs);
    color: var(--odd-color-text-secondary);
    font-size: var(--odd-font-size-xs);
  }
  .wb-content .wb-preview iframe {
    display: block;
    inline-size: 100%;
    block-size: 14rem;
    border: 0;
  }
  .wb-content .wb-status:empty {
    display: none;
  }
  .wb-content [role='alert'] {
    color: var(--odd-color-danger-foreground, var(--odd-color-text-primary));
  }
  .wb-content .wb-code {
    overflow-x: auto;
    margin: var(--odd-space-xs) 0 0;
    padding: var(--odd-space-sm);
    background: var(--odd-color-surface-sunken);
    border-radius: var(--odd-radius-sm);
    white-space: pre;
  }
  .wb-content .wb-log {
    max-block-size: 14rem;
    overflow: auto;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--odd-font-size-sm);
  }
  .wb-content .wb-log li {
    padding-block: var(--odd-space-2xs);
    border-block-end: var(--odd-border-width-default) solid var(--odd-color-border-default);
  }
  .wb-content .wb-cell-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--odd-space-2xs) var(--odd-space-xs);
  }
  .wb-content .wb-error {
    color: var(--odd-color-danger-foreground, var(--odd-color-text-primary));
  }

  /* Theme Studio */
  .wb-content fieldset.wb-group {
    border: var(--odd-border-width-default) solid var(--odd-color-border-default);
    border-radius: var(--odd-radius-sm);
    padding: var(--odd-space-md);
  }
  .wb-content .wb-field {
    display: grid;
    gap: var(--odd-space-2xs);
    margin-block: var(--odd-space-sm);
  }
  .wb-content .wb-json textarea {
    inline-size: 100%;
    box-sizing: border-box;
  }
  .wb-content .wb-swatch {
    display: inline-block;
    inline-size: 1.5rem;
    block-size: 1.5rem;
    border: var(--odd-border-width-default) solid var(--odd-color-border-strong);
    border-radius: var(--odd-radius-sm);
  }
  .wb-content .wb-list {
    margin: 0;
    padding-inline-start: var(--odd-space-lg);
  }
  .wb-content .wb-bar {
    display: block;
    block-size: 0.75rem;
    min-inline-size: 1px;
    max-inline-size: 100%;
    background: var(--odd-color-action-default);
    border-radius: var(--odd-radius-sm);
  }
  @media (forced-colors: active) {
    .wb-content .wb-bar {
      background: CanvasText;
    }
  }
`;
