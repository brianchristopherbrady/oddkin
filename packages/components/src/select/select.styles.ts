import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default select look beyond the shared control module: the placeholder in secondary text
 * (the options keep primary text in the engine's picker). In the customizable select's open
 * picker, Figma `select`'s open state: the raised listbox surface (the overlay module's
 * `overlayPickerStyles`), with square option rows (the option-row module's `optionRowPickerStyles`)
 * between dividers.
 */
export const selectStyles = css`
  .control:has(> .placeholder:checked) {
    color: ${token('color.text.secondary')};
  }
  .control:has(> .placeholder:checked) > :not(.placeholder):not(:disabled) {
    color: ${token('color.text.primary')};
  }
  @supports (appearance: base-select) and selector(::picker(select)) {
    .control option {
      border-radius: 0;
    }
    .control :is(option:not(.placeholder), optgroup) + :is(option, optgroup) {
      border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
    }
  }
`;
