import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default badge look: a tone surface with an inset edge, `radius/sm`, and Status text. */
export const badgeStyles = css`
  .badge {
    gap: ${token('space.2xs')};
    padding-block: ${token('space.3xs')};
    padding-inline: ${token('space.xs')};
    border-radius: var(--odd-badge-radius, ${token('radius.sm')});
    background: var(--_tone-surface);
    box-shadow: inset 0 0 0 ${token('border.width.default')} var(--_tone-border);
    color: var(--_tone-foreground);
    font-family: ${token('font.family.sans')};
    font-size: ${token('font.size.xs')};
    font-weight: ${token('font.weight.medium')};
    line-height: ${token('line-height.normal')};
    letter-spacing: ${token('letter-spacing.normal')};
  }
  .marker > .glyph {
    font-size: ${token('icon.size.sm')};
  }
`;
