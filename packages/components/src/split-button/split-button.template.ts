import { html } from '@oddkin/core/template';
import type { OddkinSplitButton } from './split-button.js';

/**
 * Anatomy: the `primary` part (a native `<button>` with the button look, the default slot, and the
 * `spinner` part while loading) and an `odd-menu` with a glyph-only trigger named by
 * `strings.more`, whose `trigger`, `menu`, `submenu`, `item`, `group`, and `separator` parts it
 * forwards (`exportparts`).
 * The menu's `odd-action` events cross this shadow root as they are.
 */
export const splitButtonTemplate = (split: OddkinSplitButton) =>
  html`<button
      part="primary"
      class="odd-button"
      type="button"
      data-appearance=${split.appearance}
      data-size=${split.size}
      ?disabled=${split.disabled}
      aria-disabled=${split.loading ? 'true' : null}
      @click=${split._onPrimaryClick}
    >
      <span part="spinner" class="spinner" aria-hidden="true" ?hidden=${!split.loading}></span>
      <slot></slot>
    </button>
    <odd-menu
      exportparts="trigger, menu, submenu, item, group, separator"
      label=${split._moreLabel}
      appearance=${split.appearance}
      size=${split.size}
      ?disabled=${split.disabled}
      .items=${split._items.value}
    ></odd-menu>`;
