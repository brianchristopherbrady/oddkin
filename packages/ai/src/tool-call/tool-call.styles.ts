import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { toolCallRecipeStyles } from './tool-call.recipe.styles.js';

/**
 * The arrangement is the layout recipe in `tool-call.recipe.ts`. Figma page 10, lightly until its
 * visual pass: the card `space.lg` in, with the large radius and the default border and surface;
 * the call's name in the AI title type (`font.size.md`, semibold), its status and purpose in the
 * small type and the secondary text colour (the status is words, not a coloured badge); Details'
 * content in the primary text colour, not the disclosure's; each section a sunken box `space.md`
 * in with the small radius, its label in the UI type over its code in the code type, which
 * scrolls within 16rem; the failure in the body type and the danger colour.
 */
export const toolCallStyles = css`
  ${toolCallRecipeStyles}
  .base {
    padding: ${token('space.lg')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.lg')};
    background: ${token('color.surface.default')};
  }
  p {
    margin: 0;
  }
  .name {
    font-size: ${token('font.size.md')};
    font-weight: ${token('font.weight.semibold')};
    letter-spacing: ${token('letter-spacing.normal')};
  }
  .state,
  .purpose {
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    letter-spacing: ${token('type.small.letter-spacing')};
    line-height: ${token('type.small.line-height')};
  }
  .body {
    color: ${token('color.text.primary')};
  }
  .section {
    padding: ${token('space.md')};
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.sunken')};
  }
  .label {
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    letter-spacing: ${token('type.ui.letter-spacing')};
    line-height: ${token('type.ui.line-height')};
  }
  .code {
    margin: 0;
    max-block-size: 16rem;
    overflow: auto;
    font-family: ${token('type.code.family')};
    font-size: ${token('type.code.size')};
    font-weight: ${token('type.code.weight')};
    line-height: ${token('type.code.line-height')};
    white-space: pre-wrap;
  }
  .failure .error {
    font-size: ${token('type.body.size')};
    line-height: ${token('type.body.line-height')};
  }
`;
