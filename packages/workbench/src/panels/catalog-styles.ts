/**
 * The components catalog's styles: its look, shared by the catalog panel's shadow root and the
 * shell's light DOM (where layout classes arrange the same markup), and its arrangement inside
 * the panel. Separate from the panels' content sheet, so only the catalog loads them.
 */
import { css } from '@oddkin/core/styles';

export const catalogStyles = css`
  .wb-catalog-filters p {
    margin: 0;
  }
  .wb-catalog-search label {
    font-size: var(--odd-font-size-sm);
    font-weight: var(--odd-font-weight-medium);
  }
  .wb-catalog-search small {
    color: var(--odd-color-text-secondary);
    font-size: var(--odd-font-size-xs);
    font-weight: var(--odd-font-weight-regular);
  }
  :is(.wb-catalog-search input, .wb-categories button) {
    min-block-size: 2.5rem;
    padding-inline: var(--odd-space-md);
    font: inherit;
    color: var(--odd-color-text-primary);
    background: var(--odd-color-surface-default);
    border: var(--odd-border-width-default) solid var(--odd-color-border-strong);
    border-radius: var(--odd-radius-sm);
  }
  .wb-categories button {
    font-weight: var(--odd-font-weight-medium);
    cursor: pointer;
  }
  .wb-catalog-search input {
    font-weight: var(--odd-font-weight-regular);
  }
  .wb-categories [aria-pressed='true'] {
    color: var(--odd-color-text-on-action);
    background: var(--odd-color-action-default);
    border-color: var(--odd-color-action-default);
  }
  .wb-count {
    padding: var(--odd-space-3xs) var(--odd-space-xs);
    color: var(--odd-color-neutral-foreground);
    background: var(--odd-color-neutral-surface);
    border: var(--odd-border-width-default) solid var(--odd-color-neutral-border);
    border-radius: var(--odd-radius-sm);
    font-size: var(--odd-font-size-xs);
  }
  .wb-card :is(h2, h3) {
    margin: 0;
    font-size: var(--odd-font-size-lg);
    font-weight: var(--odd-font-weight-semibold);
  }
  .wb-card p {
    margin: var(--odd-space-xs) 0 0;
    color: var(--odd-color-text-secondary);
  }
  .wb-card .wb-card-tag {
    margin: 0;
    padding-block-start: var(--odd-space-sm);
    border-block-start: var(--odd-border-width-default) solid var(--odd-color-border-default);
    color: var(--odd-color-text-primary);
    font-size: var(--odd-font-size-sm);
  }
  a.wb-card-action {
    display: block;
    margin-block-start: var(--odd-space-sm);
    padding: var(--odd-space-xs) var(--odd-space-md);
    color: var(--odd-color-text-primary);
    border: var(--odd-border-width-default) solid var(--odd-color-border-strong);
    border-radius: var(--odd-radius-sm);
    font-size: var(--odd-font-size-sm);
    font-weight: var(--odd-font-weight-medium);
    text-align: center;
    text-decoration: none;
  }
  a.wb-card-action:hover {
    background: var(--odd-color-surface-hover);
  }
`;

/** The arrangement in the panel's shadow root, which the page's layout.css cannot reach. */
export const catalogLayoutStyles = css`
  .wb-content .wb-catalog-filters {
    display: grid;
    gap: var(--odd-space-lg);
    margin-block-end: var(--odd-space-xl);
  }
  .wb-content :is(.wb-catalog-search, .wb-counts, .wb-categories) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--odd-space-sm);
  }
  .wb-content .wb-catalog-search label {
    display: grid;
    flex: 1 1 18rem;
    max-inline-size: 32rem;
    gap: var(--odd-space-2xs);
  }
  .wb-content .wb-group + .wb-group {
    margin-block-start: var(--odd-space-2xl);
  }
  .wb-content .wb-cards {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--odd-space-lg);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .wb-content .wb-card {
    block-size: 100%;
  }
  /* Live previews: only a host that loads the library supplies them, so only the panel has them. */
  .wb-content .wb-card.wb-has-preview::part(base) {
    overflow: hidden;
  }
  .wb-content .wb-card.wb-has-preview::part(header) {
    border-block-end: var(--odd-border-width-default) solid var(--odd-color-border-default);
  }
  .wb-content .wb-card.wb-has-preview::part(body) {
    padding: var(--odd-space-sm) var(--odd-space-lg) 0;
  }
  .wb-content .wb-card.wb-has-preview::part(footer) {
    padding: 0 var(--odd-space-lg) var(--odd-space-lg);
  }
  /* A fixed height, as in Figma 03: a preview built as its card scrolls in never moves the cards. */
  .wb-content .wb-card-preview {
    display: grid;
    place-items: center;
    block-size: 10rem;
    overflow: hidden;
    padding: var(--odd-space-md);
    background: var(--odd-color-surface-specimen);
  }
  @container wb-content (width >= 32rem) {
    .wb-content .wb-cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @container wb-content (width >= 52rem) {
    .wb-content .wb-cards {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
`;
