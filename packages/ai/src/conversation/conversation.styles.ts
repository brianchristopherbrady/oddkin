import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const conversationStyles = css`
  :host {
    display: block;
    block-size: 100%;
    min-block-size: 12rem;
  }
  .base {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: ${token('space.xs')};
    block-size: 100%;
    min-block-size: 0;
  }
  .scroller {
    flex: 1 1 auto;
    min-block-size: 8rem;
    overflow-y: auto;
    padding-block: ${token('space.sm')};
    padding-inline: ${token('space.xs')};
  }
  .scroller:focus-visible {
    outline-offset: -2px;
  }
  .feed {
    display: grid;
    gap: ${token('space.lg')};
    max-inline-size: var(--odd-conversation-max-width, 48rem);
    margin-inline: auto;
  }
  .feed > odd-message {
    border-radius: ${token('radius.md')};
  }
  .feed > odd-message:focus-visible {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('space.2xs')};
  }
  .history,
  .empty {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: ${token('space.xs')};
    margin-block-end: ${token('space.sm')};
  }
  .jump {
    position: absolute;
    inset-inline-end: ${token('space.sm')};
    inset-block-end: 6rem;
    min-block-size: ${token('target.min')};
    padding-inline: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('radius.full')};
    background: ${token('color.surface.raised')};
    color: inherit;
    font: inherit;
    font-size: ${token('font.size.sm')};
    box-shadow: ${token('elevation.md')};
    cursor: pointer;
  }
  odd-activity {
    padding-inline: ${token('space.xs')};
  }
  @media (forced-colors: active) {
    .jump {
      border-color: ButtonText;
    }
  }
`;
