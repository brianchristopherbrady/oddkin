import {
  focusRingStyles,
  hostStyles,
  nativeButtonStyles,
  toneStyles,
  visuallyHiddenStyles,
} from '@oddkin/components/styles';
import { css, type StyleInput } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { aiElementRecipeStyles } from './ai-element.recipe.styles.js';

/**
 * Styles every `@oddkin/ai` element adds to the shared component primitives: host text
 * defaults, status labels (coloured by `data-tone` through the shared tone styles), and action
 * rows (the layout recipe in `ai-element.recipe.ts`). Buttons are native
 * `<button class="odd-button" data-size="sm">`, drawn by `nativeButtonStyles` like `odd-button`.
 */
export const aiElementStyles = css`
  ${aiElementRecipeStyles}
  :host {
    display: block;
    min-inline-size: 0;
    color: ${token('color.text.primary')};
    font-family: ${token('type.body.family')};
    font-size: ${token('type.body.size')};
    line-height: ${token('type.body.line-height')};
    overflow-wrap: anywhere;
  }
  .muted {
    color: ${token('color.text.secondary')};
    font-size: ${token('font.size.sm')};
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: ${token('space.none')};
    padding-block: ${token('space.3xs')};
    padding-inline: ${token('space.xs')};
    border: ${token('border.width.default')} solid var(--_tone-border);
    border-radius: ${token('radius.full')};
    font-size: ${token('font.size.xs')};
    font-weight: ${token('font.weight.medium')};
    color: var(--_tone-foreground);
    white-space: nowrap;
  }
  .status:is(
    [data-tone='info'],
    [data-tone='success'],
    [data-tone='warning'],
    [data-tone='danger']
  ) {
    border-color: currentColor;
    background: var(--_tone-surface);
  }
  .status:is([data-tone=''], [data-tone='active']) {
    border-color: ${token('color.border.strong')};
    color: ${token('color.text.primary')};
  }
  .error {
    color: ${token('color.danger.foreground')};
    font-size: ${token('font.size.sm')};
  }
  /* Figma draws the AI elements' buttons in the Field/small text style: regular weight. */
  .odd-button {
    min-inline-size: ${token('target.min')};
    font-weight: ${token('font.weight.regular')};
  }
  @media (forced-colors: active) {
    .status {
      border-color: CanvasText;
    }
  }
`;

/** Shared primitives first, then the AI element styles; each element adds its own sheet. */
export const aiBaseStyles: readonly StyleInput[] = [
  hostStyles,
  visuallyHiddenStyles,
  focusRingStyles,
  toneStyles,
  nativeButtonStyles,
  aiElementStyles,
];
