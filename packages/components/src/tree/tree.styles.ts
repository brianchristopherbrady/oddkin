import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default visual styles for the tree: Figma `Tree`'s surface (the default surface, a
 * default border, `card.radius`), rows as `navRowStyles` draws them indented by
 * `navigation.indent`, and the empty and loading states in secondary text.
 */
export const treeStyles = css`
  .root {
    --_indent: ${token('navigation.indent')};
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('card.radius')};
    background: ${token('color.surface.default')};
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  .state {
    padding: ${token('space.md')};
    color: ${token('color.text.secondary')};
  }
`;
