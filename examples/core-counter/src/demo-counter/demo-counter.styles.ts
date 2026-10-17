import { css } from '@mote/core';

export const demoCounterStyles = css`
  :host {
    display: inline-flex;
    font: inherit;
  }
  button {
    font: inherit;
    padding: 0.5rem 1rem;
    border: 2px solid currentColor;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 3px solid var(--demo-focus, #c2410c);
    outline-offset: 2px;
  }
  :host(:state(positive)) button {
    background: var(--demo-ink, #1e3a5f);
    color: var(--demo-paper, #fbf7ef);
  }
`;
