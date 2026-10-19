import { computed } from '@oddkin/core/reactive';
import { html, repeat } from '@oddkin/core/template';
import type { NavigationItem } from '../models/navigation.js';
import type {
  CustomNavigationItem,
  NavigationEntry,
  NavigationKind,
  NavigationKinds,
} from './kinds.js';
import type { OddkinSideNav } from './side-nav.js';

/**
 * Anatomy: `part="base"` `<nav>` with the `header`, `list`, and `footer` regions of the
 * `side-nav` recipe (classes `root`, `header`, `content`, `footer`). Entries render as native
 * links, buttons for actions, and disclosure buttons with nested lists for groups. Item
 * templates run outside the render's tracking, so state they show is bound as readables:
 * changing `current` or expansion updates those attributes only.
 */
export const sideNavTemplate = (nav: OddkinSideNav) => {
  const items = nav.items;
  const kinds = nav.kinds;
  return html`<nav part="base" class="root" aria-label=${nav.label || null}>
    <div part="header" class="header" ?hidden=${!nav._hasHeader.value}>
      <slot name="header" @slotchange=${nav._onSlotChange}></slot>
    </div>
    ${
      items
        ? html`<ul part="list" class="content">
            ${entries(nav, kinds, items)}
          </ul>`
        : html`<div part="list" class="content">
            <slot @slotchange=${nav._onSlotChange}></slot>
          </div>`
    }
    <div part="footer" class="footer" ?hidden=${!nav._hasFooter.value}>
      <slot name="footer" @slotchange=${nav._onSlotChange}></slot>
    </div>
  </nav>`;
};

// Entries of project kinds are keyed with their registry, so assigning new `kinds` renders them
// again while built-in entries keep their nodes.
const generations = new WeakMap<NavigationKinds, number>();
let lastGeneration = 0;
const keyOf = (kinds: NavigationKinds, item: NavigationEntry) => {
  if (!kinds.get(item.kind)) return item.id;
  let generation = generations.get(kinds);
  if (generation === undefined) generations.set(kinds, (generation = ++lastGeneration));
  return `${item.id}\u0000${generation}`;
};

const entries = (
  nav: OddkinSideNav,
  kinds: NavigationKinds,
  items: readonly NavigationEntry[],
  depth = 0,
): unknown =>
  repeat(
    items,
    (item) => keyOf(kinds, item),
    (item) => html`<li class="item">${entry(nav, kinds, item, depth)}</li>`,
  );

// A readable, so a renderer's reads (caller signals, `current`) update only this label.
const label = (nav: OddkinSideNav, item: NavigationEntry, depth: number, kind?: NavigationKind) =>
  computed(() => {
    const context = { current: item.id === nav.current, depth };
    if (kind) return kind.render(item as CustomNavigationItem, context);
    const render = nav.renderLabel;
    return render ? render(item as NavigationItem, context) : item.label;
  });
const text = (value: unknown) => (typeof value === 'string' ? value : null);

type LinkEntry = Extract<NavigationItem, { kind: 'link' }> | CustomNavigationItem;
type ActionEntry = Extract<NavigationItem, { kind: 'action' }> | CustomNavigationItem;

const link = (nav: OddkinSideNav, item: LinkEntry, content: unknown) => {
  const target = text(item.target);
  return html`<a
    part="link"
    class="entry"
    href=${nav._href(item)}
    target=${target}
    rel=${text(item.rel) ?? (target === '_blank' ? 'noopener noreferrer' : null)}
    aria-current=${computed(() => (item.id === nav.current ? 'page' : null))}
    aria-disabled=${item.disabled ? 'true' : null}
    role=${item.disabled ? 'link' : null}
    ><span class="label">${content}</span>${
      text(item.badge) ? html`<span part="badge" class="badge">${item.badge}</span>` : null
    }</a
  >`;
};

const action = (nav: OddkinSideNav, item: ActionEntry, content: unknown) =>
  html`<button
    part="action"
    class="entry"
    type="button"
    ?disabled=${!!item.disabled}
    @click=${() => nav._action(item)}
  >
    <span class="label">${content}</span>
  </button>`;

function entry(
  nav: OddkinSideNav,
  kinds: NavigationKinds,
  item: NavigationEntry,
  depth: number,
): unknown {
  switch (item.kind) {
    case 'link':
      return link(nav, item, label(nav, item, depth));
    case 'action':
      return action(nav, item, label(nav, item, depth));
    case 'group': {
      const open = computed(() => nav._isExpanded(item));
      const id = nav._groupId(item.id);
      return html`<button
          part="group-toggle"
          class="entry toggle"
          type="button"
          aria-expanded=${computed(() => (open.value ? 'true' : 'false'))}
          aria-controls=${id}
          @click=${() => nav._toggle(item)}
        >
          <span class="label">${label(nav, item, depth)}</span
          ><span class="chevron" aria-hidden="true"></span>
        </button>
        <ul part="group" class="group-items" id=${id} ?hidden=${computed(() => !open.value)}>
          ${entries(nav, kinds, item.items as readonly NavigationEntry[], depth + 1)}
        </ul>`;
    }
  }
  // A project kind reuses the link or action wrapper with its own label content.
  const kind = kinds.get(item.kind);
  if (!kind) {
    nav._unknownKind(item.kind);
    return null;
  }
  const content = label(nav, item, depth, kind);
  return kind.semantics === 'link' ? link(nav, item, content) : action(nav, item, content);
}
