import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinStat } from '../src/stat/stat.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-stat (component-contracts.md §3.2), with the shipped theme.
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

async function mount(attributes: string, context = '+8.2% this month') {
  container = document.createElement('div');
  container.style.inlineSize = '320px';
  container.innerHTML = `<odd-stat ${attributes}>${context}</odd-stat>`;
  document.body.append(container);
  const el = container.querySelector<OddkinStat>('odd-stat')!;
  await settle(el);
  return el;
}
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
const style = (el: Element) => getComputedStyle(el);
const busy = (el: OddkinStat) =>
  (el as unknown as { internals: ElementInternals }).internals.ariaBusy;
const BASE = 'label="Active members" value="1,284"';

describe('odd-stat', () => {
  it('shows the label, the value, and the context, in reading order', async () => {
    const el = await mount(`${BASE} trend="increase"`);
    expect(part(el, 'label')!.textContent).toBe('Active members');
    expect(part(el, 'value')!.textContent).toBe('1,284');
    const slot = part(el, 'context')!.querySelector('slot')!;
    expect(slot.assignedNodes()[0]!.textContent).toBe('+8.2% this month');
    const tops = ['label', 'value', 'context'].map((n) => part(el, n)!.getBoundingClientRect().top);
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    const range = document.createRange();
    range.selectNodeContents(el);
    expect(range.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(range.getBoundingClientRect().top).toBeGreaterThanOrEqual(tops[2]!);
  });

  it('points the arrow up for an increase and down for a decrease, in the same neutral colour', async () => {
    let el = await mount(`${BASE} trend="increase"`);
    const up = part(el, 'context')!.querySelector('svg')!;
    expect(up.getAttribute('aria-hidden')).toBe('true');
    expect(up.getBoundingClientRect().width).toBe(
      parseFloat(themeValue('inline-size', '--odd-icon-size-sm')),
    );
    // The arrow and the context share a line, `space.xs` apart.
    const text = document.createRange();
    text.selectNodeContents(el);
    expect(text.getBoundingClientRect().left - up.getBoundingClientRect().right).toBeCloseTo(
      parseFloat(themeValue('gap', '--odd-space-xs')),
      0,
    );
    expect(style(up).rotate).toBe('none');
    const colour = style(part(el, 'context')!).color;
    expect(colour).toBe(themeValue('color', '--odd-color-text-secondary'));
    container.remove();
    el = await mount(`${BASE} trend="decrease"`, '−3.4% this month');
    expect(style(part(el, 'context')!.querySelector('svg')!).rotate).toBe('180deg');
    expect(style(part(el, 'context')!).color).toBe(colour);
    container.remove();
    el = await mount(BASE, 'Across 12 teams');
    expect(part(el, 'context')!.querySelector('svg')).toBeNull();
    expect(el.trend).toBe('none');
    // Set as a property, it reflects, so the arrow turns too.
    el.trend = 'decrease';
    await settle(el);
    expect(el.getAttribute('trend')).toBe('decrease');
    expect(style(part(el, 'context')!.querySelector('svg')!).rotate).toBe('180deg');
  });

  it('draws the card surface with the value in the display role', async () => {
    const el = await mount(BASE);
    const base = part(el, 'base')!;
    expect(style(base).paddingTop).toBe(themeValue('padding-top', '--odd-card-padding'));
    expect(style(base).borderTopColor).toBe(themeValue('color', '--odd-color-border-default'));
    expect(style(base).borderTopLeftRadius).toBe(
      themeValue('border-top-left-radius', '--odd-card-radius'),
    );
    expect(style(base).backgroundColor).toBe(themeValue('color', '--odd-color-surface-default'));
    expect(style(part(el, 'value')!).fontSize).toBe(
      themeValue('font-size', '--odd-type-display-size'),
    );
    expect(style(part(el, 'label')!).color).toBe(themeValue('color', '--odd-color-text-secondary'));
  });

  it('while loading, shows a placeholder on the sunken surface and says so, and is busy', async () => {
    const el = await mount('label="Active members" loading');
    expect(busy(el)).toBe('true');
    const placeholder = part(el, 'placeholder')!;
    expect(placeholder.localName).toBe('odd-skeleton');
    await settle(placeholder);
    const block = placeholder.shadowRoot!.querySelector('.block')!;
    expect(style(block).backgroundColor).toBe(themeValue('color', '--odd-color-surface-sunken'));
    expect(placeholder.getBoundingClientRect().height).toBeCloseTo(
      parseFloat(themeValue('font-size', '--odd-type-display-size')) * 1.25,
      0,
    );
    expect(part(el, 'context')!.textContent).toBe('Loading…');
    expect(part(el, 'value')).toBeNull();
    // The author's context waits for the value.
    expect(el.shadowRoot!.querySelector('slot')).toBeNull();
    el.loading = false;
    el.value = '1,284';
    await settle(el);
    expect(busy(el)).toBeNull();
    expect(part(el, 'placeholder')).toBeNull();
  });

  it('without a value, says the data is not available and hides the dash', async () => {
    const el = await mount('label="Active members"');
    expect(part(el, 'value')!.textContent).toBe('—');
    expect(part(el, 'value')!.getAttribute('aria-hidden')).toBe('true');
    expect(part(el, 'context')!.textContent).toBe('Data not available');
    el.strings = { unavailable: 'Données indisponibles' };
    await settle(el);
    expect(part(el, 'context')!.textContent).toBe('Données indisponibles');
  });

  it('reports an unknown trend and shows no arrow', async () => {
    const codes: string[] = [];
    const previous = setErrorHandler((_error, context) => codes.push(context.code ?? ''));
    const el = await mount(`${BASE} trend="up"`).finally(() => setErrorHandler(previous));
    expect(codes).toEqual(['element.attribute.invalid']);
    expect(part(el, 'context')!.querySelector('svg')).toBeNull();
  });

  it('wraps a long value inside its surface', async () => {
    const el = await mount(`label="Revenue" value="${'9'.repeat(40)}"`);
    expect(part(el, 'value')!.scrollWidth).toBeLessThanOrEqual(part(el, 'value')!.clientWidth);
  });

  it('releases everything when removed', async () => {
    const before = scopeStats();
    await mount('label="Active members" loading');
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
