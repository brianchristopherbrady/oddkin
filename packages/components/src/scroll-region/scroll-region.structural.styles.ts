import { css } from '@oddkin/core/styles';

/**
 * The element is a one-track grid, so a `block-size` or `max-block-size` on it bounds the
 * scroller, and as a flex or grid item it shrinks to the space left instead of its content's size.
 * Where supported, the scrollbar gutter is stable, so content does not shift when it starts to
 * scroll. No tokens.
 */
export const scrollRegionStructuralStyles = css`
  :host {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    min-inline-size: 0;
    min-block-size: 0;
  }
  .base {
    overflow: auto;
  }
  @supports (scrollbar-gutter: stable) {
    .base {
      scrollbar-gutter: stable;
    }
  }
  .content {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
`;
