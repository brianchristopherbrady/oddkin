import { css } from '@oddkin/core';

export const demoGreetingStyles = css`
  :host {
    display: block;
  }
  p {
    margin: 0;
    font-size: 1.5rem;
  }
  :host([excited]) p {
    font-style: italic;
  }
  small {
    display: block;
    opacity: 0.75;
  }
`;
