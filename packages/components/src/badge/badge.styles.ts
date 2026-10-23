import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default badge look: Figma `badge` (tone surface and text, `radius/sm`, Status text). */
export const badgeStyles = css`
  .badge {
    gap: ${token('space.2xs')};
    padding-block: ${token('space.3xs')};
    padding-inline: ${token('space.xs')};
    border-radius: var(--odd-badge-radius, ${token('radius.sm')});
    background: var(--_tone-surface);
    color: var(--_tone-foreground);
    font-family: ${token('font.family.sans')};
    font-size: ${token('font.size.xs')};
    font-weight: ${token('font.weight.medium')};
    line-height: ${token('line-height.normal')};
    letter-spacing: ${token('letter-spacing.normal')};
  }
  .marker {
    font-size: ${token('icon.size.sm')};
  }
`;
