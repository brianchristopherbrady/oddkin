import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { MenuItemRecord, OddkinMenu } from '../src/menu/menu.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-menu (component-contracts.md §3.6, §2.2), with the shipped theme.
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

const CHILDREN =
  '<option value="new">New project</option><option value="duplicate" title="With its files">Duplicate project</option><option value="archive" disabled>Archive</option><hr><optgroup label="Danger zone"><option value="delete">Delete project</option></optgroup>';
const ITEMS: readonly MenuItemRecord[] = [
  { id: 'new', label: 'New project', shortcut: 'Ctrl N' },
  {
    id: 'share',
    label: 'Share',
    items: [
      { id: 'link', label: 'Copy link' },
      { id: 'email', label: 'Email' },
    ],
  },
  { kind: 'separator' },
  { id: 'delete', label: 'Delete project', tone: 'danger' },
];

async function mount(attributes = '', children = `Project actions${CHILDREN}`) {
  container = document.createElement('div');
  container.innerHTML = `<button type="button" id="before">before</button><odd-menu ${attributes}>${children}</odd-menu><button type="button" id="after">after</button>`;
  document.body.append(container);
  const el = container.querySelector<OddkinMenu>('odd-menu')!;
  await settle(el);
  const log: string[] = [];
  el.addEventListener('odd-action', (event) => {
    const { id, action } = (event as CustomEvent<{ id: string; action: string }>).detail;
    log.push(`${action} ${id}`);
  });
  return { el, log };
}
const trigger = (el: OddkinMenu) => el.shadowRoot!.querySelector<HTMLElement>('[part~="trigger"]')!;
const menu = (el: OddkinMenu, path = '') =>
  el.shadowRoot!.getElementById(path ? `menu-${path}` : 'menu')!;
const item = (el: OddkinMenu, path: string) => el.shadowRoot!.getElementById(`item-${path}`)!;
const focused = (el: OddkinMenu) => el.shadowRoot!.activeElement?.id;
const isOpen = (surface: Element) => surface.matches(':popover-open');
const label = (row: Element) => row.querySelector('.option-text')!.textContent;
const openWith = async (el: OddkinMenu, keys: string) => {
  trigger(el).focus();
  await userEvent.keyboard(keys);
  await expect.poll(() => isOpen(menu(el))).toBe(true);
  await settle(el);
};

describe('odd-menu', () => {
  it('is a menu button whose trigger names and controls a menu of the item children', async () => {
    const { el } = await mount();
    await expect
      .element(page.getByRole('button', { name: 'Project actions', exact: true }))
      .toBeVisible();
    const button = trigger(el);
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('menu');
    expect(menu(el).getAttribute('role')).toBe('menu');
    expect(menu(el).getAttribute('aria-labelledby')).toBe('trigger');
    expect(isOpen(menu(el))).toBe(false);
    // The entries are data: only the trigger's own content is slotted.
    const slotted = el.shadowRoot!.querySelector('slot')!.assignedNodes();
    expect(slotted.map((node) => node.textContent?.trim()).join('')).toBe('Project actions');
    const rows = [...menu(el).querySelectorAll('[role="menuitem"]')];
    expect(rows.map(label)).toEqual([
      'New project',
      'Duplicate project',
      'Archive',
      'Delete project',
    ]);
    expect(rows[1]!.querySelector('.option-description')!.textContent).toBe('With its files');
    expect(rows[2]!.getAttribute('aria-disabled')).toBe('true');
    expect(menu(el).querySelector('[role="separator"]')).not.toBeNull();
    const group = menu(el).querySelector('[role="group"]')!;
    expect(el.shadowRoot!.getElementById(group.getAttribute('aria-labelledby')!)!.textContent).toBe(
      'Danger zone',
    );
    // Children edited later are followed, and so is the trigger's content.
    el.querySelector('option')!.textContent = 'Create project';
    el.append(' now');
    await expect.poll(() => label(item(el, '0'))).toBe('Create project');
    await expect
      .poll(() =>
        el
          .shadowRoot!.querySelector('slot')!
          .assignedNodes()
          .map((n) => n.textContent)
          .join(''),
      )
      .toBe('Project actions now');
  });

  it('opens on a click with focus on the first item; a choice reports odd-action, closes, and returns focus', async () => {
    const { el, log } = await mount('', `Actions for every selected project${CHILDREN}`);
    await userEvent.click(trigger(el));
    await expect.poll(() => focused(el)).toBe('item-0');
    // Opened by a press, the focused item does not show the keyboard ring.
    expect(item(el, '0').matches(':focus-visible')).toBe(false);
    expect(trigger(el).getAttribute('aria-expanded')).toBe('true');
    // The menu hangs below the trigger, at least as wide.
    const box = trigger(el).getBoundingClientRect();
    const surface = menu(el).getBoundingClientRect();
    expect(surface.top).toBeGreaterThanOrEqual(box.bottom);
    expect(surface.width).toBeGreaterThanOrEqual(box.width - 1);
    await userEvent.click(item(el, '1'));
    expect(log).toEqual(['select duplicate']);
    await expect.poll(() => isOpen(menu(el))).toBe(false);
    await expect.poll(() => focused(el)).toBe('trigger');
    expect(trigger(el).getAttribute('aria-expanded')).toBe('false');
    // A second press on the trigger of an open menu closes it.
    await userEvent.click(trigger(el));
    await expect.poll(() => isOpen(menu(el))).toBe(true);
    await userEvent.click(trigger(el));
    await expect.poll(() => isOpen(menu(el))).toBe(false);
  });

  it('opens from the keyboard on the first or last item; arrows wrap, Home and End, and typing move', async () => {
    const { el } = await mount();
    await openWith(el, '{Enter}');
    expect(focused(el)).toBe('item-0');
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => focused(el)).toBe('trigger');
    await openWith(el, ' ');
    expect(focused(el)).toBe('item-0');
    await userEvent.keyboard('{Escape}');
    await openWith(el, '{ArrowDown}');
    expect(focused(el)).toBe('item-0');
    await userEvent.keyboard('{Escape}');
    await openWith(el, '{ArrowUp}');
    expect(focused(el)).toBe('item-4-0');
    // Wrapping, and disabled items stay focusable (APG).
    await userEvent.keyboard('{ArrowDown}');
    expect(focused(el)).toBe('item-0');
    await userEvent.keyboard('{ArrowUp}');
    expect(focused(el)).toBe('item-4-0');
    await userEvent.keyboard('{ArrowUp}');
    expect(focused(el)).toBe('item-2');
    await userEvent.keyboard('{Home}');
    expect(focused(el)).toBe('item-0');
    await userEvent.keyboard('{End}');
    expect(focused(el)).toBe('item-4-0');
    await userEvent.keyboard('d');
    expect(focused(el)).toBe('item-1');
    await userEvent.keyboard('d');
    expect(focused(el)).toBe('item-4-0');
    // Typing reaches disabled items too.
    await new Promise((resolve) => setTimeout(resolve, 600));
    await userEvent.keyboard('a');
    expect(focused(el)).toBe('item-2');
    // The next opening lands on the first item again.
    await userEvent.keyboard('{Escape}');
    await openWith(el, '{Enter}');
    expect(focused(el)).toBe('item-0');
  });

  it('chooses with Enter and Space, never a disabled item, and keeps the menu open when the action is cancelled', async () => {
    const { el, log } = await mount();
    await openWith(el, '{Enter}');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter} ');
    expect(log).toEqual([]);
    expect(isOpen(menu(el))).toBe(true);
    await userEvent.click(item(el, '2'), { force: true });
    expect(log).toEqual([]);
    // Space continues a typed query instead of choosing.
    await userEvent.keyboard('d ');
    expect(log).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await userEvent.keyboard('{Home} ');
    expect(log).toEqual(['select new']);
    await expect.poll(() => focused(el)).toBe('trigger');
    // Items in a group are chosen as any other.
    await openWith(el, '{ArrowUp}');
    await userEvent.keyboard('{Enter}');
    expect(log).toEqual(['select new', 'select delete']);
    el.addEventListener('odd-action', (event) => event.preventDefault(), { once: true });
    await openWith(el, '{Enter}');
    await userEvent.keyboard('{Enter}');
    expect(log).toEqual(['select new', 'select delete', 'select new']);
    expect(isOpen(menu(el))).toBe(true);
    expect(focused(el)).toBe('item-0');
  });

  it('closes on Escape, on Tab, and on a press outside', async () => {
    const { el } = await mount();
    await openWith(el, '{Enter}');
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => isOpen(menu(el))).toBe(false);
    expect(focused(el)).toBe('trigger');
    await openWith(el, '{Enter}');
    await userEvent.keyboard('{Tab}');
    await expect.poll(() => isOpen(menu(el))).toBe(false);
    expect(el.shadowRoot!.activeElement).toBeNull();
    await openWith(el, '{Enter}');
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await expect.poll(() => isOpen(menu(el))).toBe(false);
    expect(focused(el)).toBe('trigger');
    await openWith(el, '{Enter}');
    await userEvent.click(container.querySelector('#after')!);
    await expect.poll(() => isOpen(menu(el))).toBe(false);
  });

  it('keeps submenu keys to items with a submenu and to usable ones, refocuses an open submenu, and releases a closed one', async () => {
    const { el, log } = await mount('label="More actions"', '');
    el.items = [
      ITEMS[0]!,
      {
        id: 'share',
        label: 'Share',
        items: [
          { id: 'link', label: 'Copy link' },
          { id: 'email', label: 'Email', disabled: true },
        ],
      },
      { id: 'archive', label: 'Archive', disabled: true },
      { id: 'export', label: 'Export', disabled: true, items: [{ id: 'pdf', label: 'PDF' }] },
    ];
    await settle(el);
    await openWith(el, '{Enter}');
    // Right on an item without a submenu, or a disabled one, does nothing.
    await userEvent.keyboard('{ArrowRight}');
    expect(focused(el)).toBe('item-0');
    expect(log).toEqual([]);
    await userEvent.keyboard('{End}{ArrowRight}');
    expect(focused(el)).toBe('item-3');
    expect(isOpen(menu(el, '3'))).toBe(false);
    const open = scopeStats();
    await userEvent.click(item(el, '1'));
    await expect.poll(() => focused(el)).toBe('item-1-0');
    // Disabled items in a submenu stay focusable too.
    await userEvent.keyboard('{ArrowDown}');
    expect(focused(el)).toBe('item-1-1');
    // A press on the item of an open submenu (light dismiss closes it first) opens it again.
    await userEvent.click(item(el, '1'));
    await expect.poll(() => focused(el)).toBe('item-1-0');
    // With the submenu open, arrows on its parent's level stay there.
    await userEvent.click(item(el, '2'), { force: true });
    expect(focused(el)).toBe('item-2');
    await userEvent.keyboard('{ArrowUp}');
    expect(focused(el)).toBe('item-1');
    // Closing it releases its wiring.
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => focused(el)).toBe('item-1-0');
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => isOpen(menu(el, '1'))).toBe(false);
    await expect.poll(() => scopeStats()).toEqual(open);
  });

  it('opens a submenu on its first item with Right, closes one level with Left and Escape, and closes every level after a choice', async () => {
    const { el, log } = await mount('label="More actions"', '');
    el.items = ITEMS;
    await settle(el);
    // Only the menu's own opening and closing reach the host, not its submenus'.
    const toggles: string[] = [];
    for (const type of ['beforetoggle', 'toggle'])
      el.addEventListener(type, (event) =>
        toggles.push(`${type} ${(event as ToggleEvent).newState}`),
      );
    const share = item(el, '1');
    expect(share.getAttribute('aria-haspopup')).toBe('menu');
    expect(share.getAttribute('aria-controls')).toBe('menu-1');
    expect(menu(el, '1').getAttribute('aria-labelledby')).toBe('item-1');
    await openWith(el, '{Enter}');
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await expect.poll(() => focused(el)).toBe('item-1-0');
    expect(share.getAttribute('aria-expanded')).toBe('true');
    expect(isOpen(menu(el))).toBe(true);
    // The submenu sits beside its item.
    expect(menu(el, '1').getBoundingClientRect().left).toBeGreaterThanOrEqual(
      share.getBoundingClientRect().right,
    );
    // Arrows stay within the submenu.
    await userEvent.keyboard('{ArrowDown}');
    expect(focused(el)).toBe('item-1-1');
    await userEvent.keyboard('{ArrowDown}');
    expect(focused(el)).toBe('item-1-0');
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => focused(el)).toBe('item-1');
    expect(isOpen(menu(el, '1'))).toBe(false);
    expect(share.getAttribute('aria-expanded')).toBe('false');
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => focused(el)).toBe('item-1-0');
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => focused(el)).toBe('item-1');
    expect(isOpen(menu(el))).toBe(true);
    // Enter and a click open it too; a choice inside closes every level.
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => focused(el)).toBe('item-1-0');
    await userEvent.click(item(el, '1-1'));
    expect(log).toEqual(['select email']);
    await expect.poll(() => isOpen(menu(el))).toBe(false);
    expect(isOpen(menu(el, '1'))).toBe(false);
    await expect.poll(() => focused(el)).toBe('trigger');
    await expect
      .poll(() => toggles)
      .toEqual(['beforetoggle open', 'toggle open', 'beforetoggle closed', 'toggle closed']);
  });

  it('takes items from the property, which wins over children, with icons, shortcuts, and the danger tone', async () => {
    const warnings: unknown[] = [];
    const warn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args[0]);
    try {
      const { el } = await mount();
      el.items = [
        { id: 'new', label: 'New project', shortcut: 'Ctrl N', icon: '/icon.svg' },
        { id: 'delete', label: 'Delete project', tone: 'danger' },
      ];
      await settle(el);
      const rows = [...menu(el).querySelectorAll('[role="menuitem"]')];
      expect(rows.map(label)).toEqual(['New project', 'Delete project']);
      expect(rows[0]!.querySelector('.option-end')!.textContent).toBe('Ctrl N');
      expect(rows[0]!.querySelector('odd-icon')!.getAttribute('src')).toBe('/icon.svg');
      expect(rows[1]!.classList.contains('danger')).toBe(true);
      expect(String(warnings[0])).toContain('[collection.source.conflict]');
    } finally {
      console.warn = warn;
    }
  });

  it('names a glyph-only trigger with label, and a disabled trigger does not open', async () => {
    const { el } = await mount('label="More actions" disabled', CHILDREN);
    expect(trigger(el).getAttribute('aria-label')).toBe('More actions');
    expect((trigger(el) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(trigger(el), { force: true });
    expect(isOpen(menu(el))).toBe(false);
  });

  it('draws the trigger as a button, the menu as the overlay surface, and the rows as option rows', async () => {
    const { el } = await mount('appearance="primary" size="sm"');
    const button = getComputedStyle(trigger(el));
    expect(button.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-action-default'),
    );
    expect(trigger(el).getBoundingClientRect().height).toBe(
      Math.max(
        parseFloat(themeValue('block-size', '--odd-control-height-sm')),
        parseFloat(themeValue('block-size', '--odd-target-min')),
      ),
    );
    await openWith(el, '{Enter}');
    const surface = getComputedStyle(menu(el));
    expect(surface.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-raised'),
    );
    expect(surface.borderTopColor).toBe(
      themeValue('border-top-color', '--odd-color-border-default'),
    );
    expect(surface.boxShadow).not.toBe('none');
    expect(surface.paddingTop).toBe(themeValue('padding-top', '--odd-space-xs'));
    const row = item(el, '0');
    expect(`${row.getBoundingClientRect().height}px`).toBe(
      themeValue('block-size', '--odd-control-height-md'),
    );
    // The focused row shows the ring and the hover surface (Figma MenuItem Focus).
    expect(row.matches(':focus-visible')).toBe(true);
    expect(getComputedStyle(row).outlineColor).toBe(
      themeValue('outline-color', '--odd-color-focus-ring'),
    );
    expect(getComputedStyle(row).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-hover'),
    );
    const heading = getComputedStyle(menu(el).querySelector('.group-label')!);
    expect(heading.color).toBe(themeValue('color', '--odd-color-text-secondary'));
    const separator = getComputedStyle(menu(el).querySelector('.separator')!);
    expect(separator.borderTopColor).toBe(
      themeValue('border-top-color', '--odd-color-border-default'),
    );
    expect(getComputedStyle(item(el, '2')).color).toBe(
      themeValue('color', '--odd-color-text-disabled'),
    );
    expect(getComputedStyle(item(el, '2')).cursor).toBe('not-allowed');
    expect(getComputedStyle(row).cursor).toBe('pointer');
  });

  it('mirrors the submenu keys in right-to-left text', async () => {
    const { el } = await mount('dir="rtl" label="More actions"', '');
    el.items = ITEMS;
    await settle(el);
    await openWith(el, '{Enter}');
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    expect(isOpen(menu(el, '1'))).toBe(false);
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => focused(el)).toBe('item-1-0');
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => focused(el)).toBe('item-1');
    expect(isOpen(menu(el, '1'))).toBe(false);
  });

  it('releases everything when removed, also with a submenu open', async () => {
    const before = scopeStats();
    const { el } = await mount('', '');
    el.items = ITEMS;
    await settle(el);
    await openWith(el, '{Enter}');
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await expect.poll(() => focused(el)).toBe('item-1-0');
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
