import { OddkinElement, prop } from '@oddkin/core/element';
import { langOf } from '@oddkin/core/i18n';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';

/**
 * A person or group marker: the initials of `label`, replaced by a picture (`src`) once it has
 * loaded. The initials show while the picture loads and stay when it fails, in the same circle.
 * Content placed inside replaces the initials (a "+3" overflow count).
 *
 * @slot - Replaces the initials, such as "+3" at the end of a group.
 * @csspart base - The circle.
 * @csspart image - The picture, shown once it has loaded.
 * @cssprop --odd-avatar-size - Diameter; overrides `size`.
 * @a11y An image named by `label` (the person's name); without `label`, or with only spaces, it is hidden from assistive technology, for a name already shown beside it.
 * @previewRole avatar
 * @useFor Identifying people in lists, comments, assignments, and member groups.
 * @notFor Product or file images; decorative illustrations.
 * @category Display
 * @customization 1 2 3
 */
export class OddkinAvatar extends OddkinElement.with({
  label: prop.string({
    default: '',
    description: "The person's or group's name; names the image.",
  }),
  src: prop.string({
    default: '',
    description: 'Picture URL; the initials show without it, while it loads, and if it fails.',
  }),
  size: prop.enum(['sm', 'md', 'lg'], {
    default: 'md',
    reflect: true,
    description: 'Diameter: 32, 40, or 48 px.',
  }),
}) {
  /** @internal The source whose picture loaded; the initials show until the current one has. */
  readonly _loaded = signal<string | null>(null);
  /** @internal The source whose picture failed to load; the initials stay for it. */
  readonly _failed = signal<string | null>(null);

  /** @internal The template's load and error handler for the picture of `source`. */
  _settle(event: Event, source: string): void {
    // The source changed and the new picture is not rendered yet: this outcome is not current.
    if (source !== this.src) return;
    (event.type === 'load' ? this._loaded : this._failed).value = source;
  }

  /** @internal Up to two initials: the first letters of the first and last words of `label`. */
  get _initials(): string {
    const words = this.label.trim().split(/\s+/).filter(Boolean);
    const first = (word: string | undefined) => (word ? (Array.from(word)[0] ?? '') : '');
    const letters = first(words[0]) + (words.length > 1 ? first(words.at(-1)) : '');
    return letters.toLocaleUpperCase(langOf(this));
  }

  protected override mounted(scope: Scope): void {
    scope.effect(() => {
      // Outcomes belong to one source: another source is requested afresh, and so is a source
      // set again after a different one.
      const source = this.src;
      if (this._loaded.peek() !== source) this._loaded.value = null;
      if (this._failed.peek() !== source) this._failed.value = null;
    });
    scope.effect(() => {
      const named = this.label.trim() !== '';
      this.internals.role = named ? 'img' : null;
      this.internals.ariaLabel = named ? this.label : null;
      this.internals.ariaHidden = named ? null : 'true';
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-avatar': OddkinAvatar;
  }
}
