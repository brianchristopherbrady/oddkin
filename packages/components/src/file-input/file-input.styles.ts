import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default file input: Figma `fileUpload`. The surface takes the card radius, the strong
 * border, and the default surface; the upload glyph at `icon.size.lg`, `space.md` before the
 * title in the UI style (the error takes its place in the danger colour); the native
 * `::file-selector-button` is a secondary button (the tokens of `odd-button`, compared in the
 * tests); file rows show the name in the UI style over the size in Small and secondary text.
 * Files dragged over the surface give it the action border and the selection surface.
 */
export const fileInputStyles = css`
  .surface {
    padding: ${token('card.padding')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('card.radius')};
    background: ${token('color.surface.default')};
    transition-property: background-color, border-color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  :host(:state(drop-target)) .surface {
    border-color: ${token('color.action.default')};
    background: ${token('color.selection.surface')};
  }
  .header-glyph,
  .file-glyph {
    color: ${token('color.text.secondary')};
    font-size: ${token('icon.size.lg')};
  }
  .title,
  .header .error,
  .file-name {
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  .title,
  .file-name {
    color: ${token('color.text.primary')};
  }
  .description,
  .picker {
    margin-inline-start: calc(${token('icon.size.lg')} + ${token('space.md')});
  }
  .picker {
    max-inline-size: calc(100% - ${token('icon.size.lg')} - ${token('space.md')});
    margin-block-start: ${token('space.xs')};
    color: ${token('color.text.primary')};
    cursor: pointer;
  }
  .picker::file-selector-button {
    box-sizing: border-box;
    min-block-size: max(${token('control.height.md')}, ${token('target.min')});
    margin: ${token('space.none')};
    padding-block: ${token('space.none')};
    padding-inline: ${token('control.padding.inline.md')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
    cursor: pointer;
    transition-property: background-color, border-color, color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  @media (hover: hover) {
    .picker:enabled:hover::file-selector-button {
      background: ${token('color.surface.hover')};
    }
  }
  .picker:enabled:active::file-selector-button {
    background: ${token('color.surface.sunken')};
  }
  .picker:disabled::file-selector-button {
    border-color: transparent;
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.disabled')};
    cursor: not-allowed;
  }
  .field:has(.picker:disabled) :is(.label, .title) {
    color: ${token('color.text.disabled')};
  }
  .file-size {
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  .remove {
    min-inline-size: max(${token('control.height.sm')}, ${token('target.min')});
    min-block-size: max(${token('control.height.sm')}, ${token('target.min')});
    border-radius: ${token('control.radius')};
    background: transparent;
    color: ${token('color.text.secondary')};
    font-size: ${token('icon.size.md')};
  }
  @media (hover: hover) {
    .remove:enabled:hover {
      background: ${token('color.surface.hover')};
      color: ${token('color.text.primary')};
    }
  }
  .remove:disabled {
    color: ${token('color.text.disabled')};
    cursor: not-allowed;
  }
`;
