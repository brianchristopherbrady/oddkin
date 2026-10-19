import { afterEach, describe, expect, it } from 'vitest';

// The container, wrapper, and region contract recipes rely on (layout-recipes.md §5), checked
// on plain shadow roots so no Oddkin code is involved: what a container query can style, what
// size containment does to sizing, how slotted content finds its container, how nearest and
// named containers are chosen, what ::slotted and ::part can reach, and how inherited roles
// cross shadow boundaries.

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const undo of cleanup.splice(0)) undo();
});
function page(css: string) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  cleanup.push(() => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  });
}
function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  cleanup.push(() => root.remove());
  return root;
}
/** A host with an open shadow root holding `inner` and adopting `css`. */
function shadow(host: Element, inner: string, css = ''): ShadowRoot {
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = inner;
  if (css) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [sheet];
  }
  return root;
}
const style = (el: Element) => getComputedStyle(el);
const GREEN = 'rgb(0, 128, 0)';

describe('container queries style descendants, never the container itself', () => {
  it('a region that is its own query container does not match its own query', () => {
    const root = mount('<div class="c" style="inline-size: 30rem"><p class="d">x</p></div>');
    page(`
      .c { container-type: inline-size; }
      @container (min-inline-size: 1rem) { .c, .d { color: ${GREEN}; } }`);
    expect(style(root.querySelector('.d')!).color).toBe(GREEN);
    expect(style(root.querySelector('.c')!).color).not.toBe(GREEN);
  });
});

describe('size containment changes sizing', () => {
  it('inline-size containment makes a shrink-to-fit box ignore its content', () => {
    const root = mount(`
      <span id="free" style="display: inline-block">A label of some length</span>
      <span id="contained" style="display: inline-block; container-type: inline-size">A label of some length</span>
      <div style="position: relative"><span id="absolute" style="position: absolute; container-type: inline-size">A label</span></div>`);
    const width = (id: string) => root.querySelector(`#${id}`)!.getBoundingClientRect().width;
    expect(width('free')).toBeGreaterThan(50);
    expect(width('contained')).toBe(0);
    expect(width('absolute')).toBe(0);
  });
});

describe('slotted content and the flat tree', () => {
  function slotted(regionWidth: string) {
    const root = mount('<div class="host"><p class="child">slotted</p></div>');
    const host = root.querySelector('.host')!;
    shadow(
      host,
      `<div class="region" style="inline-size: ${regionWidth}"><slot></slot></div>`,
      `.region { container: region / inline-size; }
       @container (min-inline-size: 20rem) { ::slotted(.child) { outline-style: solid; } }`,
    );
    return { host, child: root.querySelector<HTMLElement>('.child')! };
  }

  it('a container inside the shadow tree is the nearest container of slotted light-DOM content', () => {
    page(`@container (min-inline-size: 20rem) { .child { text-decoration-line: underline; } }`);
    const wide = slotted('30rem');
    const narrow = slotted('10rem');
    // The page's own unnamed query and the shadow tree's ::slotted query both see the region.
    expect(style(wide.child).textDecorationLine).toBe('underline');
    expect(style(narrow.child).textDecorationLine).toBe('none');
    expect(style(wide.child).outlineStyle).toBe('solid');
    expect(style(narrow.child).outlineStyle).toBe('none');
  });

  it('container names are not encapsulated: a page query by name finds a container named inside a shadow tree', () => {
    page(
      `@container region (min-inline-size: 20rem) { .child { text-decoration-line: underline; } }`,
    );
    // So a component's internal container names are effectively public: namespace them.
    expect(style(slotted('30rem').child).textDecorationLine).toBe('underline');
    expect(style(slotted('10rem').child).textDecorationLine).toBe('none');
  });
});

describe('nearest and named containers', () => {
  it('an unnamed query uses the nearest container; a named query skips to the named one', () => {
    const root = mount(`
      <div style="container: outer / inline-size; inline-size: 40rem">
        <div style="container-type: inline-size; inline-size: 10rem">
          <p id="unnamed">x</p><p id="named">x</p>
        </div>
      </div>`);
    page(`
      @container (min-inline-size: 20rem) { #unnamed { outline-style: solid; } }
      @container outer (min-inline-size: 20rem) { #named { outline-style: solid; } }`);
    expect(style(root.querySelector('#unnamed')!).outlineStyle).toBe('none');
    expect(style(root.querySelector('#named')!).outlineStyle).toBe('solid');
  });
});

describe('::slotted() reaches only top-level slotted elements', () => {
  it('styles slotted children, not their descendants, and drops compound descendant selectors', () => {
    const root = mount('<div class="host"><p id="top"><span id="deep">x</span></p></div>');
    shadow(
      root.querySelector('.host')!,
      '<slot></slot>',
      `::slotted(p) { outline-style: solid; }
       ::slotted(span) { outline-style: dashed; }
       ::slotted(p) span { outline-style: dotted; }`,
    );
    expect(style(root.querySelector('#top')!).outlineStyle).toBe('solid');
    expect(style(root.querySelector('#deep')!).outlineStyle).toBe('none');
  });
});

describe('::part() is an explicit, shallow styling interface', () => {
  function nested(exportParts: boolean) {
    const root = mount('<div class="outer"></div>');
    const outer = root.querySelector('.outer')!;
    const outerRoot = shadow(
      outer,
      `<div part="frame" class="frame"><span class="private">p</span></div>
       <div class="inner"${exportParts ? ' exportparts="label"' : ''}></div>`,
    );
    const innerRoot = shadow(outerRoot.querySelector('.inner')!, '<span part="label">l</span>');
    return {
      frame: outerRoot.querySelector('.frame')!,
      private: outerRoot.querySelector('.private')!,
      label: innerRoot.querySelector('[part="label"]')!,
    };
  }

  it('reaches declared parts only: not their descendants, attributes, or nested parts unless exported', () => {
    page(`
      .outer::part(frame) { outline-style: solid; }
      .outer::part(frame) .private { outline-style: dotted; }
      .outer::part(frame)[class] { text-decoration-line: underline; }
      .outer::part(label) { outline-style: dashed; }
      .frame, .private { text-decoration-line: overline; }`);
    const closed = nested(false);
    expect(style(closed.frame).outlineStyle).toBe('solid');
    expect(style(closed.private).outlineStyle).toBe('none');
    expect(style(closed.frame).textDecorationLine).toBe('none');
    // Page selectors never match private shadow markup, whatever its class names.
    expect(style(closed.private).textDecorationLine).toBe('none');
    expect(style(closed.label).outlineStyle).toBe('none');
    // exportparts forwards a nested part, and only that part.
    expect(style(nested(true).label).outlineStyle).toBe('dashed');
  });
});

describe('inherited role variables cross shadow boundaries', () => {
  it('reach shadow internals, slotted content, and nested shadow roots; nearer declarations win', () => {
    const root = mount(
      '<div style="--role-gap: 7px"><div class="host"><p id="slotted">s</p></div></div>',
    );
    const outerRoot = shadow(
      root.querySelector('.host')!,
      '<div id="internal"></div><div class="region"><slot></slot><div class="nested"></div></div>',
      '.region { --role-gap: 9px; }',
    );
    const nestedRoot = shadow(outerRoot.querySelector('.nested')!, '<i id="deep"></i>');
    const read = (el: Element) => style(el).getPropertyValue('--role-gap').trim();
    expect(read(outerRoot.querySelector('#internal')!)).toBe('7px');
    // A region declaration reaches what is slotted into it and nested components inside it.
    expect(read(root.querySelector('#slotted')!)).toBe('9px');
    expect(read(nestedRoot.querySelector('#deep')!)).toBe('9px');
  });
});
