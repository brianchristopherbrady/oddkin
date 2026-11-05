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
    list-style: none;
  }
  .label::before {
    content: '\\25B8' / '';
    margin-inline-end: ${token('space.2xs')};
  }
  [open] > .label::before {
    content: '\\25BE' / '';
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
