import { css } from '@oddkin/core';
import { token } from '@oddkin/tokens/refs';

// Every value comes from the theme, so the theme config restyles the element.
export const tallyStyles = css`
  :host {
    display: inline-flex;
  }
  button {
    min-block-size: ${token('control.height.md')};
    padding-inline: ${token('space.md')};
    border: 0;
    border-radius: ${token('radius.full')};
    background: ${token('color.action.default')};
    color: ${token('color.text.on-action')};
    font: inherit;
    font-weight: ${token('font.weight.semibold')};
    cursor: pointer;
  }
  button:hover {
    background: ${token('color.action.hover')};
  }
  button:focus-visible {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
`;
