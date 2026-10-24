import { OddkinElement, prop } from '@oddkin/core/element';

/**
 * A content measure and an inline-size container: container queries and layout recipe conditions
 * inside it resolve against its width, not the viewport's. `measure="constrained"` (the default)
 * centres it with the theme's `layout.measure` as its maximum inline size; `fluid` fills the space.
 * Insets are the page's: put an `.odd-box` inside or around it.
 *
 * @slot - The content.
 * @csspart base - The content wrapper.
 * @cssprop --odd-container-measure - The maximum inline size when constrained (default the theme's `layout.measure`).
 * @a11y Adds no role or landmark: wrap it in `main`, `section`, or another landmark as the page needs.
 * @previewRole container
 * @useFor A readable column of page content; a region whose children respond to its width with container queries.
 * @notFor Spacing alone (use `.odd-box`); a scrolling area (use `odd-scroll-region`).
 * @category Layout
 */
export class OddkinContainer extends OddkinElement.with({
  measure: prop.enum(['constrained', 'fluid'], {
    default: 'constrained',
    reflect: true,
    description: 'Constrained: centred, at most the measure wide. Fluid: the full width.',
  }),
}) {}

declare global {
  interface HTMLElementTagNameMap {
    'odd-container': OddkinContainer;
  }
}
