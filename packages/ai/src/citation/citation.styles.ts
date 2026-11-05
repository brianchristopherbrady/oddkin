import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { citationRecipeStyles } from './citation.recipe.styles.js';

/** The arrangement is the layout recipe in `citation.recipe.ts`. */
export const citationStyles = css`
  ${citationRecipeStyles}
  :host {
    display: inline;
    position: relative;
  }
  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: 1.5em;
    min-block-size: 1.5em;
    margin-inline: 0.125em;
    padding-block: 0;
    padding-inline: 0.25em;
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.sunken')};
    color: ${token('color.link')};
    font: inherit;
    font-size: 0.75em;
    line-height: 1;
    vertical-align: super;
    cursor: pointer;
  }
  /* Touch: keep a 24px minimum target without changing the inline marker size. */
  .trigger::after {
    content: '';
    position: absolute;
    inset: -0.5rem;
  }
  .trigger[data-resolved='false'] {
    border-style: dashed;
    color: ${token('color.text.secondary')};
  }
  .preview {
    margin-block: ${token('space.xs')};
    padding: ${token('space.md')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.default')};
    font-size: ${token('font.size.sm')};
  }
  .preview[hidden] {
    display: none !important;
  }
  .title {
    font-weight: ${token('font.weight.medium')};
  }
  .host {
    font-size: ${token('font.size.xs')};
  }
  .link {
    padding-inline: ${token('space.xs')};
    border-radius: ${token('control.radius')};
    color: ${token('color.link')};
  }
  @media (forced-colors: active) {
    .trigger,
    .preview {
      border-color: CanvasText;
    }
  }
`;
