import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const promptInputStyles = css`
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
  .input:focus-visible {
    outline: none;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space.xs')};
  }
  .spacer {
    flex: 1 1 auto;
  }
  .attachments,
  .issues {
    display: flex;
    flex-wrap: wrap;
    gap: ${token('space.xs')};
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .issues {
    flex-direction: column;
  }
  .attachment {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space.2xs')};
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
