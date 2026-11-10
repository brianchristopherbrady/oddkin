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
  answer(items: ContextResource[], failed?: string[]): Promise<void>;
}

/** A picker whose host records each query; with `accept`, it accepts every change. */
async function mount(setup: (el: Picker) => void = () => {}, accept = true): Promise<Harness> {
  await import('../src/context-picker/context-picker.define.js');
  const el = document.createElement('odd-context-picker');
  el.sources = sources;
  el.multiple = true;
  setup(el);
  const queries: ContextQueryDetail[] = [];
  el.addEventListener('odd-context-query', (e) => queries.push(e.detail));
  if (accept) el.addEventListener('odd-context-change', (e) => (el.value = e.detail.value));
  container.append(el);
  await settle(el);
  return {
    el,
    queries,
    async answer(items, failed = []) {
      const q = queries.at(-1)!;
      el.results = {
        requestId: q.requestId,
        items,
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
    await userEvent.keyboard('{ArrowDown}');
    await settle(h.el);
    expect(results.getAttribute('aria-activedescendant')).toBe(options(h.el)[1]!.id);
    expect(changes).toEqual([]);
    await userEvent.keyboard(' ');
    await settle(h.el);
    expect(changes).toEqual(['add']);
    expect(h.el.value).toEqual([checklist]);
    expect(options(h.el)[1]!.getAttribute('aria-selected')).toBe('true');
    // Still open in multiple mode.
    expect(h.el.open).toBe(true);
  });

  it('changes nothing until the host sets the value; a cancelled change is refused', async () => {
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

  it('a host that neither accepts nor cancels changes nothing: no choice, no announcement, still open', async () => {
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
    expect(h.el.value).toEqual([]);
    expect(heard).toEqual([]);
    expect(h.el.open).toBe(true);
  });

  it('a change the host cancels is refused even if it also set the value', async () => {
    const h = await mount((el) => (el.multiple = false), false);
    h.el.addEventListener('odd-context-change', (e) => {
      h.el.value = e.detail.value;
      e.preventDefault();
    });
    await open(h);
    await h.answer([brief]);
    options(h.el)[0]!.click();
    await settle(h.el);
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

  it('disabled: the trigger is off and nothing opens', async () => {
    const h = await mount((el) => (el.disabled = true));
    expect(($(h.el, '[part="trigger"]') as HTMLButtonElement).disabled).toBe(true);
    await open(h);
    expect(h.el.open).toBe(false);
    expect(h.queries).toHaveLength(0);
  });
});
