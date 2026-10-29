import { css } from '@oddkin/core';
import { token } from '@oddkin/tokens/refs';

export const greetingStyles = css`
  :host {
    display: block;
  }
  p {
    margin: 0;
    color: ${token('color.text.primary')};
    font-size: ${token('font.size.2xl')};
    font-weight: ${token('font.weight.semibold')};
  }
  strong {
    color: ${token('color.action.default')};
  }
`;
