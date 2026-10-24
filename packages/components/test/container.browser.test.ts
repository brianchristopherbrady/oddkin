import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinContainer } from '../src/container/container.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-container (component-contracts.md §3.7), with the shipped theme.
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

async function mount(attributes = '', width = 960, content = '<p id="child">Text</p>') {
  container = document.createElement('div');
  container.style.inlineSize = `${width}px`;
  container.innerHTML = `<odd-container ${attributes}>${content}</odd-container>`;
  document.body.append(container);
  const el = container.querySelector<OddkinContainer>('odd-container')!;
  await settle(el);
  return el;
}
const rect = (el: Element) => el.getBoundingClientRect();

describe('odd-container', () => {
  it('is constrained by default: centred, at most layout.measure wide', async () => {
    const el = await mount();
    expect(el.measure).toBe('constrained');
    expect(el.getAttribute('measure')).toBe('constrained');
    const measure = parseFloat(themeValue('max-inline-size', '--odd-layout-measure'));
    expect(measure).toBe(640);
    expect(rect(el).width).toBe(measure);
    expect(rect(el).left - rect(container).left).toBe(rect(container).right - rect(el).right);
  });

  it('fills a narrower parent, and fills any width when fluid', async () => {
    let el = await mount('', 320);
    expect(rect(el).width).toBe(320);
    container.remove();
    el = await mount('measure="fluid"', 960);
    expect(rect(el).width).toBe(960);
    el.measure = 'constrained';
    await settle(el);
    expect(rect(el).width).toBe(640);
  });

  it('is the query container for its children, by width', async () => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(
      '@container odd-container (min-width: 600px) { #child { color: rgb(1, 2, 3); } } @container (min-width: 900px) { #child { outline: 1px solid rgb(4, 5, 6); } }',
    );
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    try {
      // 960px of viewport space, but the container is 640px: the named query matches, 900px does not.
      const el = await mount();
      const child = el.querySelector('#child')!;
      expect(getComputedStyle(child).color).toBe('rgb(1, 2, 3)');
      expect(getComputedStyle(child).outlineStyle).toBe('none');
      el.measure = 'fluid';
      await settle(el);
      expect(getComputedStyle(child).outlineStyle).toBe('solid');
      container.style.inlineSize = '500px';
      expect(getComputedStyle(child).color).not.toBe('rgb(1, 2, 3)');
    } finally {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    }
  });

  it('takes another maximum from --odd-container-measure, and page rules on the element win', async () => {
    const el = await mount('style="--odd-container-measure: 400px"');
    expect(rect(el).width).toBe(400);
    el.style.maxInlineSize = '300px';
    expect(rect(el).width).toBe(300);
  });

  it('adds no role, landmark, or tab stop, and renders its content in the base part', async () => {
    const el = await mount('', 960, '<h3>Notes</h3><a href="#x">Link</a>');
    expect(el.getAttribute('role')).toBeNull();
    expect(page.getByRole('region').elements()).toHaveLength(0);
    const base = el.shadowRoot!.querySelector('[part~="base"]')!;
    expect(
      base
        .querySelector('slot')!
        .assignedElements()
        .map((e) => e.localName),
    ).toEqual(['h3', 'a']);
    expect(rect(el.querySelector('h3')!).width).toBe(640);
  });

  it('reports an unknown measure and stays constrained', async () => {
    const codes: string[] = [];
    const previous = setErrorHandler((_error, context) => codes.push(context.code ?? ''));
    const el = await mount('measure="wide"').finally(() => setErrorHandler(previous));
    expect(codes).toEqual(['element.attribute.invalid']);
    expect(el.measure).toBe('constrained');
    expect(rect(el).width).toBe(640);
  });

  it('releases everything when removed', async () => {
    const before = scopeStats();
    await mount();
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
