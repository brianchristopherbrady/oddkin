import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default icon sizes: Figma `icon` (16, 20, 24 px from `icon.size.*`). */
export const iconStyles = css`
  :host {
    --_icon-size: var(--odd-icon-size, ${token('icon.size.md')});
  }
  :host([size='sm']) {
    --_icon-size: var(--odd-icon-size, ${token('icon.size.sm')});
  }
  :host([size='lg']) {
    --_icon-size: var(--odd-icon-size, ${token('icon.size.lg')});
  }
`;
