import { html, nothing, type TemplateResult } from '@oddkin/core/template';
import type { MenuActionRecord, MenuItemRecord } from '../collection/collection.js';
import { chevronDownGlyph, chevronEndGlyph } from '../styles/glyphs.js';
import type { OddkinMenu } from './menu.js';

/**
 * Anatomy: the `trigger` part (a native `<button>` with the button look, `aria-haspopup="menu"`,
 * `aria-expanded`, and `aria-controls`; the default slot and a chevron), an empty `point` the menu
 * opens against as a context menu, and the `menu` part (a `role="menu"` popover labelled by the
 * trigger). Entries render in order: an action is a
 * `menuitem` (`part="item"`, option-row anatomy: icon, label with description, shortcut), a group
 * is a `role="group"` named by its `part="group"` heading, and a separator is
 * `role="separator"`. An action with `items` is wrapped with its submenu (`role="none"`): the item
 * has `aria-haspopup`, `aria-expanded`, and `aria-controls`, and the submenu is a nested
 * `role="menu"` popover labelled by the item. Ids and `data-path` follow each entry's path.
 */
export const menuTemplate = (menu: OddkinMenu) => {
  const open = menu._openSubmenus.value;
  const action = (record: MenuActionRecord, path: string) =>
    html`<div
      role="menuitem"
      part="item"
      class=${record.tone === 'danger' ? 'option danger' : 'option'}
      id=${`item-${path}`}
      data-path=${path}
      aria-disabled=${record.disabled ? 'true' : null}
      aria-haspopup=${record.items ? 'menu' : null}
      aria-expanded=${record.items ? String(open.has(path)) : null}
      aria-controls=${record.items ? `menu-${path}` : null}
    >
      ${
        record.icon
          ? html`<span class="option-start"
              ><odd-icon src=${record.icon} size="sm"></odd-icon
            ></span>`
          : nothing
      }<span class="option-label"
        ><span class="option-text">${record.label}</span>${
          record.description
            ? html`<span class="option-description">${record.description}</span>`
            : nothing
        }</span
      >${record.shortcut ? html`<span class="option-end">${record.shortcut}</span>` : nothing}${
        record.items ? html`<span class="option-end">${chevronEndGlyph}</span>` : nothing
      }
    </div>`;
  const entries = (list: readonly MenuItemRecord[], parent: string): TemplateResult[] =>
    list.map((entry, index) => {
      const path = parent ? `${parent}-${index}` : String(index);
      if (entry.kind === 'separator')
        return html`<div role="separator" part="separator" class="separator"></div>`;
      if (entry.kind === 'group')
        return html`<div role="group" class="group" aria-labelledby=${`group-${path}`}>
          <div part="group" id=${`group-${path}`} class="group-label">${entry.label}</div>
          ${entries(entry.items, path)}
        </div>`;
      if (!entry.items) return action(entry, path);
      return html`<div role="none" class="submenu">
        ${action(entry, path)}
        <div
          role="menu"
          part="menu submenu"
          class="overlay-surface menu"
          id=${`menu-${path}`}
          popover="auto"
          aria-labelledby=${`item-${path}`}
        >
          ${entries(entry.items, path)}
        </div>
      </div>`;
    });
  return html`<button
      part="trigger"
      id="trigger"
      class="odd-button"
      type="button"
      data-appearance=${menu.appearance}
      data-size=${menu.size}
      ?disabled=${menu.disabled}
      aria-haspopup="menu"
      aria-expanded=${String(menu._open.value)}
      aria-controls="menu"
      aria-label=${menu.label || null}
      @click=${menu._onTriggerClick}
      @keydown=${menu._onTriggerKeydown}
    >
      <slot></slot><span class="trigger-glyph">${chevronDownGlyph}</span>
    </button>
    <span id="point" class="point"></span>
    <div
      part="menu"
      id="menu"
      class="overlay-surface menu"
      role="menu"
      aria-labelledby="trigger"
      @click=${menu._onMenuClick}
      @keydown=${menu._onMenuKeydown}
    >
      ${entries(menu._items.value, '')}
    </div>`;
};
