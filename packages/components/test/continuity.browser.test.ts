import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import type { CommandRecord } from '../src/command-palette/command-palette.js';
import './register.js';
import { loadTheme, settle } from './probe.js';

// Continuity (responsiveness.md; component-contracts.md §2.11): a change of width keeps the
// person's work, and an open surface stays open and beside what opened it. Each probe acts first
// (opens a surface, types, chooses, focuses), then narrows and widens the parent, in the default
// and the compact density and right to left. Anchored surfaces are measured inside the test
// viewport (parents of 400 to 200 px); the modal ones and the toast belong to the viewport, which
// changes instead.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
let viewport: [number, number];
beforeEach(() => {
  viewport = [innerWidth, innerHeight];
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  await userEvent.unhover(document.body);
  container.remove();
  flush();
  await page.viewport(...viewport);
});

const SETUPS = ['default density', 'compact density', 'right to left'] as const;
type Setup = (typeof SETUPS)[number];
const WIDTHS = [400, 260, 200, 400, 200];

const frames = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

async function mount<E extends HTMLElement>(setup: Setup, html: string, selector: string) {
  Object.assign(container.style, { boxSizing: 'border-box', padding: '10px', inlineSize: '400px' });
  if (setup === 'compact density') container.dataset['oddDensity'] = 'compact';
  if (setup === 'right to left') container.dir = 'rtl';
  container.innerHTML = html;
  const el = container.querySelector<E>(selector)!;
  await settle(el);
  return el;
}
const resize = async (width: number, ...els: HTMLElement[]) => {
  container.style.inlineSize = `${width}px`;
  for (const el of els) await settle(el as HTMLElement & { updateComplete?: Promise<unknown> });
  await frames();
};
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
/** The focused element, through open shadow roots. */
const focused = (): Element | null => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
};
/** Nothing overflows the parent sideways. */
const expectInside = () =>
  expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth + 1);
/** Beside its anchor: on a side of it, within `gap`, and across from it on the other axis. */
const expectBeside = (anchor: Element, surface: Element, gap = 16) => {
  const [a, s] = [anchor.getBoundingClientRect(), surface.getBoundingClientRect()];
  const block =
    Math.min(Math.abs(a.top - s.bottom), Math.abs(s.top - a.bottom)) <= gap &&
    s.left < a.right &&
    a.left < s.right;
  const inline =
    Math.min(Math.abs(a.left - s.right), Math.abs(s.left - a.right)) <= gap &&
    s.top < a.bottom &&
    a.top < s.bottom;
  expect(block || inline, JSON.stringify({ anchor: a.toJSON(), surface: s.toJSON() })).toBe(true);
};
/** Inside the viewport. */
const expectInViewport = (el: Element) => {
  const box = el.getBoundingClientRect();
  expect(box.left).toBeGreaterThanOrEqual(-1);
  expect(box.right).toBeLessThanOrEqual(document.documentElement.clientWidth + 1);
};
const isOpen = (el: Element) => el.matches(':popover-open');
/** The density no width changes: each element's padding and font size. */
const sameLook = (...els: Element[]) => {
  const look = () =>
    els.map((el) => {
      const style = getComputedStyle(el);
      return [style.paddingInlineStart, style.paddingBlockStart, style.fontSize];
    });
  const first = look();
  return () => expect(look()).toEqual(first);
};

describe('overlays and pickers keep their place and the work in them (row 30)', () => {
  it.each(SETUPS)(
    'odd-popover stays open by its trigger with a draft in it (%s)',
    async (setup) => {
      const el = await mount(
        setup,
        `<p>Share the workspace with the people <button popovertarget="p" id="trigger">Share</button> who review it.</p>
        <odd-popover id="p" label="Share workspace"><p>Invite people.</p><input id="invite" aria-label="Email"></odd-popover>`,
        'odd-popover',
      );
      const trigger = container.querySelector<HTMLElement>('#trigger')!;
      await userEvent.click(trigger);
      await expect.poll(() => isOpen(el)).toBe(true);
      const field = container.querySelector<HTMLInputElement>('#invite')!;
      await userEvent.fill(field, 'alex@example.com');
      field.setSelectionRange(4, 4);
      const unchanged = sameLook(trigger, el, field);
      for (const width of WIDTHS) {
        await resize(width, el);
        expect(isOpen(el)).toBe(true);
        expectBeside(trigger, el);
        expect(focused()).toBe(field);
        expect([field.value, field.selectionStart]).toEqual(['alex@example.com', 4]);
        expectInside();
        unchanged();
      }
    },
  );

  it.each(SETUPS)('odd-tooltip stays shown by its focused anchor (%s)', async (setup) => {
    const el = await mount(
      setup,
      `<p>Copy a link to this workspace <button id="copy" aria-label="Copy link">C</button> for the team.</p>
      <odd-tooltip id="t" anchor="copy">Copy a link to this workspace</odd-tooltip>`,
      'odd-tooltip',
    );
    const anchor = container.querySelector<HTMLElement>('#copy')!;
    anchor.focus();
    await expect.poll(() => isOpen(el), { timeout: 3000 }).toBe(true);
    const unchanged = sameLook(anchor, el);
    for (const width of WIDTHS) {
      await resize(width, el);
      expect(isOpen(el)).toBe(true);
      expectBeside(anchor, el);
      expect(focused()).toBe(anchor);
      expectInside();
      unchanged();
    }
  });

  it.each(SETUPS)('odd-menu stays open by its trigger on the active item (%s)', async (setup) => {
    const el = await mount(
      setup,
      `<p>Manage the project <odd-menu>Project actions<option value="new">New project</option><option value="rename">Rename</option><option value="delete">Delete project</option></odd-menu> from here.</p>`,
      'odd-menu',
    );
    const trigger = part(el, 'trigger');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const menu = part(el, 'menu');
    await expect.poll(() => isOpen(menu)).toBe(true);
    await userEvent.keyboard('{ArrowDown}');
    await settle(el);
    const item = focused();
    expect(item?.textContent?.trim()).toBe('Rename');
    const unchanged = sameLook(trigger, menu, item!);
    for (const width of WIDTHS) {
      await resize(width, el);
      expect(isOpen(menu)).toBe(true);
      expectBeside(trigger, menu);
      expect(focused()).toBe(item);
      expectInside();
      unchanged();
    }
  });

  it.each(SETUPS)('odd-select keeps the chosen option and the focus (%s)', async (setup) => {
    const el = await mount(
      setup,
      `<odd-select label="Workspace role" name="role"><option value="editor" selected>Editor</option><option value="admin">Administrator, with every permission in the workspace</option></odd-select>`,
      'odd-select',
    );
    const control = part(el, 'control') as HTMLSelectElement;
    await userEvent.selectOptions(control, 'admin');
    control.focus();
    const unchanged = sameLook(control);
    for (const width of WIDTHS) {
      await resize(width, el);
      expect(part(el, 'control')).toBe(control);
      expect((el as HTMLElement & { value: string }).value).toBe('admin');
      expect(focused()).toBe(control);
      expectInside();
      unchanged();
    }
  });

  it.each(SETUPS)('odd-listbox keeps the active option and the focus (%s)', async (setup) => {
    const el = await mount(
      setup,
      `<odd-listbox label="Workspace role" name="role"><option value="editor" selected>Editor</option><option value="admin">Administrator, with every permission in the workspace</option><option value="viewer">Viewer</option></odd-listbox>`,
      'odd-listbox',
    );
    const listbox = part(el, 'listbox');
    listbox.focus();
    await userEvent.keyboard('{ArrowDown}');
    await settle(el);
    const active = listbox.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    const unchanged = sameLook(listbox);
    for (const width of WIDTHS) {
      await resize(width, el);
      expect(part(el, 'listbox')).toBe(listbox);
      expect(listbox.getAttribute('aria-activedescendant')).toBe(active);
      expect(focused()).toBe(listbox);
      expectInside();
      unchanged();
    }
  });

  it.each(SETUPS)(
    'odd-date-picker keeps a typed date, then its open calendar by the field (%s)',
    async (setup) => {
      const el = await mount(
        setup,
        `<odd-date-picker label="Publish date" value="2026-10-26"></odd-date-picker>`,
        'odd-date-picker',
      );
      const control = part(el, 'control') as HTMLInputElement;
      await userEvent.fill(control, '2026-11-2');
      control.setSelectionRange(5, 5);
      const unchanged = sameLook(control);
      for (const width of WIDTHS) {
        await resize(width, el);
        expect(part(el, 'control')).toBe(control);
        expect([control.value, control.selectionStart]).toEqual(['2026-11-2', 5]);
        expect(focused()).toBe(control);
        expectInside();
        unchanged();
      }
      const button = part(el, 'button');
      await userEvent.click(button);
      const popup = part(el, 'popup');
      await expect.poll(() => isOpen(popup)).toBe(true);
      await settle(el);
      const day = focused();
      expect(day).not.toBe(control);
      for (const width of WIDTHS) {
        await resize(width, el);
        expect(isOpen(popup)).toBe(true);
        // The calendar hangs from the date field, not from its button.
        expectBeside(control, popup, 24);
        expect(focused()).toBe(day);
        expectInside();
      }
    },
  );

  it.each(SETUPS)(
    'odd-color-picker keeps its open panel by the button and a hex value being typed (%s)',
    async (setup) => {
      const el = await mount(
        setup,
        `<odd-color-picker label="Color" value="#2563EB"></odd-color-picker>`,
        'odd-color-picker',
      );
      const button = part(el, 'button');
      await userEvent.click(button);
      const popup = part(el, 'popup');
      await expect.poll(() => isOpen(popup)).toBe(true);
      const hex = part(el, 'hex') as HTMLInputElement;
      await userEvent.fill(hex, '#0A7D3');
      hex.setSelectionRange(2, 2);
      const unchanged = sameLook(popup, hex);
      for (const width of WIDTHS) {
        await resize(width, el);
        expect(isOpen(popup)).toBe(true);
        expectBeside(button, popup, 24);
        expect(focused()).toBe(hex);
        expect([hex.value, hex.selectionStart]).toEqual(['#0A7D3', 2]);
        expectInside();
        unchanged();
      }
    },
  );

  it.each(SETUPS)(
    'odd-split-button keeps its open menu by the trigger on the active item (%s)',
    async (setup) => {
      const el = await mount(
        setup,
        `<p>Save the draft <odd-split-button value="save">Save<option value="save-as">Save as…</option><option value="copy">Save a copy</option></odd-split-button> before closing.</p>`,
        'odd-split-button',
      );
      const menu = el.shadowRoot!.querySelector<HTMLElement>('odd-menu')!;
      const trigger = part(menu, 'trigger');
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      const surface = part(menu, 'menu');
      await expect.poll(() => isOpen(surface)).toBe(true);
      await userEvent.keyboard('{ArrowDown}');
      await settle(menu);
      const item = focused();
      expect(item?.textContent?.trim()).toBe('Save a copy');
      const unchanged = sameLook(trigger, surface, item!);
      for (const width of WIDTHS) {
        await resize(width, el, menu);
        expect(isOpen(surface)).toBe(true);
        expectBeside(trigger, surface);
        expect(focused()).toBe(item);
        expectInside();
        unchanged();
      }
    },
  );

  // Modal surfaces and the toast belong to the viewport: it changes instead of a parent.
  const VIEWPORTS: readonly [number, number][] = [
    [414, 700],
    [320, 600],
    [280, 560],
    [414, 700],
    [280, 560],
  ];

  it.each(SETUPS)(
    'odd-dialog stays open with a draft and the focus while the viewport changes (%s)',
    async (setup) => {
      const el = await mount<HTMLElement & { show(): void; open: boolean }>(
        setup,
        `<odd-dialog label="Rename workspace"><p>Choose a clear name that the whole team will recognise.</p><input id="name" aria-label="Name" value="Design"><button id="save" slot="footer">Save</button></odd-dialog>`,
        'odd-dialog',
      );
      el.show();
      await settle(el);
      const field = container.querySelector<HTMLInputElement>('#name')!;
      await userEvent.fill(field, 'Design review');
      field.setSelectionRange(3, 3);
      const dialog = part(el, 'dialog');
      const unchanged = sameLook(dialog, part(el, 'body'), field);
      for (const [width, height] of VIEWPORTS) {
        await page.viewport(width, height);
        await settle(el);
        await frames();
        expect(el.open).toBe(true);
        expect(focused()).toBe(field);
        expect([field.value, field.selectionStart]).toEqual(['Design review', 3]);
        expectInViewport(dialog);
        unchanged();
      }
    },
  );

  it.each(SETUPS)(
    'odd-drawer stays open with a draft and the focus while the viewport changes (%s)',
    async (setup) => {
      const el = await mount<HTMLElement & { show(): void; open: boolean }>(
        setup,
        `<odd-drawer label="Member details"><p>Alex Morgan</p><input id="name" aria-label="Name" value="Alex"><button id="save" slot="footer">Save</button></odd-drawer>`,
        'odd-drawer',
      );
      el.show();
      await settle(el);
      const field = container.querySelector<HTMLInputElement>('#name')!;
      await userEvent.fill(field, 'Alex Morgan');
      field.setSelectionRange(2, 2);
      const panel = part(el, 'dialog');
      const unchanged = sameLook(panel, part(el, 'body'), field);
      for (const [width, height] of VIEWPORTS) {
        await page.viewport(width, height);
        await settle(el);
        await frames();
        expect(el.open).toBe(true);
        expect(focused()).toBe(field);
        expect([field.value, field.selectionStart]).toEqual(['Alex Morgan', 2]);
        expectInViewport(panel);
        unchanged();
      }
    },
  );

  it.each(SETUPS)(
    'odd-command-palette keeps its query and the active result while the viewport changes (%s)',
    async (setup) => {
      const el = await mount<HTMLElement & { show(): void; open: boolean; items: unknown }>(
        setup,
        `<odd-command-palette label="Command palette"></odd-command-palette>`,
        'odd-command-palette',
      );
      const commands: readonly CommandRecord[] = [
        { id: 'new', label: 'New project', group: 'Commands' },
        { id: 'invite', label: 'Invite people to the workspace', group: 'Commands' },
        { id: 'theme', label: 'Switch theme', description: 'Light or dark', group: 'Commands' },
      ];
      el.items = commands;
      el.show();
      await settle(el);
      const input = part(el, 'input') as HTMLInputElement;
      await userEvent.fill(input, 'pro');
      await userEvent.keyboard('{ArrowDown}');
      input.setSelectionRange(1, 1);
      await settle(el);
      const active = input.getAttribute('aria-activedescendant');
      const dialog = part(el, 'dialog');
      const unchanged = sameLook(dialog, input);
      for (const [width, height] of VIEWPORTS) {
        await page.viewport(width, height);
        await settle(el);
        await frames();
        expect(el.open).toBe(true);
        expect(focused()).toBe(input);
        expect([input.value, input.selectionStart]).toEqual(['pro', 1]);
        expect(input.getAttribute('aria-activedescendant')).toBe(active);
        expectInViewport(dialog);
        unchanged();
      }
    },
  );

  it.each(SETUPS)(
    'odd-toast stays shown in its corner with its action focused while the viewport changes (%s)',
    async (setup) => {
      const el = await mount<HTMLElement & { show(): void; open: boolean }>(
        setup,
        `<odd-toast label="Invitation sent" tone="success">Alex can now join the workspace and see its projects.<button id="undo" slot="end">Undo</button></odd-toast>`,
        'odd-toast',
      );
      el.show();
      await settle(el);
      const undo = container.querySelector<HTMLElement>('#undo')!;
      undo.focus();
      const unchanged = sameLook(el, undo);
      for (const [width, height] of VIEWPORTS) {
        await page.viewport(width, height);
        await settle(el);
        await frames();
        expect(el.open).toBe(true);
        expect(focused()).toBe(undo);
        expectInViewport(el);
        unchanged();
      }
    },
  );
});
