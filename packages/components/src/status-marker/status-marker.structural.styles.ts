import { css } from '@oddkin/core/styles';

/** A circle that centres its glyph or content; an empty idle marker shows a dot. No tokens. */
export const statusMarkerStructuralStyles = css`
  :host {
    display: inline-grid;
    flex: none;
    vertical-align: middle;
  }
  .base {
    display: grid;
    place-items: center;
    inline-size: var(--_size);
    block-size: var(--_size);
    border: var(--_border, 0) solid;
    border-radius: var(--_radius, 50%);
    box-sizing: border-box;
  }
  :host(:empty[status='idle']) .base::after {
    content: '';
    inline-size: 33%;
    block-size: 33%;
    border-radius: inherit;
    background: currentColor;
  }
`;
