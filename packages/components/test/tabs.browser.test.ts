import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinTabs } from '../src/tabs/tabs.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-tabs and odd-tab-panel (component-contracts.md §3.4, §2.3), with the shipped theme.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
afterEach(() => {
  container?.remove();
  flush();
});
const PANELS = `<odd-tab-panel label="Overview" value="overview">Overview text <button>In overview</button></odd-tab-panel
  ><odd-tab-panel label="Activity" value="activity">Activity text</odd-tab-panel
  ><odd-tab-panel label="Settings" value="settings">Settings text</odd-tab-panel>`;
async function mount(attributes = '', panels = PANELS): Promise<OddkinTabs> {
  container = document.createElement('div');
  container.innerHTML = `<button id="before">before</button><odd-tabs label="Project" ${attributes}>${panels}</odd-tabs><button id="after">after</button>`;
  document.body.append(container);
  const el = container.querySelector('odd-tabs')!;
  for (const each of container.querySelectorAll('*')) await settle(each);
  return el;
}
const tabs = (el: Element) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="tab"]')];
const panels = (el: Element) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="panel"]'),
];
const selected = (el: Element) => tabs(el).map((t) => t.getAttribute('aria-selected') === 'true');
const focused = (el: Element) => tabs(el).indexOf(el.shadowRoot!.activeElement as HTMLElement);
/** `input` and `change` events dispatched at the element. */
const record = (el: Element) => {
  const seen: string[] = [];
  for (const type of ['input', 'change']) el.addEventListener(type, () => seen.push(type));
  return seen;
};
const focusFirst = async (el: OddkinTabs) => {
  container.querySelector<HTMLElement>('#before')!.focus();
  await userEvent.tab();
  expect(el.shadowRoot!.activeElement?.getAttribute('role')).toBe('tab');
};
const describedPath = async (steps: number) => {
  container.querySelector<HTMLElement>('#before')!.focus();
  const path: string[] = [];
  for (let i = 0; i < steps; i++) {
    await userEvent.tab();
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    path.push(
      `${active?.getAttribute('role') ?? active?.localName}:${active?.textContent?.trim()}`,
    );
  }
  return path;
};

describe('odd-tabs', () => {
  it('is a named tab list whose tabs control panels holding the odd-tab-panel children', async () => {
    const el = await mount();
    const list = el.shadowRoot!.querySelector('[part~="list"]')!;
    expect(list.getAttribute('role')).toBe('tablist');
    expect(list.getAttribute('aria-label')).toBe('Project');
    expect(list.getAttribute('aria-orientation')).toBe('horizontal');
    expect(tabs(el).map((t) => t.textContent!.trim())).toEqual([
      'Overview',
      'Activity',
      'Settings',
    ]);
    const children = [...el.children];
    panels(el).forEach((panel, i) => {
      const tab = tabs(el)[i]!;
      expect(tab.getAttribute('role')).toBe('tab');
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(tab.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
      expect(panel.querySelector('slot')!.assignedElements()).toEqual([children[i]]);
    });
    expect(selected(el)).toEqual([true, false, false]);
    expect(panels(el).map((p) => p.hidden)).toEqual([false, true, true]);
    expect(children[1]!.getBoundingClientRect().height).toBe(0);
  });

  it('shows the panel whose value matches, else the first enabled one, else by position', async () => {
    const el = await mount('value="settings"');
    expect(selected(el)).toEqual([false, false, true]);
    expect(tabs(el).map((t) => t.tabIndex)).toEqual([-1, -1, 0]);
    el.value = 'unknown';
    await settle(el);
    expect(selected(el)).toEqual([true, false, false]);
    el.value = 'overview';
    el.querySelector('odd-tab-panel')!.disabled = true;
    await settle(el);
    expect(selected(el)).toEqual([false, true, false]);
    expect(el.querySelector('odd-tab-panel')!.hasAttribute('disabled')).toBe(true);
    const plain = await mount(
      'value="1"',
      '<odd-tab-panel label="A">a</odd-tab-panel><odd-tab-panel label="B">b</odd-tab-panel>',
    );
    expect(selected(plain)).toEqual([false, true]);
  });

  it('selects by click with one input and one change, never for property changes', async () => {
    const el = await mount();
    const seen = record(el);
    tabs(el)[1]!.click();
    await settle(el);
    expect(el.value).toBe('activity');
    expect(selected(el)).toEqual([false, true, false]);
    expect(seen).toEqual(['input', 'change']);
    tabs(el)[1]!.click();
    el.value = 'settings';
    await settle(el);
    expect(selected(el)).toEqual([false, false, true]);
    expect(seen).toEqual(['input', 'change']);
    el.querySelector<HTMLElement & { disabled: boolean }>('[value="overview"]')!.disabled = true;
    await settle(el);
    expect((tabs(el)[0] as HTMLButtonElement).disabled).toBe(true);
    tabs(el)[0]!.click();
    expect(seen).toEqual(['input', 'change']);
  });

  it('moves focus and selection with arrow keys, Home and End, skipping disabled tabs', async () => {
    const el = await mount();
    el.querySelector<HTMLElement & { disabled: boolean }>('[value="activity"]')!.disabled = true;
    await settle(el);
    const seen = record(el);
    await focusFirst(el);
    await userEvent.keyboard('{ArrowRight}');
    await settle(el);
    expect([focused(el), el.value]).toEqual([2, 'settings']);
    expect(seen).toEqual(['input', 'change']);
    await userEvent.keyboard('{ArrowRight}');
    await settle(el);
    expect([focused(el), el.value]).toEqual([0, 'overview']);
    await userEvent.keyboard('{End}');
    await settle(el);
    expect(focused(el)).toBe(2);
    await userEvent.keyboard('{Home}');
    await settle(el);
    expect(focused(el)).toBe(0);
    await userEvent.keyboard('{ArrowDown}');
    await settle(el);
    expect(focused(el)).toBe(0);
  });

  it('mirrors Left and Right in right-to-left text', async () => {
    const el = await mount('dir="rtl"');
    await focusFirst(el);
    await userEvent.keyboard('{ArrowLeft}');
    await settle(el);
    expect([focused(el), el.value]).toEqual([1, 'activity']);
  });

  it('with manual activation, moves focus without selecting until Enter or Space', async () => {
    const el = await mount('activation="manual"');
    const seen = record(el);
    await focusFirst(el);
    await userEvent.keyboard('{ArrowRight}');
    await settle(el);
    expect(focused(el)).toBe(1);
    expect(selected(el)).toEqual([true, false, false]);
    expect(seen).toEqual([]);
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(selected(el)).toEqual([false, true, false]);
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard(' ');
    await settle(el);
    expect(selected(el)).toEqual([false, false, true]);
    expect(seen).toEqual(['input', 'change', 'input', 'change']);
  });

  it('has one Tab stop in the list, the selected tab, then the panel', async () => {
    const el = await mount('activation="manual"');
    expect(await describedPath(4)).toEqual([
      'tab:Overview',
      'tabpanel:',
      'button:In overview',
      'button:after',
    ]);
    // Focus moved to another tab and left: coming back lands on the selected tab again.
    await focusFirst(el);
    await userEvent.keyboard('{ArrowRight}');
    await settle(el);
    container.querySelector<HTMLElement>('#after')!.focus();
    await settle(el);
    expect(tabs(el).map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    expect(focused(el)).toBe(0);
  });

  it('when vertical, uses Up and Down and puts the list beside the panel', async () => {
    const el = await mount('orientation="vertical"');
    expect(el.shadowRoot!.querySelector('[part~="list"]')!.getAttribute('aria-orientation')).toBe(
      'vertical',
    );
    await focusFirst(el);
    await userEvent.keyboard('{ArrowRight}');
    await settle(el);
    expect(focused(el)).toBe(0);
    await userEvent.keyboard('{ArrowDown}');
    await settle(el);
    expect([focused(el), el.value]).toEqual([1, 'activity']);
    const list = el.shadowRoot!.querySelector('[part~="list"]')!.getBoundingClientRect();
    const panel = panels(el)[1]!.getBoundingClientRect();
    expect(panel.left).toBeGreaterThanOrEqual(list.right);
  });

  it('follows added, removed, renamed, and late panels', async () => {
    const el = await mount();
    const panel = document.createElement('odd-tab-panel');
    panel.label = 'History';
    el.append(panel);
    // Before the mutation observer runs: the panel reported itself when it connected.
    flush();
    expect(tabs(el).map((t) => t.textContent!.trim())).toEqual([
      'Overview',
      'Activity',
      'Settings',
      'History',
    ]);
    el.querySelector('[value="activity"]')!.remove();
    panel.label = 'Changes';
    await settle(el);
    expect(tabs(el).map((t) => t.textContent!.trim())).toEqual(['Overview', 'Settings', 'Changes']);
    expect(panels(el)[2]!.querySelector('slot')!.assignedElements()).toEqual([panel]);
    // Other children are never shown.
    el.append(Object.assign(document.createElement('p'), { textContent: 'stray' }));
    await settle(el);
    expect(tabs(el)).toHaveLength(3);
    expect(el.querySelector('p')!.assignedSlot).toBeNull();
  });

  it('draws the selected tab in the selection colours and the others in secondary text', async () => {
    const el = await mount();
    const [overview, activity] = tabs(el);
    expect(getComputedStyle(overview!).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-selection-background'),
    );
    expect(getComputedStyle(overview!).color).toBe(
      themeValue('color', '--odd-color-selection-foreground'),
    );
    expect(getComputedStyle(activity!).color).toBe(
      themeValue('color', '--odd-color-text-secondary'),
    );
    const divider = getComputedStyle(el.shadowRoot!.querySelector('.panels')!, '::before');
    expect(divider.backgroundColor).toBe(themeValue('color', '--odd-color-border-default'));
    expect(divider.blockSize).toBe('1px');
    await focusFirst(el);
    expect(getComputedStyle(overview!).outlineStyle).toBe('solid');
    for (const tab of tabs(el)) expect(getComputedStyle(tab).transitionDuration).toBe('0s');
  });

  it('reports an invalid orientation and stays horizontal', async () => {
    const codes: string[] = [];
    setErrorHandler((_error, context) => codes.push(context.code ?? ''));
    try {
      const el = await mount('orientation="column"');
      expect(el.orientation).toBe('horizontal');
    } finally {
      setErrorHandler(undefined);
    }
    expect(codes).toEqual(['element.attribute.invalid']);
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the selected tab and the border visible in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const el = await mount();
        const system = (property: string, color: string) => {
          const probe = document.createElement('span');
          probe.style.setProperty(property, color);
          container.append(probe);
          return getComputedStyle(probe).getPropertyValue(property);
        };
        expect(getComputedStyle(tabs(el)[0]!).backgroundColor).toBe(
          system('background-color', 'Highlight'),
        );
        expect(getComputedStyle(tabs(el)[0]!).color).toBe(system('color', 'HighlightText'));
        expect(
          getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!).borderBlockStartColor,
        ).toBe(system('color', 'CanvasText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything it owns when removed', async () => {
    const before = scopeStats();
    await mount();
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
