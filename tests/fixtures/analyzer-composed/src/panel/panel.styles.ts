import { css } from '@oddkin/core';
import { token } from '@oddkin/tokens/refs';

export const panelStyles = css`
  :host {
    display: block;
    padding: ${token('layout.inset')};
    gap: var(--acme-panel-gap, 1rem);
    color: var(--odd-color-text-primary);
  }
`;
