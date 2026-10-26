import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default input look beyond the shared control module: the search field's clear button,
 * a round target of the minimum size around its 1em glyph, in secondary text; and Figma
 * `number`'s stepper, a sunken segment inside the field's border at its end, of two buttons a
 * control height wide, the text kept clear of it by `space.xs`.
 */
export const inputStyles = css`
  .clear {
    inline-size: ${token('target.min')};
    block-size: ${token('target.min')};
    margin: calc((1em - ${token('target.min')}) / 2);
    border-radius: ${token('radius.full')};
    color: ${token('color.text.secondary')};
  }
  @media (hover: hover) {
    .clear:hover {
      background: ${token('color.surface.hover')};
      color: ${token('color.text.primary')};
    }
    .step:enabled:hover {
      background: ${token('color.surface.hover')};
    }
  }
  .stepper {
    margin: ${token('border.width.default')};
    overflow: hidden;
    border-start-end-radius: calc(
      var(--odd-field-radius, ${token('control.radius')}) - ${token('border.width.default')}
    );
    border-end-end-radius: calc(
      var(--odd-field-radius, ${token('control.radius')}) - ${token('border.width.default')}
    );
    background: ${token('color.surface.sunken')};
  }
  .step {
    inline-size: ${token('control.height.md')};
  }
  .step:disabled {
    color: ${token('color.text.disabled')};
  }
  .control-box:has(> .stepper) > .control {
    padding-inline-end: calc(
      2 * ${token('control.height.md')} + ${token('border.width.default')} + ${token('space.xs')}
    );
  }
`;
