import { computed } from '@oddkin/core/reactive';
import { html, repeat } from '@oddkin/core/template';
import type { NavigationItem } from '../models/navigation.js';
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
  return html`<nav part="base" class="root" aria-label=${nav.label || null}>
    <div part="header" class="header" ?hidden=${!nav._hasHeader.value}>
      <slot name="header" @slotchange=${nav._onSlotChange}></slot>
    </div>
    ${
      items
        ? html`<ul part="list" class="content">
            ${entries(nav, items)}
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

const entries = (nav: OddkinSideNav, items: readonly NavigationItem[]): unknown =>
  repeat(
    items,
    (item) => item.id,
    (item) => html`<li class="item">${entry(nav, item)}</li>`,
  );

function entry(nav: OddkinSideNav, item: NavigationItem): unknown {
  switch (item.kind) {
    case 'link':
      return html`<a
        part="link"
        class="entry"
        href=${nav._href(item)}
        target=${item.target ?? null}
        rel=${item.rel ?? (item.target === '_blank' ? 'noopener noreferrer' : null)}
        aria-current=${computed(() => (item.id === nav.current ? 'page' : null))}
        aria-disabled=${item.disabled ? 'true' : null}
        role=${item.disabled ? 'link' : null}
        ><span class="label">${item.label}</span>${
          item.badge ? html`<span part="badge" class="badge">${item.badge}</span>` : null
        }</a
      >`;
    case 'action':
      return html`<button
        part="action"
        class="entry"
        type="button"
        ?disabled=${!!item.disabled}
        @click=${() => nav._action(item)}
      >
        <span class="label">${item.label}</span>
      </button>`;
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
          <span class="label">${item.label}</span><span class="chevron" aria-hidden="true"></span>
        </button>
        <ul part="group" class="group-items" id=${id} ?hidden=${computed(() => !open.value)}>
          ${entries(nav, item.items)}
        </ul>`;
    }
  }
}
