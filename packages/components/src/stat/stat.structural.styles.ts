import { css } from '@oddkin/core/styles';

/** A column: label, value, context; the arrow points down for a decrease. No tokens. */
export const statStructuralStyles = css`
  :host {
    display: block;
  }
  .base {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  .value {
    overflow-wrap: anywhere;
  }
  .context {
    display: flex;
    align-items: center;
  }
  :host([trend='decrease']) .glyph {
    rotate: 180deg;
  }
  .placeholder {
    inline-size: 50%;
  }
`;
