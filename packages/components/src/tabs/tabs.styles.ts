import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default tabs: Figma `Tabs` (a bordered default surface with `card/radius`; the selected
 * tab in the selection colours with `control/radius`, the others in the secondary text colour; a
 * divider between the tabs and the panel).
 */
export const tabsStyles = css`
  .tabs {
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: var(--odd-tabs-radius, ${token('card.radius')});
    background: var(--odd-tabs-background, ${token('color.surface.default')});
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
  }
  .list {
    gap: ${token('space.xs')};
    padding: ${token('space.xs')};
  }
  .tab {
    min-block-size: ${token('control.height.sm')};
    padding: ${token('space.xs')} ${token('space.lg')};
    border-radius: ${token('control.radius')};
    color: ${token('color.text.secondary')};
  }
  .tab[aria-selected='true'] {
    background: ${token('color.selection.background')};
    color: ${token('color.selection.foreground')};
  }
  .tab:disabled {
    color: ${token('color.text.disabled')};
  }
  @media (hover: hover) {
    .tab:not(:disabled, [aria-selected='true']):hover {
      background: ${token('color.surface.hover')};
    }
  }
  .panels::before {
    block-size: ${token('border.width.default')};
    background: ${token('color.border.default')};
  }
  :host([orientation='vertical']) .panels::before {
    block-size: auto;
    inline-size: ${token('border.width.default')};
  }
  .panel {
    padding: ${token('space.md')};
  }
`;
