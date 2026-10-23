import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default progress look: Figma `progress` (sunken track, action fill, `radius/sm`). */
export const progressStyles = css`
  .progress {
    gap: ${token('space.xs')};
    color: ${token('color.text.primary')};
  }
  .label,
  .value-text {
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
  }
  .value-text {
    color: ${token('color.text.secondary')};
    font-variant-numeric: tabular-nums;
  }
  .track {
    block-size: var(--odd-progress-height, ${token('space.xs')});
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.sunken')};
  }
  .indicator {
    border-radius: ${token('radius.sm')};
    background: ${token('color.action.default')};
    transition: inline-size ${token('motion.duration.normal')} ${token('motion.easing.standard')};
  }
  .description {
    color: ${token('color.text.secondary')};
    font-family: ${token('type.small.family')};
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    line-height: ${token('type.small.line-height')};
  }
`;
