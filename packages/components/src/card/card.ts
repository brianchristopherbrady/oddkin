import { MoteElement, prop } from '@mote/core/element';
import { signal } from '@mote/core/reactive';
import type { Scope } from '@mote/core/scope';

const HEADING = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

/**
 * A surface that groups related content, with optional header and footer.
 *
 * It is a plain container unless it has an accessible name: `label`, or (where the browser
 * supports ARIA element reflection) a heading in the `header` slot. Then it is a named `region`.
 *
 * @slot - The body.
 * @slot header - Heading and supporting content; a heading here names the card.
 * @slot footer - Actions or supplementary content.
 * @csspart base - The surface.
 * @csspart header - The header region (hidden when empty).
 * @csspart body - The body region.
 * @csspart footer - The footer region (hidden when empty).
 * @cssprop --mote-card-padding - Inner padding.
 * @cssprop --mote-card-gap - Space between header, body, and footer.
 * @cssprop --mote-card-radius - Corner radius.
 * @cssprop --mote-card-background - Background colour.
 * @cssprop --mote-card-border-color - Border colour.
 * @cssprop --mote-card-shadow - Shadow for `variant="elevated"` (literal fallback until elevation tokens exist).
 * @a11y Becomes a named region only with `label` or a slotted heading; otherwise it adds no landmark.
 * @previewRole surface
 * @useFor Grouping related content and actions into one visual unit.
 * @notFor Page layout; use layout recipes. A whole clickable card; put a link or button inside.
 * @limitation Naming the region from a slotted heading needs `ElementInternals.ariaLabelledByElements` (newer than the browser baseline); without it, use `label`.
 * @category Containers
 */
export class MoteCard extends MoteElement.with({
  variant: prop.enum(['outlined', 'filled', 'elevated'], {
    default: 'outlined',
    reflect: true,
    description: 'Surface treatment.',
  }),
  padding: prop.enum(['none', 'sm', 'md', 'lg'], {
    default: 'md',
    reflect: true,
    description: 'Inner padding step.',
  }),
  label: prop.string({ default: '', description: 'Accessible name; makes the card a region.' }),
}) {
  /** @internal True while the header slot has content; read by the template. */
  readonly _hasHeader = signal(false);
  /** @internal True while the footer slot has content; read by the template. */
  readonly _hasFooter = signal(false);

  /** @internal Slot change handler used by the template. */
  readonly _onSlotChange = (): void => this.#refresh();

  protected override mounted(scope: Scope): void {
    // After the first commit, so the slots exist; re-runs when `label` changes.
    scope.effect(() => {
      this.label;
      this.#refresh();
    });
  }

  #refresh(): void {
    const filled = (name: string) =>
      this.shadowRoot
        ?.querySelector<HTMLSlotElement>(`slot[name="${name}"]`)
        ?.assignedNodes({ flatten: true })
        .some((node) => node.nodeType === Node.ELEMENT_NODE || !!node.textContent?.trim()) ?? false;
    this._hasHeader.value = filled('header');
    this._hasFooter.value = filled('footer');
    this.#syncSemantics();
  }

  #syncSemantics(): void {
    const internals = this.internals as ElementInternals & {
      ariaLabelledByElements?: readonly Element[] | null;
    };
    const header = this.shadowRoot?.querySelector<HTMLSlotElement>('slot[name="header"]');
    const heading = header
      ?.assignedElements({ flatten: true })
      .map((el) => (el.matches(HEADING) ? el : el.querySelector(HEADING)))
      .find((el): el is Element => el !== null);
    if (this.label) {
      internals.role = 'region';
      internals.ariaLabel = this.label;
      if ('ariaLabelledByElements' in internals) internals.ariaLabelledByElements = null;
    } else if (heading && 'ariaLabelledByElements' in internals) {
      internals.role = 'region';
      internals.ariaLabel = null;
      internals.ariaLabelledByElements = [heading];
    } else {
      internals.role = null;
      internals.ariaLabel = null;
      if ('ariaLabelledByElements' in internals) internals.ariaLabelledByElements = null;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mote-card': MoteCard;
  }
}
