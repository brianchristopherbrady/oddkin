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
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.default')};
  }
  .summary {
    min-block-size: ${token('target.min')};
    cursor: pointer;
  }
  .name::before {
    content: '\\25B8' / '';
    margin-inline-end: ${token('space.2xs')};
  }
  [open] > .summary > .name::before {
    content: '\\25BE' / '';
  }
  .name {
    flex-basis: 100%;
    font-family: ${token('font.family.mono')};
    font-size: ${token('font.size.sm')};
  }
  .purpose {
    flex-basis: 100%;
  }
  .body {
    padding-block-start: ${token('space.xs')};
  }
  .label {
    margin: 0;
    font-size: ${token('font.size.sm')};
    color: ${token('color.text.secondary')};
  }
  .code {
    margin: 0;
    max-block-size: 16rem;
    padding: ${token('space.xs')};
    overflow: auto;
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.lg')};
    background: ${token('color.surface.sunken')};
    font-family: ${token('font.family.mono')};
    font-size: ${token('font.size.sm')};
    white-space: pre-wrap;
  }
  .failure {
    margin-block-start: ${token('space.xs')};
    padding-block-start: ${token('space.xs')};
    border-block-start: ${token('border.width.default')} solid ${token('color.danger.foreground')};
  }
`;
