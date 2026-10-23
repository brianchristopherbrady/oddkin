import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default spinner: Figma `spinner` (action arc on the border track, UI text). */
export const spinnerElementStyles = css`
  .base {
    gap: ${token('space.md')};
    color: ${token('color.text.secondary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
  }
  :host([size='sm']) .base {
    gap: ${token('space.sm')};
  }
  .base .spinner {
    font-size: ${token('icon.size.md')};
    border-color: ${token('color.border.default')};
    border-block-start-color: var(--odd-spinner-color, ${token('color.action.default')});
    border-inline-end-color: var(--odd-spinner-color, ${token('color.action.default')});
  }
  :host([size='sm']) .base .spinner {
    font-size: ${token('icon.size.sm')};
  }
  :host([size='lg']) .base .spinner {
    font-size: ${token('icon.size.lg')};
  }
`;
