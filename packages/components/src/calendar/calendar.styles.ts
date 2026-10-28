import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default calendar: Figma `calendar` and `calendar/Day`. The raised surface with
 * `space.md` padding and `space.sm` between rows; the month in the UI style between small ghost
 * buttons; weekday names in Small and secondary text; `control.height.md` square date cells
 * `space.2xs` apart in the UI style, with `radius.sm`: dates of other months in secondary text,
 * dates that cannot be chosen in the disabled colour, today outlined and the chosen date filled
 * in the action colour. A divider in the default border colour over the Today and Clear buttons.
 */
export const calendarStyles = css`
  :host(:disabled) .label {
    color: ${token('color.text.disabled')};
  }
  .calendar {
    padding: ${token('space.md')};
    background: ${token('color.surface.raised')};
  }
  .heading,
  .day {
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  .heading {
    color: ${token('color.text.primary')};
  }
  .nav {
    --odd-button-padding-inline: ${token('space.none')};
    min-inline-size: max(${token('control.height.sm')}, ${token('target.min')});
    font-size: ${token('icon.size.md')};
  }
  @media (hover: hover) {
    .day:not([aria-disabled='true']):not([aria-selected='true']):hover {
      background: ${token('color.surface.hover')};
    }
  }
  .grid {
    margin: calc(-1 * ${token('space.2xs')});
    border-spacing: ${token('space.2xs')};
  }
  .weekday {
    block-size: ${token('space.lg')};
    color: ${token('color.text.secondary')};
    font-family: ${token('type.small.family')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  .day {
    inline-size: ${token('control.height.md')};
    block-size: ${token('control.height.md')};
    border-width: ${token('border.width.default')};
    border-radius: ${token('radius.sm')};
    color: ${token('color.text.primary')};
    transition-property: background-color, border-color, color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  .day[part~='day-outside'] {
    color: ${token('color.text.secondary')};
  }
  .day[aria-current='date'] {
    border-color: ${token('color.action.default')};
  }
  .day[aria-disabled='true'] {
    color: ${token('color.text.disabled')};
  }
  .day[aria-selected='true'] {
    background: ${token('color.action.default')};
    color: ${token('color.text.on-action')};
  }
  .divider {
    block-size: ${token('border.width.default')};
    background: ${token('color.border.default')};
  }
`;
