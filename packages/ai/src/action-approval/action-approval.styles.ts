import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const actionApprovalStyles = css`
  .base {
    display: grid;
    gap: ${token('space.xs')};
    padding: ${token('space.sm')};
    border: ${token('border.width.strong')} solid ${token('color.border.strong')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.raised')};
  }
  .base[data-status='approved'],
  .base[data-status='rejected'],
  .base[data-status='expired'],
  .base[data-status='superseded'] {
    border-width: ${token('border.width.default')};
    border-color: ${token('color.border.default')};
  }
  p {
    margin: 0;
  }
  .title {
    font-weight: ${token('font.weight.semibold')};
  }
  .changes {
    display: grid;
    gap: ${token('space.2xs')};
    font-size: ${token('font.size.sm')};
  }
  .change {
    display: flex;
    flex-wrap: wrap;
    gap: ${token('space.xs')};
  }
  .change-label {
    font-weight: ${token('font.weight.medium')};
  }
  del {
    color: ${token('color.text.danger')};
  }
  ins {
    color: ${token('color.text.success')};
    text-decoration: none;
  }
  .state {
    font-size: ${token('font.size.sm')};
  }
  .state[data-tone='success'] {
    color: ${token('color.text.success')};
  }
  .state[data-tone='danger'] {
    color: ${token('color.text.danger')};
  }
  .reason {
    display: grid;
    flex: 1 1 100%;
    gap: ${token('space.2xs')};
  }
  textarea {
    min-block-size: ${token('target.min')};
    padding: ${token('space.2xs')} ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    font: inherit;
    color: inherit;
    background: ${token('color.surface.default')};
    resize: vertical;
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
  }
`;
