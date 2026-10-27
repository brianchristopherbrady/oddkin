import { OddkinElement, prop } from '@oddkin/core/element';
import { langOf } from '@oddkin/core/i18n';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';

/**
 * A person or group marker: a picture (`src`) or, without one or when it fails to load, the
 * initials of `label`. Content placed inside replaces the initials (a "+3" overflow count).
 *
 * @slot - Replaces the initials, such as "+3" at the end of a group.
 * @csspart base - The circle.
 * @csspart image - The picture.
 * @cssprop --odd-avatar-size - Diameter; overrides `size`.
 * @a11y An image named by `label` (the person's name); without `label` it is hidden from assistive technology, for a name already shown beside it.
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
  src: prop.string({ default: '', description: 'Picture URL; the initials show without it.' }),
  size: prop.enum(['sm', 'md', 'lg'], {
    default: 'md',
    reflect: true,
    description: 'Diameter: 32, 40, or 48 px.',
  }),
}) {
  /** @internal The picture failed to load; reset when `src` changes. */
  readonly _failed = signal(false);
  /** @internal Image error handler used by the template. */
  readonly _onError = (): void => {
    this._failed.value = true;
  };

  /** @internal Up to two initials: the first letters of the first and last words of `label`. */
  get _initials(): string {
    const words = this.label.trim().split(/\s+/).filter(Boolean);
    const first = (word: string | undefined) => (word ? (Array.from(word)[0] ?? '') : '');
    const letters = first(words[0]) + (words.length > 1 ? first(words.at(-1)) : '');
    return letters.toLocaleUpperCase(langOf(this));
  }

  protected override mounted(scope: Scope): void {
    let previous = this.src;
    scope.effect(() => {
      if (this.src !== previous) {
        previous = this.src;
        this._failed.value = false;
      }
      const named = this.label !== '';
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
