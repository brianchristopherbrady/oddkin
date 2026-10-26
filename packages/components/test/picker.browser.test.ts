import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinPicker, TreeItemRecord } from '../src/picker/picker.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-picker (component-contracts.md §3.3, §2.4, §2.5), with the shipped theme.
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

const LAYERS: readonly TreeItemRecord[] = [
  {
    id: 'workspace',
    label: 'Workspace layers',
    children: [
      {
        id: 'transportation',
        label: 'Transportation',
        children: [
          { id: 'roads', label: 'Roads' },
          { id: 'rail', label: 'Rail' },
        ],
      },
      { id: 'boundaries', label: 'Boundaries' },
      { id: 'buildings', label: 'Buildings', disabled: true },
    ],
  },
  { id: 'imagery', label: 'Imagery' },
];
const FLAT =
  '<option value="roads">Roads</option><option value="rail" selected>Rail</option><option value="boundaries" disabled>Boundaries</option><option value="buildings">Buildings</option>';

async function mount(
  attributes = 'label="Map layers" name="layer"',
  props: Partial<OddkinPicker> = {},
  children = '',
) {
  container = document.createElement('div');
  container.innerHTML = `<form id="form"><button type="button" id="before">before</button><odd-picker style="inline-size: 320px" ${attributes}>${children}</odd-picker><button type="button" id="after">after</button></form>`;
  const el = container.querySelector<OddkinPicker>('odd-picker')!;
  Object.assign(el, props);
  document.body.append(container);
  await settle(el);
  const log: string[] = [];
  const now = () => (el.multiple ? String(el.values) : el.value);
  el.addEventListener('input', () => log.push(`input ${now()}`));
  el.addEventListener('change', () => log.push(`change ${now()}`));
  el.addEventListener('odd-toggle', (event) => {
    const { id, expanded } = (event as CustomEvent<{ id: string; expanded: boolean }>).detail;
    log.push(`toggle ${id} ${expanded}`);
  });
  return { el, log, form: container.querySelector('form')! };
}
const tree = (props: Partial<OddkinPicker> = {}, attributes?: string) =>
  mount(attributes, { items: LAYERS, ...props });
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const parts = (el: Element, name: string) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${name}"]`),
];
const trigger = (el: Element) => part(el, 'trigger');
const rows = (el: Element) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"], [role="option"]'),
];
const text = (row: Element | null | undefined) =>
  row?.querySelector('.label, .option-text')?.textContent;
const shown = (el: Element) => rows(el).map(text);
const row = (el: Element, label: string) => rows(el).find((each) => text(each) === label)!;
const open = (el: Element) => part(el, 'popup').matches(':popover-open');
/** The label of the active row. */
const active = (el: Element) => {
  const id = trigger(el).getAttribute('aria-activedescendant');
  return id ? text(el.shadowRoot!.getElementById(id)) : undefined;
};
const press = async (el: OddkinPicker, keys: string) => {
  if (el.shadowRoot!.activeElement !== trigger(el)) trigger(el).focus();
  await userEvent.keyboard(keys);
  await settle(el);
};
const chips = (el: Element) =>
  parts(el, 'chip').map((chip) => chip.querySelector('.chip-text')!.textContent);

describe('odd-picker', () => {
  it('is a labelled select-only combobox with a tree popup, showing the chosen item after its parent', async () => {
    const { el } = await tree(
      { value: 'roads' },
      'label="Map layers" description="Choose from the available layers."',
    );
    const box = trigger(el);
    await expect.element(page.getByRole('combobox', { name: 'Map layers' })).toBeVisible();
    expect(box.tabIndex).toBe(0);
    expect(box.textContent!.trim()).toBe('Transportation / Roads');
    expect(box.getAttribute('aria-haspopup')).toBe('tree');
    expect(box.getAttribute('aria-expanded')).toBe('false');
    expect(box.getAttribute('aria-controls')).toBe('content');
    expect(part(el, 'tree').id).toBe('content');
    expect(box.getAttribute('aria-describedby')).toBe('description');
    expect(open(el)).toBe(false);
    expect(part(el, 'clear').hidden).toBe(false);
    // Items holding the chosen one start expanded.
    expect(shown(el)).toEqual([
      'Workspace layers',
      'Transportation',
      'Roads',
      'Rail',
      'Boundaries',
      'Buildings',
      'Imagery',
    ]);
    expect(row(el, 'Roads').getAttribute('aria-selected')).toBe('true');
    expect(row(el, 'Roads').getAttribute('aria-level')).toBe('3');
  });

  it('has a listbox popup without items, and the placeholder while nothing is chosen', async () => {
    const { el } = await mount(
      'label="Map layers" placeholder="Choose a layer…"',
      {},
      FLAT.replace(' selected', ''),
    );
    expect(trigger(el).hasAttribute('aria-haspopup')).toBe(false);
    expect(part(el, 'listbox').getAttribute('role')).toBe('listbox');
    expect(part(el, 'listbox').id).toBe('content');
    expect(trigger(el).textContent!.trim()).toBe('Choose a layer…');
    expect(part(el, 'clear').hidden).toBe(true);
  });

  it('opens on the chosen row, moves without choosing, and chooses with Enter, which closes', async () => {
    const { el, log } = await tree({ value: 'rail' });
    await press(el, '{ArrowDown}');
    expect(open(el)).toBe(true);
    expect(trigger(el).getAttribute('aria-expanded')).toBe('true');
    expect(active(el)).toBe('Rail');
    expect(row(el, 'Rail').classList.contains('active')).toBe(true);
    // Focus stays on the trigger; the selection does not follow the active row.
    await press(el, '{ArrowDown}');
    expect(active(el)).toBe('Boundaries');
    expect(el.value).toBe('rail');
    // Buildings is disabled and skipped.
    await press(el, '{ArrowDown}');
    expect(active(el)).toBe('Imagery');
    await press(el, '{Home}');
    expect(active(el)).toBe('Workspace layers');
    await press(el, '{End}');
    expect(active(el)).toBe('Imagery');
    await press(el, '{ArrowUp}{Enter}');
    expect(el.value).toBe('boundaries');
    expect(open(el)).toBe(false);
    expect(el.shadowRoot!.activeElement).toBe(trigger(el));
    expect(trigger(el).textContent!.trim()).toBe('Workspace layers / Boundaries');
    expect(log).toEqual(['input boundaries', 'change boundaries']);
  });

  it('closes with Escape or Alt+Up without changing the value, focus staying on the trigger', async () => {
    const { el, log } = await tree({ value: 'rail' });
    await press(el, '{ArrowDown}{ArrowDown}{Escape}');
    expect(open(el)).toBe(false);
    expect(el.value).toBe('rail');
    expect(el.shadowRoot!.activeElement).toBe(trigger(el));
    await press(el, '{Alt>}{ArrowDown}{/Alt}');
    expect(open(el)).toBe(true);
    await press(el, '{Alt>}{ArrowUp}{/Alt}');
    expect(open(el)).toBe(false);
    expect(log).toEqual([]);
  });

  it('opens with Enter, Space, Home, and End, and on the next match when typing', async () => {
    const { el } = await tree();
    await press(el, '{Enter}');
    expect(open(el)).toBe(true);
    expect(active(el)).toBe('Workspace layers');
    await press(el, '{Escape} ');
    expect(open(el)).toBe(true);
    await press(el, '{Escape}{End}');
    expect(active(el)).toBe('Imagery');
    await press(el, '{Escape}{Home}');
    expect(active(el)).toBe('Workspace layers');
    await press(el, '{Escape}i');
    expect(open(el)).toBe(true);
    expect(active(el)).toBe('Imagery');
  });

  it('expands and collapses with Right and Left, apart from the selection', async () => {
    const { el, log } = await tree();
    // Nothing chosen: every branch starts collapsed.
    expect(shown(el)).toEqual(['Workspace layers', 'Imagery']);
    await press(el, '{ArrowDown}{ArrowRight}');
    expect(log).toEqual(['toggle workspace true']);
    expect(shown(el)).toEqual([
      'Workspace layers',
      'Transportation',
      'Boundaries',
      'Buildings',
      'Imagery',
    ]);
    expect(active(el)).toBe('Workspace layers');
    await press(el, '{ArrowRight}');
    expect(active(el)).toBe('Transportation');
    await press(el, '{ArrowRight}{ArrowRight}');
    expect(active(el)).toBe('Roads');
    await press(el, '{ArrowLeft}');
    expect(active(el)).toBe('Transportation');
    await press(el, '{ArrowLeft}');
    expect(shown(el)).not.toContain('Roads');
    // Expanding never chose anything.
    expect(el.value).toBe('');
    expect(log).toEqual([
      'toggle workspace true',
      'toggle transportation true',
      'toggle transportation false',
    ]);
    // A branch is a choice of its own; its descendants are not chosen with it.
    await press(el, '{Enter}');
    expect(el.value).toBe('transportation');
    expect(trigger(el).textContent!.trim()).toBe('Workspace layers / Transportation');
  });

  it('mirrors Right and Left right to left, and expands every sibling with *', async () => {
    const { el } = await tree();
    el.setAttribute('dir', 'rtl');
    await press(el, '{ArrowDown}{ArrowLeft}');
    expect(shown(el)).toContain('Transportation');
    await press(el, '{ArrowLeft}');
    expect(active(el)).toBe('Transportation');
    await press(el, '*');
    expect(shown(el)).toContain('Roads');
  });

  it('keeps the expansion the caller owns, reporting odd-toggle only', async () => {
    const { el, log } = await tree({ expanded: [] });
    el.addEventListener('odd-toggle', (event) => event.preventDefault());
    await press(el, '{ArrowDown}{ArrowRight}');
    expect(log).toEqual(['toggle workspace true']);
    expect(shown(el)).toEqual(['Workspace layers', 'Imagery']);
  });

  it('opens and closes on a press in the field; a row chooses, its chevron only toggles', async () => {
    const { el, log } = await tree();
    await userEvent.click(part(el, 'control'));
    await settle(el);
    expect(open(el)).toBe(true);
    expect(el.shadowRoot!.activeElement).toBe(trigger(el));
    await userEvent.click(row(el, 'Workspace layers').querySelector('.toggle')!);
    await settle(el);
    expect(shown(el)).toContain('Transportation');
    expect(el.value).toBe('');
    await userEvent.click(row(el, 'Boundaries'));
    await settle(el);
    expect(el.value).toBe('boundaries');
    expect(open(el)).toBe(false);
    expect(log).toEqual(['toggle workspace true', 'input boundaries', 'change boundaries']);
    await userEvent.click(part(el, 'control'));
    await userEvent.click(part(el, 'control'));
    await settle(el);
    expect(open(el)).toBe(false);
    // A press outside closes the popup; leaving closes it too.
    await userEvent.click(part(el, 'control'));
    await userEvent.click(document.body);
    await settle(el);
    expect(open(el)).toBe(false);
  });

  it('closes from the footer: Close (single) returns focus to the trigger', async () => {
    const { el } = await tree();
    await press(el, '{ArrowDown}');
    expect(part(el, 'summary').textContent!.trim()).toBe('Choose one item');
    expect(part(el, 'close').textContent!.trim()).toBe('Close');
    expect(parts(el, 'clear-all')).toEqual([]);
    await userEvent.tab();
    expect(el.shadowRoot!.activeElement).toBe(part(el, 'close'));
    expect(open(el)).toBe(true);
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(open(el)).toBe(false);
    expect(el.shadowRoot!.activeElement).toBe(trigger(el));
  });

  it('toggles rows at once with multiple; chips, the count, Clear, and Done', async () => {
    const { el, log, form } = await tree(
      { multiple: true, values: ['roads'] },
      'label="Map layers" name="layers"',
    );
    expect(chips(el)).toEqual(['Roads']);
    await press(el, '{ArrowDown}');
    expect(part(el, 'tree').getAttribute('aria-multiselectable')).toBe('true');
    expect(active(el)).toBe('Roads');
    await press(el, '{ArrowDown}{Enter}{ArrowDown} ');
    expect(el.values).toEqual(['roads', 'rail', 'boundaries']);
    expect(open(el)).toBe(true);
    expect(part(el, 'summary').textContent!.trim()).toBe('3 selected');
    expect(chips(el)).toEqual(['Roads', 'Rail', 'Boundaries']);
    expect(row(el, 'Rail').getAttribute('aria-selected')).toBe('true');
    expect(row(el, 'Imagery').getAttribute('aria-selected')).toBe('false');
    expect(new FormData(form).getAll('layers')).toEqual(['roads', 'rail', 'boundaries']);
    await press(el, ' ');
    expect(el.values).toEqual(['roads', 'rail']);
    expect(log).toEqual([
      'input roads,rail',
      'change roads,rail',
      'input roads,rail,boundaries',
      'change roads,rail,boundaries',
      'input roads,rail',
      'change roads,rail',
    ]);
    await userEvent.click(part(el, 'clear-all'));
    await settle(el);
    expect(el.values).toEqual([]);
    expect(open(el)).toBe(true);
    expect(part(el, 'close').textContent!.trim()).toBe('Done');
    await userEvent.click(part(el, 'close'));
    await settle(el);
    expect(open(el)).toBe(false);
    expect(el.shadowRoot!.activeElement).toBe(trigger(el));
  });

  it('removes values from the closed trigger: Backspace, and the chips with Left', async () => {
    const { el } = await tree({ multiple: true, values: ['roads', 'rail', 'boundaries'] });
    await press(el, '{Backspace}');
    expect(el.values).toEqual(['roads', 'rail']);
    await press(el, '{ArrowLeft}');
    const removes = parts(el, 'chip-remove');
    expect(el.shadowRoot!.activeElement).toBe(removes.at(-1));
    await userEvent.keyboard('{ArrowLeft}{Delete}');
    await settle(el);
    expect(el.values).toEqual(['rail']);
    await userEvent.keyboard('{Escape}');
    expect(el.shadowRoot!.activeElement).toBe(trigger(el));
    await userEvent.click(part(el, 'chip-remove'));
    await settle(el);
    expect(el.values).toEqual([]);
    expect(open(el)).toBe(false);
  });

  it('chooses from a listbox: options as children, typeahead, and the check on the chosen one', async () => {
    const { el, log } = await mount('label="Map layers" name="layer"', {}, FLAT);
    expect(el.value).toBe('rail');
    expect(trigger(el).textContent!.trim()).toBe('Rail');
    await press(el, 'b');
    expect(open(el)).toBe(true);
    // Boundaries is disabled: typeahead skips it.
    expect(active(el)).toBe('Buildings');
    await press(el, '{Enter}');
    expect(el.value).toBe('buildings');
    expect(log).toEqual(['input buildings', 'change buildings']);
    await press(el, '{ArrowDown}');
    expect(row(el, 'Buildings').getAttribute('aria-selected')).toBe('true');
    expect(getComputedStyle(row(el, 'Buildings').querySelector('.option-check')!).visibility).toBe(
      'visible',
    );
  });

  it('takes part in its form: one value, required with validity on the trigger, and reset', async () => {
    const { el, form } = await tree({}, 'label="Map layers" name="layer" required');
    expect(trigger(el).getAttribute('aria-required')).toBe('true');
    expect(el.validity.valueMissing).toBe(true);
    expect(form.checkValidity()).toBe(false);
    el.reportValidity();
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(trigger(el));
    expect(trigger(el).getAttribute('aria-invalid')).toBe('true');
    await press(el, '{ArrowDown}{ArrowDown}{Enter}');
    expect(el.value).toBe('imagery');
    expect(el.validity.valid).toBe(true);
    expect(new FormData(form).get('layer')).toBe('imagery');
    form.reset();
    await settle(el);
    expect(el.value).toBe('');
  });

  it('is skipped by Tab and never opens while disabled', async () => {
    const { el } = await tree({ value: 'roads' }, 'label="Map layers" disabled');
    expect(trigger(el).hasAttribute('tabindex')).toBe(false);
    expect(trigger(el).getAttribute('aria-disabled')).toBe('true');
    expect(part(el, 'clear').hidden).toBe(true);
    container.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect(document.activeElement!.id).toBe('after');
    await userEvent.click(part(el, 'control'), { force: true });
    await settle(el);
    expect(open(el)).toBe(false);
  });

  it('shows the loading row, the empty slot, and the status slot in the popup', async () => {
    const { el } = await tree({ items: [], loading: true });
    await press(el, '{ArrowDown}');
    expect(part(el, 'loading').hidden).toBe(false);
    expect(part(el, 'tree').getAttribute('aria-busy')).toBe('true');
    expect(part(el, 'empty').hidden).toBe(true);
    el.loading = false;
    await settle(el);
    expect(part(el, 'empty').hidden).toBe(false);
    expect(part(el, 'empty').textContent!.trim()).toBe('No items available');
    expect(open(el)).toBe(true);
  });

  it('draws one focus ring around the field and the open popup while focused from the keyboard', async () => {
    const { el } = await tree({ value: 'roads' });
    container.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect(trigger(el).matches(':focus-visible')).toBe(true);
    const box = part(el, 'control');
    expect(getComputedStyle(box).outlineStyle).toBe('solid');
    await press(el, '{ArrowDown}');
    const popup = part(el, 'popup');
    const ring = getComputedStyle(popup, '::before');
    expect(getComputedStyle(box).outlineStyle).toBe('none');
    expect(ring.borderTopStyle).toBe('solid');
    // The popup does not clip, so the ring shows around the field above it.
    expect(getComputedStyle(popup).overflow).toBe('visible');
    const field = box.getBoundingClientRect();
    const surface = popup.getBoundingClientRect();
    // The popup is as wide as the field and joined to it.
    expect(surface.width).toBeCloseTo(field.width, 0);
    expect(surface.top).toBeCloseTo(field.bottom, 0);
    expect(parseFloat(ring.top)).toBeCloseTo(-(field.height + 4), 0);
  });

  it('is one Tab stop, as a native select; the chip and clear buttons stay out of the Tab order', async () => {
    const { el } = await tree({ multiple: true, values: ['roads', 'rail'] });
    container.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect(el.shadowRoot!.activeElement).toBe(trigger(el));
    await userEvent.tab();
    expect(document.activeElement!.id).toBe('after');
    await userEvent.tab({ shift: true });
    expect(el.shadowRoot!.activeElement).toBe(trigger(el));
  });

  it('shows the error state once the user leaves a required, empty picker, also in a disabled fieldset', async () => {
    const { el, log } = await tree({}, 'label="Map layers" required');
    trigger(el).focus();
    await settle(el);
    expect(trigger(el).hasAttribute('aria-invalid')).toBe(false);
    container.querySelector<HTMLElement>('#after')!.focus();
    await settle(el);
    expect(trigger(el).getAttribute('aria-invalid')).toBe('true');
    expect(el.matches(':state(user-invalid)')).toBe(true);
    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    container.querySelector('form')!.append(fieldset);
    fieldset.append(el);
    await settle(el);
    expect(trigger(el).getAttribute('aria-disabled')).toBe('true');
    await press(el, '{ArrowDown}');
    expect(open(el)).toBe(false);
    expect(log).toEqual([]);
  });

  it('draws the control field, a raised popup, and the active row apart from the chosen one', async () => {
    const { el } = await tree({ value: 'roads' });
    const box = getComputedStyle(part(el, 'control'));
    expect(box.borderTopColor).toBe(themeValue('border-top-color', '--odd-color-border-strong'));
    expect(getComputedStyle(el.shadowRoot!.querySelector('.chevron')!).color).toBe(
      themeValue('color', '--odd-color-text-secondary'),
    );
    const closed = el.shadowRoot!.querySelector('.chevron')!.innerHTML;
    await press(el, '{ArrowDown}{ArrowDown}');
    const surface = getComputedStyle(part(el, 'popup'));
    expect(surface.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-raised'),
    );
    expect(surface.boxShadow).not.toBe('none');
    // Selection: the bar and weight of the navigation row; focus: the ring on another row.
    const roads = getComputedStyle(row(el, 'Roads'));
    expect(roads.borderInlineStartColor).toBe(
      themeValue('border-inline-start-color', '--odd-color-action-default'),
    );
    expect(roads.outlineStyle).toBe('none');
    expect(getComputedStyle(row(el, 'Rail')).outlineColor).toBe(
      themeValue('outline-color', '--odd-color-focus-ring'),
    );
    // The chevron points up while the popup is open.
    expect(el.shadowRoot!.querySelector('.chevron')!.innerHTML).not.toBe(closed);
  });

  it.runIf(server.browser === 'chromium')(
    'marks the chosen row and disabled rows in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el } = await tree({ value: 'roads' });
        await press(el, '{ArrowDown}');
        const probe = document.createElement('span');
        probe.style.color = 'Highlight';
        container.append(probe);
        expect(getComputedStyle(row(el, 'Roads')).borderInlineStartColor).toBe(
          getComputedStyle(probe).color,
        );
        probe.style.color = 'GrayText';
        expect(getComputedStyle(row(el, 'Buildings')).color).toBe(getComputedStyle(probe).color);
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('focuses the trigger from its label, and never chooses a disabled row', async () => {
    const { el, log } = await tree({ value: 'roads' });
    await userEvent.click(part(el, 'label'));
    expect(el.shadowRoot!.activeElement).toBe(trigger(el));
    await press(el, '{ArrowDown}');
    await userEvent.click(row(el, 'Buildings'), { force: true });
    await settle(el);
    expect(el.value).toBe('roads');
    expect(open(el)).toBe(true);
    expect(log).toEqual([]);
  });

  it('closes on Escape without closing what holds it', async () => {
    const { el } = await tree();
    const seen: string[] = [];
    container.addEventListener('keydown', (event) => seen.push(event.key));
    await press(el, '{ArrowDown}');
    seen.length = 0;
    await press(el, '{Escape}');
    expect(open(el)).toBe(false);
    expect(seen).toEqual([]);
    // Closed, Escape is the page's.
    await press(el, '{Escape}');
    expect(seen).toEqual(['Escape']);
  });

  it('keeps the chips on one line while open, and cuts a long value short', async () => {
    const many = [{ id: 'all', label: 'All layers', children: LAYERS }];
    const { el } = await mount('label="Map layers" multiple', {
      items: many,
      values: ['transportation', 'boundaries', 'imagery', 'roads'],
    });
    el.style.inlineSize = '200px';
    const visible = () =>
      parts(el, 'chip').filter((chip) => getComputedStyle(chip).visibility === 'visible');
    await expect.poll(() => visible().length).toBeLessThan(4);
    // The narrower field is measured once it has resized.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await settle(el);
    const count = visible().length;
    await press(el, '{ArrowDown}');
    expect(open(el)).toBe(true);
    expect(visible()).toHaveLength(count);
    expect(part(el, 'more').hidden).toBe(false);
    el.multiple = false;
    el.value = 'transportation';
    await settle(el);
    const value = el.shadowRoot!.querySelector<HTMLElement>('.value')!;
    expect(part(el, 'control').getBoundingClientRect().width).toBe(200);
    expect(value.scrollWidth).toBeGreaterThan(value.clientWidth);
    expect(part(el, 'control').getBoundingClientRect().height).toBeLessThan(60);
  });

  it('scrolls the rows while the footer stays, and flips above the field when there is no room below', async () => {
    const items = Array.from({ length: 40 }, (_, n) => ({ id: `layer-${n}`, label: `Layer ${n}` }));
    const { el } = await mount('label="Map layers"', { items });
    await press(el, '{ArrowDown}');
    const popup = part(el, 'popup').getBoundingClientRect();
    const content = el.shadowRoot!.querySelector<HTMLElement>('.content')!;
    expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    expect(part(el, 'footer').getBoundingClientRect().bottom).toBeLessThanOrEqual(popup.bottom + 1);
    await press(el, '{End}');
    expect(content.scrollTop).toBeGreaterThan(0);
    await press(el, '{Escape}');
    // Near the bottom of the viewport, the popup opens above, joined to the field's top.
    el.items = items.slice(0, 6);
    container.style.cssText = 'position: fixed; inset-block-end: 8px; inset-inline-start: 0';
    container.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    await press(el, '{ArrowDown}');
    const field = part(el, 'control').getBoundingClientRect();
    const above = part(el, 'popup');
    await expect.poll(() => above.dataset['side']).toBe('block-start');
    expect(above.getBoundingClientRect().bottom).toBeCloseTo(field.top, 0);
    const ring = getComputedStyle(above, '::before');
    expect(parseFloat(ring.bottom)).toBeCloseTo(-(field.height + 4), 0);
    expect(parseFloat(ring.top)).toBeCloseTo(-4, 0);
  });
  it('releases everything when removed, also while open', async () => {
    const before = scopeStats();
    const { el } = await tree({ multiple: true, values: ['roads'] });
    await press(el, '{ArrowDown}');
    expect(open(el)).toBe(true);
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
