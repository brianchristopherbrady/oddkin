import { css } from '@mote/core/styles';
import { token } from '@mote/tokens/refs';

/** Mote's default visual styles: semantic tokens through documented component variables. */
export const buttonStyles = css`
  button {
    min-block-size: max(
      var(--mote-button-height, ${token('control.height.md')}),
      ${token('target.min')}
    );
    padding-inline: var(--mote-button-padding-inline, ${token('control.padding.inline.md')});
    gap: ${token('control.gap')};
    border: ${token('border.width.default')} solid var(--mote-button-border-color, transparent);
    border-radius: var(--mote-button-radius, ${token('control.radius')});
    background: var(--mote-button-background, ${token('color.surface.raised')});
    color: var(--mote-button-color, ${token('color.text.primary')});
    font-family: ${token('font.family.sans')};
    font-size: ${token('font.size.md')};
    font-weight: ${token('font.weight.semibold')};
    line-height: 1.25;
  }
  :host([size='sm']) button {
    min-block-size: max(
      var(--mote-button-height, ${token('control.height.sm')}),
      ${token('target.min')}
    );
    padding-inline: var(--mote-button-padding-inline, ${token('control.padding.inline.sm')});
    font-size: ${token('font.size.sm')};
  }
  :host([size='lg']) button {
    min-block-size: max(
      var(--mote-button-height, ${token('control.height.lg')}),
      ${token('target.min')}
    );
    padding-inline: var(--mote-button-padding-inline, ${token('control.padding.inline.lg')});
    font-size: ${token('font.size.lg')};
  }
  :host([appearance='primary']) button {
    background: var(--mote-button-background, ${token('color.action.default')});
    color: var(--mote-button-color, ${token('color.text.on-action')});
  }
  :host([appearance='primary']) button:hover:enabled:not([aria-disabled='true']) {
    background: var(--mote-button-background, ${token('color.action.hover')});
  }
  :host([appearance='primary']) button:active:enabled:not([aria-disabled='true']) {
    background: var(--mote-button-background, ${token('color.action.active')});
  }
  :host([appearance='secondary']) button {
    border-color: var(--mote-button-border-color, ${token('color.border.strong')});
    background: var(--mote-button-background, ${token('color.surface.default')});
  }
  :host([appearance='secondary']) button:hover:enabled:not([aria-disabled='true']),
  :host([appearance='ghost']) button:hover:enabled:not([aria-disabled='true']) {
    background: var(--mote-button-background, ${token('color.surface.hover')});
  }
  :host([appearance='ghost']) button {
    background: var(--mote-button-background, transparent);
  }
  button:focus-visible {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
  button:disabled {
    border-color: transparent;
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.disabled')};
  }
`;
