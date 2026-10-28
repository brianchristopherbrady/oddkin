import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { checkpointRecipeStyles } from './checkpoint.recipe.styles.js';

/** The arrangement is the layout recipe in `checkpoint.recipe.ts`. */
export const checkpointStyles = css`
  ${checkpointRecipeStyles}
  .base {
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.default')};
  }
  p {
    margin: 0;
  }
  .label {
    font-weight: ${token('font.weight.semibold')};
  }
  .restores {
    margin: ${token('space.2xs')} 0 0;
    padding-inline-start: ${token('space.lg')};
    font-size: ${token('font.size.sm')};
  }
  .state {
    font-size: ${token('font.size.sm')};
  }
  .state[data-tone='success'] {
    color: ${token('color.success.foreground')};
  }
  .state[data-tone='danger'] {
    color: ${token('color.danger.foreground')};
  }
  .confirm {
    padding: ${token('space.xs')};
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.sunken')};
  }
`;
