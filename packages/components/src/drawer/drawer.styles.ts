import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default drawer: Figma `drawer`, odd-dialog's sheet look and title with a divider in the
 * default border colour under the header as well as above the actions, and the body in primary
 * text. A small margin from the viewport edges shows the card radius on every corner. Non-modal, it
 * is not in the top layer, so it stacks at `z-index.overlay`.
 */
export const drawerStyles = css`
  .dialog {
    z-index: ${token('z-index.overlay')};
    max-inline-size: calc(100% - 2 * ${token('space.sm')});
    max-block-size: none;
    margin-block: ${token('space.sm')};
    margin-inline-end: ${token('space.sm')};
  }
  :host([side='inline-start']) .dialog {
    margin-inline-start: ${token('space.sm')};
  }
  .header {
    padding: ${token('space.md')} ${token('space.lg')};
  }
  .header::after {
    block-size: ${token('border.width.default')};
    background: ${token('color.border.default')};
  }
  .body {
    padding: ${token('space.lg')};
    color: ${token('color.text.primary')};
  }
`;
