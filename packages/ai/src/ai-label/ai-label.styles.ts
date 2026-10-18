import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const aiLabelStyles = css`
  :host {
    display: inline-block;
    font-size: ${token('font.size.xs')};
  }
  .label {
    display: inline-flex;
    align-items: center;
    min-block-size: ${token('target.min')};
    padding-inline: ${token('space.xs')};
    border-radius: ${token('radius.full')};
    color: ${token('color.text.secondary')};
    font-weight: ${token('font.weight.medium')};
    list-style: none;
    cursor: pointer;
  }
  .label::before {
    content: '\\2726';
    margin-inline-end: ${token('space.2xs')};
  }
  .details,
  .notes,
  .muted {
    margin-block: ${token('space.2xs')} 0;
    max-inline-size: 40ch;
  }
  .details div {
    display: flex;
    gap: ${token('space.xs')};
  }
  .details dt {
    color: ${token('color.text.secondary')};
  }
  .details dd {
    margin: 0;
  }
`;
