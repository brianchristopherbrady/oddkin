import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const transcriptStyles = css`
  p {
    margin: 0;
  }
  .list {
    display: grid;
    gap: ${token('space.2xs')};
    margin: 0;
    padding: 0;
    list-style: none;
  }
  textarea {
    inline-size: 100%;
    padding: ${token('space.2xs')} ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: inherit;
    font: inherit;
  }
  .interim {
    color: ${token('color.text.secondary')};
    font-style: italic;
  }
`;
