import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { artifactRecipeStyles } from './artifact.recipe.styles.js';

/** The arrangement is the layout recipe in `artifact.recipe.ts`. */
export const artifactStyles = css`
  ${artifactRecipeStyles}
  .base {
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.lg')};
    background: ${token('color.surface.default')};
  }
  .title {
    flex: 1 1 12rem;
    margin: 0;
    font-weight: ${token('font.weight.semibold')};
  }
  p {
    margin: 0;
  }
  .revision {
    min-inline-size: 0;
  }
  select {
    /* Never wider than the header: a wide font in a narrow container clips the label instead. */
    max-inline-size: 100%;
    min-block-size: ${token('target.min')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: inherit;
    font: inherit;
    font-size: ${token('font.size.sm')};
  }
  .preview {
    min-inline-size: 0;
    overflow-x: auto;
  }
  .preview > :first-child {
    margin-block-start: 0;
  }
  .preview pre,
  .source {
    margin: 0;
    padding: ${token('space.sm')};
    overflow: auto;
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.sunken')};
    font-family: ${token('font.family.mono')};
    font-size: ${token('font.size.sm')};
  }
  .source,
  .preview .text {
    max-block-size: 32rem;
    white-space: pre-wrap;
  }
  .preview a {
    color: ${token('color.link')};
  }
  .preview .tok-keyword {
    color: ${token('color.link')};
  }
  .preview .tok-string {
    color: ${token('color.success.foreground')};
  }
  .preview .tok-comment {
    color: ${token('color.text.secondary')};
  }
`;
