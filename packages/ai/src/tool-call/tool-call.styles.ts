import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { toolCallRecipeStyles } from './tool-call.recipe.styles.js';

/** The arrangement is the layout recipe in `tool-call.recipe.ts`. */
export const toolCallStyles = css`
  ${toolCallRecipeStyles}
  :host {
    display: grid;
    gap: ${token('space.xs')};
  }
  .base {
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.default')};
  }
  .summary {
    min-block-size: ${token('target.min')};
    padding: ${token('space.xs')} ${token('space.sm')};
    cursor: pointer;
  }
  .name {
    font-family: ${token('font.family.mono')};
    font-size: ${token('font.size.sm')};
    font-weight: ${token('font.weight.semibold')};
  }
  .purpose {
    flex-basis: 100%;
  }
  .body {
    padding: 0 ${token('space.sm')} ${token('space.sm')};
  }
  .label {
    margin: 0 0 ${token('space.2xs')};
    font-size: ${token('font.size.xs')};
    font-weight: ${token('font.weight.semibold')};
    color: ${token('color.text.secondary')};
  }
  .code {
    margin: 0;
    max-block-size: 16rem;
    padding: ${token('space.xs')};
    overflow: auto;
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.sunken')};
    font-family: ${token('font.family.mono')};
    font-size: ${token('font.size.xs')};
    white-space: pre-wrap;
  }
  .failure {
    padding: ${token('space.xs')} ${token('space.sm')};
    border-block-start: ${token('border.width.default')} solid ${token('color.danger.foreground')};
  }
`;
