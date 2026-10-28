import { css } from '@oddkin/core';
import { token } from '@oddkin/tokens/refs';
import { panelLayoutStyles } from './panel.layout.styles.js';

export const panelStyles = css`
  ${panelLayoutStyles}
  :host {
    display: block;
    padding: ${token('layout.inset')};
    gap: var(--acme-panel-gap, 1rem);
    color: var(--odd-color-text-primary);
  }
`;
