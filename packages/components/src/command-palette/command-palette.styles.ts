import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default command palette (Figma `CommandPalette`, `CommandItem`) beyond the shared
 * modules (the surface is the overlay look, the rows the option-row look): `radius.lg` and `space.lg`
 * around content `space.md` apart; the search field on the default surface, `control.height.lg`
 * high, ringed in the focus colour while it has focus (the input always has it); group headings
 * in the eyebrow role; the active command in the selection colours with its shortcut in the code
 * role; the empty state's title in the section role; the hints in the small role.
 */
export const commandPaletteStyles = css`
  /* The modal sheet (scrim, elevation) with Figma's raised surface and large radius. */
  .overlay-surface.palette {
    gap: ${token('space.md')};
    padding: ${token('space.lg')};
    border-radius: ${token('radius.lg')};
    background: ${token('color.surface.raised')};
  }
  .search {
    gap: ${token('space.sm')};
    min-block-size: ${token('control.height.lg')};
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    font-family: ${token('type.body.family')};
    font-size: ${token('type.body.size')};
    line-height: ${token('type.body.line-height')};
  }
  .search:focus-within {
    border-color: ${token('color.focus.ring')};
    box-shadow: 0 0 0 calc(${token('focus.width')} - ${token('border.width.default')})
      ${token('color.focus.ring')};
  }
  kbd {
    font: inherit;
  }
  .search-glyph,
  .input::placeholder {
    color: ${token('color.text.secondary')};
    opacity: 1;
  }
  .hint,
  .footer {
    color: ${token('color.text.secondary')};
    font-family: ${token('type.small.family')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  .footer {
    gap: ${token('space.md')};
  }
  .group + .group,
  .group + .option,
  .option + .group {
    margin-block-start: ${token('space.sm')};
  }
  .group-label {
    padding: ${token('space.xs')} ${token('space.sm')};
    color: ${token('color.text.secondary')};
    font-family: ${token('type.eyebrow.family')};
    font-size: ${token('type.eyebrow.size')};
    font-weight: ${token('type.eyebrow.weight')};
    line-height: ${token('type.eyebrow.line-height')};
    letter-spacing: ${token('type.eyebrow.letter-spacing')};
  }
  /* Figma CommandItem: rows on the default surface, space.sm around their content. */
  .option {
    gap: ${token('space.sm')};
    padding: ${token('space.sm')};
    background: ${token('color.surface.default')};
  }
  .shortcut {
    font-family: ${token('type.code.family')};
    font-size: ${token('type.code.size')};
    font-weight: ${token('type.code.weight')};
    line-height: ${token('type.code.line-height')};
  }
  /* Also under the pointer: the active command keeps the selection colours. */
  .listbox .option.active {
    outline: none;
    background: ${token('color.selection.background')};
    color: ${token('color.selection.foreground')};
  }
  .option.active .option-description,
  .option.active .option-end {
    color: ${token('color.selection.foreground')};
  }
  .state {
    gap: ${token('space.sm')};
    padding-block: ${token('space.sm')};
    color: ${token('color.text.secondary')};
    font-family: ${token('type.body.family')};
    font-size: ${token('type.body.size')};
    line-height: ${token('type.body.line-height')};
  }
  .state.empty {
    color: ${token('color.text.primary')};
    font-family: ${token('type.section.family')};
    font-size: ${token('type.section.size')};
    font-weight: ${token('type.section.weight')};
    line-height: ${token('type.section.line-height')};
    letter-spacing: ${token('type.section.letter-spacing')};
  }
`;
