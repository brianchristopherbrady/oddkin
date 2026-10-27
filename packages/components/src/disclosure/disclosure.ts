import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import type { Scope } from '@oddkin/core/scope';

/** Re-dispatched at the host: the native `toggle` of the inner `<details>` stays in the shadow root. */
export const disclosureToggleEvent = event('toggle', {
  bubbles: false,
  composed: false,
  cancelable: false,
  intent: 'notification',
  description:
    'A `ToggleEvent` (`oldState`, `newState`) once per change of `open`, whatever changed it, as native `<details>` reports it.',
});

// Connected disclosures: a group (`name`) spans shadow roots, which native `<details name>` cannot.
const members = new Set<OddkinDisclosure>();

/**
 * One trigger that shows or hides one related region: a native `<details>` and `<summary>`.
 * Disclosures that share a `name` in the same tree form an accordion: opening one closes the
 * others, and adjacent ones draw as one surface.
 *
 * @slot - The content shown while open.
 * @csspart base - The surface.
 * @csspart summary - The native `<summary>`: the button that opens and closes it.
 * @csspart label - The summary text.
 * @csspart marker - The chevron.
 * @csspart content - The region around the default slot.
 * @cssprop --odd-disclosure-radius - Corner radius of the surface.
 * @cssprop --odd-disclosure-background - Background of the surface.
 * @cssstate joined-start - The previous sibling is a disclosure of the same group; the two share a divider.
 * @cssstate joined-end - The next sibling is a disclosure of the same group.
 * @a11y The summary is a native disclosure button named by `label`; its expanded state comes from the platform. Content stays in the light DOM and in reading order, and find-in-page opens a closed disclosure that holds a match. Disabled: the summary leaves the Tab order and reports `aria-disabled`.
 * @keyboard Tab reaches the summary; Enter or Space opens and closes it.
 * @previewRole disclosure
 * @useFor Optional detail, advanced settings, and frequently asked questions (an accordion with `name`).
 * @notFor Switching between views (use odd-tabs); navigation menus; content everyone needs to read.
 * @category Navigation
 * @customization 1 2 3
 */
export class OddkinDisclosure extends OddkinElement.with({
  label: prop.string({
    default: '',
    description: 'The summary text; names the disclosure button.',
  }),
  open: prop.boolean({ reflect: true, description: 'Shows the content.' }),
  name: prop.string({
    default: '',
    reflect: true,
    description:
      'Exclusive group: opening one closes the others with the same name in the same tree, as native `<details name>` does.',
  }),
  disabled: prop.boolean({
    reflect: true,
    description: 'The summary cannot be activated and leaves the Tab order.',
  }),
}) {
  static override events = { toggle: disclosureToggleEvent };
  declare readonly _events?: ElementEvents<typeof OddkinDisclosure>;

  /** @internal Summary activation: the host's `open` is the one source of the state. */
  readonly _onClick = (event: MouseEvent): void => {
    event.preventDefault();
    if (!this.disabled) this.open = !this.open;
  };

  /**
   * @internal The inner `<details>` changed. The platform may open it itself (find-in-page), so its
   * state is taken over; the event is reported at the host, where the native one cannot reach.
   */
  readonly _onToggle = (event: ToggleEvent): void => {
    const details = event.currentTarget as HTMLDetailsElement;
    if (details.open !== this.open) this.open = details.open;
    if (event.oldState === event.newState) return;
    this.dispatchEvent(
      new ToggleEvent('toggle', { oldState: event.oldState, newState: event.newState }),
    );
  };

  protected override connected(scope: Scope): void {
    members.add(this);
    scope.add(() => {
      members.delete(this);
      this.#rejoin(this.name);
    }, 'disclosure group');
    // As native: an open disclosure inserted into a group that already has one open closes.
    if (this.open && this.#openPeer()) this.open = false;
    this.#rejoin(this.name);
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    if (changes.has('name')) {
      this.#rejoin(changes.get('name') as string);
      this.#rejoin(this.name);
      if (this.open && this.#openPeer()) this.open = false;
    }
    if (changes.has('open') && this.open) {
      for (const peer of this.#peers()) peer.open = false;
    }
  }

  protected override moved(): void {
    this.#rejoin(this.name);
  }

  *#peers(): Generator<OddkinDisclosure> {
    if (!this.name) return;
    const root = this.getRootNode();
    for (const other of members)
      if (other !== this && other.name === this.name && other.getRootNode() === root) yield other;
  }

  #openPeer(): boolean {
    for (const peer of this.#peers()) if (peer.open) return true;
    return false;
  }

  /** Joined states of every connected member of a group, from its siblings. */
  #rejoin(name: string): void {
    if (name) for (const member of members) if (member.name === name) member.#join();
    this.#join();
  }

  #join(): void {
    const joined = (sibling: Element | null) =>
      !!this.name && sibling instanceof OddkinDisclosure && sibling.name === this.name;
    this.setState('joined-start', joined(this.previousElementSibling));
    this.setState('joined-end', joined(this.nextElementSibling));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-disclosure': OddkinDisclosure;
  }
}
