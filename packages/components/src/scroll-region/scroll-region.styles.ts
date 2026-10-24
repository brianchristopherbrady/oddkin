import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default scroll region: Figma `Oddkin/Layout/ScrollRegion` (children `layout.gap` apart). */
export const scrollRegionStyles = css`
  .content {
    gap: var(--odd-scroll-region-gap, ${token('layout.gap')});
  }
`;
