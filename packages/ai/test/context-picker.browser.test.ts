import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import type { ContextResource, ContextSource } from '../src/contracts/types.js';
import type { ContextQueryDetail } from '../src/events.js';

type Picker = HTMLElementTagNameMap['odd-context-picker'];

const sources: ContextSource[] = [
  { id: 'drive', label: 'Drive' },
  { id: 'wiki', label: 'Wiki' },
];
const brief: ContextResource = {
  sourceId: 'drive',
  id: 'brief',
  label: 'Launch brief',
  type: 'document',
  path: 'Product / Launch',
  description: '2h ago',
};
const checklist: ContextResource = {
  sourceId: 'wiki',
  id: 'checklist',
  label: 'Release checklist',
  type: 'page',
};
const notes: ContextResource = {
  sourceId: 'drive',
  id: 'notes',
  label: 'Pricing notes',
  type: 'document',
  unavailable: 'Unavailable',
};

const browsable: ContextSource[] = [
  { id: 'drive', label: 'Drive', description: '240 resources', browse: true },
  { id: 'wiki', label: 'Wiki', description: '86 pages', browse: true },
  { id: 'records', label: 'Records' },
];
const launch: ContextResource = {
  sourceId: 'drive',
  id: 'launch',
  label: 'Launch',
  type: 'folder',
  description: 'Open collection',
  container: true,
};
const product: ContextResource = {
  sourceId: 'drive',
  id: 'product',
  label: 'Product',
  type: 'folder',
  container: true,
};
const folderRef: ContextResource = {
  sourceId: 'drive',
  id: 'launch-folder',
  label: 'Launch folder',
  type: 'folder',
  description: 'Folder reference · contents not selected',
};

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const settle = async (el: Picker) => {
  await el.updateComplete;
  flush();
  await frame();
  await el.updateComplete;
  flush();
};
const $ = (el: Picker, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector);
const $$ = (el: Picker, selector: string) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>(selector),
];
const options = (el: Picker) => $$(el, '[role="option"]');
const names = (el: Picker) => options(el).map((o) => o.querySelector('.name')!.textContent);

interface Harness {
  el: Picker;
  queries: ContextQueryDetail[];
  /** Answer the latest query with these items (each source complete unless failed). */
  answer(
    items: ContextResource[],
    failed?: string[],
    extra?: { nextCursor?: string; total?: number },
  ): Promise<void>;
}

/** A picker whose host records each query; with `assign`, its handler sets each change itself. */
async function mount(setup: (el: Picker) => void = () => {}, assign = true): Promise<Harness> {
  await import('../src/context-picker/context-picker.define.js');
  const el = document.createElement('odd-context-picker');
  el.sources = sources;
  el.multiple = true;
  setup(el);
  const queries: ContextQueryDetail[] = [];
  el.addEventListener('odd-context-query', (e) => queries.push(e.detail));
  if (assign) el.addEventListener('odd-context-change', (e) => (el.value = [...e.detail.value]));
  container.append(el);
  await settle(el);
  return {
    el,
    queries,
    async answer(items, failed = [], extra = {}) {
      const q = queries.at(-1)!;
      el.results = {
        requestId: q.requestId,
        items,
        ...extra,
        sources: q.sourceIds.map((sourceId) =>
          failed.includes(sourceId)
            ? { sourceId, status: 'failed' as const }
            : { sourceId, status: 'complete' as const },
        ),
      };
      await settle(el);
    },
  };
}

async function open(h: Harness): Promise<void> {
  ($(h.el, '[part="trigger"]') as HTMLButtonElement).click();
  await settle(h.el);
}

describe('odd-context-picker', () => {
  it('opens a non-modal dialog from its trigger, focuses the search, and asks for recent resources', async () => {
    const h = await mount();
    const toggles: string[] = [];
    h.el.addEventListener('toggle', (e) => toggles.push((e as ToggleEvent).newState));
    const trigger = $(h.el, '[part="trigger"]')!;
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent?.trim()).toBe('Add context');
    await open(h);
    expect(h.el.open).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect($(h.el, '[part="surface"]')!.matches(':popover-open')).toBe(true);
    expect($(h.el, '[part="surface"]')!.getAttribute('role')).toBe('dialog');
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '[part="search"]'));
    expect(h.queries).toHaveLength(1);
    expect(h.queries[0]).toMatchObject({ query: '', sourceIds: ['drive', 'wiki'] });
    expect(toggles).toEqual(['open']);
    await h.answer([brief, checklist]);
    expect(names(h.el)).toEqual(['Launch brief', 'Release checklist']);
    expect($(h.el, '[part="results"]')!.getAttribute('aria-multiselectable')).toBe('true');
  });

  it('opened from script, it asks nothing and shows the results it was given', async () => {
    const h = await mount((el) => {
      el.results = { requestId: 'given', items: [brief, checklist] };
      el.open = true;
    });
    await settle(h.el);
    expect(h.queries).toHaveLength(0);
    expect(names(h.el)).toEqual(['Launch brief', 'Release checklist']);
  });

  it('shows only results for its latest request, aborting older ones; typing waits 200 ms', async () => {
    const h = await mount();
    await open(h);
    const search = $(h.el, '[part="search"]') as HTMLInputElement;
    for (const value of ['l', 'la', 'lau']) {
      search.value = value;
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    expect(h.queries).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 120));
    expect(h.queries, 'still waiting').toHaveLength(1);
    await new Promise((r) => setTimeout(r, 200));
    expect(h.queries.map((q) => q.query)).toEqual(['', 'lau']);
    expect(h.queries[0]!.signal.aborted).toBe(true);
    expect(h.queries[1]!.signal.aborted).toBe(false);
    // An answer to the older request is ignored.
    h.el.results = { requestId: h.queries[0]!.requestId, items: [checklist] };
    await settle(h.el);
    expect(options(h.el)).toHaveLength(0);
    expect($(h.el, '[part="results"]')!.getAttribute('aria-busy')).toBe('true');
    await h.answer([brief]);
    expect(names(h.el)).toEqual(['Launch brief']);
    expect($(h.el, '.match')!.textContent).toBe('Lau');
    expect($(h.el, '[part="results"]')!.getAttribute('aria-busy')).toBe('false');
    // Closing aborts the open request.
    search.value = 'x';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    h.el.open = false;
    await settle(h.el);
    await new Promise((r) => setTimeout(r, 260));
    expect(h.queries).toHaveLength(2);
  });

  it('searches one source when the scope names it', async () => {
    const h = await mount();
    await open(h);
    const scope = $(h.el, 'select.scope') as HTMLSelectElement;
    scope.value = 'wiki';
    scope.dispatchEvent(new Event('change', { bubbles: true }));
    expect(h.queries.at(-1)).toMatchObject({ sourceIds: ['wiki'] });
  });

  it('moves into the results with Down Arrow; focus never chooses; Space chooses', async () => {
    const h = await mount();
    await open(h);
    await h.answer([brief, checklist]);
    const changes: string[] = [];
    h.el.addEventListener('odd-context-change', (e) => changes.push(e.detail.reason));
    await userEvent.keyboard('{ArrowDown}');
    await settle(h.el);
    const results = $(h.el, '[part="results"]')!;
    expect(h.el.shadowRoot!.activeElement).toBe(results);
    expect(results.getAttribute('aria-activedescendant')).toBe(options(h.el)[0]!.id);
    expect(options(h.el).map((o) => o.classList.contains('active'))).toEqual([true, false]);
    await userEvent.keyboard('{ArrowDown}');
    await settle(h.el);
    expect(results.getAttribute('aria-activedescendant')).toBe(options(h.el)[1]!.id);
    expect(options(h.el).map((o) => o.classList.contains('active'))).toEqual([false, true]);
    expect(changes).toEqual([]);
    await userEvent.keyboard(' ');
    await settle(h.el);
    expect(changes).toEqual(['add']);
    expect(h.el.value).toEqual([checklist]);
    expect(options(h.el)[1]!.getAttribute('aria-selected')).toBe('true');
    // Still open in multiple mode.
    expect(h.el.open).toBe(true);
  });

  it('a cancelled change is refused: nothing is chosen', async () => {
    const h = await mount(() => {}, false);
    await open(h);
    await h.answer([brief]);
    const proposed: unknown[] = [];
    h.el.addEventListener('odd-context-change', (e) => {
      proposed.push(e.detail);
      e.preventDefault();
    });
    options(h.el)[0]!.click();
    await settle(h.el);
    expect(proposed).toEqual([{ value: [brief], reason: 'add' }]);
    expect(h.el.value).toEqual([]);
    expect(options(h.el)[0]!.getAttribute('aria-selected')).toBe('false');
  });

  it('announces an accepted change with the new count, to a surrounding announcer first', async () => {
    const h = await mount();
    const heard: string[] = [];
    container.addEventListener('odd-announce', (e) => {
      heard.push((e as CustomEvent<{ text: string }>).detail.text);
      e.preventDefault();
    });
    await open(h);
    await h.answer([brief, checklist]);
    options(h.el)[0]!.click();
    await settle(h.el);
    options(h.el)[0]!.click();
    await settle(h.el);
    expect(heard).toEqual([
      'Launch brief, document, Drive, selected. 1 selected.',
      'Launch brief removed. 0 selected.',
    ]);
  });

  it('single: choosing replaces the value, closes, and returns focus to the trigger', async () => {
    const h = await mount((el) => {
      el.multiple = false;
      el.value = [checklist];
    });
    await open(h);
    await h.answer([brief, checklist]);
    expect($(h.el, '[part="results"]')!.getAttribute('aria-multiselectable')).toBe('false');
    expect($$(h.el, '.indicator-dot')).toHaveLength(2);
    // A single choice shows its dot on the chosen row only.
    expect($$(h.el, '.indicator-dot').map((d) => getComputedStyle(d).visibility)).toEqual([
      'hidden',
      'visible',
    ]);
    const proposals: string[] = [];
    h.el.addEventListener('odd-context-change', (e) => proposals.push(e.detail.reason));
    options(h.el)[0]!.click();
    await settle(h.el);
    expect(h.el.value).toEqual([brief]);
    expect(proposals).toEqual(['replace']);
    expect(h.el.open).toBe(false);
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '[part="trigger"]'));
    // Choosing what is already chosen proposes nothing.
    await open(h);
    await h.answer([brief, checklist]);
    options(h.el)[0]!.click();
    await settle(h.el);
    expect(proposals).toEqual(['replace']);
    expect(h.el.open).toBe(true);
  });

  it('confirm: choices stay a draft until Add N; Cancel and Escape discard it', async () => {
    const h = await mount((el) => {
      el.commit = 'confirm';
      el.value = [brief];
    });
    const changes: unknown[] = [];
    h.el.addEventListener('odd-context-change', (e) => changes.push(e.detail));
    await open(h);
    await h.answer([brief, checklist]);
    options(h.el)[1]!.click();
    await settle(h.el);
    expect(changes).toEqual([]);
    expect(h.el.value).toEqual([brief]);
    expect(options(h.el)[1]!.getAttribute('aria-selected')).toBe('true');
    const buttons = () => $$(h.el, '[part="footer"] button').map((b) => b.textContent?.trim());
    expect(buttons()).toEqual(['Cancel', 'Add 2']);
    // Escape discards the draft.
    await userEvent.keyboard('{Escape}');
    await settle(h.el);
    expect(h.el.open).toBe(false);
    expect(h.el.value).toEqual([brief]);
    await open(h);
    await h.answer([brief, checklist]);
    expect(options(h.el)[1]!.getAttribute('aria-selected')).toBe('false');
    options(h.el)[1]!.click();
    await settle(h.el);
    (
      $$(h.el, '[part="footer"] button').find(
        (b) => b.textContent?.trim() === 'Add 2',
      ) as HTMLElement
    ).click();
    await settle(h.el);
    expect(changes).toEqual([{ value: [brief, checklist], reason: 'apply' }]);
    expect(h.el.value).toEqual([brief, checklist]);
    expect(h.el.open).toBe(false);
  });

  it('at max, unchosen results cannot be added and say why; chosen ones stay removable', async () => {
    const h = await mount((el) => {
      el.max = 1;
      el.value = [brief];
    });
    await open(h);
    await h.answer([brief, checklist]);
    const [first, second] = options(h.el);
    expect(second!.getAttribute('aria-disabled')).toBe('true');
    expect(second!.getAttribute('aria-description')).toContain('Limit reached');
    expect($(h.el, '.status-line')!.textContent?.trim()).toBe(
      '1 of 1 selected · remove one to add another',
    );
    second!.click();
    await settle(h.el);
    expect(h.el.value).toEqual([brief]);
    const reasons: string[] = [];
    h.el.addEventListener('odd-context-change', (e) => reasons.push(e.detail.reason));
    first!.click();
    await settle(h.el);
    expect(h.el.value).toEqual([]);
    expect(reasons).toEqual(['remove']);
  });

  it('a disabled picker opened from script still chooses nothing', async () => {
    const h = await mount((el) => {
      el.results = { requestId: 'given', items: [brief] };
      el.disabled = true;
      el.open = true;
    });
    await settle(h.el);
    const proposed: unknown[] = [];
    h.el.addEventListener('odd-context-change', (e) => proposed.push(e.detail));
    options(h.el)[0]?.click();
    await settle(h.el);
    expect(proposed).toEqual([]);
    expect(h.el.value).toEqual([]);
  });

  it('a change no handler cancels applies: chosen, announced, and a single choice closes', async () => {
    const h = await mount((el) => (el.multiple = false), false);
    const heard: string[] = [];
    container.addEventListener('odd-announce', (e) => {
      heard.push((e as CustomEvent<{ text: string }>).detail.text);
      e.preventDefault();
    });
    await open(h);
    await h.answer([brief]);
    options(h.el)[0]!.click();
    await settle(h.el);
    expect(h.el.value).toEqual([brief]);
    expect(heard).toEqual(['Launch brief, document, Drive, selected. 1 selected.']);
    expect(h.el.open).toBe(false);
  });

  it('a value the handler sets stays, even another one; only the proposal is announced', async () => {
    const h = await mount((el) => (el.multiple = false), false);
    const heard: string[] = [];
    container.addEventListener('odd-announce', (e) => {
      heard.push((e as CustomEvent<{ text: string }>).detail.text);
      e.preventDefault();
    });
    h.el.addEventListener('odd-context-change', () => (h.el.value = [checklist]));
    await open(h);
    await h.answer([brief, checklist]);
    options(h.el)[0]!.click();
    await settle(h.el);
    expect(h.el.value).toEqual([checklist]);
    expect(heard).toEqual([]);
    expect(h.el.open).toBe(true);
  });

  it('cancelled, then set by the host: shown, but not announced, and the surface stays open', async () => {
    const h = await mount((el) => (el.multiple = false), false);
    const heard: string[] = [];
    container.addEventListener('odd-announce', (e) => {
      heard.push((e as CustomEvent<{ text: string }>).detail.text);
      e.preventDefault();
    });
    h.el.addEventListener('odd-context-change', (e) => {
      h.el.value = [...e.detail.value];
      e.preventDefault();
    });
    await open(h);
    await h.answer([brief]);
    options(h.el)[0]!.click();
    await settle(h.el);
    expect(h.el.value).toEqual([brief]);
    expect(options(h.el)[0]!.getAttribute('aria-selected')).toBe('true');
    expect(heard).toEqual([]);
    expect(h.el.open).toBe(true);
  });
  it('an unavailable resource cannot be added, but stays removable once chosen', async () => {
    const h = await mount((el) => (el.value = [notes]));
    await open(h);
    await h.answer([notes, brief]);
    expect(options(h.el)[0]!.getAttribute('aria-disabled')).toBe('false');
    options(h.el)[0]!.click();
    await settle(h.el);
    expect(h.el.value).toEqual([]);
    await h.answer([notes, brief]);
    expect(options(h.el)[0]!.getAttribute('aria-disabled')).toBe('true');
    expect(options(h.el)[0]!.getAttribute('aria-description')).toContain('Unavailable');
  });

  it('tells a failed search from no matches, and retries', async () => {
    const h = await mount();
    await open(h);
    await h.answer([], ['drive', 'wiki']);
    expect($(h.el, '.feedback-title')!.textContent?.trim()).toBe(
      'Drive and Wiki could not be searched',
    );
    expect($(h.el, '.status-line')!.textContent?.trim()).toBe(
      'Drive and Wiki search failed · results unknown',
    );
    ($$(h.el, '.feedback button')[0] as HTMLElement).click();
    expect(h.queries).toHaveLength(2);
    await h.answer([brief], ['wiki']);
    expect(names(h.el)).toEqual(['Launch brief']);
    expect($(h.el, '.status-line')!.textContent?.trim()).toBe(
      'Wiki unavailable · 1 of 2 sources searched',
    );
    const search = $(h.el, '[part="search"]') as HTMLInputElement;
    search.value = 'zz';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 260));
    await h.answer([]);
    expect($(h.el, '.feedback-title')!.textContent?.trim()).toBe('No matches in Drive and Wiki');
    ($$(h.el, '.feedback button')[0] as HTMLElement).click();
    await settle(h.el);
    expect(h.queries.at(-1)!.query).toBe('');
    expect(search.value).toBe('');
  });

  it("shows the host's message for a failed source, and Retry only when it may help", async () => {
    const h = await mount();
    await open(h);
    const fail = async (retryable?: boolean) => {
      const q = h.queries.at(-1)!;
      h.el.results = {
        requestId: q.requestId,
        items: [],
        sources: [
          {
            sourceId: 'drive',
            status: 'failed',
            error: { code: 'auth', message: 'Reconnect Drive.', retryable },
          },
          {
            sourceId: 'wiki',
            status: 'failed',
            error: { code: 'auth', message: 'Reconnect Drive.', retryable: false },
          },
        ],
      };
      await settle(h.el);
    };
    await fail();
    expect($(h.el, '.feedback-text')!.textContent?.trim()).toBe('Reconnect Drive.');
    expect($$(h.el, '.feedback button').map((b) => b.textContent?.trim())).toEqual([
      'Retry search',
    ]);
    await fail(false);
    expect($$(h.el, '.feedback button')).toEqual([]);
  });

  it('announces how many are loaded while more pages may come, and the total when known', async () => {
    const h = await mount();
    const heard: string[] = [];
    container.addEventListener('odd-announce', (e) => {
      heard.push((e as CustomEvent<{ text: string }>).detail.text);
      e.preventDefault();
    });
    await open(h);
    const search = $(h.el, '[part="search"]') as HTMLInputElement;
    const type = async (value: string) => {
      search.value = value;
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 260));
    };
    await type('l');
    await h.answer([brief], [], { nextCursor: 'p2' });
    expect(heard.at(-1)).toBe('1 loaded');
    ($(h.el, '.more') as HTMLElement).click();
    await settle(h.el);
    await h.answer([checklist]);
    expect(heard.at(-1)).toBe('2 results.');
    await type('la');
    await h.answer([brief], [], { nextCursor: 'p2', total: 30 });
    expect(heard.at(-1)).toBe('30 results.');
  });

  it('reviews the chosen resources under Selected (N)', async () => {
    const h = await mount((el) => (el.value = [brief, checklist]));
    await open(h);
    await h.answer([]);
    const selected = $$(h.el, '.scope-row button')[0]!;
    expect(selected.textContent?.trim()).toBe('Selected (2)');
    selected.click();
    await settle(h.el);
    expect($(h.el, '.title')!.textContent).toBe('Selected context');
    expect(names(h.el)).toEqual(['Launch brief', 'Release checklist']);
    options(h.el)[1]!.click();
    await settle(h.el);
    expect(h.el.value).toEqual([brief]);
  });

  it('the scope offers the same review: Selected only', async () => {
    const h = await mount((el) => (el.value = [brief, checklist]));
    await open(h);
    await h.answer([]);
    const asked = h.queries.length;
    const scope = $(h.el, 'select.scope') as HTMLSelectElement;
    scope.selectedIndex = [...scope.options].findIndex((o) => o.dataset['view'] === 'selected');
    scope.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(h.el);
    expect($(h.el, '.title')!.textContent).toBe('Selected context');
    expect(names(h.el)).toEqual(['Launch brief', 'Release checklist']);
    expect(h.queries, 'reviewing asks the host nothing').toHaveLength(asked);
  });

  it('only the collection scrolls: the header, search, and footer stay in view', async () => {
    const h = await mount();
    await open(h);
    await h.answer(
      Array.from({ length: 20 }, (_, i) => ({ ...brief, id: `r${i}`, label: `Resource ${i}` })),
    );
    const collection = $(h.el, '.collection') as HTMLElement;
    collection.scrollTop = collection.scrollHeight;
    expect(collection.scrollTop).toBeGreaterThan(0);
    const surface = $(h.el, '[part="surface"]')!.getBoundingClientRect();
    expect($(h.el, '.header')!.getBoundingClientRect().top).toBeGreaterThanOrEqual(surface.top);
    expect($(h.el, '[part="footer"]')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      surface.bottom,
    );
  });

  it('Escape and Done return focus to the trigger; Tab out closes and leaves focus outside', async () => {
    const h = await mount();
    const after = document.createElement('button');
    after.textContent = 'After';
    container.append(after);
    await open(h);
    await userEvent.keyboard('{Escape}');
    await settle(h.el);
    expect(h.el.open).toBe(false);
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '[part="trigger"]'));
    await open(h);
    ($$(h.el, '[part="footer"] button').at(-1) as HTMLElement).click();
    await settle(h.el);
    expect(h.el.open).toBe(false);
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '[part="trigger"]'));
    await open(h);
    after.focus();
    await settle(h.el);
    expect(h.el.open).toBe(false);
    expect(document.activeElement).toBe(after);
  });

  it('the icon trigger: a plus button named by its label, which shows as its tooltip', async () => {
    const h = await mount((el) => {
      el.trigger = 'icon';
      el.label = 'Attach context';
    });
    const trigger = $(h.el, '[part="trigger"]') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe('Attach context');
    expect(trigger.textContent!.trim(), 'only the plus').toBe('');
    expect(trigger.querySelector('svg')).not.toBeNull();
    const tip = $(h.el, 'odd-tooltip') as HTMLElementTagNameMap['odd-tooltip'];
    expect(tip.textContent!.trim()).toBe('Attach context');
    // Focus shows the tooltip; it repeats the name, so it adds no description.
    trigger.focus();
    await settle(h.el);
    expect(tip.open).toBe(true);
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
    await userEvent.keyboard('{Escape}');
    await settle(h.el);
    expect(tip.open).toBe(false);
    trigger.click();
    await settle(h.el);
    expect(h.el.open).toBe(true);
    // The text form: the text, and no tooltip.
    h.el.open = false;
    h.el.trigger = 'text';
    await settle(h.el);
    expect(trigger.hasAttribute('aria-label')).toBe(false);
    expect(trigger.textContent!.trim()).toBe('Attach context');
    expect($(h.el, 'odd-tooltip')).toBeNull();
  });

  it('a resource shows the icon `icons` gives its kind; others show the document icon', async () => {
    const folder =
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"%3E%3Crect width="20" height="16"/%3E%3C/svg%3E';
    const h = await mount((el) => (el.icons = { folder }));
    await open(h);
    await h.answer([{ ...folderRef, kind: 'folder' }, { ...brief, kind: 'sheet' }, checklist]);
    const icon = (i: number) => options(h.el)[i]!.querySelector('.option-icon')!;
    expect(icon(0).querySelector('odd-icon')!.getAttribute('src')).toBe(folder);
    expect(icon(1).querySelector('svg')).not.toBeNull();
    expect(icon(2).querySelector('svg')).not.toBeNull();
    // A new map applies to the rows shown.
    h.el.icons = { sheet: folder };
    await settle(h.el);
    expect(icon(0).querySelector('odd-icon')).toBeNull();
    expect(icon(1).querySelector('odd-icon')!.getAttribute('src')).toBe(folder);
  });

  it('presentation="sheet": a full-screen modal dialog with the same search, list, and choice', async () => {
    const h = await mount((el) => (el.presentation = 'sheet'));
    const toggles: string[] = [];
    h.el.addEventListener('toggle', (e) => toggles.push((e as ToggleEvent).newState));
    await open(h);
    const surface = $(h.el, '[part="surface"]') as HTMLDialogElement;
    expect(surface.localName).toBe('dialog');
    expect(surface.matches(':modal')).toBe(true);
    const box = surface.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([window.innerWidth, window.innerHeight]);
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '[part="search"]'));
    expect(h.queries).toHaveLength(1);
    await h.answer([brief, checklist]);
    expect(names(h.el)).toEqual(['Launch brief', 'Release checklist']);
    expect($$(h.el, '.collection .status-line').map((p) => p.textContent)).toEqual([
      'Selections stay when you change search or source.',
    ]);
    options(h.el)[0]!.click();
    await settle(h.el);
    expect(h.el.value).toEqual([brief]);
    await userEvent.keyboard('{Escape}');
    await settle(h.el);
    expect(h.el.open).toBe(false);
    expect(surface.open).toBe(false);
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '[part="trigger"]'));
    expect(toggles).toEqual(['open', 'closed']);
    // A close request the dialog handles itself (a system back gesture) closes the picker too.
    await open(h);
    surface.close();
    await settle(h.el);
    expect(h.el.open).toBe(false);
    expect(toggles).toEqual(['open', 'closed', 'open', 'closed']);
  });

  it('a presentation set while open applies once it closes', async () => {
    const h = await mount();
    await open(h);
    h.el.presentation = 'sheet';
    await settle(h.el);
    const popover = $(h.el, '[part="surface"]')!;
    expect(popover.localName, 'the popover stays while open').toBe('div');
    expect(popover.matches(':popover-open')).toBe(true);
    expect($$(h.el, '.collection .status-line'), 'no sheet hint in the popover').toHaveLength(0);
    h.el.open = false;
    await settle(h.el);
    expect($(h.el, '[part="surface"]')!.localName).toBe('dialog');
    await open(h);
    expect(($(h.el, '[part="surface"]') as HTMLDialogElement).open).toBe(true);
    h.el.presentation = 'popover';
    await settle(h.el);
    expect($(h.el, '[part="surface"]')!.localName, 'the sheet stays while open').toBe('dialog');
    $$(h.el, '[part="footer"] button').at(-1)!.click();
    await settle(h.el);
    expect(h.el.open).toBe(false);
    expect($(h.el, '[part="surface"]')!.localName).toBe('div');
    // The new popover is placed against the trigger.
    await open(h);
    const [trigger, popup] = [$(h.el, '[part="trigger"]')!, $(h.el, '[part="surface"]')!];
    expect(
      Math.abs(popup.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom),
    ).toBeLessThanOrEqual(12);
    h.el.open = false;
    await settle(h.el);
    // Set and opened at once: the sheet shows.
    h.el.presentation = 'sheet';
    h.el.open = true;
    await settle(h.el);
    expect(($(h.el, '[part="surface"]') as HTMLDialogElement).open).toBe(true);
  });

  it('disabled: the trigger is off and nothing opens', async () => {
    const h = await mount((el) => (el.disabled = true));
    expect(($(h.el, '[part="trigger"]') as HTMLButtonElement).disabled).toBe(true);
    await open(h);
    expect(h.el.open).toBe(false);
    expect(h.queries).toHaveLength(0);
  });
});

describe('odd-context-picker: browsing and paging', () => {
  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
  const status = (h: Harness) => text($(h.el, '.status-line'));
  const browse = (h: Harness) =>
    $$(h.el, '[part="footer"] button').find((b) => text(b) === 'Browse…') as HTMLElement;
  const mountBrowsable = (setup: (el: Picker) => void = () => {}) =>
    mount((el) => {
      el.sources = browsable;
      setup(el);
    });
  /** Browse…, then the browser's source `index`, answered with `items`. */
  const browseSource = async (h: Harness, index: number, items: ContextResource[]) => {
    browse(h).click();
    await settle(h.el);
    ($$(h.el, '.nav .source')[index] as HTMLElement).click();
    await settle(h.el);
    await h.answer(items);
  };
  const type = async (h: Harness, query: string) => {
    const search = $(h.el, '[part="search"]') as HTMLInputElement;
    search.value = query;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 260));
    await settle(h.el);
  };

  it('offers Browse… only when a source can be browsed', async () => {
    const plain = await mount();
    await open(plain);
    expect($$(plain.el, '[part="footer"] button').map(text)).toEqual(['Done']);
    const h = await mountBrowsable();
    await open(h);
    expect($$(h.el, '[part="footer"] button').map(text)).toEqual(['Browse…', 'Done']);
  });

  it('Back out of a source lists the sources that can be browsed, keeps the scope explicit, and asks for nothing', async () => {
    const h = await mountBrowsable();
    await open(h);
    await h.answer([]);
    await type(h, 'la');
    await h.answer([launch, brief], [], { nextCursor: 'p2' });
    ($(h.el, '.container') as HTMLElement).click();
    await settle(h.el);
    await h.answer([folderRef]);
    ($(h.el, '.back') as HTMLElement).click();
    await settle(h.el);
    await h.answer([product, launch], [], { nextCursor: 'p2' });
    expect($(h.el, '.more')).not.toBeNull();
    const asked = h.queries.length;
    expect(text($(h.el, '.back'))).toBe('Back · Sources');
    ($(h.el, '.back') as HTMLElement).click();
    await settle(h.el);
    expect($$(h.el, '.browse .source').map(text)).toEqual([
      'Drive · 240 resources',
      'Wiki · 86 pages',
    ]);
    expect(status(h)).toBe('Browse · search scope stays explicit');
    expect(($(h.el, '[part="results"]') as HTMLElement).hidden).toBe(true);
    expect(h.queries).toHaveLength(asked);
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '.source'));
    expect(($(h.el, '[part="search"]') as HTMLInputElement).value, 'the search is cleared').toBe(
      '',
    );
    expect($(h.el, '.more'), 'no Load more on the sources').toBeNull();
    // A source from that list opens in the surface itself.
    ($$(h.el, '.browse .source')[1] as HTMLElement).click();
    await settle(h.el);
    expect(h.queries.at(-1)).toMatchObject({ location: { sourceId: 'wiki' } });
    expect($(h.el, '[part="surface"]')!.localName).toBe('div');
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '.back'));
  });

  it('browses a source, opens containers, selects a folder reference, and goes back', async () => {
    const h = await mountBrowsable();
    await open(h);
    await h.answer([]);
    browse(h).click();
    await settle(h.el);
    expect($$(h.el, '.nav .source').map(text)).toEqual(['All sources', 'Drive', 'Wiki', 'Records']);
    const drive = $$(h.el, '.nav .source')[1] as HTMLElement;
    drive.click();
    await settle(h.el);
    expect(h.queries.at(-1)).toMatchObject({
      query: '',
      sourceIds: ['drive'],
      location: { sourceId: 'drive' },
    });
    expect(h.queries.at(-1)!.location).not.toHaveProperty('id');
    expect(drive.getAttribute('aria-current')).toBe('true');
    expect(drive.hasAttribute('data-appearance'), 'the current source: secondary').toBe(false);
    await h.answer([product, launch, folderRef]);
    expect(status(h)).toBe('Drive · browse');
    expect($(h.el, '.back'), 'the list of sources is beside: no Back at the top').toBeNull();
    expect($$(h.el, '.containers .container').map(text)).toEqual([
      'Product · folder',
      'Launch · Open collection',
    ]);
    // A container opens; it is not an option. A folder reference is one.
    expect(names(h.el)).toEqual(['Launch folder']);
    ($$(h.el, '.container')[1] as HTMLElement).click();
    await settle(h.el);
    expect(h.queries.at(-1)).toMatchObject({ location: { sourceId: 'drive', id: 'launch' } });
    await h.answer([folderRef]);
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '.back'));
    expect(status(h)).toBe('Drive / Launch · browse');
    expect(text($(h.el, '.back'))).toBe('Back · Drive');
    options(h.el)[0]!.click();
    await settle(h.el);
    expect(h.el.value).toEqual([folderRef]);
    // Up to the top of the source: focus goes to the source.
    ($(h.el, '.back') as HTMLElement).click();
    await settle(h.el);
    expect(h.queries.at(-1)!.location).toEqual({ sourceId: 'drive' });
    await h.answer([product, launch]);
    expect($(h.el, '.back')).toBeNull();
    expect(h.el.shadowRoot!.activeElement).toBe(drive);
    // All sources leaves the source for every source's results.
    ($$(h.el, '.nav .source')[0] as HTMLElement).click();
    await settle(h.el);
    expect(h.queries.at(-1)!).not.toHaveProperty('location');
    expect(h.queries.at(-1)!.sourceIds).toEqual(['drive', 'wiki', 'records']);
    await h.answer([brief]);
    expect($(h.el, '.browse')).toBeNull();
    expect(text($(h.el, '.nav [aria-current]'))).toBe('All sources');
    expect(names(h.el)).toEqual(['Launch brief']);
  });

  it('shows the path in the Back label and the status, two containers deep', async () => {
    const h = await mountBrowsable();
    await open(h);
    await h.answer([]);
    await browseSource(h, 1, [product]);
    ($(h.el, '.container') as HTMLElement).click();
    await settle(h.el);
    await h.answer([launch]);
    ($(h.el, '.container') as HTMLElement).click();
    await settle(h.el);
    await h.answer([folderRef]);
    expect(status(h)).toBe('Drive / Product / Launch · browse');
    expect(text($(h.el, '.back'))).toBe('Back · Product');
    expect(text($(h.el, '.nav [aria-current]'))).toBe('Drive');
  });

  it('leaves browsing when the person types or changes the scope', async () => {
    const h = await mountBrowsable();
    await open(h);
    await h.answer([]);
    const reenter = async () => {
      await type(h, 'la');
      await h.answer([launch]);
      ($(h.el, '.container') as HTMLElement).click();
      await settle(h.el);
      await h.answer([folderRef]);
      expect($(h.el, '.back')).not.toBeNull();
    };
    await reenter();
    const search = $(h.el, '[part="search"]') as HTMLInputElement;
    search.value = 'launch';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(h.el);
    expect($(h.el, '.back')).toBeNull();
    await new Promise((r) => setTimeout(r, 260));
    expect(h.queries.at(-1)!).toMatchObject({ query: 'launch' });
    expect(h.queries.at(-1)!).not.toHaveProperty('location');
    await h.answer([brief]);
    await reenter();
    const scope = $(h.el, 'select.scope') as HTMLSelectElement;
    scope.value = 'wiki';
    scope.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(h.el);
    expect($(h.el, '.back')).toBeNull();
    expect(h.queries.at(-1)).toMatchObject({ sourceIds: ['wiki'] });
    expect(h.queries.at(-1)!).not.toHaveProperty('location');
  });

  it("the browser's list of sources is the scope: the search goes on in the source chosen", async () => {
    const h = await mountBrowsable();
    await open(h);
    await h.answer([]);
    await browseSource(h, 1, [folderRef]);
    expect($(h.el, '.scope-row'), 'the list replaces the scope row').toBeNull();
    await type(h, 'launch');
    expect(h.queries.at(-1)).toMatchObject({ query: 'launch', sourceIds: ['drive'] });
    expect(h.queries.at(-1)!).not.toHaveProperty('location');
    expect(text($(h.el, '.nav [aria-current]')), 'still in Drive').toBe('Drive');
    await h.answer([brief]);
    // A source that cannot be browsed is searched; the query stays.
    ($$(h.el, '.nav .source')[3] as HTMLElement).click();
    await settle(h.el);
    expect(h.queries.at(-1)).toMatchObject({ query: 'launch', sourceIds: ['records'] });
    expect(text($(h.el, '.nav [aria-current]'))).toBe('Records');
    await h.answer([]);
    ($$(h.el, '.nav .source')[0] as HTMLElement).click();
    await settle(h.el);
    expect(h.queries.at(-1)).toMatchObject({
      query: 'launch',
      sourceIds: ['drive', 'wiki', 'records'],
    });
    // A source that can be browsed starts from its top.
    ($$(h.el, '.nav .source')[2] as HTMLElement).click();
    await settle(h.el);
    expect(h.queries.at(-1)).toMatchObject({ query: '', location: { sourceId: 'wiki' } });
    expect(($(h.el, '[part="search"]') as HTMLInputElement).value).toBe('');
    // Selected (N) sits in the list, as Figma draws it.
    expect(text($(h.el, '.nav [aria-pressed]'))).toBe('Selected (0)');
  });

  it('opens a container found in the results, starting a browse inside it', async () => {
    const h = await mountBrowsable();
    await open(h);
    const search = $(h.el, '[part="search"]') as HTMLInputElement;
    search.value = 'la';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 260));
    await h.answer([launch, brief]);
    expect(names(h.el)).toEqual(['Launch brief']);
    ($(h.el, '.container') as HTMLElement).click();
    await settle(h.el);
    expect(h.queries.at(-1)).toMatchObject({
      query: '',
      sourceIds: ['drive'],
      location: { sourceId: 'drive', id: 'launch' },
    });
    expect(search.value).toBe('');
  });

  it('announces the number of items of a browsed location', async () => {
    const h = await mountBrowsable();
    const heard: string[] = [];
    container.addEventListener('odd-announce', (e) => {
      heard.push((e as CustomEvent<{ text: string }>).detail.text);
      e.preventDefault();
    });
    await open(h);
    await h.answer([]);
    await browseSource(h, 1, [product, launch, folderRef]);
    expect(heard).toEqual(['Drive: 3 items.']);
  });

  it('rows inside a browsed source leave out its name; the review keeps every source', async () => {
    const h = await mountBrowsable((el) => (el.value = [checklist]));
    await open(h);
    await h.answer([]);
    await browseSource(h, 1, [folderRef]);
    const meta = () => text(options(h.el)[0]!.querySelector('.option-description'));
    expect(meta()).not.toContain('Drive');
    // Selected (1) while still inside Drive: the chosen page is from Wiki and says so.
    ($(h.el, '.nav [aria-pressed]') as HTMLElement).click();
    await settle(h.el);
    expect(names(h.el)).toEqual(['Release checklist']);
    expect(meta()).toBe('Wiki');
  });

  it('closing leaves browsing; reopening starts at the results', async () => {
    const h = await mountBrowsable();
    await open(h);
    await h.answer([]);
    browse(h).click();
    await settle(h.el);
    h.el.open = false;
    await settle(h.el);
    await open(h);
    expect($(h.el, '[part="surface"]')!.localName, 'the anchored surface again').toBe('div');
    expect($(h.el, '.browse')).toBeNull();
    expect(h.queries.at(-1)).not.toHaveProperty('location');
  });

  it('pages: Load more asks for the next page, appends it, and keeps the choice and the status honest', async () => {
    const h = await mountBrowsable();
    await open(h);
    await h.answer([brief], [], { nextCursor: 'p2' });
    expect(status(h)).toBe('1 loaded');
    expect(text($(h.el, '.more'))).toBe('Load more');
    options(h.el)[0]!.click();
    await settle(h.el);
    expect(h.el.value).toEqual([brief]);
    ($(h.el, '.more') as HTMLElement).click();
    await settle(h.el);
    expect(h.queries.at(-1)).toMatchObject({ cursor: 'p2', query: '' });
    expect($(h.el, '.more')).toBeNull();
    // The shown rows are not being updated while the next page loads.
    expect(text(options(h.el)[0]!.querySelector('.option-description'))).not.toContain('Updating');
    await h.answer([checklist], [], { nextCursor: 'p3' });
    expect(names(h.el)).toEqual(['Launch brief', 'Release checklist']);
    expect(options(h.el)[0]!.getAttribute('aria-selected')).toBe('true');
    expect(status(h)).toBe('2 loaded');
    ($(h.el, '.more') as HTMLElement).click();
    await settle(h.el);
    await h.answer([notes]);
    expect(names(h.el)).toEqual(['Launch brief', 'Release checklist', 'Pricing notes']);
    expect($(h.el, '.more')).toBeNull();
  });

  it('a known total replaces "N loaded" with the matches; a new search forgets the pages', async () => {
    const h = await mountBrowsable();
    await open(h);
    const search = $(h.el, '[part="search"]') as HTMLInputElement;
    search.value = 'l';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 260));
    await h.answer([brief], [], { nextCursor: 'p2', total: 30 });
    expect(status(h)).toBe('30 matches · Drive, Wiki and Records');
    ($(h.el, '.more') as HTMLElement).click();
    await settle(h.el);
    await h.answer([checklist], [], { total: 30 });
    expect(names(h.el)).toEqual(['Launch brief', 'Release checklist']);
    search.value = 'la';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 260));
    expect(h.queries.at(-1)).not.toHaveProperty('cursor');
    await h.answer([notes]);
    expect(names(h.el)).toEqual(['Pricing notes']);
  });
});

describe('odd-context-picker: the expanded browser', () => {
  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
  const status = (h: Harness) => text($(h.el, '.status-line'));
  const footer = (h: Harness, label: string) =>
    $$(h.el, '[part="footer"] button').find((b) => text(b) === label) as HTMLElement;
  const mountBrowsable = (setup: (el: Picker) => void = () => {}) =>
    mount((el) => {
      el.sources = browsable;
      setup(el);
    });
  const expand = async (h: Harness) => {
    footer(h, 'Browse…').click();
    await settle(h.el);
  };
  const type = async (h: Harness, query: string) => {
    const search = $(h.el, '[part="search"]') as HTMLInputElement;
    search.value = query;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 260));
    await settle(h.el);
  };
  const chips = (h: Harness) => $$(h.el, '.review odd-chip');
  const removeOf = (chip: HTMLElement) =>
    chip.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove"]')!;

  it('Browse… opens a modal dialog that keeps the query, scope, results, and draft', async () => {
    const h = await mountBrowsable((el) => {
      el.commit = 'confirm';
      el.value = [brief];
    });
    const toggles: string[] = [];
    h.el.addEventListener('toggle', (e) => toggles.push((e as ToggleEvent).newState));
    await open(h);
    await h.answer([brief, checklist]);
    options(h.el)[1]!.click();
    await settle(h.el);
    const scope = $(h.el, 'select.scope') as HTMLSelectElement;
    scope.value = 'drive';
    scope.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(h.el);
    await h.answer([brief]);
    await type(h, 'la');
    await h.answer([brief]);
    const asked = h.queries.length;
    await expand(h);
    const dialog = $(h.el, '[part="surface"]') as HTMLDialogElement;
    expect(dialog.localName).toBe('dialog');
    expect(dialog.classList.contains('browser')).toBe(true);
    expect(dialog.open && dialog.matches(':modal'), 'modal: the page behind is inert').toBe(true);
    // The scrim behind it, as behind every Oddkin modal.
    const scrim = document.createElement('div');
    scrim.style.backgroundColor = 'var(--odd-color-scrim)';
    container.append(scrim);
    expect(getComputedStyle(dialog, '::backdrop').backgroundColor).toBe(
      getComputedStyle(scrim).backgroundColor,
    );
    expect(text($(h.el, '#title'))).toBe('Browse context');
    expect(($(h.el, '[part="search"]') as HTMLInputElement).value).toBe('la');
    expect(names(h.el)).toEqual(['Launch brief']);
    expect(h.queries, 'nothing is asked again').toHaveLength(asked);
    expect($(h.el, 'nav.nav')!.getAttribute('aria-label')).toBe('Sources');
    expect($$(h.el, '.nav .source').map(text), 'All sources and every source').toEqual([
      'All sources',
      'Drive',
      'Wiki',
      'Records',
    ]);
    // The scope is the current source; it has the focus.
    const scoped = $(h.el, '.nav [aria-current="true"]');
    expect(text(scoped)).toBe('Drive');
    expect(h.el.shadowRoot!.activeElement).toBe(scoped);
    expect($(h.el, '.scope-row'), 'the list replaces the scope row').toBeNull();
    expect($$(h.el, '[part="footer"] button').map(text)).toEqual(['Cancel', 'Add 2']);
    expect(text($(h.el, '#review-title'))).toBe('Selected · 2');
    expect($(h.el, '.review')!.getAttribute('aria-labelledby')).toBe('review-title');
    expect(chips(h).map(text)).toEqual(['Launch brief · Drive', 'Release checklist · Wiki']);
    expect(text($(h.el, '.review .status-line'))).toBe(
      'Selections stay when you change search or source.',
    );
    expect($(h.el, '[part="trigger"]')!.getAttribute('aria-expanded')).toBe('true');
    expect(toggles, 'still the same open picker').toEqual(['open']);
    expect(h.el.value).toEqual([brief]);
  });

  it('Browse… inside a location keeps it and focuses its source; from the list of sources, the results', async () => {
    const h = await mountBrowsable();
    await open(h);
    await h.answer([]);
    await type(h, 'la');
    await h.answer([launch, brief]);
    ($(h.el, '.container') as HTMLElement).click();
    await settle(h.el);
    await h.answer([folderRef]);
    const asked = h.queries.length;
    await expand(h);
    expect(status(h)).toBe('Drive / Launch · browse');
    expect(text($(h.el, '.back'))).toBe('Back · Drive');
    const drive = $$(h.el, '.nav .source')[1]!;
    expect(drive.getAttribute('aria-current')).toBe('true');
    expect(h.el.shadowRoot!.activeElement).toBe(drive);
    expect(names(h.el)).toEqual(['Launch folder']);
    expect(h.queries).toHaveLength(asked);
    // Out to the surface's own list of sources, then Browse…: the browser shows the results.
    h.el.open = false;
    await settle(h.el);
    await open(h);
    await h.answer([]);
    await type(h, 'la');
    await h.answer([launch]);
    ($(h.el, '.container') as HTMLElement).click();
    await settle(h.el);
    await h.answer([]);
    ($(h.el, '.back') as HTMLElement).click();
    await settle(h.el);
    await h.answer([launch]);
    ($(h.el, '.back') as HTMLElement).click();
    await settle(h.el);
    expect($$(h.el, '.browse .source')).toHaveLength(2);
    await expand(h);
    expect($(h.el, '.browse')).toBeNull();
    expect(h.queries.at(-1)).toMatchObject({ query: '', sourceIds: ['drive', 'wiki', 'records'] });
    expect(h.queries.at(-1)).not.toHaveProperty('location');
  });

  it("a chip's remove button unchooses it, a draft in confirm mode; focus moves on to the next chip, then the search", async () => {
    const h = await mountBrowsable((el) => {
      el.commit = 'confirm';
      el.value = [brief, checklist];
    });
    const reasons: string[] = [];
    h.el.addEventListener('odd-context-change', (e) => reasons.push(e.detail.reason));
    await open(h);
    await h.answer([brief, checklist]);
    await expand(h);
    removeOf(chips(h)[0]!).click();
    await settle(h.el);
    expect(reasons, 'a draft: nothing is proposed yet').toEqual([]);
    expect(chips(h).map(text)).toEqual(['Release checklist · Wiki']);
    expect(text($(h.el, '#review-title'))).toBe('Selected · 1');
    expect(options(h.el)[0]!.getAttribute('aria-selected')).toBe('false');
    expect(h.el.shadowRoot!.activeElement).toBe(chips(h)[0]);
    expect(chips(h)[0]!.shadowRoot!.activeElement).toBe(removeOf(chips(h)[0]!));
    await userEvent.keyboard('{Delete}');
    await settle(h.el);
    expect(chips(h)).toHaveLength(0);
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '[part="search"]'));
    expect(h.el.value).toEqual([brief, checklist]);
    footer(h, 'Add 0').click();
    await settle(h.el);
    expect(reasons).toEqual(['apply']);
    expect(h.el.value).toEqual([]);
  });

  it("a chip's remove button proposes the change in immediate mode, announced", async () => {
    const h = await mountBrowsable((el) => (el.value = [brief, checklist]));
    const heard: string[] = [];
    container.addEventListener('odd-announce', (e) => {
      heard.push((e as CustomEvent<{ text: string }>).detail.text);
      e.preventDefault();
    });
    const changes: string[] = [];
    h.el.addEventListener('odd-context-change', (e) => changes.push(e.detail.reason));
    await open(h);
    await h.answer([brief, checklist]);
    await expand(h);
    removeOf(chips(h)[1]!).click();
    await settle(h.el);
    expect(changes).toEqual(['remove']);
    expect(h.el.value).toEqual([brief]);
    expect(heard.at(-1)).toBe('Release checklist removed. 1 selected.');
    expect(chips(h)[0]!.shadowRoot!.activeElement, 'the last chip: the one before').toBe(
      removeOf(chips(h)[0]!),
    );
    expect(h.el.open).toBe(true);
  });

  for (const how of ['Escape', 'Close', 'Cancel'] as const)
    it(`${how} closes the browser, discards the draft, and returns focus to the trigger`, async () => {
      const h = await mountBrowsable((el) => {
        el.commit = 'confirm';
        el.value = [brief];
      });
      await open(h);
      await h.answer([brief, checklist]);
      await expand(h);
      options(h.el)[1]!.click();
      await settle(h.el);
      if (how === 'Escape') await userEvent.keyboard('{Escape}');
      else if (how === 'Close') ($(h.el, '.close') as HTMLElement).click();
      else footer(h, 'Cancel').click();
      await settle(h.el);
      expect(h.el.open).toBe(false);
      expect(h.el.value).toEqual([brief]);
      expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '[part="trigger"]'));
      expect($(h.el, '[part="surface"]')!.localName, 'it opens as the presentation says').toBe(
        'div',
      );
    });

  it('Add N applies the draft chosen in the browser and closes', async () => {
    const h = await mountBrowsable((el) => {
      el.commit = 'confirm';
      el.value = [brief];
    });
    await open(h);
    await h.answer([brief, checklist]);
    await expand(h);
    options(h.el)[1]!.click();
    await settle(h.el);
    footer(h, 'Add 2').click();
    await settle(h.el);
    expect(h.el.value).toEqual([brief, checklist]);
    expect(h.el.open).toBe(false);
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '[part="trigger"]'));
  });

  it('from the sheet, Browse… keeps the same modal dialog open as the browser', async () => {
    const h = await mountBrowsable((el) => (el.presentation = 'sheet'));
    await open(h);
    await h.answer([brief]);
    const dialog = $(h.el, '[part="surface"]') as HTMLDialogElement;
    expect(dialog.classList.contains('fullscreen')).toBe(true);
    await expand(h);
    expect($(h.el, '[part="surface"]')).toBe(dialog);
    expect(dialog.classList.contains('browser')).toBe(true);
    expect(dialog.open && dialog.matches(':modal')).toBe(true);
    expect(h.el.shadowRoot!.activeElement).toBe($(h.el, '.nav .source'));
    expect($(h.el, '.collection > .status-line'), 'the review carries the hint').toBeNull();
    ($(h.el, '.close') as HTMLElement).click();
    await settle(h.el);
    expect(h.el.open).toBe(false);
    await open(h);
    expect(
      ($(h.el, '[part="surface"]') as HTMLDialogElement).classList.contains('fullscreen'),
    ).toBe(true);
  });
});
