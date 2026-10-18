import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const messageStyles = css`
  .base {
    display: grid;
    gap: ${token('space.xs')};
  }
  .header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space.xs')};
  }
  .role {
    font-size: ${token('font.size.sm')};
    font-weight: ${token('font.weight.semibold')};
    color: ${token('color.text.secondary')};
  }
  .content {
    display: grid;
    gap: ${token('space.sm')};
    min-inline-size: 0;
  }
  .base[data-role='user'] .content {
    justify-self: start;
    max-inline-size: 100%;
    padding: ${token('space.xs')} ${token('space.sm')};
    border-radius: ${token('radius.lg')};
    background: ${token('color.surface.sunken')};
  }
  .plain-text {
    margin: 0;
    white-space: pre-wrap;
  }
  .reasoning summary {
    min-block-size: ${token('target.min')};
    color: ${token('color.text.secondary')};
    font-size: ${token('font.size.sm')};
    cursor: pointer;
  }
  .reasoning odd-response {
    padding-inline-start: ${token('space.sm')};
    border-inline-start: ${token('border.width.default')} solid ${token('color.border.default')};
    color: ${token('color.text.secondary')};
  }
  .file {
    margin: 0;
    font-size: ${token('font.size.sm')};
  }
  .file a {
    color: ${token('color.link')};
  }
  .fallback {
    margin: 0;
    padding: ${token('space.xs')} ${token('space.sm')};
    border: ${token('border.width.default')} dashed ${token('color.border.default')};
    border-radius: ${token('radius.sm')};
    color: ${token('color.text.secondary')};
    font-size: ${token('font.size.sm')};
  }
  .edit {
    display: grid;
    gap: ${token('space.xs')};
  }
  .edit textarea {
    inline-size: 100%;
    padding: ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: inherit;
    font: inherit;
  }
  .footer {
    gap: ${token('space.2xs')};
  }
`;
