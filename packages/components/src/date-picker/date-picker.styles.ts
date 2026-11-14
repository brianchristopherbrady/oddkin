import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default date picker: Figma `datePicker`. The field is the shared control look; the
 * calendar button is a target of the minimum size around its glyph in secondary text (as the
 * search field's clear button); the popup is the overlay surface, the calendar on it without a
 * surface of its own.
 */
export const datePickerStyles = css`
  .button {
    inline-size: ${token('target.min')};
    block-size: ${token('target.min')};
    margin: calc((${token('icon.size.md')} - ${token('target.min')}) / 2);
    border-radius: ${token('control.radius')};
    color: ${token('color.text.secondary')};
  }
  @media (hover: hover) {
    .button:enabled:hover {
      background: ${token('color.surface.hover')};
      color: ${token('color.text.primary')};
    }
  }
  odd-calendar::part(calendar) {
    background: transparent;
  }
`;
