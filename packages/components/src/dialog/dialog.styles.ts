import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default dialog: Figma `dialog` and `alertDialog` (the shared sheet look from the
 * overlay-surface module, the title in the Card title style, the body in secondary text, and the
 * actions under a divider in the default border colour). It keeps a margin from every edge of the
 * viewport, measured with dynamic viewport units so mobile toolbars do not cover it.
 */
export const dialogStyles = css`
  .dialog {
    max-inline-size: calc(100% - 2 * ${token('space.md')});
    max-block-size: calc(100dvh - 2 * ${token('space.md')});
  }
  .header {
    padding: ${token('space.lg')} ${token('space.lg')} ${token('space.sm')};
  }
  .title {
    color: ${token('color.text.primary')};
    font-family: ${token('type.title.family')};
    font-size: ${token('type.title.size')};
    font-weight: ${token('type.title.weight')};
    line-height: ${token('type.title.line-height')};
    letter-spacing: ${token('type.title.letter-spacing')};
  }
  .overlay-close {
    margin-block-start: calc(-1 * ${token('space.xs')});
    margin-inline-end: calc(-1 * ${token('space.sm')});
  }
  .body {
    padding: 0 ${token('space.lg')} ${token('space.lg')};
    color: ${token('color.text.secondary')};
  }
  .footer {
    padding: ${token('space.md')} ${token('space.lg')};
  }
  .footer::before {
    block-size: ${token('border.width.default')};
    background: ${token('color.border.default')};
  }
`;
