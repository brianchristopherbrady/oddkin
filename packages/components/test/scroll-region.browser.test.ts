import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinScrollRegion } from '../src/scroll-region/scroll-region.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-scroll-region (component-contracts.md §3.7), with the shipped theme.
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

const lines = (count: number) =>
  Array.from({ length: count }, (_, i) => `<p>Line ${i + 1}</p>`).join('');
/** Waits for the resize observer's delivery and the re-render it causes. */
const observed = async (el: OddkinScrollRegion) => {
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await settle(el);
};
async function mount(attributes = '', content = lines(20), style = 'max-block-size: 120px') {
  container = document.createElement('div');
  container.innerHTML = `<button id="before">before</button><odd-scroll-region style="${style}" ${attributes}>${content}</odd-scroll-region><button id="after">after</button>`;
  document.body.append(container);
  const el = container.querySelector<OddkinScrollRegion>('odd-scroll-region')!;
  await observed(el);
  return el;
}
const base = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
/** The id of the focused element, or the part name inside a shadow root. */
const focused = () => {
  const active = document.activeElement;
  return active?.shadowRoot?.activeElement?.getAttribute('part') ?? active?.id;
};
const tabOrder = async (count: number) => {
  (container.querySelector('#before') as HTMLElement).focus();
  const order = [focused()];
  for (let i = 0; i < count; i++) {
    await userEvent.tab();
    order.push(focused());
  }
  return order;
};

describe('odd-scroll-region', () => {
  it('is a focusable region named by label while its content overflows, in the native tab order', async () => {
    const el = await mount('label="Release notes"');
    await expect
      .element(page.getByRole('region', { name: 'Release notes', exact: true }))
      .toBeVisible();
    expect(base(el).tabIndex).toBe(0);
    const order = await tabOrder(2);
    expect(order).toEqual(['before', 'base', 'after']);
    // The same as native markup for a scrollable region.
    container.innerHTML =
      '<button id="before">before</button><div id="base" tabindex="0" role="region" aria-label="Release notes" style="max-block-size: 120px; overflow: auto">' +
      lines(20) +
      '</div><button id="after">after</button>';
    expect(await tabOrder(2)).toEqual(order);
  });

  it('has its state as soon as it has rendered, before the observer delivers', async () => {
    container = document.createElement('div');
    container.innerHTML = `<odd-scroll-region label="Release notes" style="max-block-size: 120px">${lines(20)}</odd-scroll-region>`;
    document.body.append(container);
    const el = container.querySelector<OddkinScrollRegion>('odd-scroll-region')!;
    await el.updateComplete;
    flush();
    expect(base(el).getAttribute('role')).toBe('region');
    expect(base(el).tabIndex).toBe(0);
  });

  it('is neither focusable nor a region when the content fits', async () => {
    const el = await mount('label="Release notes"', lines(2), 'max-block-size: 400px');
    expect(base(el).hasAttribute('tabindex')).toBe(false);
    expect(base(el).hasAttribute('role')).toBe(false);
    expect(base(el).hasAttribute('aria-label')).toBe(false);
    expect(page.getByRole('region').elements()).toHaveLength(0);
    expect(await tabOrder(1)).toEqual(['before', 'after']);
  });

  it('scrolls from the keyboard', async () => {
    const el = await mount('label="Release notes"');
    const scroller = base(el);
    scroller.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0);
    await userEvent.keyboard('{End}');
    await expect
      .poll(() => scroller.scrollTop)
      .toBeGreaterThanOrEqual(scroller.scrollHeight - scroller.clientHeight - 1);
    await userEvent.keyboard('{Home}');
    await expect.poll(() => scroller.scrollTop).toBe(0);
  });

  it('follows its content and its own size', async () => {
    const el = await mount('label="Release notes"', lines(2), 'max-block-size: 120px');
    expect(base(el).hasAttribute('role')).toBe(false);
    el.insertAdjacentHTML('beforeend', lines(20));
    await observed(el);
    expect(base(el).getAttribute('role')).toBe('region');
    el.style.maxBlockSize = '4000px';
    await observed(el);
    expect(base(el).hasAttribute('role')).toBe(false);
    el.style.maxBlockSize = '120px';
    await observed(el);
    expect(base(el).tabIndex).toBe(0);
    el.replaceChildren();
    await observed(el);
    expect(base(el).hasAttribute('tabindex')).toBe(false);
  });

  it('follows its content at a fixed size', async () => {
    const el = await mount('label="Release notes"', lines(1), 'block-size: 150px');
    expect(base(el).hasAttribute('role')).toBe(false);
    el.insertAdjacentHTML('beforeend', lines(20));
    await observed(el);
    expect(base(el).getAttribute('role')).toBe('region');
  });

  it('takes the space left in a flex column and scrolls within it', async () => {
    container = document.createElement('div');
    container.innerHTML = `<div style="display: flex; flex-direction: column; block-size: 200px"><header style="block-size: 50px">Header</header><odd-scroll-region label="Release notes" style="flex: 1">${lines(20)}</odd-scroll-region></div>`;
    document.body.append(container);
    const el = container.querySelector<OddkinScrollRegion>('odd-scroll-region')!;
    await observed(el);
    expect(el.getBoundingClientRect().height).toBe(150);
    expect(base(el).getAttribute('role')).toBe('region');
  });

  it('scrolls sideways content that is wider than the element', async () => {
    const el = await mount(
      'label="Wide table"',
      '<div style="inline-size: 900px">Wide</div>',
      'inline-size: 200px',
    );
    expect(base(el).getAttribute('role')).toBe('region');
    expect(base(el).scrollWidth).toBeGreaterThan(base(el).clientWidth);
  });

  it('is bounded by block-size too, and keeps a stable gutter', async () => {
    const el = await mount('label="Release notes"', lines(20), 'block-size: 150px');
    expect(el.getBoundingClientRect().height).toBe(150);
    expect(base(el).getBoundingClientRect().height).toBe(150);
    expect(base(el).getAttribute('role')).toBe('region');
    if (CSS.supports('scrollbar-gutter', 'stable'))
      expect(getComputedStyle(base(el)).scrollbarGutter).toBe('stable');
  });

  it('names itself from strings when label is empty, and follows label changes', async () => {
    const el = await mount();
    expect(base(el).getAttribute('aria-label')).toBe('Scrollable content');
    el.strings = { label: 'Contenu défilant' };
    await settle(el);
    expect(base(el).getAttribute('aria-label')).toBe('Contenu défilant');
    el.label = 'Build log';
    await settle(el);
    await expect
      .element(page.getByRole('region', { name: 'Build log', exact: true }))
      .toBeVisible();
  });

  it('stacks its children layout.gap apart, with a property for one-off gaps', async () => {
    const el = await mount('label="Release notes"', '<div>One</div><div>Two</div>');
    const content = el.shadowRoot!.querySelector('.content')!;
    expect(getComputedStyle(content).rowGap).toBe(themeValue('row-gap', '--odd-layout-gap'));
    const [first, second] = [...el.children].map((c) => c.getBoundingClientRect());
    expect(first!.width).toBe(base(el).clientWidth);
    expect(second!.top - first!.bottom).toBe(parseFloat(themeValue('row-gap', '--odd-layout-gap')));
    el.style.setProperty('--odd-scroll-region-gap', '3px');
    expect(getComputedStyle(content).rowGap).toBe('3px');
  });

  it('shows the focus ring on keyboard focus', async () => {
    const el = await mount('label="Release notes"');
    await tabOrder(1);
    const style = getComputedStyle(base(el));
    expect(style.outlineStyle).toBe('solid');
    expect(style.outlineColor).toBe(themeValue('color', '--odd-color-focus-ring'));
  });

  it.runIf(server.browser === 'chromium')('keeps the focus ring in forced colours', async () => {
    const session = cdp();
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    });
    try {
      const el = await mount('label="Release notes"');
      await tabOrder(1);
      const style = getComputedStyle(base(el));
      expect(style.outlineStyle).toBe('solid');
      expect(parseFloat(style.outlineWidth)).toBeGreaterThan(0);
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] });
    }
  });

  it('releases its observer when removed', async () => {
    const before = scopeStats();
    await mount('label="Release notes"');
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
