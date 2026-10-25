import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default marker: Figma's Step status (`control.height.sm`, a `border.width.default`
 * ring): idle on the sunken surface, complete in the action colour, pending on the selection
 * surface, failed on the danger surface.
 */
export const statusMarkerStyles = css`
  :host {
    --_size: var(--odd-status-marker-size, ${token('control.height.sm')});
    --_border: ${token('border.width.default')};
    --_radius: ${token('radius.full')};
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: 1;
  }
  .base {
    background: ${token('color.surface.sunken')};
    border-color: ${token('color.border.strong')};
  }
  :host([status='complete']) .base {
    background: ${token('color.action.default')};
    border-color: ${token('color.action.default')};
    color: ${token('color.text.on-action')};
  }
  :host([status='pending']) .base {
    background: ${token('color.selection.surface')};
    border-color: transparent;
    color: ${token('color.selection.foreground')};
  }
  .glyph,
  .spinner {
    font-size: ${token('icon.size.sm')};
  }
  :host([status='failed']) .base {
    background: ${token('color.danger.surface')};
    border-color: ${token('color.danger.foreground')};
    color: ${token('color.danger.foreground')};
  }
`;
