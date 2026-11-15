import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default chip: Figma `chip` (sunken surface, `control/height/sm`, `control/radius`,
 * selection colours when selected, the focus ring around the chip). The remove button is a target
 * of the minimum size centred on its 16px glyph, taking only the glyph's room, as Figma draws it.
 */
export const chipStyles = css`
  .chip {
    box-sizing: border-box;
    gap: ${token('control.gap')};
    min-block-size: ${token('control.height.sm')};
    padding-inline: ${token('control.padding.inline.sm')};
    border: ${token('border.width.default')} solid transparent;
    border-radius: var(--odd-chip-radius, ${token('control.radius')});
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
  }
  .chip:has(.remove:focus-visible) {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
  .remove {
    inline-size: ${token('target.min')};
    block-size: ${token('target.min')};
    margin: calc((${token('icon.size.sm')} - ${token('target.min')}) / 2);
    border-radius: ${token('radius.sm')};
    font-size: ${token('icon.size.sm')};
  }
  :host([selected]) .chip {
    background: ${token('color.selection.background')};
    color: ${token('color.selection.foreground')};
  }
  :host([disabled]) .chip {
    color: ${token('color.text.disabled')};
  }
  @media (hover: hover) {
    :host(:not([disabled])) .remove:hover {
      background: ${token('color.surface.hover')};
    }
  }
`;
