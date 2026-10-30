/**
 * The catalog panel's arrangement in its shadow root, which the page's layout.css cannot reach.
 * A module of its own, so Workbench's shell, which arranges the same markup with layout classes,
 * does not carry it.
 */
import { css } from '@oddkin/core/styles';

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
  .wb-content .wb-card-preview {
    display: grid;
    place-items: center;
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
