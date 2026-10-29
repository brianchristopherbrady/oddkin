import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import type { OddkinCombobox } from '../src/combobox/combobox.js';
import type { OddkinPicker } from '../src/picker/picker.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// The value views of a multiple option field (component-contracts.md §3.3, `view`), shared by
// odd-combobox and odd-picker, with the shipped theme.
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

const MEMBERS = [
  ['amelia', 'Amelia Johnson', 'Design'],
  ['noah', 'Noah Williams', 'Engineering'],
  ['olivia', 'Olivia Brown', 'Design'],
  ['liam', 'Liam Wilson', 'Engineering'],
  ['sophia', 'Sophia Davis', 'Product'],
  ['ethan', 'Ethan Miller', 'Engineering'],
] as const;
const options = MEMBERS.map(([value, label, group]) => ({ value, label, group }));
const ALL = MEMBERS.map(([value]) => value);

type Field = OddkinCombobox | OddkinPicker;
async function mount(
  tag: 'odd-combobox' | 'odd-picker',
  view: string,
  values: string[],
  width = 320,
) {
  container = document.createElement('div');
  container.innerHTML = `<form><button type="button" id="before">before</button><${tag} label="Team members" name="members" multiple view="${view}"></${tag}><button type="button" id="after">after</button></form>`;
  const el = container.querySelector<Field>(tag)!;
  el.style.inlineSize = `${width}px`;
  Object.assign(el, { options, values });
  document.body.append(container);
  await settle(el);
  // The field measures once it has its width.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await settle(el);
  return el;
}
async function openPopup(el: Field) {
  el.shadowRoot!.querySelector<HTMLElement>('.combobox')!.focus();
  await userEvent.keyboard('{ArrowDown}');
  await settle(el);
}
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const parts = (el: Element, name: string) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${name}"]`),
];
const visible = (items: HTMLElement[]) =>
  items.filter((item) => getComputedStyle(item).visibility === 'visible');
// Linux CI's DejaVu Sans is much wider than Windows' and macOS's fonts; fitting is measured in a wide font.
const wide = new CSSStyleSheet();
wide.replaceSync(':root { --odd-font-family-sans: Verdana, "DejaVu Sans", sans-serif; }');

for (const tag of ['odd-combobox', 'odd-picker'] as const)
  describe(`${tag} view`, () => {
    it('chips by default; count: the number chosen after the user glyph', async () => {
      const el = await mount(tag, 'count', ALL.slice(0, 3));
      expect(el.view).toBe('count');
      const value = part(el, 'value');
      expect(value.textContent!.trim()).toBe('3 selected');
      expect(value.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
      expect(parts(el, 'chip')).toEqual([]);
      el.values = [];
      await settle(el);
      expect(el.shadowRoot!.querySelector('[part~="value"]')).toBeNull();
    });

    it('text: two names, then how many others, in the page language', async () => {
      const el = await mount(tag, 'text', ['amelia']);
      expect(part(el, 'value').textContent).toBe('Amelia Johnson');
      el.values = ['amelia', 'noah'];
      await settle(el);
      expect(part(el, 'value').textContent).toBe('Amelia Johnson and Noah Williams');
      el.values = ['amelia', 'noah', 'olivia'];
      await settle(el);
      expect(part(el, 'value').textContent).toBe('Amelia Johnson, Noah Williams, and 1 other');
      el.values = ALL;
      await settle(el);
      expect(part(el, 'value').textContent).toBe('Amelia Johnson, Noah Williams, and 4 others');
    });

    it('auto: chips up to four values, then the count', async () => {
      const el = await mount(tag, 'auto', ALL.slice(0, 4));
      expect(parts(el, 'chip')).toHaveLength(4);
      el.values = ALL.slice(0, 5);
      await settle(el);
      expect(parts(el, 'chip')).toEqual([]);
      expect(part(el, 'value').textContent!.trim()).toBe('5 selected');
    });

    it('avatars: initials on one row, "+N" for the rest, names read from hidden text', async () => {
      // The combobox keeps its input's 4em beside the values (the picker has no input).
      const el = await mount(tag, 'avatars', ALL, 260);
      const avatars = parts(el, 'avatar');
      // Each is an odd-avatar named by its label, drawing the initials (ADR 0043 dependency).
      expect(avatars.map((a) => a.getAttribute('label'))).toEqual(
        MEMBERS.map(([, label]) => label),
      );
      expect(avatars[0]!.shadowRoot!.textContent).toContain('AJ');
      const shown = visible(avatars).length;
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThan(6);
      expect(part(el, 'more').textContent).toContain(`+${6 - shown}`);
      const circle = avatars[0]!.shadowRoot!.querySelector('[part~="base"]')!;
      expect(getComputedStyle(circle).borderRadius).not.toBe('0px');
      await expect.element(page.getByRole('list', { name: 'Selected' })).toBeInTheDocument();
    });

    it('grouped: a chip per option group, or the total when they do not fit', async () => {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, wide];
      try {
        // Room for two group chips beside the combobox's input; three never fit in 200px.
        const el = await mount(tag, 'grouped', ['amelia', 'olivia', 'sophia'], 560);
        expect(visible(parts(el, 'group-summary')).map((c) => c.textContent!.trim())).toEqual([
          'Design · 2',
          'Product · 1',
        ]);
        expect(part(el, 'more').hidden).toBe(true);
        el.style.inlineSize = '200px';
        el.values = ALL;
        await expect.poll(() => part(el, 'more').hidden).toBe(false);
        expect(part(el, 'more').textContent!.trim()).toBe('6 total');
        expect(visible(parts(el, 'group-summary'))).toEqual([]);
        // An option without a group counts under its own label.
        el.options = options.map((o) =>
          o.value === 'amelia' ? { value: o.value, label: o.label } : o,
        );
        el.values = ['amelia', 'sophia'];
        await settle(el);
        expect(parts(el, 'group-summary').map((c) => c.textContent!.trim())).toEqual([
          'Amelia Johnson · 1',
          'Product · 1',
        ]);
      } finally {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== wide);
      }
    });

    it('expandable: two rows of chips and "+N more"; Show all reviews and removes every value', async () => {
      const el = await mount(tag, 'expandable', ALL, 400);
      const box = part(el, 'control').getBoundingClientRect();
      const shown = visible(parts(el, 'chip'));
      const rows = new Set(shown.map((c) => Math.round(c.getBoundingClientRect().top)));
      // Two rows of chips before "+N more" (one row is chips alone).
      expect(rows.size).toBe(2);
      expect(part(el, 'more').textContent!.trim()).toBe(`+${6 - shown.length} more`);
      expect(box.height).toBeLessThan(100);
      const toggle = part(el, 'show-all');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(part(el, 'review').hidden).toBe(true);
      await userEvent.click(toggle);
      await settle(el);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.textContent!.trim()).toBe('Show less');
      const review = part(el, 'review');
      expect(review.hidden).toBe(false);
      expect(review.querySelectorAll('[part~="chip"]')).toHaveLength(6);
      await userEvent.click(review.querySelector<HTMLElement>('[part~="chip-remove"]')!);
      await settle(el);
      expect(el.values).toEqual(ALL.slice(1));
      expect(review.querySelectorAll('[part~="chip"]')).toHaveLength(5);
    });

    it('select-all: a check box over the usable options shown, mixed while some are chosen', async () => {
      const el = await mount(tag, 'chips', ['amelia']);
      el.options = options.map((o) => (o.value === 'ethan' ? { ...o, disabled: true } : o));
      el.selectAll = true;
      await settle(el);
      let changes = 0;
      el.addEventListener('change', () => changes++);
      await openPopup(el);
      const box = part(el, 'select-all');
      expect(box.getAttribute('role')).toBe('checkbox');
      expect(box.textContent!.trim()).toBe('Select all 5 options');
      expect(box.getAttribute('aria-checked')).toBe('mixed');
      await userEvent.click(box);
      await settle(el);
      // The disabled option stays as it was.
      expect([...(el.values ?? [])].sort()).toEqual(ALL.filter((v) => v !== 'ethan').sort());
      expect(box.getAttribute('aria-checked')).toBe('true');
      expect(changes).toBe(1);
      await userEvent.click(box);
      await settle(el);
      expect(el.values).toEqual([]);
      expect(box.getAttribute('aria-checked')).toBe('false');
      expect(changes).toBe(2);
      // The picker has no read-only state; disabled stops the change the same way.
      el.toggleAttribute(tag === 'odd-combobox' ? 'readonly' : 'disabled', true);
      await settle(el);
      expect(
        el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="select-all"]')?.disabled ?? true,
      ).toBe(true);
    });

    it('review: the popup starts with the chosen values, each removable, and View N more', async () => {
      const el = await mount(tag, 'count', ALL.slice(0, 5));
      el.review = true;
      await settle(el);
      await openPopup(el);
      const toggle = part(el, 'selected-toggle');
      expect(toggle.textContent!.trim()).toBe('Selected (5)');
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(parts(el, 'selected-option').map((o) => o.textContent!.trim())).toEqual([
        'Amelia Johnson',
        'Noah Williams',
        'Olivia Brown',
      ]);
      const more = part(el, 'view-more');
      expect(more.textContent!.trim()).toBe('View 2 more');
      await userEvent.click(more);
      await settle(el);
      expect(parts(el, 'selected-option')).toHaveLength(5);
      expect(part(el, 'view-more').textContent!.trim()).toBe('Show less');
      // Keyboard removal moves focus to the next remove button.
      const removes = parts(el, 'selected-remove');
      expect(removes[0]!.getAttribute('aria-label')).toBe('Remove Amelia Johnson');
      removes[0]!.focus();
      await userEvent.keyboard('{Enter}');
      await settle(el);
      expect(el.values).toEqual(ALL.slice(1, 5));
      expect(el.shadowRoot!.activeElement).toBe(removes[1]);
      expect(part(el, 'popup').matches(':popover-open')).toBe(true);
      await userEvent.click(toggle);
      await settle(el);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(el.shadowRoot!.getElementById('selected-list')!.hidden).toBe(true);
      // View N more belongs to the open review only.
      expect(el.shadowRoot!.querySelector('[part~="view-more"]')).toBeNull();
    });
  });

describe('view in the theme', () => {
  it('draws the count and the review in the shipped look', async () => {
    const el = await mount('odd-combobox', 'expandable', ALL, 240);
    await userEvent.click(part(el, 'show-all'));
    await settle(el);
    const review = getComputedStyle(part(el, 'review'));
    expect(review.borderTopColor).toBe(
      themeValue('border-top-color', '--odd-color-border-default'),
    );
  });
});
