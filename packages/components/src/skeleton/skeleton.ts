import { OddkinElement, prop } from '@oddkin/core/element';
import type { Scope } from '@oddkin/core/scope';

/**
 * A content-shaped placeholder while a region loads. Hidden from assistive technology: mark the
 * loading region with `aria-busy="true"` and replace the placeholders when the content arrives.
 *
 * @csspart line - One text line (`shape="text"`).
 * @csspart base - The block (`shape="rect"` or `"circle"`).
 * @cssprop --odd-skeleton-color - Placeholder colour.
 * @a11y Hidden from assistive technology; the region that loads says it is busy.
 * @previewRole placeholder
 * @useFor Regions whose layout is known before their content: lists, cards, avatars with text.
 * @notFor Waiting with no known layout (use odd-spinner); progress of a task (use odd-progress).
 * @category Feedback
 */
export class OddkinSkeleton extends OddkinElement.with({
  shape: prop.enum(['text', 'rect', 'circle'], {
    default: 'text',
    reflect: true,
    description:
      'Text lines, a rectangle, or a circle. Size rect and circle with CSS on the element.',
  }),
  lines: prop.number({
    default: 1,
    description: 'Number of text lines; the last of several is shorter.',
  }),
}) {
  /** @internal Whole lines, at least one. */
  get _lines(): number {
    return Math.max(1, Math.floor(this.lines) || 1);
  }

  protected override mounted(scope: Scope): void {
    scope.effect(() => {
      this.internals.ariaHidden = 'true';
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-skeleton': OddkinSkeleton;
  }
}
