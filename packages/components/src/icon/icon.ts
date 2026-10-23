import { OddkinElement, prop } from '@oddkin/core/element';
import type { Scope } from '@oddkin/core/scope';

/**
 * An icon drawn in the current text colour: an SVG file by URL (`src`), or an inline `<svg>`
 * placed inside. Oddkin ships no icon set; bring your own, and pay only for the icons you use.
 *
 * @slot - An inline `<svg>`, used when `src` is empty.
 * @csspart base - The icon box.
 * @cssprop --odd-icon-size - Edge length; overrides `size`.
 * @a11y With `label` the icon is an image named by it; without, it is hidden from assistive technology. Beside text that already says the same, leave `label` empty.
 * @limitation `src` is drawn as a CSS mask, so the page's Content-Security-Policy must allow the URL in `img-src`, and the file's own colours are ignored (one colour, `currentColor`).
 * @previewRole icon
 * @useFor Pictograms beside text, or alone with `label`.
 * @notFor The only name of a control (give the control its own label); decoration that belongs in CSS.
 * @category Display
 */
export class OddkinIcon extends OddkinElement.with({
  src: prop.string({
    default: '',
    description: 'URL of an SVG, drawn in the current text colour; empty uses the slotted `<svg>`.',
  }),
  label: prop.string({
    default: '',
    description: 'Accessible name; empty marks the icon decorative.',
  }),
  size: prop.enum(['sm', 'md', 'lg'], {
    default: 'md',
    reflect: true,
    description: 'Edge length: 16, 20, or 24 px (the icon size tokens).',
  }),
}) {
  protected override mounted(scope: Scope): void {
    scope.effect(() => {
      const named = this.label !== '';
      this.internals.role = named ? 'img' : null;
      this.internals.ariaLabel = named ? this.label : null;
      this.internals.ariaHidden = named ? null : 'true';
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-icon': OddkinIcon;
  }
}
