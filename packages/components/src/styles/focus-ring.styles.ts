import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * The keyboard focus indicator: an outline from the focus tokens on whatever matches
 * `:focus-visible` inside the shadow root. Outlines take a system colour in forced-colours mode
 * and never change layout.
 */
export const focusRingStyles = css`
  :focus-visible {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
`;
