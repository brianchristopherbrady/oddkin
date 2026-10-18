import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const citationStyles = css`
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
    padding-inline: 0.25em;
    border: ${token('border.width.default')} solid ${token('color.border.default')};
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
    display: flex;
    flex-direction: column;
    gap: ${token('space.2xs')};
    margin-block: ${token('space.xs')};
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.raised')};
    font-size: ${token('font.size.sm')};
  }
  .preview[hidden] {
    display: none !important;
  }
  .link {
    color: ${token('color.link')};
  }
  @media (forced-colors: active) {
    .trigger,
    .preview {
      border-color: CanvasText;
    }
  }
`;
