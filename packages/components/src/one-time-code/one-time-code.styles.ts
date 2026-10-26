import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default one-time code (Figma `oneTimeCode`, `oneTimeCode/Cell`): `space.sm` between
 * the field's rows; `control.height.md` by `control.height.lg` cells, `space.xs` apart, with the
 * control radius and the strong border on the default surface, the digit in the body type role;
 * the focus ring on the active cell while focused, and the caret in the primary text colour.
 * The danger border marks an invalid code, the success border a `complete` one; a disabled or
 * `pending` code takes the sunken surface and the disabled text colour. The status line is in
 * the small type role: the secondary text colour, the success colour once `complete`.
 */
export const oneTimeCodeStyles = css`
  .field {
    gap: ${token('space.sm')};
  }
  .cells {
    gap: ${token('space.xs')};
  }
  .cell {
    inline-size: ${token('control.height.md')};
    block-size: ${token('control.height.lg')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: ${token('color.text.primary')};
    font-size: ${token('type.body.size')};
    line-height: ${token('type.body.line-height')};
  }
  .code:focus-visible + .cells .cell[data-active] {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
  .caret {
    background: ${token('color.text.primary')};
  }
  :host(:state(user-invalid)) .cell {
    border-color: ${token('color.danger.foreground')};
  }
  :host([status='complete']) .cell {
    border-color: ${token('color.success.foreground')};
  }
  :host(:disabled) .cell,
  :host([status='pending']) .cell {
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.disabled')};
  }
  .status {
    gap: ${token('space.xs')};
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  :host([status='complete']) .status {
    color: ${token('color.success.foreground')};
  }
  .status > :is(.glyph, .spinner) {
    font-size: ${token('icon.size.sm')};
  }
`;
