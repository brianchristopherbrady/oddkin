import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default split panel: Figma `Splitter/vertical` and `Splitter/horizontal` (a sunken handle
 * with `radius/xs` and a secondary grip; the hover surface; the selection colours while dragging).
 * The separator takes pointer input over at least `target.min` across, wider than it looks.
 */
export const splitPanelStyles = css`
  .split {
    --_size: var(--odd-split-panel-separator-size, ${token('space.md')});
  }
  .separator {
    border-radius: ${token('radius.xs')};
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.secondary')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    cursor: pointer;
    cursor: col-resize;
    transition-property: background-color, color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  :host([orientation='vertical']) .separator {
    cursor: pointer;
    cursor: row-resize;
  }
  .separator::before {
    content: '';
    position: absolute;
    inset-block: 0;
    inset-inline: calc((var(--_size) - ${token('target.min')}) / 2);
  }
  :host([orientation='vertical']) .separator::before {
    inset-block: calc((var(--_size) - ${token('target.min')}) / 2);
    inset-inline: 0;
  }
  @media (hover: hover) {
    .separator:hover {
      background: ${token('color.surface.hover')};
    }
  }
  .dragging .separator {
    background: ${token('color.selection.background')};
    color: ${token('color.selection.foreground')};
  }
`;
