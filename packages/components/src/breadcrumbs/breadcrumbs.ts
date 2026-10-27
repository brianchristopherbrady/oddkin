import { OddkinElement, prop } from '@oddkin/core/element';
import { format, strings } from '@oddkin/core/i18n';
import { computed, signal, untracked, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { CollectionSource, readLinks, type LinkRecord } from '../collection/collection.js';

export const BREADCRUMBS_STRINGS = {
  label: 'Breadcrumb',
  more: 'Show {count} more',
};

/** One entry of the trail. */
export type BreadcrumbEntry =
  | {
      readonly kind: 'link' | 'current';
      readonly key: string;
      readonly first: boolean;
      readonly record: LinkRecord;
    }
  | { readonly kind: 'more'; readonly key: string; readonly count: number };

/**
 * A location trail: links to the pages above this one, then the current page as text. Items come
 * from `<a href>` descendants (a server-rendered `<ol><li><a href>` list works as written) or the
 * `items` property; with `max-items`, the middle items wait behind a "more" button.
 *
 * @csspart base - The `<nav>` surface.
 * @csspart list - The ordered list.
 * @csspart item - Each list item.
 * @csspart link - Each link to a page above this one.
 * @csspart current - The current page (text with `aria-current="page"`).
 * @csspart separator - The mark before each item after the first.
 * @csspart more - The button that shows the collapsed items.
 * @slot home - Replaces the first item's text: other text, or an icon (`<svg>`), which is decorative; with no text in it, the first item's label stays as hidden text, so the item keeps its name.
 * @cssprop --odd-breadcrumbs-radius - Corner radius of the surface.
 * @a11y A `<nav>` landmark named by `label` (default `strings.label`, "Breadcrumb") around an ordered list. The last item is the current page, as text with `aria-current="page"`. Separators are hidden from assistive technology. The "more" button is named "Show 2 more" (`strings.more`); activating it shows the collapsed items and moves focus to the first of them.
 * @keyboard Tab moves through the links and the "more" button; Enter follows a link; Enter or Space on "more" shows the collapsed items.
 * @previewRole breadcrumbs
 * @useFor Showing where a page sits in a hierarchy, with links to the levels above it.
 * @notFor The steps of a process; primary navigation (use odd-side-nav); a back button.
 * @category Navigation
 * @customization 1 2 3
 */
export class OddkinBreadcrumbs extends OddkinElement.with({
  label: prop.string({
    default: '',
    description: 'Names the navigation; default `strings.label`.',
  }),
  items: prop.object<readonly LinkRecord[]>({
    description:
      'Items `{ label, href }`, the last being the current page. When set (even to an empty array) it is the only source; `<a href>` children are ignored.',
  }),
  maxItems: prop.number({
    default: 0,
    description:
      'Collapse when there are more items than this: the first item, a "more" button, and the last `max-items − 1` items show. 0 never collapses.',
  }),
  strings: prop.object<Partial<typeof BREADCRUMBS_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  readonly #source = new CollectionSource<LinkRecord>({
    host: this,
    name: 'items',
    property: () => this.items,
    read: readLinks,
  });
  #focusRevealed = false;

  /** @internal What the `home` slot holds: nothing, content without text (an icon), or text. */
  readonly _home = signal<'none' | 'icon' | 'text'>('none');

  /** @internal Slot change handler used by the template. */
  readonly _onHomeChange = (event: Event): void => {
    const nodes = (event.target as HTMLSlotElement).assignedNodes();
    this._home.value = !nodes.length
      ? 'none'
      : nodes.some((node) => !!node.textContent?.trim())
        ? 'text'
        : 'icon';
  };

  /** @internal Whether the collapsed items were shown. */
  readonly _expanded = signal(false);

  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof BREADCRUMBS_STRINGS> = computed(() =>
    strings(BREADCRUMBS_STRINGS, this.strings),
  );

  /** @internal The items shown: the first, "more" when collapsed, the rest; the last is current. */
  readonly _entries: Readable<readonly BreadcrumbEntry[]> = computed(() => {
    const records = this.#source.records.value;
    const max = Math.floor(this.maxItems) || 0;
    const entry = (record: LinkRecord, i: number): BreadcrumbEntry => {
      const kind = i === records.length - 1 ? 'current' : 'link';
      return {
        kind,
        key: `${i}\n${kind}\n${record.href}\n${record.label}`,
        first: i === 0,
        record,
      };
    };
    const all = records.map(entry);
    if (max <= 0 || records.length <= max || this._expanded.value) return all;
    const tail = Math.max(1, max - 1);
    const hidden = records.length - 1 - tail;
    if (hidden < 1) return all;
    return [all[0]!, { kind: 'more', key: 'more', count: hidden }, ...all.slice(-tail)];
  });

  /** @internal The "more" button's name. */
  _moreLabel(count: number): string {
    return format(this._strings.value.more, { count: String(count) });
  }

  /** @internal "More" was activated: show every item and focus the first one shown. */
  _reveal(): void {
    this.#focusRevealed = true;
    this._expanded.value = true;
  }

  protected override connected(scope: Scope): void {
    scope.use(this.#source);
  }

  protected override mounted(scope: Scope): void {
    scope.effect(
      () => {
        if (!this._expanded.value || !this.#focusRevealed) return;
        this.#focusRevealed = false;
        untracked(() =>
          this.shadowRoot!.querySelectorAll<HTMLElement>('[part~="link"]')[1]?.focus(),
        );
      },
      { phase: 'post', name: '<odd-breadcrumbs> revealed focus' },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-breadcrumbs': OddkinBreadcrumbs;
  }
}
