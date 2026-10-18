import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const contextPickerStyles = css`
  .base {
    display: grid;
    gap: ${token('space.xs')};
  }
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
  .item {
    padding: ${token('space.2xs')} ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.default')};
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space.xs')};
  }
  .label {
    flex: 1 1 8rem;
    min-inline-size: 0;
  }
  .kind {
    font-size: ${token('font.size.xs')};
    text-transform: uppercase;
  }
  .excerpt {
    max-block-size: 10rem;
    margin: ${token('space.2xs')} 0 0;
    overflow: auto;
    font-family: ${token('font.family.mono')};
    font-size: ${token('font.size.xs')};
    white-space: pre-wrap;
  }
  .url {
    display: flex;
    flex-wrap: wrap;
    gap: ${token('space.2xs')};
  }
  input[type='url'] {
    min-block-size: ${token('target.min')};
    padding-inline: ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: inherit;
    font: inherit;
  }
`;
