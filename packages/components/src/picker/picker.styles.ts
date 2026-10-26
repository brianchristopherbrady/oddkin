import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default picker look beyond odd-combobox's field and the shared rows and surfaces (Figma
 * `Picker`: `multiselect/Field` in its Picker state, `popover` in its Picker state, `Tree` in its
 * Picker states, `ListboxSurface`): the multiple field padded as a single one
 * (`control.padding.inline.md`, no chip rows), the content `control.gap` apart and at least
 * `control.height.md` high, the tree content padded by `space.sm` with rows
 * `navigation.item.gap` apart in the UI type role, the active row's focus ring, the footer
 * (`Picker actions`: `space.xs` and `control.padding.inline.md` padding, a default top border,
 * the summary in the small type role and secondary text), and the keyboard focus ring (`focus.width`,
 * `radius.lg`) around the field and the open popup as one surface. The field's own ring gives way
 * to it while the popup is open.
 */
export const pickerStyles = css`
  /* Figma's Picker field pads chips as it pads a value, without odd-combobox's chip rows. */
  :host([multiple]) .box {
    padding-block: 0;
    padding-inline-start: ${token('control.padding.inline.md')};
  }
  .content {
    gap: ${token('control.gap')};
    min-block-size: ${token('control.height.md')};
  }
  .tree {
    --_indent: ${token('navigation.indent')};
    gap: ${token('navigation.item.gap')};
    padding: ${token('space.sm')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  .entry.active {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
  .footer {
    gap: ${token('space.xs')};
    padding: ${token('space.xs')} ${token('control.padding.inline.md')};
    border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
  }
  .summary {
    color: ${token('color.text.secondary')};
    font-family: ${token('type.small.family')};
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    line-height: ${token('type.small.line-height')};
    letter-spacing: ${token('type.small.letter-spacing')};
  }
  .box:has(.combobox[aria-expanded='true']:focus-visible) {
    outline: none;
  }
  .field:has(.combobox:focus-visible) + .popup:popover-open::before {
    content: '';
    inset: calc(
        -1 * (var(--_anchor-block-size, 0px) + ${token('focus.width')} + ${token('focus.offset')})
      )
      calc(-1 * (${token('focus.width')} + ${token('focus.offset')}))
      calc(-1 * (${token('focus.width')} + ${token('focus.offset')}));
    border: ${token('focus.width')} solid ${token('color.focus.ring')};
    border-radius: ${token('radius.lg')};
  }
  .field:has(.combobox:focus-visible) + .popup[data-side='block-start']:popover-open::before {
    inset: calc(-1 * (${token('focus.width')} + ${token('focus.offset')}))
      calc(-1 * (${token('focus.width')} + ${token('focus.offset')}))
      calc(
        -1 * (var(--_anchor-block-size, 0px) + ${token('focus.width')} + ${token('focus.offset')})
      );
  }
`;
