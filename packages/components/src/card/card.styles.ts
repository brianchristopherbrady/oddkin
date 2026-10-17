import { css } from '@mote/core/styles';
import { token } from '@mote/tokens/refs';

/** Mote's default visual styles for the card. */
export const cardStyles = css`
  .card {
    gap: var(--mote-card-gap, ${token('space.sm')});
    padding: var(--mote-card-padding, ${token('card.padding')});
    border: ${token('border.width.default')} solid
      var(--mote-card-border-color, ${token('color.border.default')});
    border-radius: var(--mote-card-radius, ${token('card.radius')});
    background: var(--mote-card-background, ${token('color.surface.default')});
    color: ${token('color.text.primary')};
    font-family: ${token('font.family.sans')};
  }
  :host([padding='none']) .card {
    padding: var(--mote-card-padding, 0);
  }
  :host([padding='sm']) .card {
    padding: var(--mote-card-padding, ${token('space.sm')});
  }
  :host([padding='lg']) .card {
    padding: var(--mote-card-padding, ${token('space.lg')});
  }
  :host([variant='filled']) .card {
    border-color: var(--mote-card-border-color, transparent);
    background: var(--mote-card-background, ${token('color.surface.sunken')});
  }
  :host([variant='elevated']) .card {
    border-color: var(--mote-card-border-color, transparent);
    background: var(--mote-card-background, ${token('color.surface.raised')});
    box-shadow: var(--mote-card-shadow, 0 1px 2px rgb(0 0 0 / 0.12), 0 4px 12px rgb(0 0 0 / 0.08));
  }
`;
