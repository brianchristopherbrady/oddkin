import { LiveAnnouncer, type Announcement } from '@oddkin/core/controllers/announce';
import { ActiveDescendant } from '@oddkin/core/controllers/active-descendant';
import { PositionController } from '@oddkin/core/controllers/position';
import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { computed, signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { ContextResource, ContextResults, ContextSource } from '../contracts/types.js';
import { announceEvent, contextChangeEvent, contextQueryEvent } from '../events.js';
import { createId } from '../internal/ids.js';
import { format, formatNumber, langOf, strings } from '../internal/strings.js';

export const CONTEXT_PICKER_STRINGS = {
  add: 'Add context',
  title: 'Add context',
  selectedTitle: 'Selected context',
  close: 'Close',
  search: 'Search resources',
  allSources: 'All sources',
  scope: 'Sources to search',
  selected: 'Selected ({count})',
  count: '{count} selected',
  recent: 'Recent · {sources}',
  connected: '{count} connected sources',
  matches: '{count} matches · {sources}',
  searching: 'Searching {sources}… · previous results shown',
  loading: 'Loading · {sources}',
  loadingTitle: 'Loading resources',
  loadingText: 'Getting recent resources from {sources}.',
  noMatchesStatus: '{sources} searched · 0 matches',
  noMatches: 'No matches in {sources}',
  noMatchesText: 'Try another name, or choose All sources.',
  clearSearch: 'Clear search',
  empty: 'No resources available',
  emptyText: 'This source has no resources to show.',
  failedStatus: '{sources} search failed · results unknown',
  failed: '{sources} could not be searched',
  failedText: 'Your selections are safe. Try searching again.',
  partial: '{failed} unavailable · {searched} of {total} sources searched',
  retry: 'Retry search',
  confirmHint: 'Changes apply only when you choose Add {count}',
  singleHint: 'Choose one resource · applies and closes',
  limit: '{count} of {max} selected · remove one to add another',
  limitReached: 'Limit reached',
  review: '{count} selected · across all sources',
  noneSelected: 'Nothing selected yet.',
  done: 'Done',
  cancel: 'Cancel',
  apply: 'Add {count}',
  and: '{rest} and {last}',
  addedAnnouncement: '{label}, {type}, {source}, selected. {count} selected.',
  removedAnnouncement: '{label} removed. {count} selected.',
  resultsAnnouncement: '{count} results.',
  searchingAnnouncement: 'Searching {sources}…',
  noMatchesAnnouncement: 'No matches.',
};

/** Re-dispatched at the host: the surface's own `toggle` stays in the shadow root. */
export const contextPickerToggleEvent = event('toggle', {
  bubbles: false,
  composed: false,
  cancelable: false,
  intent: 'notification',
  description: 'A `ToggleEvent` (`oldState`, `newState`) each time the surface opens or closes.',
});

/** Identity of a resource: its source and its id. */
export const resourceKey = (r: Pick<ContextResource, 'sourceId' | 'id'>): string =>
  `${r.sourceId}\u001f${r.id}`;

/**
 * Find and choose the resources sent with a request, from the sources the host connects: a
 * button opens a search with a separate list of results; the host answers each search, owns the
 * chosen resources (`value`), and shows them outside the picker.
 *
 * Choosing only asks (`odd-context-change`, cancelable): the selection changes when the host sets
 * `value`. With `commit="confirm"` changes stay a draft until Add N, and Cancel, Close, Escape, or
 * leaving the surface discards them.
 *
 * @slot actions - Host actions in the surface's footer, e.g. upload or connect a source.
 * @csspart trigger - The button that opens the surface.
 * @csspart surface - The non-modal dialog, anchored to the trigger in the top layer.
 * @csspart search - The search field.
 * @csspart results - The listbox of results, or of the chosen resources in review.
 * @csspart option - Each result.
 * @csspart footer - The count, host actions, and Done (or Cancel and Add N).
 * @a11y The trigger has `aria-haspopup="dialog"` and `aria-expanded`; the surface is a non-modal `dialog` named by its title. The search field controls a separate listbox whose options carry no controls: name (label, type, source), description (path, metadata, why it is unavailable). Focus never chooses. Searching and the number of results are announced politely, a new failure once, and an accepted change with the new count.
 * @keyboard Enter or Space on the trigger opens it and focuses the search. Down Arrow or Tab moves into the results; Up, Down, Home, and End move; Space or Enter chooses. Escape, Close, and Done close and return focus to the trigger; Tab or a press outside closes and leaves focus there.
 * @useFor Choosing documents, pages, or records from connected sources as context for a request.
 * @notFor Uploading, connecting accounts, or fetching content (the host's); showing the chosen context (compose chips or rows outside).
 * @customization 1 2
 * @category AI
 */
export class OddkinContextPicker extends OddkinElement.with({
  value: prop.array<ContextResource>({
    description: 'The chosen resources (host-owned). Identity is `sourceId` with `id`.',
  }),
  sources: prop.array<ContextSource>({ description: 'The connected sources (host-owned).' }),
  results: prop.object<ContextResults>({
    description: 'The host’s answer to the last `odd-context-query`, by `requestId`.',
  }),
  multiple: prop.boolean({ description: 'Choose several; the surface stays open.' }),
  commit: prop.enum(['immediate', 'confirm'], {
    default: 'immediate',
    description: '`confirm`: changes stay a draft until Add N.',
  }),
  max: prop.number({
    default: 0,
    description: 'The most resources that can be chosen; 0 for no limit.',
  }),
  open: prop.boolean({ reflect: true, description: 'Whether the surface is open.' }),
  disabled: prop.boolean({ reflect: true, description: 'Prevents opening and choosing.' }),
  label: prop.string({ default: '', description: 'The trigger’s text (default `strings.add`).' }),
  strings: prop.object<Partial<typeof CONTEXT_PICKER_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'odd-context-query': contextQueryEvent,
    'odd-context-change': contextChangeEvent,
    'odd-announce': announceEvent,
    toggle: contextPickerToggleEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinContextPicker>;

  /** @internal The search text. */
  readonly _query = signal('');
  /** @internal The source searched, or '' for all of them. */
  readonly _scope = signal('');
  /** @internal `selected`: the chosen resources in review instead of the results. */
  readonly _view = signal<'results' | 'selected'>('results');
  /** @internal With `commit="confirm"`, the choice before Add N. */
  readonly _draft = signal<readonly ContextResource[] | undefined>(undefined);
  /** @internal The latest request, until its results arrive. */
  readonly _pending = signal<string | undefined>(undefined);
  /** @internal The results shown: the latest that answered one of this picker's requests. */
  readonly _shown = signal<ContextResults | undefined>(undefined);
  /** @internal The active option's index. */
  readonly _active = signal(-1);

  /** @internal The choice being edited: the draft, else the committed value. */
  readonly _chosen = computed(() => this._draft.value ?? this.value);
  /** @internal Keys of the choice being edited. */
  readonly _keys = computed(() => new Set(this._chosen.value.map(resourceKey)));
  /** @internal Waiting for the results of the latest request. */
  readonly _loading = computed(() => {
    const pending = this._pending.value;
    return pending !== undefined && this._shown.value?.requestId !== pending;
  });
  /** @internal At `max`: unchosen results cannot be added. */
  readonly _atLimit = computed(() => this.max > 0 && this._chosen.value.length >= this.max);

  #abort: AbortController | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #announcer: LiveAnnouncer | undefined;
  #returnFocus = false;
  #byPerson = false;
  readonly #listbox = new ActiveDescendant({
    target: () => this._results(),
    items: () => [...(this._results()?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])],
    onActiveChange: (index) => (this._active.value = index),
  });

  /** @internal */
  get _strings(): typeof CONTEXT_PICKER_STRINGS {
    return strings(CONTEXT_PICKER_STRINGS, this.strings);
  }

  /** @internal */
  _surface(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part="surface"]');
  }
  /** @internal */
  _results(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part="results"]');
  }
  /** @internal */
  _trigger(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part="trigger"]');
  }

  /** @internal The label of a source, or of the sources searched. */
  _sourceLabel(id: string): string {
    return this.sources.find((s) => s.id === id)?.label ?? id;
  }
  /** @internal "Drive", "Drive and Wiki", "Drive, Wiki and Records". */
  _sourcesText(ids: readonly string[]): string {
    const labels = ids.map((id) => this._sourceLabel(id));
    if (labels.length < 2) return labels[0] ?? '';
    return format(this._strings.and, {
      rest: labels.slice(0, -1).join(', '),
      last: labels[labels.length - 1] as string,
    });
  }
  /** @internal The sources the scope searches. */
  _scopeIds(): string[] {
    const scope = this._scope.value;
    return scope ? [scope] : this.sources.map((s) => s.id);
  }

  /** @internal Why a resource cannot be chosen now, or ''. */
  _blocked(resource: ContextResource): string {
    if (this._keys.value.has(resourceKey(resource))) return '';
    if (resource.unavailable) return resource.unavailable;
    return this.multiple && this._atLimit.value ? this._strings.limitReached : '';
  }

  // ---- Opening and closing ----

  /** @internal */
  readonly _onTrigger = (): void => {
    if (this.open) this._close(true);
    else if (!this.disabled) {
      this.#byPerson = true;
      this.open = true;
    }
  };
  /** @internal */
  readonly _onClose = (): void => this._close(true);
  /** @internal Done, in immediate mode. */
  readonly _onDone = (): void => this._close(true);

  /** @internal Close; with `focusTrigger`, focus returns to the trigger. */
  _close(focusTrigger: boolean): void {
    if (!this.open) return;
    this.#returnFocus = focusTrigger;
    this.open = false;
  }

  #show(): void {
    const surface = this._surface();
    const byPerson = this.#byPerson;
    this.#byPerson = false;
    if (!surface || surface.matches(':popover-open')) return;
    this._view.value = 'results';
    surface.showPopover();
    // Opened from script, the host shows what it wants through `results`; a person asks.
    if (byPerson) this.#request(this._query.peek());
    else {
      this._pending.value = this.results?.requestId;
      this._receive(this.results);
    }
    this.shadowRoot?.querySelector<HTMLInputElement>('[part="search"]')?.focus();
  }

  #hide(): void {
    clearTimeout(this.#timer);
    this.#abort?.abort();
    this.#abort = undefined;
    this._pending.value = undefined;
    this._draft.value = undefined;
    this.#listbox.setActive(-1);
    const surface = this._surface();
    if (surface?.matches(':popover-open')) surface.hidePopover();
    if (this.#returnFocus) this._trigger()?.focus();
    this.#returnFocus = false;
  }

  // ---- Searching ----

  /** @internal */
  readonly _onInput = (event: Event): void => {
    this._query.value = (event.target as HTMLInputElement).value;
    this._view.value = 'results';
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#request(this._query.peek()), 200);
  };
  /** @internal */
  readonly _onScope = (event: Event): void => {
    this._scope.value = (event.target as HTMLSelectElement).value;
    this._view.value = 'results';
    this.#request(this._query.peek());
  };
  /** @internal */
  readonly _onRetry = (): void => this.#request(this._query.peek());
  /** @internal */
  readonly _onClear = (): void => {
    this._query.value = '';
    this.#request('');
    this.shadowRoot?.querySelector<HTMLInputElement>('[part="search"]')?.focus();
  };

  #request(query: string): void {
    clearTimeout(this.#timer);
    this.#abort?.abort();
    const abort = (this.#abort = new AbortController());
    const requestId = createId('context');
    this._pending.value = requestId;
    const sourceIds = this._scopeIds();
    if (query)
      this.#say({
        text: format(this._strings.searchingAnnouncement, {
          sources: this._sourcesText(sourceIds),
        }),
      });
    this.emit(contextQueryEvent, { requestId, query, sourceIds, signal: abort.signal });
  }

  /** @internal Results arrived: show them if they answer the latest request. */
  _receive(results: ContextResults | undefined): void {
    if (!results || results.requestId !== this._pending.peek()) return;
    this._shown.value = results;
    this.#listbox.sync();
    const failed = (results.sources ?? []).filter((s) => s.status === 'failed');
    if (failed.length)
      this.#say({
        text: format(this._strings.failed, {
          sources: this._sourcesText(failed.map((s) => s.sourceId)),
        }),
        priority: 'assertive',
        key: `failed:${results.requestId}`,
      });
    if (this._query.peek() && failed.length < (results.sources?.length ?? 1))
      this.#say({
        text: results.items.length
          ? format(this._strings.resultsAnnouncement, {
              count: formatNumber(results.total ?? results.items.length, langOf(this)),
            })
          : this._strings.noMatchesAnnouncement,
        key: `results:${results.requestId}`,
      });
  }

  // ---- Choosing ----

  /** @internal */
  readonly _onSelectedView = (): void => {
    this._view.value = this._view.peek() === 'selected' ? 'results' : 'selected';
    this.#listbox.setActive(-1);
  };

  /** @internal Choose or unchoose the option at `index` among the options shown. */
  _toggleAt(index: number): void {
    const option = this.#options()[index];
    const resource = option ? this._optionResource(option) : undefined;
    if (!resource || this.disabled || this._blocked(resource)) return;
    const key = resourceKey(resource);
    const current = this._chosen.peek();
    const chosen = this._keys.peek().has(key);
    let next: ContextResource[];
    let reason: 'add' | 'remove' | 'replace';
    if (!this.multiple) {
      if (chosen) return;
      next = [resource];
      reason = 'replace';
    } else if (chosen) {
      next = current.filter((r) => resourceKey(r) !== key);
      reason = 'remove';
    } else {
      next = [...current, resource];
      reason = 'add';
    }
    if (this.commit === 'confirm') {
      this._draft.value = next;
      this.#announceChange(resource, !chosen, next.length);
      return;
    }
    if (!this.#propose(next, reason)) return;
    this.#announceChange(resource, !chosen, next.length);
    if (!this.multiple) this._close(true);
  }

  /** @internal Add N, in confirm mode. */
  readonly _onApply = (): void => {
    const draft = this._draft.peek();
    if (draft && this.#propose(draft, 'apply')) this._close(true);
  };
  /** @internal Cancel, in confirm mode: the draft is discarded. */
  readonly _onCancel = (): void => this._close(true);

  /** Ask the host; true when it set `value` to the proposal. */
  #propose(
    next: readonly ContextResource[],
    reason: 'add' | 'remove' | 'replace' | 'apply',
  ): boolean {
    if (!this.emit(contextChangeEvent, { value: [...next], reason })) return false;
    const keys = this.value.map(resourceKey);
    return keys.length === next.length && next.every((r, i) => resourceKey(r) === keys[i]);
  }

  #announceChange(resource: ContextResource, added: boolean, count: number): void {
    const t = this._strings;
    const n = formatNumber(count, langOf(this));
    this.#say({
      text: added
        ? format(t.addedAnnouncement, {
            label: resource.label,
            type: resource.type,
            source: this._sourceLabel(resource.sourceId),
            count: n,
          })
        : format(t.removedAnnouncement, { label: resource.label, count: n }),
      key: `change:${resourceKey(resource)}:${added}:${count}:${Date.now()}`,
    });
  }

  /** To the announcer around the picker (a conversation); else to its own live regions. */
  #say(message: Announcement): void {
    const detail = {
      text: message.text,
      priority: message.priority ?? 'polite',
      key: message.key ?? message.text,
    };
    if (this.emit(announceEvent, detail)) this.#announcer?.announce(detail);
  }

  /** @internal The resource an option shows. */
  _optionResource(option: Element): ContextResource | undefined {
    const key = (option as HTMLElement).dataset['key'];
    const list =
      this._view.peek() === 'selected' ? this._chosen.peek() : (this._shown.peek()?.items ?? []);
    return list.find((r) => resourceKey(r) === key);
  }

  #options(): HTMLElement[] {
    return [...(this._results()?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  }

  // ---- Keys and pointer ----

  /** @internal Down Arrow in the search moves into the results. */
  readonly _onSearchKey = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' || !this.#options().length) return;
    event.preventDefault();
    this._results()?.focus();
    if (this.#listbox.activeIndex < 0) this.#listbox.setActive(0);
  };
  /** @internal Space or Enter chooses the active option. */
  readonly _onResultsKey = (event: KeyboardEvent): void => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (this.#listbox.activeIndex >= 0) this._toggleAt(this.#listbox.activeIndex);
  };
  /** @internal The results take focus: show the active option, the first by default. */
  readonly _onResultsFocus = (): void => {
    if (this.#listbox.activeIndex < 0 && this.#options().length) this.#listbox.setActive(0);
  };
  /** @internal */
  readonly _onOptionClick = (event: Event): void => {
    const index = this.#options().indexOf(event.currentTarget as HTMLElement);
    if (index < 0) return;
    this.#listbox.setActive(index, { scroll: false });
    this._toggleAt(index);
  };
  /** @internal Escape closes; the browser's own close request would not return focus. */
  readonly _onSurfaceKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this._close(true);
  };
  /** @internal Tab out of the surface closes it and leaves focus where it went. */
  readonly _onFocusOut = (event: FocusEvent): void => {
    const to = event.relatedTarget as Node | null;
    if (to && !this.shadowRoot?.contains(to) && !this.contains(to)) this._close(false);
  };
  /** @internal A press outside closed the popover (light dismiss). */
  readonly _onSurfaceToggle = (event: Event): void => {
    const { newState } = event as ToggleEvent;
    if (newState === 'closed' && this.open) this.open = false;
  };

  protected override mounted(scope: Scope): void {
    const root = this.shadowRoot;
    const polite = root?.querySelector<HTMLElement>('.live-polite');
    const assertive = root?.querySelector<HTMLElement>('.live-assertive');
    if (polite && assertive)
      this.#announcer = scope.use(new LiveAnnouncer({ regions: () => ({ polite, assertive }) }));
    scope.use(this.#listbox);
    scope.use(
      new PositionController({
        anchor: () => this._trigger(),
        surface: () => this._surface(),
        offset: 8,
        viewportMargin: 16,
        onPlace: ({ availableHeight, availableWidth }) => {
          const style = this._surface()?.style;
          style?.setProperty('--_overlay-max-block-size', `${availableHeight}px`);
          style?.setProperty('--_overlay-max-inline-size', `${availableWidth}px`);
        },
      }),
    );
    let wasOpen = false;
    scope.effect(() => {
      const open = this.open;
      if (open === wasOpen) return;
      wasOpen = open;
      if (open) this.#show();
      else this.#hide();
      this.dispatchEvent(
        new ToggleEvent('toggle', {
          oldState: open ? 'closed' : 'open',
          newState: open ? 'open' : 'closed',
        }),
      );
    });
    scope.effect(() => this._receive(this.results));
    scope.add(() => {
      clearTimeout(this.#timer);
      this.#abort?.abort();
    }, 'context picker');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-context-picker': OddkinContextPicker;
  }
}
