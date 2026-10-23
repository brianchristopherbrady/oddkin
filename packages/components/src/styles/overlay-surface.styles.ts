import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * The overlay look (Figma `popover`, `tooltip`, `Menu`, `ListboxSurface`, and the open `select`,
 * `combobox`, and `multiselect`): the raised surface, the default border, `control.radius`, and
 * `elevation.md`. `.sheet` is the modal look of `dialog`, `alertDialog`, and `drawer`: the default
 * surface, `card.radius`, `elevation.xl`, and the scrim behind it. Spacing is the consumer's. The
 * close control is a secondary glyph button of the target size. Unless motion is reduced,
 * popovers and dialogs (with their backdrop) fade in (a keyframes animation, at the floor) and fade
 * out where `transition-behavior: allow-discrete` keeps them shown while closing; nothing waits
 * for either (F11).
 */
export const overlaySurfaceStyles = css`
  .overlay-surface,
  :host([popover]) {
    border-width: ${token('border.width.default')};
    border-color: ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.raised')};
    color: ${token('color.text.primary')};
    box-shadow: ${token('elevation.md')};
    font-family: ${token('type.body.family')};
    font-size: ${token('type.body.size')};
    line-height: ${token('type.body.line-height')};
  }
  .overlay-surface.sheet {
    border-radius: ${token('card.radius')};
    background: ${token('color.surface.default')};
    box-shadow: ${token('elevation.xl')};
  }
  .overlay-surface.sheet::backdrop {
    background: ${token('color.scrim')};
  }
  .overlay-close {
    min-inline-size: max(${token('control.height.sm')}, ${token('target.min')});
    min-block-size: max(${token('control.height.sm')}, ${token('target.min')});
    border-radius: ${token('control.radius')};
    color: ${token('color.text.secondary')};
    font-size: ${token('icon.size.md')};
  }
  @media (hover: hover) {
    .overlay-close:hover {
      background: ${token('color.surface.hover')};
      color: ${token('color.text.primary')};
    }
  }
  @keyframes odd-overlay-in {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    [popover].overlay-surface:popover-open,
    :host(:popover-open),
    dialog.overlay-surface[open],
    dialog.overlay-surface[open]::backdrop {
      animation: odd-overlay-in ${token('motion.duration.fast')} ${token('motion.easing.enter')};
    }
    @supports (transition-behavior: allow-discrete) {
      [popover].overlay-surface:not(:popover-open),
      :host([popover]:not(:popover-open)),
      dialog.overlay-surface:not([open]) {
        opacity: 0;
        transition:
          opacity ${token('motion.duration.fast')} ${token('motion.easing.exit')},
          display ${token('motion.duration.fast')} allow-discrete,
          overlay ${token('motion.duration.fast')} allow-discrete;
      }
      dialog.overlay-surface:not([open])::backdrop {
        opacity: 0;
        transition: opacity ${token('motion.duration.fast')} ${token('motion.easing.exit')};
      }
    }
  }
`;

/**
 * The anchored overlay look on the open picker of a native `<select>`, in its gated enhancement
 * (`appearance: base-select`; registry entry `customizable-select`). The declarations repeat the
 * anchored rule above rather than share a fragment: the analyzer reads each css template
 * statically, and an interpolated fragment would hide its tokens. Only odd-select uses it, so it is
 * imported relatively and not re-exported from `@oddkin/components/styles`.
 */
export const overlayPickerStyles = css`
  @supports (appearance: base-select) and selector(::picker(select)) {
    ::picker(select) {
      border-width: ${token('border.width.default')};
      border-color: ${token('color.border.default')};
      border-radius: ${token('control.radius')};
      background: ${token('color.surface.raised')};
      color: ${token('color.text.primary')};
      box-shadow: ${token('elevation.md')};
      font-family: ${token('type.body.family')};
      font-size: ${token('type.body.size')};
      line-height: ${token('type.body.line-height')};
    }
  }
`;
