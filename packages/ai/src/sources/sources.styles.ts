import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const sourcesStyles = css`
  .heading {
    margin: 0 0 ${token('space.xs')};
    font-size: ${token('font.size.sm')};
    font-weight: ${token('font.weight.semibold')};
    color: ${token('color.text.secondary')};
  }
  .list {
    display: grid;
    gap: ${token('space.xs')};
    margin: 0;
    padding-inline-start: ${token('space.lg')};
    font-size: ${token('font.size.sm')};
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: ${token('space.2xs')} ${token('space.xs')};
    border-radius: ${token('radius.sm')};
  }
  .item[data-revealed='true'] {
    background: ${token('color.surface.selected')};
  }
  .title {
    color: ${token('color.text.link')};
    font-weight: ${token('font.weight.medium')};
  }
  span.title {
    color: inherit;
  }
  .excerpt {
    color: ${token('color.text.secondary')};
  }
`;
