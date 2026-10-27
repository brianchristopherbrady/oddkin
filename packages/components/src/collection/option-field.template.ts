import { html, nothing, repeat, type TemplateResult } from '@oddkin/core/template';
import {
  checkGlyph,
  chevronDownGlyph,
  chevronUpGlyph,
  closeGlyph,
  minusGlyph,
  userGlyph,
} from '../styles/glyphs.js';
import type { OptionRecord } from './collection.js';
import type { OddkinOptionField } from './option-field.js';

/** Rows the popup review shows before View N more (Figma's Inline selection panel). */
export const REVIEW_ROWS = 3;

/** One chosen value as a chip (`part="chip"`), with its remove button unless `readonly`. */
const chip = (
  field: OddkinOptionField,
  value: string,
  shown: boolean,
  readonly: boolean,
  disabled: boolean,
) => {
  const label = field._labelOf(value);
  return html`<span role="listitem" part="chip" class=${shown ? 'chip item' : 'chip item overflow'}
    ><span class="chip-text">${label}</span>${
      readonly
        ? nothing
        : html`<button
            part="chip-remove"
            class="remove"
            type="button"
            tabindex="-1"
            aria-label=${field._removeLabel(label)}
            ?disabled=${disabled}
            @click=${() => field._onChipRemove(value)}
            @keydown=${(event: KeyboardEvent) => field._onChipKeydown(event, value)}
          >
            ${closeGlyph}
          </button>`
    }</span
  >`;
};

/** The "+N" item (`part="more"`) for the items that do not fit while collapsed. */
const more = (field: OddkinOptionField, hidden: number, collapsed: boolean, words = false) =>
  html`<span
    role="listitem"
    part="more"
    class=${hidden ? 'chip more' : 'chip more empty'}
    ?hidden=${!collapsed}
    >${
      words
        ? html`+${field._moreLabel(hidden)}`
        : html`<span aria-hidden="true">+${hidden}</span
            ><span class="visually-hidden">${field._moreLabel(hidden)}</span>`
    }</span
  >`;

/**
 * The chosen values of a multiple option field as chips (chip module; component-contracts.md
 * §3.3): a list named by `strings.selected` of `part="chip"` items, each with a
 * `part="chip-remove"` button unless `readonly`, and the `part="more"` count ("+N", read as
 * `strings.more`) that stands for the chips that do not fit while collapsed (two rows of chips and
 * "+N more" with `view="expandable"`).
 */
export const chipsTemplate = (field: OddkinOptionField, readonly: boolean, disabled: boolean) => {
  const selected = field._selected.value;
  const collapsed = field._collapsed.value;
  const shown = collapsed ? field._shown.value : Number.POSITIVE_INFINITY;
  const hidden = Math.max(0, selected.length - shown);
  return html`<span class="chips" role="list" aria-label=${field._strings.selected}
    >${repeat(
      selected,
      (value) => value,
      (value, index) => chip(field, value, index < shown, readonly, disabled),
    )}${more(field, hidden, collapsed, field._view.value === 'expandable')}</span
  >`;
};

/**
 * The chosen values as a multiple option field's `view` shows them in the field box: chips (also
 * `auto` up to four values, and `expandable`), the count after the user glyph or a sentence
 * (`part="value"`), initials (`part="avatar"` items and "+N"), or a chip per option group
 * ("Design · 12", or the total when they do not fit). Nothing while no value is chosen.
 */
export const valueTemplate = (field: OddkinOptionField, readonly: boolean, disabled: boolean) => {
  const selected = field._selected.value;
  if (!selected.length) return nothing;
  const strings = field._strings;
  switch (field._view.value) {
    case 'count':
      return html`<span part="value" class="value count"
        >${userGlyph}<span class="value-text">${field._countText}</span></span
      >`;
    case 'text':
      return html`<span part="value" class="value">${field._sentence}</span>`;
    case 'avatars': {
      const shown = field._shown.value;
      const hidden = Math.max(0, selected.length - shown);
      return html`<span class="avatars" role="list" aria-label=${strings.selected}
        >${repeat(
          selected,
          (value) => value,
          (value, index) => {
            const label = field._labelOf(value);
            return html`<span
              role="listitem"
              class=${index < shown ? 'avatar item' : 'avatar item overflow'}
              ><odd-avatar part="avatar" label=${label}></odd-avatar
            ></span>`;
          },
        )}${more(field, hidden, true)}</span
      >`;
    }
    case 'grouped': {
      const groups = field._groups;
      const fits = field._shown.value >= groups.length;
      return html`<span class="chips" role="list" aria-label=${strings.selected}
        >${repeat(
          groups,
          (group) => group.label,
          (group) =>
            html`<span
              role="listitem"
              part="group-summary"
              class=${fits ? 'chip tag item' : 'chip tag item overflow'}
              >${field._format(strings.group, { group: group.label, count: group.count })}</span
            >`,
        )}<span role="listitem" part="more" class="chip more" ?hidden=${fits}
          >${field._format(strings.total, { count: selected.length })}</span
        ></span
      >`;
    }
    default:
      return chipsTemplate(field, readonly, disabled);
  }
};

/**
 * Below the field with `view="expandable"`: Show all (`part="show-all"`, a disclosure for the
 * review) and the review of every chosen value (`part="review"`: the count and every chip, each
 * removable, in a bounded area that scrolls).
 */
export const reviewTemplate = (field: OddkinOptionField, readonly: boolean, disabled: boolean) => {
  const selected = field._selected.value;
  if (field._view.value !== 'expandable' || !selected.length) return nothing;
  const reviewing = field._reviewing.value;
  const strings = field._strings;
  return html`<div class="review-bar">
      <button
        part="show-all"
        class="odd-button show-all"
        type="button"
        data-appearance="ghost"
        data-size="sm"
        aria-expanded=${String(reviewing)}
        aria-controls="review"
        @click=${field._onReview}
      >
        ${reviewing ? strings.showLess : strings.showAll}
      </button>
    </div>
    <div part="review" id="review" class="review panel" ?hidden=${!reviewing}>
      <span class="review-count">${field._countText}</span>
      <span class="chips" role="list" aria-label=${strings.selected}
        >${repeat(
          reviewing ? selected : [],
          (value) => value,
          (value) => chip(field, value, true, readonly, disabled),
        )}</span
      >
    </div>`;
};

/**
 * The top of a multiple field's popup (Figma `multiselect/SelectionPanel`), each part opt-in:
 * - `summary`: the count (`part="summary"`) and Clear all (`part="clear-all"`), for a popup
 *   without a footer that has them;
 * - `review`: the chosen values (`part="selected"`): the disclosure "Selected (N)"
 *   (`part="selected-toggle"`), the first three as rows (`part="selected-option"`), each with a
 *   remove button (`part="selected-remove"`) unless read-only, and View N more
 *   (`part="view-more"`, Show less once open);
 * - `selectAll`: the Select all check box (`part="select-all"`, mixed while some are chosen) over
 *   `options`, the usable options shown.
 */
export const selectionTemplate = (
  field: OddkinOptionField,
  options: readonly OptionRecord[],
  summary: boolean,
) => {
  if (!field.multiple || !(field.review || field.selectAll)) return nothing;
  const selected = field._selected.value;
  const strings = field._strings;
  const editable = field._changeable;
  const head = summary
    ? html`<div class="selection-summary spread">
        <span part="summary" class="summary">${field._countText}</span>
        <button
          part="clear-all"
          class="odd-button"
          type="button"
          data-appearance="ghost"
          data-size="sm"
          ?disabled=${!editable || !selected.length}
          @click=${field._onClear}
        >
          ${strings.clearAll}
        </button>
      </div>`
    : nothing;
  let review: TemplateResult | typeof nothing = nothing;
  if (field.review && selected.length) {
    const open = field._reviewOpen.value;
    const all = field._reviewAll.value;
    const shown = all ? selected : selected.slice(0, REVIEW_ROWS);
    const hidden = selected.length - REVIEW_ROWS;
    review = html`<div part="selected" class="selected-section">
      <button
        part="selected-toggle"
        class="selected-toggle spread"
        type="button"
        aria-expanded=${String(open)}
        aria-controls="selected-list"
        @click=${field._onReviewToggle}
      >
        <span class="selected-heading"
          >${field._format(strings.selectedCount, { count: selected.length })}</span
        ><span class="chevron" aria-hidden="true">${open ? chevronUpGlyph : chevronDownGlyph}</span>
      </button>
      <div
        id="selected-list"
        class=${all ? 'selected-list all' : 'selected-list'}
        role="list"
        aria-label=${strings.selected}
        ?hidden=${!open}
      >
        ${repeat(
          shown,
          (value) => value,
          (value) => {
            const label = field._labelOf(value);
            return html`<div role="listitem" part="selected-option" class="selected-option spread">
              <span class="option-label">${label}</span>${
                editable
                  ? html`<button
                      part="selected-remove"
                      class="remove"
                      type="button"
                      aria-label=${field._removeLabel(label)}
                      @click=${(event: Event) => field._onReviewRemove(event, value)}
                    >
                      ${closeGlyph}
                    </button>`
                  : nothing
              }
            </div>`;
          },
        )}
      </div>
      ${
        hidden > 0 && open
          ? html`<button
              part="view-more"
              class="view-more"
              type="button"
              aria-expanded=${String(all)}
              aria-controls="selected-list"
              @click=${field._onViewMore}
            >
              ${all ? strings.showLess : field._format(strings.viewMore, { count: hidden })}
            </button>`
          : nothing
      }
    </div>`;
  }
  let selectAll: TemplateResult | typeof nothing = nothing;
  const usable = options.filter((option) => !option.disabled);
  if (field.selectAll && usable.length) {
    const chosen = usable.filter((option) => selected.includes(option.value)).length;
    const state = !chosen ? null : chosen === usable.length ? 'checked' : 'mixed';
    selectAll = html`<button
      part="select-all"
      class="option select-all"
      type="button"
      role="checkbox"
      aria-checked=${state === 'checked' ? 'true' : state === 'mixed' ? 'mixed' : 'false'}
      ?disabled=${!editable}
      @click=${() => field._selectAll(options)}
    >
      <span class="option-start indicator" aria-hidden="true"
        ><span class="indicator-box" data-state=${state}></span
        ><span class="indicator-mark indicator-check">${checkGlyph}</span
        ><span class="indicator-mark indicator-mixed">${minusGlyph}</span></span
      ><span class="option-label"
        >${field._format(strings.selectAll, { count: usable.length })}</span
      >
    </button>`;
  }
  const panel =
    head === nothing && review === nothing
      ? nothing
      : html`<div class="selection panel">${head}${review}</div>`;
  return html`${panel}${selectAll}`;
};

/**
 * The end of the field box: the clear button (`part="clear"`, shown while there is a value the
 * user may clear; out of the Tab order, as the keyboard clears otherwise) and an optional chevron.
 */
export const fieldEndTemplate = (field: OddkinOptionField, chevron?: TemplateResult) =>
  html`<span class="control-end">
    <button
      part="clear"
      class="clear"
      type="button"
      tabindex="-1"
      aria-label=${field._strings.clear}
      ?hidden=${!field._clearable}
      @click=${field._onClear}
    >
      ${closeGlyph}</button
    >${chevron ? html`<span class="chevron" aria-hidden="true">${chevron}</span>` : nothing}
  </span>`;
