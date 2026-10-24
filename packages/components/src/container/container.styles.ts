import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default container: Figma `Oddkin/Layout/Container`, constrained to `layout.measure`. */
export const containerStyles = css`
  :host(:not([measure='fluid'])) {
    max-inline-size: var(--odd-container-measure, ${token('layout.measure')});
    margin-inline: auto;
  }
`;
