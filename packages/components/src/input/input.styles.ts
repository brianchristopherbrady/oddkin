import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default input look beyond the shared control module: the search field's clear button,
 * a round target of the minimum size around its 1em glyph, in secondary text.
 */
export const inputStyles = css`
  .clear {
    inline-size: ${token('target.min')};
    block-size: ${token('target.min')};
    margin: calc((1em - ${token('target.min')}) / 2);
    border-radius: ${token('radius.full')};
    color: ${token('color.text.secondary')};
  }
  @media (hover: hover) {
    .clear:hover {
      background: ${token('color.surface.hover')};
      color: ${token('color.text.primary')};
    }
  }
`;
