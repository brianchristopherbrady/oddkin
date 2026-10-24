import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default combobox look beyond the shared modules (the field is the control look, the
 * popup the overlay look, the rows the option-row and listbox looks, the chips the chip look, the
 * clear button odd-input's): the field box holding the input (Figma `combobox`:
 * `control.padding.inline.md`; `multiselect`: `control.padding.inline.sm`, chips `control.gap`
 * apart, `space.xs` above and below as in Figma `Multiple selected`), with the control module's hover, invalid, and disabled
 * states and the focus ring drawn on the box around its input; room at the end for the clear
 * button beside the chevron.
 */
export const comboboxStyles = css`
  .control-end {
    gap: ${token('control.gap')};
  }
  .control-start,
  .chevron {
    color: ${token('color.text.secondary')};
  }
  /* The start padding beside the search glyph is the control module's. */
  .box {
    gap: ${token('control.gap')};
    padding-inline: ${token('control.padding.inline.md')};
  }
  :host([multiple]) .box,
  .control-box:has(.clear:not([hidden])) > .box {
    padding-inline-end: calc(${token('control.padding.inline.md')} + 1em + ${token('control.gap')});
  }
  :host([multiple]) .box {
    padding-block: ${token('space.xs')};
    padding-inline-start: ${token('control.padding.inline.sm')};
  }
  :host([multiple]) .control-box:has(.clear:not([hidden])) > .box {
    padding-inline-end: calc(
      ${token('control.padding.inline.md')} + 2em + 2 * ${token('control.gap')}
    );
  }
  .chips {
    gap: ${token('control.gap')};
  }
  .box:has(.entry:focus-visible) {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
  .entry::placeholder {
    color: ${token('color.text.secondary')};
    opacity: 1;
  }
  @media (hover: hover) {
    .box:has(.entry:read-write):hover {
      background: var(--odd-field-background, ${token('color.surface.hover')});
    }
  }
  .box:has(.entry[aria-invalid='true']) {
    border-color: ${token('color.danger.foreground')};
  }
  .box:has(.entry:disabled) {
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.disabled')};
  }
  .field:has(.entry:disabled) .label {
    color: ${token('color.text.disabled')};
  }
`;
