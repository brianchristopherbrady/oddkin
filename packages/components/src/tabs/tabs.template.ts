import { html } from '@oddkin/core/template';
import type { OddkinTabs } from './tabs.js';

/**
 * Anatomy: `part="base"` with the `list` of `tab` buttons and one `panel` per `odd-tab-panel`
 * child, each holding a slot the element assigns that panel to.
 */
export const tabsTemplate = (tabs: OddkinTabs) => {
  const panels = tabs._panels.value;
  const selected = tabs._selected.value;
  const active = tabs._active.value;
  return html`<div part="base" class="tabs">
    <div
      part="list"
      class="list"
      role="tablist"
      aria-label=${tabs.label || null}
      aria-orientation=${tabs.orientation}
    >
      ${panels.map(
        (panel, i) =>
          html`<button
            part="tab"
            class="tab"
            type="button"
            role="tab"
            id=${`tab-${i}`}
            aria-selected=${i === selected ? 'true' : 'false'}
            aria-controls=${`panel-${i}`}
            tabindex=${i === active ? '0' : '-1'}
            ?disabled=${panel.disabled}
            @click=${() => tabs._select(i)}
            @focus=${() => tabs._onTabFocus(i)}
          >
            ${panel.label}
          </button>`,
      )}
    </div>
    <div class="panels">
      ${panels.map(
        (_panel, i) =>
          html`<div
            part="panel"
            class="panel"
            role="tabpanel"
            id=${`panel-${i}`}
            aria-labelledby=${`tab-${i}`}
            tabindex="0"
            ?hidden=${i !== selected}
          >
            <slot></slot>
          </div>`,
      )}
    </div>
  </div>`;
};
