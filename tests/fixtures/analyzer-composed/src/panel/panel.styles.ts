import { css } from '@mote/core';
import { token } from '@mote/tokens/refs';

export const panelStyles = css`
  :host {
    display: block;
    padding: ${token('layout.inset')};
    gap: var(--acme-panel-gap, 1rem);
    color: var(--mote-color-text-primary);
  }
`;
