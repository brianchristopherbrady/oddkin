import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default toolbar: Figma `Toolbar` (a bordered default surface with `card/radius`, UI
 * text, separators in the border colour).
 */
export const toolbarStyles = css`
  .toolbar {
    gap: ${token('space.sm')};
    padding: ${token('space.md')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: var(--odd-toolbar-radius, ${token('card.radius')});
    background: var(--odd-toolbar-background, ${token('color.surface.default')});
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
  }
  ::slotted(hr) {
    inline-size: ${token('border.width.default')};
    background: ${token('color.border.default')};
  }
  :host([orientation='vertical']) ::slotted(hr) {
    inline-size: auto;
    block-size: ${token('border.width.default')};
  }
`;
