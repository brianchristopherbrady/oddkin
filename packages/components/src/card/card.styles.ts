import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default visual styles for the card. */
export const cardStyles = css`
  .card {
    gap: var(--odd-card-gap, ${token('space.sm')});
    padding: var(--odd-card-padding, ${token('card.padding')});
    border: ${token('border.width.default')} solid
      var(--odd-card-border-color, ${token('color.border.default')});
    border-radius: var(--odd-card-radius, ${token('card.radius')});
    background: var(--odd-card-background, ${token('color.surface.default')});
    color: ${token('color.text.primary')};
    font-family: ${token('font.family.sans')};
  }
  :host([padding='none']) .card {
    padding: var(--odd-card-padding, 0);
  }
  :host([padding='sm']) .card {
    padding: var(--odd-card-padding, ${token('space.sm')});
  }
  :host([padding='lg']) .card {
    padding: var(--odd-card-padding, ${token('space.lg')});
  }
  :host([variant='filled']) .card {
    border-color: var(--odd-card-border-color, transparent);
    background: var(--odd-card-background, ${token('color.surface.sunken')});
  }
  :host([variant='elevated']) .card {
    border-color: var(--odd-card-border-color, transparent);
    background: var(--odd-card-background, ${token('color.surface.raised')});
    box-shadow: var(--odd-card-shadow, ${token('elevation.md')});
  }
`;
