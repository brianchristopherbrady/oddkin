import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinMenu } from '../src/menu/menu.js';
import type { OddkinSplitButton } from '../src/split-button/split-button.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-split-button (component-contracts.md §3.6, §2.2), with the shipped theme.
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
  'Save<option value="save-as">Save as…</option><option value="copy">Save a copy</option><hr><option value="discard" disabled>Discard changes</option>';

async function mount(attributes = 'value="save"', children = CHILDREN) {
  container = document.createElement('div');
  container.innerHTML = `<odd-split-button ${attributes}>${children}</odd-split-button><button type="button" id="after">after</button>`;
  document.body.append(container);
  const el = container.querySelector<OddkinSplitButton>('odd-split-button')!;
  await settle(el);
  const inner = el.shadowRoot!.querySelector<OddkinMenu>('odd-menu')!;
  await settle(inner);
  const log: string[] = [];
  el.addEventListener('odd-action', (event) => {
    const { id, action } = (event as CustomEvent<{ id: string; action: string }>).detail;
    log.push(`${action} ${id}`);
  });
  return { el, inner, log };
}
const primary = (el: OddkinSplitButton) =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="primary"]')!;
const trigger = (inner: OddkinMenu) =>
  inner.shadowRoot!.querySelector<HTMLButtonElement>('[part~="trigger"]')!;
const surface = (inner: OddkinMenu) => inner.shadowRoot!.getElementById('menu')!;
const isOpen = (element: Element) => element.matches(':popover-open');

describe('odd-split-button', () => {
  it('is a primary button named by its content and a menu button named by strings.more', async () => {
    const { el, inner } = await mount();
    await expect.element(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'More actions', exact: true }))
      .toBeVisible();
    expect(trigger(inner).getAttribute('aria-haspopup')).toBe('menu');
    // The item children are the menu's, never the primary button's content.
    const slotted = el.shadowRoot!.querySelector('slot')!.assignedNodes();
    expect(slotted.map((node) => node.textContent).join('')).toBe('Save');
    const rows = [...surface(inner).querySelectorAll('[role="menuitem"]')];
    expect(rows.map((row) => row.querySelector('.option-text')!.textContent)).toEqual([
      'Save as…',
      'Save a copy',
      'Discard changes',
    ]);
    el.strings = { more: 'Other ways to save' };
    await settle(el);
    await expect.poll(() => trigger(inner).getAttribute('aria-label')).toBe('Other ways to save');
  });

  it('reports the primary action from a click and the keyboard, but not while loading or disabled', async () => {
    const { el, log } = await mount();
    expect(getComputedStyle(el).display).toBe('inline-flex');
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part~="spinner"]')!.hidden).toBe(true);
    await userEvent.click(primary(el));
    primary(el).focus();
    await userEvent.keyboard('{Enter}');
    expect(log).toEqual(['primary save', 'primary save']);
    el.loading = true;
    await settle(el);
    expect(primary(el).getAttribute('aria-disabled')).toBe('true');
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part~="spinner"]')!.hidden).toBe(false);
    await userEvent.click(primary(el), { force: true });
    expect(log).toHaveLength(2);
    el.loading = false;
    el.disabled = true;
    await settle(el);
    expect(primary(el).disabled).toBe(true);
    const inner = el.shadowRoot!.querySelector<OddkinMenu>('odd-menu')!;
    await settle(inner);
    expect(trigger(inner).disabled).toBe(true);
  });

  it('reports a menu choice at the host as select, closes, and keeps the menu open when it is cancelled', async () => {
    const { el, inner, log } = await mount();
    trigger(inner).focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(() => isOpen(surface(inner))).toBe(true);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(log).toEqual(['select copy']);
    await expect.poll(() => isOpen(surface(inner))).toBe(false);
    el.addEventListener('odd-action', (event) => event.preventDefault(), { once: true });
    await userEvent.click(trigger(inner));
    await expect.poll(() => isOpen(surface(inner))).toBe(true);
    await userEvent.click(surface(inner).querySelector('[role="menuitem"]')!);
    expect(log).toEqual(['select copy', 'select save-as']);
    expect(isOpen(surface(inner))).toBe(true);
  });

  it('takes items from the property, which wins over children', async () => {
    const warnings: unknown[] = [];
    const warn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args[0]);
    try {
      const { el, inner } = await mount();
      el.items = [{ id: 'merge', label: 'Merge commit' }];
      await settle(el);
      await settle(inner);
      const rows = [...surface(inner).querySelectorAll('[role="menuitem"]')];
      expect(rows.map((row) => row.querySelector('.option-text')!.textContent)).toEqual([
        'Merge commit',
      ]);
      expect(String(warnings[0])).toContain('[collection.source.conflict]');
    } finally {
      console.warn = warn;
    }
  });

  it('draws both halves with the button look, side by side a small gap apart', async () => {
    const { el, inner } = await mount('value="save" appearance="primary"');
    const left = getComputedStyle(primary(el));
    const right = getComputedStyle(trigger(inner));
    const action = themeValue('background-color', '--odd-color-action-default');
    expect(left.backgroundColor).toBe(action);
    expect(right.backgroundColor).toBe(action);
    const radius = themeValue('border-top-left-radius', '--odd-control-radius');
    expect([left.borderStartEndRadius, right.borderStartStartRadius]).toEqual([radius, radius]);
    const a = primary(el).getBoundingClientRect();
    const b = trigger(inner).getBoundingClientRect();
    expect(b.top).toBeCloseTo(a.top, 0);
    expect(b.height).toBeCloseTo(a.height, 0);
    expect(b.left - a.right).toBeCloseTo(
      parseFloat(themeValue('margin-left', '--odd-space-2xs')),
      0,
    );
  });
  it('releases everything when removed', async () => {
    const before = scopeStats();
    const { inner } = await mount();
    await userEvent.click(trigger(inner));
    await expect.poll(() => isOpen(surface(inner))).toBe(true);
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
