/**
 * The component page (Figma 20:2190): the section links, the interactive example with its
 * controls, and the card sections. Separate from the panels' content sheet, so only the
 * component panel and the shell's component page load them.
 */
import { css } from '@oddkin/core/styles';

export const exampleStyles = css`
  .wb-content > section {
    scroll-margin-block-start: var(--oddkin-panel-scroll-margin, 7.5rem);
  }
  .wb-content > section > h2:focus {
    outline: none;
  }
  .wb-content > #interactive-example > h2 {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .wb-content .wb-lede {
    margin: 0 0 var(--odd-space-lg);
    color: var(--odd-color-text-secondary);
  }
  .wb-content .wb-page-nav {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 6rem), 1fr));
    gap: var(--odd-space-xs) var(--odd-space-lg);
    margin-block-end: var(--odd-space-2xl);
  }
  .wb-content .wb-page-nav a {
    padding-block-end: var(--odd-space-xs);
    border-block-end: var(--odd-border-width-default) solid transparent;
    color: var(--odd-color-text-secondary);
    text-decoration: none;
  }
  .wb-content .wb-page-nav a[aria-current] {
    border-color: var(--odd-color-action-default);
    color: var(--odd-color-link);
  }

  /* The interactive example (Figma 33:6755). */
  .wb-content .wb-example {
    overflow: hidden;
    border: var(--odd-border-width-default) solid var(--odd-color-border-default);
    border-radius: var(--odd-radius-lg);
    background: var(--odd-color-surface-default);
  }
  .wb-content .wb-example-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--odd-space-xs);
    padding: var(--odd-space-sm);
  }
  .wb-content .wb-example-bar label {
    display: flex;
    align-items: center;
    gap: var(--odd-space-2xs);
    font-size: var(--odd-font-size-sm);
  }
  .wb-content .wb-example-bar select {
    max-inline-size: 11rem;
  }
  .wb-content .wb-example-title {
    margin: 0;
    margin-inline-end: auto;
  }
  .wb-content .wb-example-bar button {
    min-block-size: 2.5rem;
    padding-inline: var(--odd-space-md);
    border-radius: var(--odd-radius-md);
  }
  .wb-content .wb-quiet {
    border-color: transparent;
    background: transparent;
  }
  .wb-content .wb-share {
    display: block;
    padding: 0 var(--odd-space-sm) var(--odd-space-sm);
  }
  .wb-content .wb-example-stage {
    display: grid;
    min-inline-size: 0;
    padding-block-end: var(--odd-space-md);
    background: var(--odd-color-surface-specimen);
  }
  .wb-content .wb-example-stage .wb-preview {
    border: 0;
    border-radius: 0;
    background: none;
  }
  .wb-content .wb-example-caption {
    margin: 0;
    font-size: var(--odd-font-size-sm);
    text-align: center;
  }
  .wb-content .wb-example-stage .wb-status {
    margin: var(--odd-space-xs) var(--odd-space-md) 0;
  }
  .wb-content .wb-example-settings {
    padding: var(--odd-space-sm) var(--odd-space-md) 0;
    border-block-end: var(--odd-border-width-default) solid var(--odd-color-border-default);
  }
  .wb-content .wb-controls-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--odd-space-2xs) var(--odd-space-sm);
    padding: var(--odd-space-sm);
  }
  .wb-content .wb-controls-head > * {
    margin: 0;
  }
  .wb-content .wb-controls-head p {
    font-size: var(--odd-font-size-sm);
  }
  /* One region scrolls the groups under their sticky header rows; the preview stays in view. */
  .wb-content .wb-controls-scroll {
    max-block-size: 34.5rem;
    overflow: auto;
    background:
      linear-gradient(var(--odd-color-surface-default) 30%, transparent) top / 100% 2rem,
      linear-gradient(transparent, var(--odd-color-surface-default) 70%) bottom / 100% 2rem,
      radial-gradient(
          farthest-side at 50% 100%,
          color-mix(in srgb, var(--odd-color-text-primary) 14%, transparent),
          transparent
        )
        bottom / 100% 0.75rem;
    background-repeat: no-repeat;
    background-attachment: local, local, scroll;
  }
  .wb-content .wb-controls-scroll:focus-visible {
    outline: var(--odd-focus-width) solid var(--odd-color-focus-ring);
    outline-offset: calc(-1 * var(--odd-focus-width));
  }
  .wb-content .wb-controls-scroll .wb-table-wrap {
    overflow: visible;
  }
  .wb-content .wb-controls-scroll > [data-coverage] > p {
    margin: 0;
    padding: var(--odd-space-sm);
  }
  .wb-content .wb-api {
    table-layout: fixed;
    overflow-wrap: anywhere;
  }
  .wb-content .wb-api th,
  .wb-content .wb-api td {
    padding: var(--odd-space-sm);
    vertical-align: middle;
  }
  .wb-content .wb-api thead th {
    position: sticky;
    inset-block-start: 0;
    z-index: 1;
    padding-block: var(--odd-space-xs);
    background: var(--odd-color-surface-sunken);
  }
  .wb-content .wb-api th[scope='row'] {
    font-weight: var(--odd-font-weight-regular);
  }
  .wb-content .wb-api th[scope='row'] small {
    display: block;
    color: var(--odd-color-text-secondary);
  }
  .wb-content .wb-api col:nth-child(1) {
    inline-size: 19%;
  }
  .wb-content .wb-api col:nth-child(2) {
    inline-size: 19%;
  }
  .wb-content .wb-api col:nth-child(3) {
    inline-size: 10%;
  }
  .wb-content .wb-api col:nth-child(4) {
    inline-size: 12%;
  }
  .wb-content .wb-api col:nth-child(5) {
    inline-size: 10%;
  }
  .wb-content .wb-api select,
  .wb-content .wb-api input:is([type='text'], [type='number']) {
    inline-size: 100%;
    max-inline-size: 20rem;
    min-block-size: 2.5rem;
    padding-inline: var(--odd-space-sm);
    border-color: var(--odd-color-border-default);
    border-radius: var(--odd-radius-md);
  }
  .wb-content .wb-api select {
    max-inline-size: 13.75rem;
  }
  .wb-content .wb-example-code {
    padding: var(--odd-space-md);
    border-block-start: var(--odd-border-width-default) solid var(--odd-color-border-default);
  }
  .wb-content .wb-example-code[hidden] {
    display: none;
  }
  .wb-content .wb-code-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--odd-space-xs);
  }
  .wb-content input.wb-switch {
    position: relative;
    inline-size: 2.5rem;
    block-size: 1.5rem;
    margin: 0;
    appearance: none;
    background: var(--odd-color-border-strong);
    border-radius: var(--odd-radius-full);
    cursor: pointer;
  }
  .wb-content input.wb-switch::before {
    content: '';
    position: absolute;
    inset-block-start: 0.25rem;
    inset-inline-start: 0.25rem;
    inline-size: 1rem;
    block-size: 1rem;
    background: var(--odd-color-surface-default);
    border-radius: var(--odd-radius-full);
  }
  .wb-content input.wb-switch:checked {
    background: var(--odd-color-action-default);
  }
  .wb-content input.wb-switch:checked::before {
    inset-inline-start: calc(100% - 1.25rem);
  }
  @media (forced-colors: active) {
    .wb-content input.wb-switch {
      appearance: auto;
    }
  }

  /* Card sections (Figma 232:9845, 20:2266, 232:9895, 20:2292, 232:9918). */
  .wb-content .wb-boxes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
    gap: var(--odd-space-lg);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .wb-content .wb-box,
  .wb-content .wb-fact,
  .wb-content .wb-callout {
    display: grid;
    align-content: start;
    gap: var(--odd-space-md);
    min-inline-size: 0;
    padding: var(--odd-space-lg);
    border: var(--odd-border-width-default) solid var(--odd-color-border-default);
    border-radius: var(--odd-radius-lg);
    background: var(--odd-color-surface-default);
    overflow-wrap: anywhere;
  }
  .wb-content .wb-box h3 {
    margin: 0;
    font-size: var(--odd-font-size-md);
    font-weight: var(--odd-font-weight-medium);
  }
  .wb-content .wb-boxes + .wb-box {
    margin-block-start: var(--odd-space-lg);
  }
  .wb-content .wb-box ul,
  .wb-content .wb-callout ul {
    margin: 0;
    color: var(--odd-color-text-secondary);
  }
  .wb-content .wb-plain {
    display: grid;
    gap: var(--odd-space-2xs);
    padding: 0;
    list-style: none;
  }
  .wb-content .wb-names {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  }
  .wb-content .wb-sunken,
  .wb-content .wb-callout {
    background: var(--odd-color-surface-sunken);
  }
  .wb-content .wb-examples .wb-box {
    gap: 0;
    padding: 0;
    overflow: hidden;
  }
  .wb-content .wb-specimen {
    display: grid;
    place-items: center;
    min-block-size: 6rem;
    padding: var(--odd-space-sm);
    background: var(--odd-color-surface-sunken);
  }
  .wb-content .wb-box-body {
    display: grid;
    gap: var(--odd-space-sm);
    padding: var(--odd-space-md);
  }
  .wb-content .wb-box-body p {
    margin: 0;
    color: var(--odd-color-text-secondary);
  }
  .wb-content .wb-more {
    margin-block-start: var(--odd-space-md);
  }
  .wb-content > #source {
    padding: var(--odd-space-lg);
    border-radius: var(--odd-radius-lg);
    background: var(--odd-color-surface-sunken);
  }
  .wb-content .wb-facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
    gap: var(--odd-space-lg);
    margin-block-end: var(--odd-space-md);
  }
  .wb-content .wb-fact {
    gap: var(--odd-space-sm);
    padding: var(--odd-space-md);
  }
  .wb-content .wb-register {
    grid-template-columns: 6.25rem minmax(0, 1fr);
    align-items: baseline;
  }
  .wb-content .wb-fact-label {
    color: var(--odd-color-link);
    font-family: var(--odd-type-eyebrow-family);
    font-size: var(--odd-type-eyebrow-size);
    font-weight: var(--odd-type-eyebrow-weight);
    letter-spacing: var(--odd-type-eyebrow-letter-spacing);
    line-height: var(--odd-type-eyebrow-line-height);
    text-transform: uppercase;
  }
`;
