import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { toolbarDefinition } from '../src/toolbar/index.js';
import './register.js';
import { loadTheme, probeTag, semantics, settle, themeValue } from './probe.js';

// odd-toolbar (component-contracts.md §3.4), with the shipped theme.
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
const CONTROLS = `<odd-button id="filter">Filter</odd-button><span>3 selected</span><hr aria-orientation="vertical" /><button id="export">Export</button><odd-button id="archive" disabled>Archive</odd-button><input id="search" aria-label="Search" value="text" /><odd-button id="new">New item</odd-button>`;
async function mount(attributes = '', tag = 'odd-toolbar', controls = CONTROLS) {
  container = document.createElement('div');
  container.innerHTML = `<button id="before">before</button><${tag} label="Project actions" ${attributes}>${controls}</${tag}><button id="after">after</button>`;
  document.body.append(container);
  const el = container.querySelector<HTMLElement>(tag)!;
  for (const each of container.querySelectorAll('*')) await settle(each);
  return el;
}
/** The id of the focused element, or of the host whose shadow tree holds it. */
const focused = () => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement && !active.id) active = active.shadowRoot.activeElement;
  return active?.id || active?.localName;
};
const press = async (key: string, el: Element) => {
  await userEvent.keyboard(key);
  await settle(el);
  return focused();
};

describe('odd-toolbar', () => {
  it('is a toolbar named by label, with its orientation, in ElementInternals', async () => {
    const tag = probeTag(toolbarDefinition);
    const el = await mount('', tag);
    expect(semantics(el)).toEqual({ role: 'toolbar', label: 'Project actions', hidden: null });
    const internals = (el as unknown as { internals: ElementInternals }).internals;
    expect(internals.ariaOrientation).toBe('horizontal');
    el.setAttribute('orientation', 'vertical');
    el.removeAttribute('label');
    await settle(el);
    expect(internals.ariaOrientation).toBe('vertical');
    expect(semantics(el).label).toBeNull();
  });

  it('is one Tab stop: the first control, then the last one focused', async () => {
    await mount();
    container.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect(focused()).toBe('filter');
    await userEvent.tab();
    expect(focused()).toBe('after');
    container.querySelector<HTMLElement>('#export')!.focus();
    container.querySelector<HTMLElement>('#after')!.focus();
    await userEvent.tab({ shift: true });
    expect(focused()).toBe('export');
    await userEvent.tab({ shift: true });
    expect(focused()).toBe('before');
  });

  it('moves with Left and Right, wrapping, over controls only, skipping disabled ones', async () => {
    const el = await mount();
    container.querySelector<HTMLElement>('#filter')!.focus();
    expect(await press('{ArrowRight}', el)).toBe('export');
    expect(await press('{ArrowRight}', el)).toBe('search');
    // A text field keeps its arrow keys, Home, and End for the caret.
    expect(await press('{ArrowRight}', el)).toBe('search');
    expect(await press('{Home}', el)).toBe('search');
    container.querySelector<HTMLElement>('#new')!.focus();
    expect(await press('{ArrowRight}', el)).toBe('filter');
    expect(await press('{ArrowLeft}', el)).toBe('new');
    expect(await press('{Home}', el)).toBe('filter');
    expect(await press('{End}', el)).toBe('new');
    expect(await press('{ArrowDown}', el)).toBe('new');
  });

  it('leaves arrow keys to a slider', async () => {
    const el = await mount(
      '',
      'odd-toolbar',
      '<button id="a">A</button><input id="volume" type="range" aria-label="Volume" /><button id="b">B</button>',
    );
    const slider = container.querySelector<HTMLInputElement>('#volume')!;
    slider.focus();
    expect(await press('{ArrowRight}', el)).toBe('volume');
    expect(slider.value).toBe('51');
    container.querySelector<HTMLElement>('#a')!.focus();
    expect(await press('{ArrowRight}', el)).toBe('volume');
  });

  it('mirrors Left and Right right to left, and uses Up and Down when vertical', async () => {
    const el = await mount('dir="rtl"');
    container.querySelector<HTMLElement>('#filter')!.focus();
    expect(await press('{ArrowLeft}', el)).toBe('export');
    el.setAttribute('orientation', 'vertical');
    await settle(el);
    expect(await press('{ArrowLeft}', el)).toBe('export');
    expect(await press('{ArrowDown}', el)).toBe('search');
    expect(await press('{ArrowUp}', el)).toBe('search');
    container.querySelector<HTMLElement>('#export')!.focus();
    expect(await press('{ArrowUp}', el)).toBe('filter');
  });

  it('keeps one Tab stop when controls are added or the active one is removed', async () => {
    const el = await mount();
    const added = document.createElement('button');
    added.id = 'added';
    el.append(added);
    await settle(el);
    expect(added.tabIndex).toBe(-1);
    container.querySelector('#filter')!.remove();
    await settle(el);
    const stops = [...el.children].filter((c) => (c as HTMLElement).tabIndex === 0);
    expect(stops.map((c) => c.id)).toEqual(['export']);
  });

  it('draws a bordered surface with separators in the border colour', async () => {
    const el = await mount();
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!);
    expect(base.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-default'),
    );
    expect(base.borderBlockStartColor).toBe(themeValue('color', '--odd-color-border-default'));
    const hr = el.querySelector('hr')!;
    expect(getComputedStyle(hr).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-border-default'),
    );
    expect(hr.getBoundingClientRect().width).toBe(1);
    expect(hr.getBoundingClientRect().height).toBeGreaterThan(20);
    el.setAttribute('orientation', 'vertical');
    await settle(el);
    expect(hr.getBoundingClientRect().height).toBe(1);
    expect(getComputedStyle(el.querySelector('span')!).color).toBe(
      themeValue('color', '--odd-color-text-primary'),
    );
  });

  it.runIf(server.browser === 'chromium')(
    'keeps its border and separators visible in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const el = await mount();
        const probe = document.createElement('span');
        probe.style.color = 'CanvasText';
        container.append(probe);
        const canvasText = getComputedStyle(probe).color;
        expect(
          getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!).borderBlockStartColor,
        ).toBe(canvasText);
        expect(getComputedStyle(el.querySelector('hr')!).backgroundColor).toBe(canvasText);
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
