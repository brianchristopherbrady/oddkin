import { css } from '@oddkin/core';
import { token } from '@oddkin/tokens/refs';

const trailing = '0';

// Interpolated into panelStyles, as an extracted layout recipe is into an element's sheet.
export const panelLayoutStyles = css`
  @layer acme.layout {
    div {
      padding: ${token('layout.inset')};
      margin-block-end: ${trailing};
    }
  }
`;
