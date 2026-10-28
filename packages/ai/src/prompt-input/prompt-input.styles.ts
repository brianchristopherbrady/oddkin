import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { promptInputRecipeStyles } from './prompt-input.recipe.styles.js';

/** The arrangement is the layout recipe in `prompt-input.recipe.ts`. */
export const promptInputStyles = css`
  ${promptInputRecipeStyles}
  .form {
    position: relative;
    display: grid;
    gap: ${token('space.xs')};
    padding: ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('radius.lg')};
    background: ${token('color.surface.default')};
  }
  .form:focus-within {
    border-color: ${token('color.focus.ring')};
  }
  .form[data-dragging='true'] {
    border-style: dashed;
    background: ${token('color.surface.hover')};
  }
  .input {
    inline-size: 100%;
    min-block-size: ${token('target.min')};
    max-block-size: var(--odd-prompt-input-max-height, 40vh);
    padding: ${token('space.xs')};
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    resize: none;
    overflow-y: auto;
  }
  .spacer {
    flex: 1 1 auto;
  }
  .attachments,
  .issues {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .attachment {
    max-inline-size: 100%;
    padding-inline: ${token('space.xs')} 0;
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.sunken')};
    font-size: ${token('font.size.sm')};
  }
  .attachment[data-status='failed'] {
    border-color: ${token('color.danger.foreground')};
  }
  .thumb {
    inline-size: 2rem;
    block-size: 2rem;
    object-fit: cover;
    border-radius: ${token('radius.sm')};
  }
  .name {
    min-inline-size: 0;
    max-inline-size: 16rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status-text {
    margin: 0;
    font-size: ${token('font.size.sm')};
    color: ${token('color.text.secondary')};
  }
  .status-text[data-failed='true'] {
    color: ${token('color.danger.foreground')};
  }
  .drop-hint {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    border-radius: inherit;
    pointer-events: none;
    font-weight: ${token('font.weight.semibold')};
  }
  @media (forced-colors: active) {
    .form {
      border-color: CanvasText;
    }
  }
`;
