import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { define, OddkinElement } from '../src/element/index.js';
import { defineLayoutRecipe, stack } from '../src/layout/index.js';
import { checkRecipeRegions } from '../src/layout/inspect.js';
import { flush } from '../src/reactive/index.js';
import { css } from '../src/styles/index.js';
import { html } from '../src/template/index.js';
import { recipes, sideNav } from './fixtures/recipes.js';

let reported: ErrorContext[];
let container: HTMLElement;
let id = 0;
const tag = (base: string) => `${base}-${++id}`;

beforeEach(() => {
  reported = [];
  setErrorHandler((_error, context) => reported.push(context));
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  container.remove();
  flush();
  setErrorHandler(undefined);
});

class DemoSideNav extends OddkinElement {
  static override styles = [sideNav.styles];
  protected override render() {
    return html`<nav class="root" aria-label="Sections">
      <header class="header"><slot name="header"></slot></header>
      <ul class="content" part="content">
        <slot></slot>
      </ul>
      <footer class="footer"><slot name="footer"></slot></footer>
    </nav>`;
  }
}
const sideNavTag = tag('demo-side-nav');
define(sideNavTag, DemoSideNav);

const compactSideNav = sideNav.extend({ name: 'compact', regions: { footer: stack() } });
class DemoCompactSideNav extends DemoSideNav {
  static override styles = [
    compactSideNav.styles,
    css`
      .content {
        gap: 3px;
      }
    `,
  ];
}
const compactTag = tag('demo-compact-side-nav');
define(compactTag, DemoCompactSideNav);

function mount(name: string, width: string): HTMLElement {
  const el = document.createElement(name);
  el.style.inlineSize = width;
  el.innerHTML =
    '<li>One</li><li>Two</li><li>Three</li><span slot="footer">A</span><span slot="footer">B</span>';
  container.append(el);
  return el;
}

const inner = (el: HTMLElement, selector: string) =>
  el.shadowRoot?.querySelector(selector) as HTMLElement;
const columns = (el: HTMLElement) =>
  getComputedStyle(inner(el, '.content')).gridTemplateColumns.split(' ').length;

describe('layout recipes in a real cascade', () => {
  it('generates byte-identical CSS in the browser and Node', async () => {
    for (const [name, recipe] of Object.entries(recipes)) {
      const expected = await (
        await fetch(new URL(`./fixtures/${name}.recipe.css.txt`, import.meta.url))
      ).text();
      expect(recipe.cssText, name).toBe(expected);
    }
  });

  it('responds to each instance’s own container width without script', () => {
    const narrow = mount(sideNavTag, '20rem');
    const wide = mount(sideNavTag, '50rem');
    expect(columns(narrow)).toBe(1);
    expect(columns(wide)).toBe(3);
    expect(
      getComputedStyle(inner(wide, '.root')).getPropertyValue('--demo-item-padding').trim(),
    ).toBe('1rem');
    expect(
      getComputedStyle(inner(narrow, '.root')).getPropertyValue('--demo-item-padding').trim(),
    ).toBe('');
    // Roles declared on the region inherit into slotted light-DOM content.
    expect(
      getComputedStyle(wide.querySelector('li') as HTMLElement)
        .getPropertyValue('--demo-item-padding')
        .trim(),
    ).toBe('1rem');
    wide.style.inlineSize = '20rem';
    expect(columns(wide)).toBe(1);
  });

  it('applies variants from host attributes', () => {
    const el = mount(sideNavTag, '20rem');
    expect(getComputedStyle(inner(el, '.footer')).justifyContent).toBe('space-between');
    el.setAttribute('align', 'end');
    expect(getComputedStyle(inner(el, '.footer')).justifyContent).toBe('end');
  });

  it('lets unlayered component CSS override recipe layers, and extend never changes the shared sheet', () => {
    const base = mount(sideNavTag, '50rem');
    const compact = mount(compactTag, '50rem');
    expect(getComputedStyle(inner(compact, '.content')).rowGap).toBe('3px');
    expect(getComputedStyle(inner(compact, '.footer')).flexDirection).toBe('column');
    expect(getComputedStyle(inner(base, '.footer')).flexDirection).toBe('row');
    expect(getComputedStyle(inner(base, '.content')).rowGap).toBe('16px');
    expect(sideNav.styles.sheetFor(document)?.cssRules.length).toBeGreaterThan(0);
    expect(base.shadowRoot?.adoptedStyleSheets[0]).toBe(sideNav.styles.sheetFor(document));
  });

  it('checks declared regions and parts against the rendered root', () => {
    const el = mount(sideNavTag, '20rem');
    expect(checkRecipeRegions(sideNav, el.shadowRoot as ShadowRoot)).toEqual({
      missingRegions: [],
      missingParts: [],
    });
    inner(el, '.content').removeAttribute('part');
    inner(el, '.footer').remove();
    expect(checkRecipeRegions(sideNav, el.shadowRoot as ShadowRoot)).toEqual({
      missingRegions: ['footer'],
      missingParts: ['content'],
    });
  });

  it('wraps a split layout intrinsically in light DOM', () => {
    const sheet = recipes.page.styles.sheetFor(document) as CSSStyleSheet;
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    const root = document.createElement('div');
    root.className = 'page__root';
    root.innerHTML =
      '<aside class="page__aside">Side</aside><main class="page__main"><p>a</p><p>b</p><p>c</p></main>';
    root.style.inlineSize = '60rem';
    container.append(root);
    const aside = root.querySelector('aside') as HTMLElement;
    const main = root.querySelector('main') as HTMLElement;
    expect(aside.getBoundingClientRect().top).toBe(main.getBoundingClientRect().top);
    root.style.inlineSize = '24rem';
    expect(main.getBoundingClientRect().top).toBeGreaterThan(aside.getBoundingClientRect().top);
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  });

  it('reports recipes defined during render', () => {
    class Wrong extends OddkinElement {
      protected override render() {
        defineLayoutRecipe({ name: 'inline', regions: { root: stack() } });
        return html`<div class="root"></div>`;
      }
    }
    const name = tag('demo-wrong');
    define(name, Wrong);
    container.append(document.createElement(name));
    expect(reported.map((r) => r.code)).toEqual(['recipe.render.definition']);
  });
});
