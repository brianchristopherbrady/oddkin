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

describe('editors keep the value, the caret, and the focus (row 30)', () => {
  const control = (el: Element, selector: string) =>
    el.shadowRoot!.querySelector<HTMLInputElement>(selector)!;

  it.each(SETUPS)(
    'odd-input keeps a search being typed and its clear button (%s)',
    async (setup) => {
      const el = await mount(
        setup,
        `<odd-input label="Search the release notes of every project in the workspace" type="search"></odd-input>`,
        'odd-input',
      );
      const input = control(el, 'input');
      await userEvent.fill(input, 'container queries');
      input.setSelectionRange(3, 3);
      await settle(el);
      const clear = part(el, 'clear');
      expect(clear.hidden).toBe(false);
      const unchanged = sameLook(input, clear);
      for (const width of WIDTHS) {
        await resize(width, el);
        expect(control(el, 'input')).toBe(input);
        expect([input.value, input.selectionStart]).toEqual(['container queries', 3]);
        expect(focused()).toBe(input);
        const [box, button] = [input.getBoundingClientRect(), clear.getBoundingClientRect()];
        expect(button.left >= box.left - 1 || button.right <= box.right + 1).toBe(true);
        expectInside();
        unchanged();
      }
    },
  );

  it.each(SETUPS)('odd-textarea keeps a draft, its caret, and its count (%s)', async (setup) => {
    const el = await mount(
      setup,
      `<odd-textarea label="Release notes" maxlength="200"></odd-textarea>`,
      'odd-textarea',
    );
    const textarea = control(el, 'textarea') as unknown as HTMLTextAreaElement;
    const draft = 'Builds are faster.\nThe side navigation gained project kinds.';
    await userEvent.fill(textarea, draft);
    textarea.setSelectionRange(10, 10);
    await settle(el);
    const count = part(el, 'count').textContent;
    const unchanged = sameLook(textarea);
    for (const width of WIDTHS) {
      await resize(width, el);
      expect(control(el, 'textarea')).toBe(textarea);
      expect([textarea.value, textarea.selectionStart]).toEqual([draft, 10]);
      expect(focused()).toBe(textarea);
      expect(part(el, 'count').textContent).toBe(count);
      expectInside();
      unchanged();
    }
  });

  it.each(SETUPS)(
    'odd-slider keeps its value, its focused thumb, and the thumb’s place on the track (%s)',
    async (setup) => {
      const el = await mount<HTMLElement & { value: string }>(
        setup,
        `<odd-slider label="Preview scale" min="25" max="100" step="5" value="60"></odd-slider>`,
        'odd-slider',
      );
      const thumb = part(el, 'thumb');
      thumb.focus();
      // One step up: ArrowLeft in right-to-left text, as the track is mirrored.
      await userEvent.keyboard(setup === 'right to left' ? '{ArrowLeft}' : '{ArrowRight}');
      await settle(el);
      expect(el.value).toBe('65');
      const track = part(el, 'track');
      // The thumb's centre along the track, from its start edge: (65 - 25) / (100 - 25).
      const fraction = () => {
        const [t, h] = [track.getBoundingClientRect(), thumb.getBoundingClientRect()];
        const centre = h.left + h.width / 2;
        const along = (centre - t.left - h.width / 2) / (t.width - h.width);
        return setup === 'right to left' ? 1 - along : along;
      };
      const unchanged = sameLook(thumb);
      for (const width of WIDTHS) {
        await resize(width, el);
        expect(el.value).toBe('65');
        expect(focused()).toBe(thumb);
        expect(fraction()).toBeCloseTo(40 / 75, 1);
        expectInside();
        unchanged();
      }
    },
  );

  it.each(SETUPS)('odd-rating keeps the chosen star and the focus (%s)', async (setup) => {
    const el = await mount<HTMLElement & { value: string }>(
      setup,
      `<odd-rating label="How useful were these release notes for your team?" value="3"></odd-rating>`,
      'odd-rating',
    );
    const radios = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('input:not(.flag)')];
    await userEvent.click(radios[3]!);
    await settle(el);
    radios[3]!.focus();
    expect(el.value).toBe('4');
    const unchanged = sameLook(...radios);
    for (const width of WIDTHS) {
      await resize(width, el);
      expect(el.value).toBe('4');
      expect(focused()).toBe(radios[3]);
      expect(part(el, 'value').textContent?.trim()).toBe('4 of 5');
      expectInside();
      unchanged();
    }
  });

  it.each(SETUPS)(
    'odd-file-input keeps the chosen files and a focused Remove (%s)',
    async (setup) => {
      const el = await mount(
        setup,
        `<odd-file-input label="Project attachments" multiple></odd-file-input>`,
        'odd-file-input',
      );
      const input = control(el, 'input');
      const data = new DataTransfer();
      for (const name of ['release-notes-for-the-design-review-2026.pdf', 'summary.txt'])
        data.items.add(new File(['x'.repeat(2048)], name, { type: 'application/pdf' }));
      input.files = data.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await settle(el);
      const rows = [...el.shadowRoot!.querySelectorAll('[part~="file"]')];
      expect(rows).toHaveLength(2);
      const remove = rows[0]!.querySelector<HTMLElement>('[part~="remove"]')!;
      remove.focus();
      const unchanged = sameLook(part(el, 'surface'), remove);
      for (const width of WIDTHS) {
        await resize(width, el);
        const now = [...el.shadowRoot!.querySelectorAll('[part~="file"]')];
        expect(now.length === rows.length && now.every((row, i) => row === rows[i])).toBe(true);
        expect(focused()).toBe(remove);
        expectInside();
        unchanged();
      }
    },
  );

  it.each(SETUPS)(
    'odd-checkbox-group keeps its choices and the focus while its options wrap (%s)',
    async (setup) => {
      const el = await mount(
        setup,
        `<odd-checkbox-group label="Notifications" orientation="horizontal"><odd-checkbox value="email">Email</odd-checkbox><odd-checkbox value="desktop">Desktop notifications</odd-checkbox><odd-checkbox value="summary">Weekly summary</odd-checkbox></odd-checkbox-group>`,
        'odd-checkbox-group',
      );
      const choices = [...el.querySelectorAll<HTMLElement & { checked: boolean }>('odd-checkbox')];
      await userEvent.click(part(choices[1]!, 'label'));
      await settle(choices[1]!);
      const box = part(choices[1]!, 'control');
      box.focus();
      const unchanged = sameLook(...choices.map((c) => part(c, 'control')));
      for (const width of WIDTHS) {
        await resize(width, el, ...choices);
        expect(choices.map((c) => c.checked)).toEqual([false, true, false]);
        expect(focused()).toBe(box);
        expectInside();
        unchanged();
      }
    },
  );

  it.each(SETUPS)(
    'odd-radio-group keeps its choice and the focus while its options wrap (%s)',
    async (setup) => {
      const el = await mount<HTMLElement & { value: string }>(
        setup,
        `<odd-radio-group label="Workspace visibility" orientation="horizontal"><option value="private">Private</option><option value="team">Anyone in your workspace</option><option value="public">Public</option></odd-radio-group>`,
        'odd-radio-group',
      );
      const radios = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('input:not(.flag)')];
      await userEvent.click(radios[1]!);
      await settle(el);
      radios[1]!.focus();
      const unchanged = sameLook(...radios);
      for (const width of WIDTHS) {
        await resize(width, el);
        expect(el.value).toBe('team');
        expect(focused()).toBe(radios[1]);
        expectInside();
        unchanged();
      }
    },
  );

  it.each(SETUPS)(
    'odd-segmented-control keeps its choice and the focus in equal segments (%s)',
    async (setup) => {
      const el = await mount<HTMLElement & { value: string }>(
        setup,
        `<odd-segmented-control label="Preview size"><option value="sm">Small</option><option value="md" selected>Medium</option><option value="lg">Large, for print</option></odd-segmented-control>`,
        'odd-segmented-control',
      );
      const radios = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('input:not(.flag)')];
      await userEvent.click(radios[2]!);
      await settle(el);
      radios[2]!.focus();
      // Its documented minimum: equal columns, each as wide as its option's longest word, which
      // never breaks. A parent that grants less must grow or scroll (responsiveness.md).
      const segments = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.segment')];
      const extent = () => {
        const boxes = segments.map((segment) => segment.getBoundingClientRect());
        return Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left));
      };
      el.style.inlineSize = 'min-content';
      const minimum = extent();
      el.style.inlineSize = '';
      const labels = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.segment-label')];
      const unchanged = sameLook(...el.shadowRoot!.querySelectorAll('[part~="option"]'));
      for (const width of WIDTHS) {
        await resize(width, el);
        expect(el.value).toBe('lg');
        expect(focused()).toBe(radios[2]);
        expect(extent()).toBeGreaterThanOrEqual(minimum - 1);
        for (const label of labels)
          expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1);
        if (container.clientWidth - 20 >= minimum) expectInside();
        unchanged();
      }
    },
  );

  it.each(SETUPS)('odd-switch keeps its state, its thumb, and the focus (%s)', async (setup) => {
    const el = await mount<HTMLElement & { checked: boolean }>(
      setup,
      `<odd-switch>Send me a weekly summary of the activity in this workspace</odd-switch>`,
      'odd-switch',
    );
    const switchControl = part(el, 'control');
    await userEvent.click(switchControl);
    await settle(el);
    expect(el.checked).toBe(true);
    switchControl.focus();
    const thumb = part(el, 'thumb');
    // Measured once the thumb has moved (it is animated to the on side).
    await Promise.all(thumb.getAnimations().map((animation) => animation.finished));
    const offset = () =>
      Math.abs(thumb.getBoundingClientRect().left - switchControl.getBoundingClientRect().left);
    const on = offset();
    const unchanged = sameLook(switchControl, thumb);
    for (const width of WIDTHS) {
      await resize(width, el);
      expect(el.checked).toBe(true);
      expect(focused()).toBe(switchControl);
      expect(offset()).toBeCloseTo(on, 0);
      expectInside();
      unchanged();
    }
  });

  it.each(SETUPS)('odd-chip keeps a focused Remove while the chips wrap (%s)', async (setup) => {
    const el = await mount(
      setup,
      `<p><odd-chip removable>Design systems and research</odd-chip> <odd-chip removable selected>Research</odd-chip> <odd-chip removable>Accessibility reviews</odd-chip></p>`,
      'odd-chip',
    );
    const remove = part(el, 'remove');
    remove.focus();
    const unchanged = sameLook(part(el, 'base'), remove);
    for (const width of WIDTHS) {
      await resize(width, el);
      expect(part(el, 'remove')).toBe(remove);
      expect(focused()).toBe(remove);
      expectInside();
      unchanged();
    }
  });
});
