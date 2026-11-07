import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * The disclosure reads as a label: no surface of its own, its summary drawn as Figma draws the
 * label (the small secondary button's box in the Field/small text style), the marker first.
 */
export const aiLabelStyles = css`
  :host {
    display: inline-block;
    font-size: ${token('font.size.xs')};
  }
  odd-disclosure::part(base) {
    border: 0;
    border-radius: 0;
    background: none;
    outline: none;
    font: inherit;
  }
  odd-disclosure::part(summary) {
    display: inline-flex;
    min-block-size: max(${token('control.height.sm')}, ${token('target.min')});
    padding-block: ${token('space.none')};
    padding-inline: ${token('control.padding.inline.sm')};
    gap: ${token('control.gap')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('font.weight.regular')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  odd-disclosure::part(summary):focus-visible {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
  odd-disclosure::part(marker) {
    order: -1;
    font-size: ${token('icon.size.sm')};
  }
  odd-disclosure::part(content) {
    padding: 0;
    color: inherit;
  }
  odd-disclosure::part(content)::before {
    display: none;
  }
  .details,
  .notes,
  .muted {
    margin-block: ${token('space.2xs')} 0;
    max-inline-size: 40ch;
  }
  .details div {
    display: flex;
    gap: ${token('space.xs')};
  }
  .details dt {
    color: ${token('color.text.secondary')};
  }
  .details dd {
    margin: 0;
  }
  @media (forced-colors: active) {
    odd-disclosure::part(summary) {
      border-color: ButtonText;
    }
  }
`;
