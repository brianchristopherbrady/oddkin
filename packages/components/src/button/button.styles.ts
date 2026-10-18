import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default visual styles: semantic tokens through documented component variables. */
export const buttonStyles = css`
  button {
    min-block-size: max(
      var(--odd-button-height, ${token('control.height.md')}),
      ${token('target.min')}
    );
    padding-inline: var(--odd-button-padding-inline, ${token('control.padding.inline.md')});
    gap: ${token('control.gap')};
    border: ${token('border.width.default')} solid var(--odd-button-border-color, transparent);
    border-radius: var(--odd-button-radius, ${token('control.radius')});
    background: var(--odd-button-background, ${token('color.surface.raised')});
    color: var(--odd-button-color, ${token('color.text.primary')});
    font-family: ${token('font.family.sans')};
    font-size: ${token('font.size.md')};
    font-weight: ${token('font.weight.semibold')};
    line-height: 1.25;
  }
  :host([size='sm']) button {
    min-block-size: max(
      var(--odd-button-height, ${token('control.height.sm')}),
      ${token('target.min')}
    );
    padding-inline: var(--odd-button-padding-inline, ${token('control.padding.inline.sm')});
    font-size: ${token('font.size.sm')};
  }
  :host([size='lg']) button {
    min-block-size: max(
      var(--odd-button-height, ${token('control.height.lg')}),
      ${token('target.min')}
    );
    padding-inline: var(--odd-button-padding-inline, ${token('control.padding.inline.lg')});
    font-size: ${token('font.size.lg')};
  }
  :host([appearance='primary']) button {
    background: var(--odd-button-background, ${token('color.action.default')});
    color: var(--odd-button-color, ${token('color.text.on-action')});
  }
  /* Hover feedback only where the primary pointer can hover, so taps leave no sticky state. */
  @media (hover: hover) {
    :host([appearance='primary']) button:hover:enabled:not([aria-disabled='true']) {
      background: var(--odd-button-background, ${token('color.action.hover')});
    }
    :host([appearance='secondary']) button:hover:enabled:not([aria-disabled='true']),
    :host([appearance='ghost']) button:hover:enabled:not([aria-disabled='true']) {
      background: var(--odd-button-background, ${token('color.surface.hover')});
    }
  }
  :host([appearance='primary']) button:active:enabled:not([aria-disabled='true']) {
    background: var(--odd-button-background, ${token('color.action.active')});
  }
  :host([appearance='secondary']) button {
    border-color: var(--odd-button-border-color, ${token('color.border.strong')});
    background: var(--odd-button-background, ${token('color.surface.default')});
  }
  :host([appearance='ghost']) button {
    background: var(--odd-button-background, transparent);
  }
  button:disabled {
    border-color: transparent;
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.disabled')};
  }
`;
