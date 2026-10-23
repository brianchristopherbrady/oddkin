import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinSplitPanel } from '../src/split-panel/split-panel.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-split-panel (component-contracts.md §3.7), with the shipped theme.
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

const PANES =
  '<div slot="start"><button id="in-start">Start</button></div><div slot="end"><button id="in-end">End</button></div>';
async function mount(attributes = '', panes = PANES, style = 'inline-size: 816px') {
  container = document.createElement('div');
  container.innerHTML = `<button id="before">before</button><odd-split-panel style="${style}" ${attributes}>${panes}</odd-split-panel><button id="after">after</button>`;
  document.body.append(container);
  const el = container.querySelector<OddkinSplitPanel>('odd-split-panel')!;
  await settle(el);
  const log: string[] = [];
  el.addEventListener('input', () => log.push(`input ${round(el.position)}`));
  el.addEventListener('change', () => log.push(`change ${round(el.position)}`));
  return { el, log };
}
const round = (value: number) => Math.round(value * 100) / 100;
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const width = (node: Element) => node.getBoundingClientRect().width;
const press = async (el: OddkinSplitPanel, key: string) => {
  part(el, 'separator').focus();
  await userEvent.keyboard(key);
  await settle(el);
};
/** The id of the focused element, or the part name inside the split panel. */
const focused = () => {
  const active = document.activeElement;
  const inner = active?.shadowRoot?.activeElement;
  return inner?.getAttribute('part') ?? active?.id;
};

describe('odd-split-panel', () => {
  it('has a focusable separator named by label, with its value, limits, orientation, and controlled pane', async () => {
    const { el } = await mount('label="Resize files" position="30" min="10" max="80"');
    const separator = part(el, 'separator');
    await expect
      .element(page.getByRole('separator', { name: 'Resize files', exact: true }))
      .toBeVisible();
    expect(separator.getAttribute('aria-valuenow')).toBe('30');
    expect(separator.getAttribute('aria-valuemin')).toBe('10');
    expect(separator.getAttribute('aria-valuemax')).toBe('80');
    // Panes side by side: the separator itself is vertical.
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(el.shadowRoot!.getElementById(separator.getAttribute('aria-controls')!)).toBe(
      part(el, 'start'),
    );
    el.orientation = 'vertical';
    el.label = '';
    el.strings = { label: 'Größe ändern' };
    await settle(el);
    expect(separator.getAttribute('aria-orientation')).toBe('horizontal');
    expect(separator.getAttribute('aria-label')).toBe('Größe ändern');
    el.strings = undefined;
    await settle(el);
    expect(separator.getAttribute('aria-label')).toBe('Resize');
  });

  it('puts the separator’s centre at the position, in either direction', async () => {
    const { el } = await mount('position="25"');
    const base = part(el, 'base').getBoundingClientRect();
    const separator = part(el, 'separator').getBoundingClientRect();
    expect(separator.width).toBe(parseFloat(themeValue('inline-size', '--odd-space-md')));
    expect(separator.left + separator.width / 2 - base.left).toBeCloseTo(base.width / 4, 0);
    expect(width(part(el, 'start')) + separator.width + width(part(el, 'end'))).toBeCloseTo(
      base.width,
      0,
    );
    el.dir = 'rtl';
    await settle(el);
    const rtl = part(el, 'separator').getBoundingClientRect();
    expect(base.right - (rtl.left + rtl.width / 2)).toBeCloseTo(base.width / 4, 0);
    expect(part(el, 'start').getBoundingClientRect().left).toBeGreaterThan(rtl.left);
    // Panes scroll their own overflow; the separator takes touch drags and turns its grip along.
    expect(getComputedStyle(part(el, 'start')).overflow).toBe('auto');
    expect(getComputedStyle(part(el, 'end')).overflow).toBe('auto');
    expect(getComputedStyle(part(el, 'separator')).touchAction).toBe('none');
    const glyph = part(el, 'separator').querySelector('.glyph')!;
    expect(getComputedStyle(glyph).rotate).toBe('90deg');
    el.orientation = 'vertical';
    await settle(el);
    expect(getComputedStyle(glyph).rotate).toBe('none');
  });

  it('stacks the panes when vertical, sharing the element’s height', async () => {
    const { el } = await mount('orientation="vertical" position="40"', PANES, 'block-size: 400px');
    const base = part(el, 'base').getBoundingClientRect();
    const separator = part(el, 'separator').getBoundingClientRect();
    expect(separator.top + separator.height / 2 - base.top).toBeCloseTo(160, 0);
    expect(part(el, 'end').getBoundingClientRect().top).toBeCloseTo(separator.bottom, 0);
    expect(separator.width).toBe(base.width);
  });

  it('is one Tab stop between the panes, as the panes’ own controls are', async () => {
    const { el } = await mount();
    container.querySelector<HTMLElement>('#before')!.focus();
    const order: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      await userEvent.tab();
      order.push(focused());
    }
    expect(order).toEqual(['in-start', 'separator', 'in-end', 'after']);
    expect(el.shadowRoot!.activeElement).toBeNull();
  });

  it('steps with the inline arrows, mirrored right to left, and goes to the limits with Home and End', async () => {
    const { el, log } = await mount('position="50" min="20" max="70"');
    await press(el, '{ArrowRight}');
    await press(el, '{ArrowLeft}');
    await press(el, '{ArrowLeft}');
    expect(el.position).toBe(49);
    expect(part(el, 'separator').getAttribute('aria-valuenow')).toBe('49');
    await press(el, '{Home}');
    expect(el.position).toBe(20);
    await press(el, '{End}');
    expect(el.position).toBe(70);
    await press(el, '{End}');
    expect(log).toEqual([
      'input 51',
      'change 51',
      'input 50',
      'change 50',
      'input 49',
      'change 49',
      'input 20',
      'change 20',
      'input 70',
      'change 70',
    ]);
    el.dir = 'rtl';
    await press(el, '{ArrowLeft}');
    expect(el.position).toBe(70);
    await press(el, '{ArrowRight}');
    expect(el.position).toBe(69);
    // Up and Down belong to stacked panes.
    await press(el, '{ArrowDown}');
    expect(el.position).toBe(69);
  });

  it('uses Up and Down when stacked', async () => {
    const { el } = await mount('orientation="vertical"', PANES, 'block-size: 300px');
    await press(el, '{ArrowDown}');
    expect(el.position).toBe(51);
    await press(el, '{ArrowUp}');
    await press(el, '{ArrowUp}');
    expect(el.position).toBe(49);
    await press(el, '{ArrowRight}');
    expect(el.position).toBe(49);
  });

  it('collapses the start pane with Enter and restores the previous position', async () => {
    const { el, log } = await mount('position="35"');
    await press(el, '{Enter}');
    expect(el.collapsed).toBe(true);
    expect(el.hasAttribute('collapsed')).toBe(true);
    expect(part(el, 'start').hidden).toBe(true);
    expect(width(part(el, 'start'))).toBe(0);
    expect(part(el, 'separator').getAttribute('aria-valuenow')).toBe('0');
    expect(part(el, 'separator').getAttribute('aria-valuemin')).toBe('0');
    expect(part(el, 'separator').getBoundingClientRect().left).toBe(
      part(el, 'base').getBoundingClientRect().left,
    );
    expect(width(part(el, 'separator'))).toBe(
      parseFloat(themeValue('inline-size', '--odd-space-md')),
    );
    // The hidden pane's controls leave the Tab order.
    container.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect(focused()).toBe('separator');
    await press(el, '{Enter}');
    expect(el.collapsed).toBe(false);
    expect(el.position).toBe(35);
    expect(part(el, 'separator').getAttribute('aria-valuenow')).toBe('35');
    expect(log).toEqual(['input 35', 'change 35', 'input 35', 'change 35']);
  });

  it('opens a collapsed pane by moving the separator', async () => {
    const { el } = await mount('position="35" collapsed min="10"');
    expect(part(el, 'separator').getAttribute('aria-valuemin')).toBe('0');
    await press(el, '{ArrowRight}');
    expect(el.collapsed).toBe(false);
    expect(el.position).toBe(10);
  });

  it('follows a real drag, reporting input while it moves and change once on release', async () => {
    // Inside the test viewport (414 px wide by default).
    const { el, log } = await mount('position="50"', PANES, 'inline-size: 400px');
    const base = part(el, 'base').getBoundingClientRect();
    const marker = document.createElement('div');
    marker.dataset.testid = 'drop';
    marker.style.cssText = `position:fixed;left:${base.left + base.width * 0.75 - 5}px;top:${base.top + 5}px;width:10px;height:10px`;
    container.append(marker);
    // A locator: Playwright resolves it through the shadow root.
    await userEvent.dragAndDrop(
      page.getByRole('separator', { name: 'Resize', exact: true }),
      page.getByTestId('drop'),
    );
    await settle(el);
    expect(el.position).toBeCloseTo(75, 0);
    expect(log.filter((entry) => entry.startsWith('change'))).toHaveLength(1);
    expect(log.length).toBeGreaterThan(1);
    expect(log.at(-1)).toMatch(/^change /);
    expect(part(el, 'base').classList.contains('dragging')).toBe(false);
    expect(focused()).toBe('separator');
  });

  it('marks the separator while it is dragged', async () => {
    const { el } = await mount();
    const separator = part(el, 'separator');
    const at = separator.getBoundingClientRect();
    const init = {
      pointerId: 3,
      isPrimary: true,
      clientX: at.left + 2,
      clientY: at.top + 2,
      bubbles: true,
      composed: true,
    };
    separator.dispatchEvent(new PointerEvent('pointerdown', { ...init, button: 0 }));
    await settle(el);
    expect(part(el, 'base').classList.contains('dragging')).toBe(true);
    document.dispatchEvent(new PointerEvent('pointerup', { ...init, button: 0 }));
    await settle(el);
    expect(part(el, 'base').classList.contains('dragging')).toBe(false);
  });

  it('keeps the shown position within the limits and reports none for property writes', async () => {
    const { el, log } = await mount('position="90" min="20" max="60"');
    expect(part(el, 'separator').getAttribute('aria-valuenow')).toBe('60');
    el.position = 5;
    await settle(el);
    expect(part(el, 'separator').getAttribute('aria-valuenow')).toBe('20');
    el.position = 33.4;
    await settle(el);
    expect(part(el, 'separator').getAttribute('aria-valuenow')).toBe('33');
    // A maximum under the minimum is the minimum; limits stay within 0 to 100.
    el.min = 150;
    el.max = 10;
    await settle(el);
    expect(part(el, 'separator').getAttribute('aria-valuemin')).toBe('100');
    expect(part(el, 'separator').getAttribute('aria-valuemax')).toBe('100');
    el.min = -5;
    el.max = 40;
    el.collapsed = true;
    await settle(el);
    expect(part(el, 'separator').getAttribute('aria-valuemin')).toBe('0');
    expect(part(el, 'separator').getAttribute('aria-valuenow')).toBe('0');
    expect(log).toEqual([]);
  });

  it('shows a resize cursor over the separator, or the pointer where that is unsupported', async () => {
    const { el } = await mount();
    const supported = CSS.supports('cursor', 'col-resize');
    expect(getComputedStyle(part(el, 'separator')).cursor).toBe(
      supported ? 'col-resize' : 'pointer',
    );
    el.orientation = 'vertical';
    await settle(el);
    expect(getComputedStyle(part(el, 'separator')).cursor).toBe(
      supported ? 'row-resize' : 'pointer',
    );
  });

  it('takes pointer input over at least the minimum target size', async () => {
    const { el } = await mount();
    const hit = getComputedStyle(part(el, 'separator'), '::before');
    expect(hit.inlineSize).toBe(themeValue('inline-size', '--odd-target-min'));
    expect(hit.blockSize).toBe(`${part(el, 'separator').getBoundingClientRect().height}px`);
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the separator visible in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el } = await mount();
        const probe = document.createElement('span');
        probe.style.color = 'CanvasText';
        container.append(probe);
        const style = getComputedStyle(part(el, 'separator'));
        expect(style.borderInlineStartColor).toBe(getComputedStyle(probe).color);
        expect(style.borderInlineStartWidth).toBe('1px');
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it.runIf(server.browser === 'chromium')('does not animate under reduced motion', async () => {
    const session = cdp();
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    try {
      const { el } = await mount();
      expect(getComputedStyle(part(el, 'separator')).transitionDuration).toBe('0s');
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] });
    }
  });

  it('falls back to the default for an invalid position and releases everything when removed', async () => {
    const before = scopeStats();
    const codes: string[] = [];
    const previous = setErrorHandler((_error, context) => codes.push(context.code));
    const { el } = await mount('position="wide"').finally(() => setErrorHandler(previous));
    expect(codes).toEqual(['element.attribute.invalid']);
    expect(el.position).toBe(50);
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
