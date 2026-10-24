import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type {
  CommandRecord,
  OddkinCommandPalette,
} from '../src/command-palette/command-palette.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-command-palette (component-contracts.md §3.6, §2.5, §2.6), with the shipped theme.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
afterEach(async () => {
  await userEvent.unhover(document.body);
  container?.remove();
  flush();
});

const COMMANDS: readonly CommandRecord[] = [
  { id: 'new', label: 'New project', shortcut: 'Ctrl N', group: 'Commands' },
  { id: 'invite', label: 'Invite people', group: 'Commands' },
  { id: 'theme', label: 'Switch theme', description: 'Light or dark', group: 'Commands' },
  { id: 'atlas', label: 'Atlas', group: 'Projects' },
  { id: 'beacon', label: 'Beacon', group: 'Projects', disabled: true },
];

async function mount(attributes = 'label="Command palette"', items = COMMANDS) {
  container = document.createElement('div');
  container.innerHTML = `<button type="button" id="opener">Search</button><odd-command-palette ${attributes}></odd-command-palette>`;
  document.body.append(container);
  const el = container.querySelector<OddkinCommandPalette>('odd-command-palette')!;
  el.items = items;
  await settle(el);
  const log: string[] = [];
  el.addEventListener('odd-action', (event) =>
    log.push(`action ${(event as CustomEvent<{ id: string; action: string }>).detail.id}`),
  );
  el.addEventListener('odd-query-change', (event) =>
    log.push(`query ${(event as CustomEvent<{ query: string }>).detail.query}`),
  );
  el.addEventListener('close', () => log.push('close'));
  for (const name of ['input', 'change']) el.addEventListener(name, () => log.push(name));
  return { el, log, opener: container.querySelector<HTMLButtonElement>('#opener')! };
}
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const input = (el: Element) => part(el, 'input') as HTMLInputElement;
const rows = (el: Element) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]')];
const text = (row: Element | null | undefined) => row?.querySelector('.option-text')?.textContent;
const shown = (el: Element) => rows(el).map(text);
const row = (el: Element, label: string) => rows(el).find((r) => text(r) === label)!;
const active = (el: Element) => {
  const id = input(el).getAttribute('aria-activedescendant');
  return id ? text(el.shadowRoot!.getElementById(id)) : undefined;
};
const open = async (el: OddkinCommandPalette, opener: HTMLElement) => {
  opener.focus();
  el.show();
  await settle(el);
};

describe('odd-command-palette', () => {
  it('opens as a modal dialog with focus in the labelled search input', async () => {
    const { el, opener } = await mount('label="Command palette" placeholder="Search…"');
    const dialog = part(el, 'dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);
    await open(el, opener);
    expect(el.open).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
    expect(dialog.matches(':modal')).toBe(true);
    await expect
      .element(page.getByRole('dialog', { name: 'Command palette', exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole('combobox', { name: 'Search commands', exact: true }))
      .toBeVisible();
    expect(el.shadowRoot!.activeElement).toBe(input(el));
    const box = input(el);
    expect(box.placeholder).toBe('Search…');
    expect(box.getAttribute('aria-controls')).toBe('results');
    expect(box.getAttribute('aria-expanded')).toBe('true');
    expect(part(el, 'listbox').getAttribute('aria-label')).toBe('Command palette');
    expect(shown(el)).toEqual(['New project', 'Invite people', 'Switch theme', 'Atlas', 'Beacon']);
    expect(active(el)).toBe('New project');
    expect(row(el, 'New project').getAttribute('aria-selected')).toBe('true');
    // Groups are named by their heading.
    const groups = [...el.shadowRoot!.querySelectorAll('[role="group"]')];
    expect(
      groups.map(
        (g) => el.shadowRoot!.getElementById(g.getAttribute('aria-labelledby')!)!.textContent,
      ),
    ).toEqual(['Commands', 'Projects']);
    expect(row(el, 'New project').querySelector('.shortcut')!.textContent).toBe('Ctrl N');
  });

  it('filters while typing and runs the active command with Enter, then closes and returns focus', async () => {
    const { el, log, opener } = await mount();
    await open(el, opener);
    // The label contains the text anywhere.
    await userEvent.keyboard('pro');
    await settle(el);
    expect(shown(el)).toEqual(['New project']);
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}in');
    await settle(el);
    expect(shown(el)).toEqual(['Invite people']);
    expect(active(el)).toBe('Invite people');
    expect(el.query).toBe('in');
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(log.filter((line) => !line.startsWith('query'))).toEqual(['action invite', 'close']);
    expect(log).toContain('query in');
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(opener);
    // Each opening starts from an empty search.
    await open(el, opener);
    expect(input(el).value).toBe('');
    expect(shown(el)).toHaveLength(5);
  });

  it('moves over usable commands with the arrows, wrapping, and runs one with a click', async () => {
    const { el, log, opener } = await mount();
    await open(el, opener);
    await userEvent.keyboard('{ArrowUp}');
    await settle(el);
    // Beacon is disabled and skipped.
    expect(active(el)).toBe('Atlas');
    await userEvent.keyboard('{ArrowDown}');
    await settle(el);
    expect(active(el)).toBe('New project');
    await userEvent.click(row(el, 'Beacon'), { force: true });
    await settle(el);
    expect(el.open).toBe(true);
    expect(log).toEqual([]);
    await userEvent.click(row(el, 'Atlas'));
    await settle(el);
    expect(log).toEqual(['action atlas', 'close']);
    expect(el.open).toBe(false);
  });

  it('stays open when odd-action is cancelled', async () => {
    const { el, opener } = await mount();
    el.addEventListener('odd-action', (event) => event.preventDefault());
    await open(el, opener);
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(el.open).toBe(true);
    // A press on a command keeps focus in the search input.
    await userEvent.click(row(el, 'Atlas'));
    await settle(el);
    expect(el.open).toBe(true);
    expect(el.shadowRoot!.activeElement).toBe(input(el));
  });

  it('closes with Escape and returns focus to the opener', async () => {
    const { el, log, opener } = await mount();
    await open(el, opener);
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => el.open).toBe(false);
    expect(log).toContain('close');
    expect(document.activeElement).toBe(opener);
    expect(log.some((line) => line === 'input' || line === 'change')).toBe(false);
  });

  it('closes on a press on the backdrop', async () => {
    const { el, opener } = await mount();
    await open(el, opener);
    await userEvent.click(part(el, 'dialog'), { position: { x: -20, y: -20 }, force: true });
    await expect.poll(() => el.open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('starts in the search input even when the status slot holds a control', async () => {
    const { el, opener } = await mount();
    el.insertAdjacentHTML('beforeend', '<button slot="status">Try again</button>');
    await open(el, opener);
    expect(el.shadowRoot!.activeElement).toBe(input(el));
  });

  it('opens and closes from the open property and attribute', async () => {
    const { el } = await mount();
    el.open = true;
    await settle(el);
    expect((part(el, 'dialog') as HTMLDialogElement).open).toBe(true);
    el.removeAttribute('open');
    await settle(el);
    expect((part(el, 'dialog') as HTMLDialogElement).open).toBe(false);
  });

  it('leaves the search to the page with no-filter', async () => {
    const { el, log, opener } = await mount('label="Search projects" no-filter', []);
    el.addEventListener('odd-query-change', (event) => {
      const query = (event as CustomEvent<{ query: string }>).detail.query;
      el.items = ['Atlas', 'Beacon']
        .filter((name) => name.toLowerCase().startsWith(query.toLowerCase()))
        .map((name) => ({ id: name.toLowerCase(), label: name }));
    });
    await open(el, opener);
    expect(part(el, 'empty').hidden).toBe(false);
    await userEvent.keyboard('b');
    await settle(el);
    expect(shown(el)).toEqual(['Beacon']);
    expect(active(el)).toBe('Beacon');
    el.items = [{ id: 'delta', label: 'Delta' }];
    await settle(el);
    expect(shown(el)).toEqual(['Delta']);
    expect(log).toEqual(['query b']);
  });

  it('shows the loading, empty, and status states', async () => {
    const { el, opener } = await mount('label="Command palette" loading', []);
    await open(el, opener);
    expect(part(el, 'loading').hidden).toBe(false);
    expect(part(el, 'loading').textContent!.trim()).toBe('Loading…');
    expect(part(el, 'empty').hidden).toBe(true);
    el.loading = false;
    await settle(el);
    await expect.element(page.getByText('No matching commands')).toBeVisible();
    el.insertAdjacentHTML('beforeend', '<p slot="status" role="alert">Search is unavailable</p>');
    await settle(el);
    await expect.element(page.getByRole('alert')).toHaveTextContent('Search is unavailable');
    el.items = COMMANDS;
    el.loading = true;
    await expect.poll(() => rows(el).length).toBe(5);
    expect(part(el, 'listbox').getAttribute('aria-busy')).toBe('true');
  });

  it('draws the raised palette, the ringed search field, and the active command in the selection colours', async () => {
    const { el, opener } = await mount();
    await open(el, opener);
    const dialog = getComputedStyle(part(el, 'dialog'));
    expect(dialog.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-raised'),
    );
    // In dark mode the raised surface differs from the default one (a modal sheet's).
    container.dataset['oddMode'] = 'dark';
    const raised = document.createElement('span');
    raised.style.backgroundColor = 'var(--odd-color-surface-raised)';
    container.append(raised);
    expect(getComputedStyle(part(el, 'dialog')).backgroundColor).toBe(
      getComputedStyle(raised).backgroundColor,
    );
    delete container.dataset['oddMode'];
    expect(dialog.borderTopLeftRadius).toBe(
      themeValue('border-top-left-radius', '--odd-radius-lg'),
    );
    expect(dialog.paddingTop).toBe(themeValue('padding-top', '--odd-space-lg'));
    const search = getComputedStyle(part(el, 'search'));
    expect(search.borderTopColor).toBe(themeValue('border-top-color', '--odd-color-focus-ring'));
    expect(search.minHeight).toBe(themeValue('min-height', '--odd-control-height-lg'));
    const first = getComputedStyle(row(el, 'New project'));
    expect(first.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-selection-background'),
    );
    expect(first.color).toBe(themeValue('color', '--odd-color-selection-foreground'));
    // The disabled row: no hover surface under a resting pointer.
    expect(getComputedStyle(row(el, 'Beacon')).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-default'),
    );
    expect(getComputedStyle(row(el, 'Beacon')).color).toBe(
      themeValue('color', '--odd-color-text-disabled'),
    );
    expect(getComputedStyle(part(el, 'group')).fontSize).toBe(
      themeValue('font-size', '--odd-type-eyebrow-size'),
    );
    expect(part(el, 'footer').textContent!.replace(/\s+/g, ' ').trim()).toBe(
      '↑ ↓ Navigate ↵ Open Esc Close',
    );
  });

  it.runIf(server.browser === 'chromium')(
    'marks the active command in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el, opener } = await mount();
        await open(el, opener);
        const probe = document.createElement('span');
        probe.style.color = 'Highlight';
        container.append(probe);
        expect(getComputedStyle(row(el, 'New project')).backgroundColor).toBe(
          getComputedStyle(probe).color,
        );
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything when removed, also while open', async () => {
    const before = scopeStats();
    const { el, opener } = await mount();
    await open(el, opener);
    await userEvent.keyboard('a');
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
