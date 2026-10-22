/**
 * Shell styles (workbench-pages.md §3): light DOM, so every selector is scoped to
 * `oddkin-workbench`. Values come from Oddkin tokens; layout responds to container widths.
 */
import { css } from '@oddkin/core/styles';

export const shellStyles = css`
  body:has(> oddkin-workbench) {
    margin: 0;
  }
  oddkin-workbench {
    container: wb-shell / inline-size;
    display: block;
    min-block-size: 100vh;
    background: var(--odd-color-canvas);
    color: var(--odd-color-text-primary);
    font-family: var(--odd-font-family-sans);
    font-size: var(--odd-font-size-md);
    line-height: var(--odd-line-height-normal);
  }
  oddkin-workbench :focus-visible {
    outline: var(--odd-focus-width) solid var(--odd-color-focus-ring);
    outline-offset: var(--odd-focus-offset);
  }
  oddkin-workbench a {
    color: var(--odd-color-link);
  }
  oddkin-workbench code {
    font-family: var(--odd-font-family-mono);
    font-size: 0.9em;
  }
  oddkin-workbench .wb-visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  oddkin-workbench .wb-skip {
    position: absolute;
    inset-block-start: var(--odd-space-sm);
    inset-inline-start: var(--odd-space-sm);
    z-index: 2;
    padding: var(--odd-space-xs) var(--odd-space-sm);
    background: var(--odd-color-surface-raised);
    border: var(--odd-border-width-default) solid var(--odd-color-border-strong);
    border-radius: var(--odd-radius-sm);
  }
  oddkin-workbench .wb-skip:not(:focus) {
    clip-path: inset(50%);
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    padding: 0;
    border: 0;
  }

  /* Header */
  oddkin-workbench .wb-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--odd-space-sm) var(--odd-space-lg);
    padding: var(--odd-space-sm) var(--odd-space-xl);
    background: var(--odd-color-surface-default);
    border-block-end: var(--odd-border-width-default) solid var(--odd-color-border-default);
  }
  oddkin-workbench .wb-brand {
    display: inline-flex;
    align-items: center;
    gap: var(--odd-space-xs);
    color: inherit;
    font-weight: var(--odd-font-weight-semibold);
    text-decoration: none;
  }
  oddkin-workbench .wb-brand img {
    block-size: 1.5rem;
  }
  oddkin-workbench .wb-primary ul,
  oddkin-workbench .wb-sidebar ul,
  oddkin-workbench .wb-toc ul,
  oddkin-workbench .wb-cards,
  oddkin-workbench .wb-search-results {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  oddkin-workbench .wb-primary ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--odd-space-xs) var(--odd-space-lg);
  }
  oddkin-workbench .wb-primary a {
    display: inline-block;
    padding-block: var(--odd-space-2xs);
    color: var(--odd-color-text-secondary);
    text-decoration: none;
  }
  oddkin-workbench .wb-primary a[aria-current] {
    color: var(--odd-color-text-primary);
    box-shadow: inset 0 calc(-1 * var(--odd-border-width-strong)) 0 var(--odd-color-action-default);
  }
  oddkin-workbench .wb-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--odd-space-sm) var(--odd-space-md);
    margin-inline-start: auto;
  }
  oddkin-workbench .wb-tools label {
    display: inline-flex;
    align-items: center;
    gap: var(--odd-space-xs);
    color: var(--odd-color-text-secondary);
    font-size: var(--odd-font-size-sm);
  }
  oddkin-workbench input,
  oddkin-workbench select,
  oddkin-workbench button {
    font: inherit;
    color: inherit;
  }
  oddkin-workbench input[type='search'],
  oddkin-workbench select {
    padding: var(--odd-space-2xs) var(--odd-space-xs);
    background: var(--odd-color-surface-default);
    border: var(--odd-border-width-default) solid var(--odd-color-border-strong);
    border-radius: var(--odd-radius-sm);
  }

  /* Search */
  oddkin-workbench .wb-search {
    position: relative;
  }
  oddkin-workbench .wb-search-results {
    position: absolute;
    inset-inline-end: 0;
    inset-block-start: calc(100% + var(--odd-space-2xs));
    z-index: 3;
    inline-size: min(28rem, 90cqi);
    max-block-size: 70vh;
    overflow: auto;
    padding: var(--odd-space-xs);
    background: var(--odd-color-surface-raised);
    border: var(--odd-border-width-default) solid var(--odd-color-border-default);
    border-radius: var(--odd-radius-md);
    box-shadow: var(--odd-elevation-md);
  }
  oddkin-workbench .wb-search-results a {
    display: block;
    padding: var(--odd-space-2xs) var(--odd-space-xs);
    border-radius: var(--odd-radius-sm);
    color: inherit;
    text-decoration: none;
  }
  oddkin-workbench .wb-search-results a:hover {
    background: var(--odd-color-surface-hover);
  }
  oddkin-workbench .wb-search-results small {
    display: block;
    color: var(--odd-color-text-secondary);
  }

  /* Layout */
  oddkin-workbench .wb-banner {
    margin: 0;
    padding: var(--odd-space-xs) var(--odd-space-xl);
    background: var(--odd-color-warning-surface);
    color: var(--odd-color-warning-foreground);
  }
  oddkin-workbench .wb-layout {
    display: grid;
    grid-template-columns: minmax(11rem, 15rem) minmax(0, 1fr);
    gap: var(--odd-space-xl);
    max-inline-size: 88rem;
    margin-inline: auto;
    padding: var(--odd-space-xl);
  }
  oddkin-workbench .wb-layout.wb-no-sidebar {
    grid-template-columns: minmax(0, 1fr);
  }
  oddkin-workbench .wb-sidebar .wb-group-label {
    margin: var(--odd-space-md) 0 var(--odd-space-2xs);
    color: var(--odd-color-text-secondary);
    font-size: var(--odd-font-size-xs);
    font-weight: var(--odd-font-weight-semibold);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  oddkin-workbench .wb-sidebar a {
    display: block;
    padding: var(--odd-space-2xs) var(--odd-space-xs);
    border-radius: var(--odd-radius-sm);
    color: var(--odd-color-text-secondary);
    text-decoration: none;
  }
  oddkin-workbench .wb-sidebar a[aria-current] {
    background: var(--odd-color-surface-sunken);
    color: var(--odd-color-text-primary);
    font-weight: var(--odd-font-weight-medium);
  }
  oddkin-workbench .wb-sidebar-toggle {
    display: none;
    padding: var(--odd-space-2xs) var(--odd-space-sm);
    background: var(--odd-color-surface-default);
    border: var(--odd-border-width-default) solid var(--odd-color-border-strong);
    border-radius: var(--odd-radius-sm);
    cursor: pointer;
  }
  oddkin-workbench .wb-main {
    container: wb-main / inline-size;
    min-inline-size: 0;
  }
  oddkin-workbench .wb-main:focus {
    outline: none;
  }

  /* Page */
  oddkin-workbench .wb-page {
    display: grid;
    gap: var(--odd-space-lg) var(--odd-space-2xl);
    grid-template-areas: 'header' 'toc' 'body';
  }
  oddkin-workbench .wb-page-header {
    grid-area: header;
    max-inline-size: 48rem;
  }
  oddkin-workbench .wb-eyebrow {
    margin: 0 0 var(--odd-space-xs);
    color: var(--odd-color-text-secondary);
    font-size: var(--odd-font-size-xs);
    font-weight: var(--odd-font-weight-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  oddkin-workbench h1 {
    margin: 0;
    font-family: var(--odd-font-family-display);
    font-size: var(--odd-font-size-3xl);
    font-weight: var(--odd-font-weight-regular);
    line-height: var(--odd-line-height-tight);
  }
  oddkin-workbench .wb-summary {
    margin: var(--odd-space-sm) 0 0;
    color: var(--odd-color-text-secondary);
    font-size: var(--odd-font-size-lg);
  }
  oddkin-workbench .wb-back {
    display: inline-block;
    margin-block-start: var(--odd-space-md);
  }
  oddkin-workbench .wb-toc {
    grid-area: toc;
    font-size: var(--odd-font-size-sm);
  }
  oddkin-workbench .wb-toc h2 {
    margin: 0 0 var(--odd-space-xs);
    color: var(--odd-color-text-secondary);
    font-size: var(--odd-font-size-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  oddkin-workbench .wb-toc li + li {
    margin-block-start: var(--odd-space-2xs);
  }
  oddkin-workbench .wb-body {
    grid-area: body;
    min-inline-size: 0;
  }
  oddkin-workbench .wb-body > section + section {
    margin-block-start: var(--odd-space-2xl);
  }
  oddkin-workbench .wb-body h2 {
    margin: 0 0 var(--odd-space-sm);
    font-size: var(--odd-font-size-xl);
    font-weight: var(--odd-font-weight-semibold);
  }
  oddkin-workbench .wb-muted {
    color: var(--odd-color-text-secondary);
  }

  /* Overview cards: 3, 2, or 1 columns by the content's width. */
  oddkin-workbench .wb-group + .wb-group {
    margin-block-start: var(--odd-space-2xl);
  }
  oddkin-workbench .wb-cards {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--odd-space-md);
  }
  oddkin-workbench .wb-card {
    block-size: 100%;
  }
  oddkin-workbench .wb-catalog-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--odd-space-md);
    margin-block-end: var(--odd-space-lg);
  }
  oddkin-workbench .wb-catalog-filters label {
    display: grid;
    gap: var(--odd-space-2xs);
    color: var(--odd-color-text-secondary);
    font-size: var(--odd-font-size-sm);
  }
  oddkin-workbench .wb-catalog-filters input,
  oddkin-workbench .wb-catalog-filters select {
    min-inline-size: 12rem;
    padding: var(--odd-space-2xs) var(--odd-space-xs);
    background: var(--odd-color-surface-default);
    border: var(--odd-border-width-default) solid var(--odd-color-border-strong);
    border-radius: var(--odd-radius-sm);
  }
  oddkin-workbench .wb-catalog-filters p {
    margin: 0;
  }
  oddkin-workbench .wb-card h2,
  oddkin-workbench .wb-card h3 {
    margin: 0;
    font-size: var(--odd-font-size-lg);
    font-weight: var(--odd-font-weight-semibold);
  }
  oddkin-workbench .wb-card p {
    margin: var(--odd-space-xs) 0 0;
  }
  oddkin-workbench .wb-meta {
    color: var(--odd-color-text-secondary);
    font-size: var(--odd-font-size-sm);
  }
  @container wb-main (width >= 32rem) {
    oddkin-workbench .wb-cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @container wb-main (width >= 52rem) {
    oddkin-workbench .wb-cards {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    oddkin-workbench .wb-page.wb-has-toc {
      grid-template-columns: minmax(0, 1fr) 13rem;
      grid-template-areas: 'header toc' 'body toc';
      align-items: start;
    }
    oddkin-workbench .wb-has-toc .wb-toc {
      position: sticky;
      inset-block-start: var(--odd-space-lg);
    }
  }

  /* Narrow: one column; the sidebar is behind a disclosure button. */
  @container wb-shell (width < 48rem) {
    oddkin-workbench .wb-header {
      padding-inline: var(--odd-space-md);
    }
    oddkin-workbench .wb-tools {
      margin-inline-start: 0;
    }
    oddkin-workbench .wb-layout {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--odd-space-lg);
      padding: var(--odd-space-md);
    }
    oddkin-workbench .wb-sidebar-toggle {
      display: inline-flex;
    }
    oddkin-workbench .wb-sidebar:not(.wb-expanded) .wb-sidebar-list {
      display: none;
    }
  }

  @media (forced-colors: active) {
    oddkin-workbench .wb-primary a[aria-current],
    oddkin-workbench .wb-sidebar a[aria-current] {
      text-decoration: underline;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    oddkin-workbench * {
      scroll-behavior: auto;
    }
  }
`;
