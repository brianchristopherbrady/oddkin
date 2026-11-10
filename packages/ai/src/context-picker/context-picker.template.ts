import { checkGlyph, fileGlyph, plusGlyph, searchGlyph } from '@oddkin/components/styles';
import { html, nothing, repeat } from '@oddkin/core/template';
import type { ContextResource } from '../contracts/types.js';
import { format, formatNumber, langOf } from '../internal/strings.js';
import { resourceKey, type OddkinContextPicker } from './context-picker.js';

/** The label with the query's first match marked. */
const highlighted = (label: string, query: string) => {
  const at = query ? label.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
  if (at < 0) return label;
  return html`${label.slice(0, at)}<mark class="match">${label.slice(at, at + query.length)}</mark
    >${label.slice(at + query.length)}`;
};

/**
 * Anatomy: the `trigger`; the `surface` (title and Close, `search`, the scope and Selected, the
 * status line, the `results` listbox or a feedback block, the `footer`); two live regions.
 */
export const contextPickerTemplate = (host: OddkinContextPicker) => {
  const t = host._strings;
  const lang = langOf(host);
  const n = (value: number) => formatNumber(value, lang);
  const query = host._query.value;
  const reviewing = host._view.value === 'selected';
  const chosen = host._chosen.value;
  const keys = host._keys.value;
  const shown = host._shown.value;
  const loading = host._loading.value;
  const scopeIds = host._scopeIds();
  const states = shown?.sources ?? [];
  const failed = states.filter((s) => s.status === 'failed');
  const allFailed = !!shown && !loading && failed.length > 0 && failed.length === states.length;
  const items: readonly ContextResource[] = reviewing
    ? chosen
    : allFailed
      ? []
      : (shown?.items ?? []);
  const sources = host._sourcesText(scopeIds);
  const confirm = host.commit === 'confirm';
  const count = n(chosen.length);

  const status = reviewing
    ? format(t.review, { count })
    : allFailed
      ? format(t.failedStatus, { sources: host._sourcesText(failed.map((s) => s.sourceId)) })
      : loading
        ? shown
          ? format(t.searching, { sources })
          : format(t.loading, { sources: format(t.connected, { count: n(scopeIds.length) }) })
        : failed.length
          ? format(t.partial, {
              failed: host._sourcesText(failed.map((s) => s.sourceId)),
              searched: n(states.length - failed.length),
              total: n(states.length),
            })
          : host.multiple && host._atLimit.value
            ? format(t.limit, { count, max: n(host.max) })
            : query
              ? shown?.items.length
                ? format(t.matches, { count: n(shown.total ?? shown.items.length), sources })
                : format(t.noMatchesStatus, { sources })
              : confirm
                ? format(t.confirmHint, { count })
                : !host.multiple
                  ? t.singleHint
                  : format(t.recent, {
                      sources: format(t.connected, { count: n(scopeIds.length) }),
                    });

  const feedback = reviewing
    ? chosen.length
      ? nothing
      : html`<p class="feedback-text">${t.noneSelected}</p>`
    : allFailed
      ? html`<p class="feedback-title danger">
            ${format(t.failed, { sources: host._sourcesText(failed.map((s) => s.sourceId)) })}
          </p>
          <p class="feedback-text">${t.failedText}</p>
          <button class="odd-button" data-size="sm" type="button" @click=${host._onRetry}>
            ${t.retry}
          </button>`
      : loading && !shown
        ? html`<p class="feedback-title">${t.loadingTitle}</p>
            <p class="feedback-text">${format(t.loadingText, { sources })}</p>
            <span class="placeholder" aria-hidden="true"></span>
            <span class="placeholder" aria-hidden="true"></span>
            <span class="placeholder" aria-hidden="true"></span>`
        : shown && !loading && !shown.items.length
          ? query
            ? html`<p class="feedback-title">${format(t.noMatches, { sources })}</p>
                <p class="feedback-text">${t.noMatchesText}</p>
                <button class="odd-button" data-size="sm" type="button" @click=${host._onClear}>
                  ${t.clearSearch}
                </button>`
            : html`<p class="feedback-title">${t.empty}</p>
                <p class="feedback-text">${t.emptyText}</p>`
          : nothing;

  return html`<button
      part="trigger"
      class="odd-button trigger"
      data-size="md"
      type="button"
      aria-haspopup="dialog"
      aria-expanded=${host.open ? 'true' : 'false'}
      aria-controls="surface"
      ?disabled=${host.disabled}
      @click=${host._onTrigger}
    >
      ${plusGlyph}<span>${host.label || t.add}</span>
    </button>
    <div
      part="surface"
      id="surface"
      class="overlay-surface surface"
      popover="auto"
      role="dialog"
      aria-labelledby="title"
      @keydown=${host._onSurfaceKey}
      @focusout=${host._onFocusOut}
      @toggle=${host._onSurfaceToggle}
    >
      <div class="header">
        <h2 id="title" class="title">${reviewing ? t.selectedTitle : t.title}</h2>
        <button
          class="odd-button close"
          data-size="sm"
          data-appearance="ghost"
          type="button"
          @click=${host._onClose}
        >
          ${t.close}
        </button>
      </div>
      <div class="control-box search-field">
        <span class="control-start" aria-hidden="true">${searchGlyph}</span>
        <input
          part="search"
          class="control search"
          type="search"
          autocomplete="off"
          placeholder=${t.search}
          aria-label=${t.search}
          aria-controls="results"
          .value=${query}
          @input=${host._onInput}
          @keydown=${host._onSearchKey}
        />
      </div>
      <div class="scope-row">
        ${
          host.sources.length > 1
            ? html`<span class="control-box"
                ><select class="control scope" aria-label=${t.scope} @change=${host._onScope}>
                  <option value="" ?selected=${!host._scope.value}>${t.allSources}</option>
                  ${host.sources.map(
                    (s) =>
                      html`<option .value=${s.id} ?selected=${host._scope.value === s.id}>
                        ${s.label}
                      </option>`,
                  )}
                </select></span
              >`
            : nothing
        }
        <button
          class="odd-button"
          data-size="sm"
          data-appearance="ghost"
          type="button"
          aria-pressed=${reviewing ? 'true' : 'false'}
          @click=${host._onSelectedView}
        >
          ${format(t.selected, { count })}
        </button>
      </div>
      <p id="status" class=${`status-line${allFailed || failed.length ? ' danger' : ''}`}>
        ${status}
      </p>
      <div
        part="results"
        id="results"
        class="results"
        role="listbox"
        tabindex="0"
        aria-labelledby="title"
        aria-describedby="status"
        aria-multiselectable=${host.multiple ? 'true' : 'false'}
        aria-busy=${loading ? 'true' : 'false'}
        ?hidden=${!items.length}
        @keydown=${host._onResultsKey}
        @focus=${host._onResultsFocus}
      >
        ${repeat(
          items,
          (r) => resourceKey(r),
          (r, index) => {
            const isChosen = keys.has(resourceKey(r));
            const blocked = host._blocked(r);
            const meta = [host._sourceLabel(r.sourceId), r.path, blocked || r.description]
              .filter(Boolean)
              .join(' · ');
            return html`<div
              part="option"
              class=${`option${index === host._active.value ? ' active' : ''}`}
              role="option"
              data-key=${resourceKey(r)}
              aria-selected=${isChosen ? 'true' : 'false'}
              aria-disabled=${blocked ? 'true' : 'false'}
              aria-label=${`${r.label}, ${r.type}, ${host._sourceLabel(r.sourceId)}`}
              aria-description=${meta}
              @click=${host._onOptionClick}
            >
              <span class=${`option-start indicator${host.multiple ? '' : ' radio'}`}
                ><span class="indicator-box" data-state=${isChosen ? 'checked' : null}></span>${
                  host.multiple
                    ? html`<span class="indicator-mark indicator-check">${checkGlyph}</span>`
                    : html`<span class="indicator-mark indicator-dot"></span>`
                }</span
              >
              <span class="option-icon" aria-hidden="true">${fileGlyph}</span>
              <span class="option-label">
                <span class="name">${highlighted(r.label, reviewing ? '' : query)}</span>
                <span class="option-description">${meta}</span>
              </span>
            </div>`;
          },
        )}
      </div>
      <div class="feedback" ?hidden=${feedback === nothing}>${feedback}</div>
      <div part="footer" class="footer">
        <span class="count">${format(t.count, { count })}</span>
        <slot name="actions"></slot>
        ${
          confirm
            ? html`<button class="odd-button" data-size="sm" type="button" @click=${host._onCancel}>
                  ${t.cancel}
                </button>
                <button
                  class="odd-button"
                  data-size="sm"
                  data-appearance="primary"
                  type="button"
                  @click=${host._onApply}
                >
                  ${format(t.apply, { count })}
                </button>`
            : html`<button class="odd-button" data-size="sm" type="button" @click=${host._onDone}>
                ${t.done}
              </button>`
        }
      </div>
    </div>
    <div class="visually-hidden live-polite" aria-live="polite" aria-atomic="true"></div>
    <div class="visually-hidden live-assertive" aria-live="assertive" aria-atomic="true"></div>`;
};
