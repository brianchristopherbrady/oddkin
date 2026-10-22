import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * The native-`<button>` styling path: `<button class="odd-button">` looks like `odd-button`, for
 * forms that need native submit-button semantics (the button is the submitter and can be the
 * default button for Enter). `data-appearance` (`primary`, `secondary`, `ghost`; default
 * secondary), `data-size` (`sm`, `md`, `lg`; default md), and `data-full-width` mirror the
 * element's attributes; the same `--odd-button-*` variables apply. Published as
 * `@oddkin/components/css/button.css` in the `odd.components` layer; kept equal to the element's
 * computed styles by `styling.browser.test.ts`. No loading state: use `aria-disabled` and your
 * own progress text.
 */
export const nativeButtonStyles = css`
  .odd-button {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    min-block-size: max(
      var(--odd-button-height, ${token('control.height.md')}),
      ${token('target.min')}
    );
    margin: 0;
    padding-block: ${token('space.none')};
    padding-inline: var(--odd-button-padding-inline, ${token('control.padding.inline.md')});
    gap: ${token('control.gap')};
    border: ${token('border.width.default')} solid
      var(--odd-button-border-color, ${token('color.border.strong')});
    border-radius: var(--odd-button-radius, ${token('control.radius')});
    background: var(--odd-button-background, ${token('color.surface.default')});
    color: var(--odd-button-color, ${token('color.text.primary')});
    font: inherit;
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
    text-align: center;
    overflow-wrap: anywhere;
    cursor: pointer;
    transition-property: background-color, border-color, color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  .odd-button[data-size='sm'] {
    min-block-size: max(
      var(--odd-button-height, ${token('control.height.sm')}),
      ${token('target.min')}
    );
    padding-inline: var(--odd-button-padding-inline, ${token('control.padding.inline.sm')});
  }
  .odd-button[data-size='lg'] {
    min-block-size: max(
      var(--odd-button-height, ${token('control.height.lg')}),
      ${token('target.min')}
    );
    padding-inline: var(--odd-button-padding-inline, ${token('control.padding.inline.lg')});
    font-size: ${token('type.body.size')};
  }
  .odd-button[data-full-width] {
    inline-size: 100%;
  }
  .odd-button[data-appearance='primary'] {
    border-color: var(--odd-button-border-color, transparent);
    background: var(--odd-button-background, ${token('color.action.default')});
    color: var(--odd-button-color, ${token('color.text.on-action')});
  }
  .odd-button[data-appearance='ghost'] {
    border-color: var(--odd-button-border-color, transparent);
    background: var(--odd-button-background, transparent);
  }
  @media (hover: hover) {
    .odd-button[data-appearance='primary']:hover:enabled:not([aria-disabled='true']) {
      background: var(--odd-button-background, ${token('color.action.hover')});
    }
    .odd-button:not([data-appearance='primary']):hover:enabled:not([aria-disabled='true']) {
      background: var(--odd-button-background, ${token('color.surface.hover')});
    }
  }
  .odd-button[data-appearance='primary']:active:enabled:not([aria-disabled='true']) {
    background: var(--odd-button-background, ${token('color.action.pressed')});
  }
  .odd-button:not([data-appearance='primary']):active:enabled:not([aria-disabled='true']) {
    background: var(--odd-button-background, ${token('color.surface.sunken')});
  }
  .odd-button:disabled {
    border-color: transparent;
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.disabled')};
  }
  .odd-button:disabled,
  .odd-button[aria-disabled='true'] {
    cursor: not-allowed;
  }
  .odd-button:focus-visible {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
  @media (forced-colors: active) {
    .odd-button {
      border: 1px solid ButtonText;
    }
    .odd-button:disabled {
      color: GrayText;
      border-color: GrayText;
    }
  }
`;
