import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default visual styles: semantic tokens through documented component variables. */
export const buttonStyles = css`
  button {
    min-block-size: max(
      var(--odd-button-height, ${token('control.height.md')}),
      ${token('target.min')}
    );
    padding-block: ${token('space.none')};
    padding-inline: var(--odd-button-padding-inline, ${token('control.padding.inline.md')});
    gap: ${token('control.gap')};
    border: ${token('border.width.default')} solid var(--odd-button-border-color, transparent);
    border-radius: var(--odd-button-radius, ${token('control.radius')});
    background: var(--odd-button-background, ${token('color.surface.raised')});
    color: var(--odd-button-color, ${token('color.text.primary')});
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
    transition-property: background-color, border-color, color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  :host([size='sm']) button {
    min-block-size: max(
      var(--odd-button-height, ${token('control.height.sm')}),
      ${token('target.min')}
    );
    padding-inline: var(--odd-button-padding-inline, ${token('control.padding.inline.sm')});
  }
  :host([size='lg']) button {
    min-block-size: max(
      var(--odd-button-height, ${token('control.height.lg')}),
      ${token('target.min')}
    );
    padding-inline: var(--odd-button-padding-inline, ${token('control.padding.inline.lg')});
    font-size: ${token('type.body.size')};
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
    background: var(--odd-button-background, ${token('color.action.pressed')});
  }
  :host([appearance='secondary']) button:active:enabled:not([aria-disabled='true']),
  :host([appearance='ghost']) button:active:enabled:not([aria-disabled='true']) {
    background: var(--odd-button-background, ${token('color.surface.sunken')});
  }
  :host([appearance='secondary']) button {
    border-color: var(--odd-button-border-color, ${token('color.border.strong')});
    background: var(--odd-button-background, ${token('color.surface.default')});
  }
  :host([appearance='ghost']) button {
    background: var(--odd-button-background, transparent);
  }
  /* :host matches the appearance rules' specificity. */
  :host button:disabled {
    border-color: transparent;
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.disabled')};
  }
`;
