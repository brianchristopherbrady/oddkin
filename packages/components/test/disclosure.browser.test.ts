import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinDisclosure } from '../src/disclosure/disclosure.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-disclosure (component-contracts.md §3.4), with the shipped theme.
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
async function mount(markup: string): Promise<HTMLElement> {
  container = document.createElement('div');
  container.innerHTML = markup;
  document.body.append(container);
  for (const el of container.querySelectorAll('*')) await settle(el);
  return container;
}
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const details = (el: Element) => el.shadowRoot!.querySelector('details')!;
/** Toggle events dispatched at the host, as `oldState>newState`. */
const record = (el: Element) => {
  const seen: string[] = [];
  el.addEventListener('toggle', (event) => {
    expect(event).toBeInstanceOf(ToggleEvent);
    const { oldState, newState } = event as ToggleEvent;
    seen.push(`${oldState}>${newState}`);
  });
  return seen;
};
/** Waits for the queued native toggle task of the inner details. */
const toggled = () => new Promise((resolve) => setTimeout(resolve, 0));
/** The keyboard path from a button before the markup, as element descriptions. */
async function tabPath(root: HTMLElement, steps: number): Promise<string[]> {
  const start = document.createElement('button');
  start.textContent = 'start';
  root.prepend(start);
  start.focus();
  const path: string[] = [];
  for (let i = 0; i < steps; i++) {
    await userEvent.tab();
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    path.push(`${active?.localName}:${active?.textContent?.trim()}`);
  }
  start.remove();
  return path;
}

describe('odd-disclosure', () => {
  it('is a native details and summary named by label, opened by click, Enter, and Space', async () => {
    const root = await mount(
      '<odd-disclosure label="Advanced settings">Additional options.</odd-disclosure>',
    );
    const el = root.firstElementChild as OddkinDisclosure;
    const summary = part(el, 'summary');
    expect(summary.localName).toBe('summary');
    expect(summary.parentElement).toBe(details(el));
    expect(part(el, 'label').textContent).toBe('Advanced settings');
    expect(details(el).open).toBe(false);
    summary.click();
    await settle(el);
    expect(el.open).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
    expect(details(el).open).toBe(true);
    summary.focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(el.open).toBe(false);
    await userEvent.keyboard(' ');
    await settle(el);
    expect(el.open).toBe(true);
    expect(el.querySelector('slot')).toBeNull();
    expect(part(el, 'content').querySelector('slot')!.assignedNodes()[0]!.textContent).toBe(
      'Additional options.',
    );
  });

  it('dispatches one toggle at the host per change, whatever changed it', async () => {
    const root = await mount('<odd-disclosure label="Details">Text</odd-disclosure>');
    const el = root.firstElementChild as OddkinDisclosure;
    const seen = record(el);
    part(el, 'summary').click();
    await settle(el);
    await toggled();
    expect(seen).toEqual(['closed>open']);
    el.open = false;
    await settle(el);
    await toggled();
    expect(seen).toEqual(['closed>open', 'open>closed']);
    // Opened and closed again before the native task runs: no change, so no event.
    el.open = true;
    flush();
    expect(details(el).open).toBe(true);
    el.open = false;
    flush();
    await toggled();
    expect(seen).toEqual(['closed>open', 'open>closed']);
    // The platform opens the details itself (find-in-page): the host follows.
    details(el).open = true;
    await toggled();
    await settle(el);
    expect(el.open).toBe(true);
    expect(seen).toEqual(['closed>open', 'open>closed', 'closed>open']);
  });

  it('starts open with the attribute and reports it, as native details does', async () => {
    container = document.createElement('div');
    document.body.append(container);
    const el = document.createElement('odd-disclosure');
    el.setAttribute('open', '');
    const seen = record(el);
    container.append(el);
    await settle(el);
    await toggled();
    expect(details(el).open).toBe(true);
    expect(seen).toEqual(['closed>open']);
    expect(part(el, 'marker').querySelector('path')!.getAttribute('d')).toBe('M6 8l4 4 4-4');
  });

  it('keeps the Tab order of native details: the summary, then content while open', async () => {
    // A button, not a link: WebKit leaves links out of the Tab order by default.
    const content = 'Text <button>Inside</button>';
    const native = await mount(
      `<details><summary>Advanced settings</summary>${content}</details><button>after</button>`,
    );
    const nativeClosed = await tabPath(native, 2);
    native.querySelector('details')!.open = true;
    const nativeOpen = await tabPath(native, 3);
    container.remove();
    const root = await mount(
      `<odd-disclosure label="Advanced settings">${content}</odd-disclosure><button>after</button>`,
    );
    const el = root.firstElementChild as OddkinDisclosure;
    expect(await tabPath(root, 2)).toEqual(nativeClosed);
    el.open = true;
    await settle(el);
    expect(await tabPath(root, 3)).toEqual(nativeOpen);
    expect(nativeOpen).toEqual(['summary:Advanced settings', 'button:Inside', 'button:after']);
  });

  it('when disabled, is not focusable or activatable, and says so', async () => {
    const root = await mount(
      '<odd-disclosure label="Advanced settings" disabled>Text</odd-disclosure><button>after</button>',
    );
    const el = root.firstElementChild as OddkinDisclosure;
    const summary = part(el, 'summary');
    expect(summary.getAttribute('aria-disabled')).toBe('true');
    expect(await tabPath(root, 1)).toEqual(['button:after']);
    summary.click();
    await settle(el);
    expect(el.open).toBe(false);
    expect(getComputedStyle(summary).color).toBe(themeValue('color', '--odd-color-text-disabled'));
    el.disabled = false;
    await settle(el);
    expect(summary.hasAttribute('aria-disabled')).toBe(false);
    expect(summary.hasAttribute('tabindex')).toBe(false);
  });

  it('with a name, opening one closes the others in the same tree only', async () => {
    const root = await mount(`
      <odd-disclosure name="faq" label="One" open>1</odd-disclosure>
      <odd-disclosure name="faq" label="Two">2</odd-disclosure>
      <odd-disclosure name="other" label="Three" open>3</odd-disclosure>
      <div id="shadow-host"></div>`);
    const [one, two, three] = root.querySelectorAll<OddkinDisclosure>('odd-disclosure');
    const shadow = root.querySelector('#shadow-host')!.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<odd-disclosure name="faq" label="Elsewhere" open>4</odd-disclosure>';
    const elsewhere = shadow.firstElementChild as OddkinDisclosure;
    await settle(elsewhere);
    const seen = record(one!);
    part(two!, 'summary').click();
    await settle(two!);
    expect([one!.open, two!.open, three!.open, elsewhere.open]).toEqual([false, true, true, true]);
    await toggled();
    expect(seen).toEqual(['open>closed']);
    // An open member inserted into a group with an open one closes, as native details does.
    const late = document.createElement('odd-disclosure');
    late.name = 'faq';
    late.open = true;
    root.append(late);
    expect(late.open).toBe(false);
    await settle(late);
    expect([two!.open, late.open]).toEqual([true, false]);
    // Joining a group with an open member while open closes this one.
    three!.name = 'faq';
    await settle(three!);
    expect([two!.open, three!.open]).toEqual([true, false]);
    // Without a name, nothing is exclusive.
    one!.name = '';
    one!.open = true;
    await settle(one!);
    expect([one!.open, two!.open]).toEqual([true, true]);
  });

  it('draws adjacent members of a group as one surface with dividers', async () => {
    const root = await mount(`
      <odd-disclosure name="faq" label="One" open>1</odd-disclosure><odd-disclosure name="faq" label="Two">2</odd-disclosure><odd-disclosure name="faq" label="Three">3</odd-disclosure>
      <p>between</p>
      <odd-disclosure name="faq" label="Apart">4</odd-disclosure>
      <odd-disclosure label="A">a</odd-disclosure><odd-disclosure label="B">b</odd-disclosure>`);
    const [one, two, three, apart, a, b] =
      root.querySelectorAll<OddkinDisclosure>('odd-disclosure');
    const states = (el: Element) =>
      ['joined-start', 'joined-end'].filter((s) => el.matches(`:state(${s})`)).join(' ');
    expect([one, two, three, apart, a, b].map((el) => states(el!))).toEqual([
      'joined-end',
      'joined-start joined-end',
      'joined-start',
      '',
      '',
      '',
    ]);
    const base = (el: Element) => getComputedStyle(part(el, 'base'));
    expect(base(one!).borderBlockStartWidth).toBe('1px');
    expect(base(one!).borderBlockEndWidth).toBe('0px');
    expect(base(two!).borderStartStartRadius).toBe('0px');
    expect(base(three!).borderEndEndRadius).toBe(themeValue('border-radius', '--odd-card-radius'));
    const divider = getComputedStyle(part(two!, 'base'), '::before');
    expect(divider.backgroundColor).toBe(themeValue('color', '--odd-color-border-default'));
    expect(divider.blockSize).toBe('1px');
    expect(getComputedStyle(part(one!, 'base'), '::before').content).toBe('none');
    // An open member has no divider of its own under the summary.
    expect(getComputedStyle(part(one!, 'content'), '::before').display).toBe('none');
    // Members follow removals and renames.
    three!.remove();
    await settle(one!);
    expect([one, two].map((el) => states(el!))).toEqual(['joined-end', 'joined-start']);
    two!.name = '';
    await settle(two!);
    expect([one, two].map((el) => states(el!))).toEqual(['', '']);
  });

  it('shows the divider and secondary content only on a lone open disclosure', async () => {
    const root = await mount('<odd-disclosure label="Details" open>Text</odd-disclosure>');
    const el = root.firstElementChild as OddkinDisclosure;
    const content = part(el, 'content');
    expect(getComputedStyle(content).color).toBe(themeValue('color', '--odd-color-text-secondary'));
    expect(getComputedStyle(content, '::before').display).toBe('block');
    expect(getComputedStyle(content, '::before').backgroundColor).toBe(
      themeValue('color', '--odd-color-border-default'),
    );
    expect(getComputedStyle(part(el, 'summary')).color).toBe(
      themeValue('color', '--odd-color-text-primary'),
    );
  });

  it('draws the focus ring around the surface on keyboard focus only', async () => {
    const root = await mount('<odd-disclosure label="Details">Text</odd-disclosure>');
    const el = root.firstElementChild as OddkinDisclosure;
    expect(getComputedStyle(part(el, 'base')).outlineStyle).toBe('none');
    await tabPath(root, 1);
    expect(getComputedStyle(part(el, 'base')).outlineStyle).toBe('solid');
    expect(getComputedStyle(part(el, 'base')).outlineColor).toBe(
      themeValue('color', '--odd-color-focus-ring'),
    );
    expect(getComputedStyle(part(el, 'summary')).outlineStyle).toBe('none');
  });

  it('mirrors the closed chevron right to left and has no transitions', async () => {
    const root = await mount('<odd-disclosure label="Details" dir="rtl">Text</odd-disclosure>');
    const el = root.firstElementChild as OddkinDisclosure;
    const glyph = part(el, 'marker').querySelector('svg')!;
    expect(getComputedStyle(glyph).scale).toBe('-1 1');
    for (const name of ['base', 'summary', 'content'])
      expect(getComputedStyle(part(el, name)).transitionDuration).toBe('0s');
    const box = (name: string) => part(el, name).getBoundingClientRect();
    expect(box('marker').right).toBeLessThan(box('label').left);
  });

  it.runIf(server.browser === 'chromium')(
    'keeps its border and disabled text visible in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const root = await mount('<odd-disclosure label="Details" disabled>Text</odd-disclosure>');
        const el = root.firstElementChild as OddkinDisclosure;
        expect(matchMedia('(forced-colors: active)').matches).toBe(true);
        const system = (color: string) => {
          const probe = document.createElement('span');
          probe.style.color = color;
          root.append(probe);
          return getComputedStyle(probe).color;
        };
        expect(getComputedStyle(part(el, 'base')).borderBlockStartColor).toBe(system('CanvasText'));
        expect(getComputedStyle(part(el, 'summary')).color).toBe(system('GrayText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything it owns when removed', async () => {
    const before = scopeStats();
    const root = await mount(`
      <odd-disclosure name="faq" label="One" open>1</odd-disclosure>
      <odd-disclosure name="faq" label="Two">2</odd-disclosure>`);
    root.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
