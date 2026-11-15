import { checkGlyph, fileGlyph, plusGlyph, searchGlyph } from '@oddkin/components/styles';
import { html, nothing, repeat } from '@oddkin/core/template';
import type { ContextResource } from '../contracts/types.js';
import { format, formatNumber, langOf } from '../internal/strings.js';
import { resourceKey, type OddkinContextPicker } from './context-picker.js';

/**
 * The icon trigger is named by the text its tooltip shows, so the tooltip adds no description:
 * odd-tooltip describes an anchor through this hook when it has one (component-contracts.md §2.4).
 */
const noDescription = () => {};

/** The label with the query's first match marked. */
const highlighted = (label: string, query: string) => {
  const at = query ? label.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
  if (at < 0) return label;
  return html`${label.slice(0, at)}<mark class="match">${label.slice(at, at + query.length)}</mark
    >${label.slice(at + query.length)}`;
};

/**
 * Anatomy: the `trigger` (with its tooltip in the icon form); the `surface` (title and Close,
 * `search`, the scope and Selected, the status line, the collection that scrolls: `browse`, the
 * `results` listbox, Load more, a retry or feedback block; the `footer`); two live regions.
 */
export const contextPickerTemplate = (host: OddkinContextPicker) => {
  const t = host._strings;
  const lang = langOf(host);
  const n = (value: number) => formatNumber(value, lang);
  const name = host.label || t.add;
  const iconTrigger = host.trigger === 'icon';
  const sheet = host._presentation.value === 'sheet';
  const icons = host.icons;
  const query = host._query.value;
  const reviewing = host._view.value === 'selected';
  const chosen = host._chosen.value;
  const keys = host._keys.value;
  const active = host._active.value;
  const shown = host._shown.value;
  const loading = host._loading.value;
  const scopeIds = host._scopeIds();
  const states = shown?.sources ?? [];
  const failed = states.filter((s) => s.status === 'failed');
  const allFailed = !!shown && !loading && failed.length > 0 && failed.length === states.length;
  const messages = [...new Set(failed.map((s) => s.error?.message).filter(Boolean))].join(' ');
  const retryable = failed.some((s) => s.error?.retryable !== false);
  const updating = loading && !!shown && !host._paging.value;
  const browse = host._browse.value;
  const browsingRoot = !!browse && !browse.sourceId;
  const partial = !reviewing && !browsingRoot && !loading && !allFailed && failed.length > 0;
  const here = browse?.sourceId ? host._path() : '';
  const browsable = host.sources.filter((s) => s.browse);
  const all: readonly ContextResource[] = reviewing
    ? chosen
    : allFailed || browsingRoot
      ? []
      : (shown?.items ?? []);
  const containers = reviewing ? [] : all.filter((r) => r.container);
  const items = all.filter((r) => !r.container);
  const more = !reviewing && !loading && !browsingRoot && shown?.nextCursor !== undefined;
  const scopeValue = browse?.sourceId ?? host._scope.value;
  const backTo = browse?.sourceId
    ? browse.trail.length > 1
      ? (browse.trail.at(-2) as ContextResource).label
      : browse.trail.length === 1
        ? host._sourceLabel(browse.sourceId)
        : t.sources
    : '';
  const sources = host._sourcesText(scopeIds);
  const confirm = host.commit === 'confirm';
  const count = n(chosen.length);

  const status = reviewing
    ? format(t.review, { count })
    : allFailed
      ? format(t.failedStatus, { sources: host._sourcesText(failed.map((s) => s.sourceId)) })
      : browsingRoot
        ? t.browseRoot
        : loading
          ? shown
            ? format(t.searching, { sources })
            : format(t.loading, { sources: format(t.connected, { count: n(scopeIds.length) }) })
          : partial
            ? format(t.partial, {
                failed: host._sourcesText(failed.map((s) => s.sourceId)),
                searched: n(states.length - failed.length),
                total: n(states.length),
              })
            : host.multiple && host._atLimit.value
              ? format(t.limit, { count, max: n(host.max) })
              : here
                ? format(t.browseIn, { path: here })
                : shown?.nextCursor !== undefined && shown.total === undefined
                  ? format(t.loaded, { count: n(shown.items.length) })
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
    : browsingRoot
      ? nothing
      : allFailed
        ? html`<p class="feedback-title danger">
              ${format(t.failed, { sources: host._sourcesText(failed.map((s) => s.sourceId)) })}
            </p>
            <p class="feedback-text">${messages || t.failedText}</p>
            ${
              retryable
                ? html`<button class="odd-button" type="button" @click=${host._onRetry}>
                    ${t.retry}
                  </button>`
                : nothing
            }`
        : loading && !shown
          ? html`<p class="feedback-title">${t.loadingTitle}</p>
              <p class="feedback-text">${format(t.loadingText, { sources })}</p>
              <span class="placeholder" aria-hidden="true"></span>
              <span class="placeholder" aria-hidden="true"></span>
              <span class="placeholder" aria-hidden="true"></span>`
          : shown && !loading && !all.length
            ? query
              ? html`<p class="feedback-title">${format(t.noMatches, { sources })}</p>
                  <p class="feedback-text">${t.noMatchesText}</p>
                  <button
                    class="odd-button"
                    data-appearance="ghost"
                    type="button"
                    @click=${host._onClear}
                  >
                    ${t.clearSearch}
                  </button>`
              : html`<p class="feedback-title">${t.empty}</p>
                  <p class="feedback-text">${t.emptyText}</p>`
            : nothing;

  const body = html`<div class="content">
    <div class="header">
      <h2 id="title" class="title">${reviewing ? t.selectedTitle : t.title}</h2>
      <button
        class="odd-button close"
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
        type="text"
        role="searchbox"
        enterkeyhint="search"
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
                <option value="" ?selected=${!reviewing && !scopeValue}>${t.allSources}</option>
                ${host.sources.map(
                  (s) =>
                    html`<option .value=${s.id} ?selected=${!reviewing && scopeValue === s.id}>
                      ${s.label}
                    </option>`,
                )}
                <option data-view="selected" ?selected=${reviewing}>${t.selectedOnly}</option>
              </select></span
            >`
          : nothing
      }
      <button
        class="odd-button"
        data-appearance="ghost"
        type="button"
        aria-pressed=${reviewing ? 'true' : 'false'}
        @click=${host._onSelectedView}
      >
        ${format(t.selected, { count })}
      </button>
    </div>
    <p id="status" class=${`status-line${partial ? ' danger' : ''}`}>${status}</p>
    <div class="collection">
      ${
        browse
          ? html`<div part="browse" class="browse">
              ${
                browsingRoot
                  ? browsable.map(
                      (s) =>
                        html`<button
                          class="odd-button source"
                          data-appearance="ghost"
                          type="button"
                          data-id=${s.id}
                          @click=${host._onSource}
                        >
                          ${s.description ? format(t.detail, { label: s.label, detail: s.description }) : s.label}
                        </button>`,
                    )
                  : html`<button
                      class="odd-button back"
                      data-appearance="ghost"
                      type="button"
                      @click=${host._onBack}
                    >
                      ${format(t.back, { where: backTo })}
                    </button>`
              }
            </div>`
          : nothing
      }
      ${
        containers.length
          ? html`<div class="containers">
              ${containers.map(
                (r) =>
                  html`<button
                    class="odd-button container"
                    data-appearance="ghost"
                    type="button"
                    data-key=${resourceKey(r)}
                    @click=${host._onContainer}
                  >
                    ${format(t.detail, { label: r.label, detail: r.description ?? r.type })}
                  </button>`,
              )}
            </div>`
          : nothing
      }
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
            const meta = [
              browse?.sourceId && !reviewing ? undefined : host._sourceLabel(r.sourceId),
              r.path,
              blocked || r.unavailable || (updating ? t.updating : r.description),
            ]
              .filter(Boolean)
              .join(' · ');
            return html`<div
              part="option"
              class=${`option${index === active ? ' active' : ''}`}
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
                    : html`<span class="indicator-mark indicator-check indicator-dot"></span>`
                }</span
              >
              <span class="option-icon" aria-hidden="true"
                >${
                  r.kind && icons?.[r.kind]
                    ? html`<odd-icon src=${icons[r.kind]}></odd-icon>`
                    : fileGlyph
                }</span
              >
              <span class="option-label">
                <span class="name">${highlighted(r.label, reviewing ? '' : query)}</span>
                <span class="option-description">${meta}</span>
              </span>
            </div>`;
          },
        )}
      </div>
      ${
        more
          ? html`<button
              class="odd-button more"
              data-appearance="ghost"
              type="button"
              @click=${host._onLoadMore}
            >
              ${t.loadMore}
            </button>`
          : nothing
      }
      ${
        partial && retryable
          ? html`<button
              class="odd-button retry"
              data-appearance="ghost"
              type="button"
              @click=${host._onRetry}
            >
              ${format(t.retrySources, {
                sources: host._sourcesText(failed.map((s) => s.sourceId)),
              })}
            </button>`
          : nothing
      }
      <div class="feedback" ?hidden=${feedback === nothing}>${feedback}</div>
      ${sheet && !reviewing ? html`<p class="status-line">${t.keepHint}</p>` : nothing}
    </div>
    <div part="footer" class="footer">
      <span class="count">${format(t.count, { count })}</span>
      <slot name="actions"></slot>
      ${
        browsable.length
          ? html`<button
              class="odd-button"
              data-appearance="ghost"
              type="button"
              @click=${host._onBrowse}
            >
              ${t.browse}
            </button>`
          : nothing
      }
      ${
        confirm
          ? html`<button
                class="odd-button"
                data-appearance="ghost"
                type="button"
                @click=${host._onCancel}
              >
                ${t.cancel}
              </button>
              <button
                class="odd-button"
                data-appearance="primary"
                type="button"
                @click=${host._onApply}
              >
                ${format(t.apply, { count })}
              </button>`
          : html`<button class="odd-button" type="button" @click=${host._onDone}>${t.done}</button>`
      }
    </div>
  </div>`;

  return html`<button
      part="trigger"
      id="trigger"
      class=${iconTrigger ? 'odd-button icon' : 'odd-button'}
      type="button"
      aria-label=${iconTrigger ? name : null}
      aria-haspopup="dialog"
      aria-expanded=${host.open ? 'true' : 'false'}
      aria-controls="surface"
      ?disabled=${host.disabled}
      ._describe=${noDescription}
      @click=${host._onTrigger}
    >
      ${iconTrigger ? plusGlyph : name}
    </button>
    ${iconTrigger ? html`<odd-tooltip anchor="trigger">${name}</odd-tooltip>` : nothing}
    ${
      sheet
        ? html`<dialog
            part="surface"
            id="surface"
            class="overlay-surface surface fullscreen"
            aria-labelledby="title"
            @keydown=${host._onSurfaceKey}
            @close=${host._onSheetClose}
          >
            ${body}
          </dialog>`
        : html`<div
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
            ${body}
          </div>`
    }
    <div class="visually-hidden live-polite" aria-live="polite" aria-atomic="true"></div>
    <div class="visually-hidden live-assertive" aria-live="assertive" aria-atomic="true"></div>`;
};
