import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adoptStyles } from '@oddkin/core/styles';
import { documentStylesheets } from '../src/css/index.js';
import { defineLayoutRecipe, grid, stack } from '../src/layout/index.js';

// layout.css and Oddkin-bound recipes in real engines. Token CSS is not loaded here, so the
// layout roles are set on the container.
let container: HTMLElement;
const page = new CSSStyleSheet();
page.replaceSync(`@layer odd.layout { ${documentStylesheets.layout.styles.cssText} }`);

beforeEach(() => {
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, page];
  container = document.createElement('div');
  container.style.cssText =
    '--odd-layout-gap: 10px; --odd-layout-sidebar-width: 100px; --odd-layout-main-min: 200px; --odd-layout-item-min: 100px; width: 500px';
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== page);
});

const top = (el: Element) => el.getBoundingClientRect().top;

describe('layout.css', () => {
  it('splits side by side when there is room and wraps below the main minimum, without script', () => {
    container.innerHTML =
      '<div class="odd-split"><nav id="side">Side</nav><main id="main">Main</main></div>';
    const side = container.querySelector('#side') as HTMLElement;
    const main = container.querySelector('#main') as HTMLElement;
    expect(top(main)).toBe(top(side));
    expect(side.getBoundingClientRect().width).toBeGreaterThanOrEqual(100);
    container.style.width = '250px';
    expect(top(main)).toBeGreaterThan(top(side));
    // The class's own property overrides the role.
    container.style.width = '500px';
    (container.firstElementChild as HTMLElement).style.setProperty(
      '--odd-split-side-width',
      '320px',
    );
    expect(top(main)).toBeGreaterThan(top(side));
  });

  it('fits as many auto-grid columns as the item minimum allows', () => {
    container.innerHTML = `<div class="odd-auto-grid">${'<p>x</p>'.repeat(6)}</div>`;
    const columns = () =>
      getComputedStyle(container.firstElementChild as Element).gridTemplateColumns.split(' ')
        .length;
    expect(columns()).toBe(4);
    container.style.width = '220px';
    expect(columns()).toBe(2);
    container.style.width = '80px';
    expect(columns()).toBe(1);
  });

  it('reads gaps from roles and class properties, and loses to unlayered page CSS', () => {
    container.innerHTML =
      '<div class="odd-stack" id="a"></div><div class="odd-stack" id="b" style="--odd-stack-gap: 3px"></div><div class="odd-cluster" id="c"></div>';
    const gap = (id: string) => getComputedStyle(container.querySelector(id) as Element).rowGap;
    expect(gap('#a')).toBe('10px');
    expect(gap('#b')).toBe('3px');
    expect(getComputedStyle(container.querySelector('#c') as Element).flexWrap).toBe('wrap');
    const app = new CSSStyleSheet();
    app.replaceSync('.odd-stack { gap: 7px; }');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, app];
    expect(gap('#a')).toBe('7px');
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== app);
  });
});

describe('Oddkin-bound recipes', () => {
  it('respond to a named container condition with CSS only', () => {
    const recipe = defineLayoutRecipe({
      name: 'shell-demo',
      container: { name: 'shell' },
      regions: { root: stack(), content: grid({ columns: 1 }) },
      when: { 'navigation.expanded': { content: grid({ columns: 3 }) } },
    });
    const host = document.createElement('div');
    container.append(host);
    const root = host.attachShadow({ mode: 'open' });
    adoptStyles(root, [recipe.styles]);
    root.innerHTML =
      '<div class="root"><ul class="content"><li>a</li><li>b</li><li>c</li></ul></div>';
    const columns = () =>
      getComputedStyle(root.querySelector('.content') as Element).gridTemplateColumns.split(' ')
        .length;
    container.style.width = '400px';
    expect(columns()).toBe(1);
    // navigation.expanded: the shell container is at least 48rem (768px at the default size).
    container.style.width = '800px';
    expect(columns()).toBe(3);
  });
});
