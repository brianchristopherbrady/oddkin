import { live } from '@oddkin/core/helpers/live';
import { html, nothing, repeat } from '@oddkin/core/template';
import { groupsOf, type CommandRecord, type OptionRow } from '../collection/collection.js';
import { searchGlyph } from '../styles/glyphs.js';
import { spinnerTemplate } from '../styles/spinner.styles.js';
import type { OddkinCommandPalette } from './command-palette.js';

/**
 * Anatomy: a modal `<dialog part="dialog">` (the overlay surface's sheet) named by `label`, holding
 * the search field (`part="search"`: a search glyph, the `role="combobox"` input `part="input"`, and
 * an Esc hint), the results (the `role="listbox"` with command rows from the option-row module,
 * grouped under `part="group"` headings; each row an icon, the label with its description, and the
 * shortcut), the busy row, the empty state, the `status` slot, and the keyboard hints
 * (`part="footer"`). Rows are keyed by id, so the active row stays the same element while the
 * search changes.
 */
export const commandPaletteTemplate = (palette: OddkinCommandPalette) => {
  const items = palette._shown.value;
  const active = palette._activeIndex.value;
  const strings = palette._strings;
  const rows = (each: readonly OptionRow<CommandRecord>[]) =>
    repeat(
      each,
      ({ option }) => option.id,
      ({ option, index }) =>
        html`<div
          role="option"
          part="item"
          class=${index === active ? 'option active' : 'option'}
          aria-selected=${index === active ? 'true' : 'false'}
          aria-disabled=${option.disabled ? 'true' : null}
        >
          ${
            option.icon
              ? html`<span class="option-start"
                  ><odd-icon src=${option.icon} size="sm"></odd-icon
                ></span>`
              : nothing
          }<span class="option-label"
            ><span class="option-text">${option.label}</span>${
              option.description
                ? html`<span class="option-description">${option.description}</span>`
                : nothing
            }</span
          >${option.shortcut ? html`<kbd class="option-end shortcut">${option.shortcut}</kbd>` : nothing}
        </div>`,
    );
  return html`<dialog
    part="dialog"
    class="overlay-surface sheet palette"
    aria-label=${palette.label}
  >
    <div part="search" class="search">
      <span class="search-glyph" aria-hidden="true">${searchGlyph}</span>
      <input
        part="input"
        class="input"
        type="text"
        role="combobox"
        autocomplete="off"
        inputmode=${palette._hints.get('inputmode')}
        enterkeyhint=${palette._hints.get('enterkeyhint')}
        autocapitalize=${palette._hints.get('autocapitalize')}
        autocorrect=${palette._hints.get('autocorrect')}
        spellcheck=${palette._hints.get('spellcheck', 'false')}
        aria-label=${strings.search}
        aria-expanded="true"
        aria-controls="results"
        aria-autocomplete="list"
        placeholder=${palette.placeholder || null}
        .value=${live(palette.query)}
        @input=${palette._onInput}
        @keydown=${palette._onKeydown}
      />
      <kbd class="hint" aria-hidden="true">Esc</kbd>
    </div>
    <div
      class="results"
      @pointerdown=${palette._onResultsPointerdown}
      @click=${palette._onResultsClick}
    >
      <div
        part="listbox"
        id="results"
        class="listbox"
        role="listbox"
        aria-label=${palette.label}
        aria-busy=${palette.loading ? 'true' : null}
        ?hidden=${!items.length}
      >
        ${repeat(
          groupsOf(items),
          (group, n) =>
            group.label === undefined ? `item ${group.rows[0]!.option.id}` : `group ${n}`,
          (group, n) =>
            group.label === undefined
              ? rows(group.rows)
              : html`<div role="group" class="group" aria-labelledby=${`group-${n}`}>
                  <div part="group" id=${`group-${n}`} class="group-label">${group.label}</div>
                  ${rows(group.rows)}
                </div>`,
        )}
      </div>
      <div part="loading" class="state" ?hidden=${!palette.loading}>
        ${spinnerTemplate}${strings.loading}
      </div>
      <div part="empty" class="state empty" ?hidden=${items.length > 0 || palette.loading}>
        <slot name="empty">${strings.empty}</slot>
      </div>
      <slot name="status"></slot>
    </div>
    <div part="footer" class="footer">
      <span><kbd aria-hidden="true">↑ ↓</kbd> ${strings.navigate}</span>
      <span><kbd aria-hidden="true">↵</kbd> ${strings.choose}</span>
      <span><kbd aria-hidden="true">Esc</kbd> ${strings.close}</span>
    </div>
  </dialog>`;
};
