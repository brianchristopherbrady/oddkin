import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default disclosure: Figma `Disclosure` and `Accordion` (a bordered default surface with
 * `card/radius`, UI text, secondary content text, inset dividers, the focus ring around the
 * surface).
 */
export const disclosureStyles = css`
  .disclosure {
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: var(--odd-disclosure-radius, ${token('card.radius')});
    background: var(--odd-disclosure-background, ${token('color.surface.default')});
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
  }
  .disclosure:has(.summary:focus-visible) {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
  .summary {
    gap: ${token('space.sm')};
    padding: ${token('space.md')};
  }
  .marker {
    font-size: ${token('icon.size.md')};
  }
  .content {
    padding: 0 ${token('space.md')} ${token('space.md')};
    color: ${token('color.text.secondary')};
  }
  .content::before,
  :host(:state(joined-start)) .disclosure::before {
    content: '';
    display: block;
    block-size: ${token('border.width.default')};
    background: ${token('color.border.default')};
  }
  .content::before {
    margin-block-end: ${token('space.md')};
  }
  :host(:state(joined-start)) .disclosure::before {
    margin-inline: ${token('space.md')};
  }
  :host(:state(joined-start)) .content::before,
  :host(:state(joined-end)) .content::before {
    display: none;
  }
  :host([disabled]) .summary {
    color: ${token('color.text.disabled')};
  }
`;
