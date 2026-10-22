import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generate, resolveToken, type ResolveContext, type ResolvedTheme } from '../src/index.js';
import { cases } from './fixtures/cases.js';

// M8 (plan 909): theme, product, density, mode, and profile scopes across shadow roots
// (theming-and-styling.md §5.3). Expected values come from the generator's own resolver.

const result = generate(cases['products-density']);
const theme = result.theme as ResolvedTheme;
const css = result.css ?? '';

const shadow = (host: Element, html: string, adoptTokens = false) => {
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = html;
  if (adoptTokens) {
    // A sheet from this document's constructor (theming-and-styling.md §8).
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [sheet];
  }
  return root;
};

describe('token scopes across shadow roots', () => {
  const sheet = new CSSStyleSheet();
  let root: HTMLElement;
  const probes = new Map<string, HTMLElement>();
  const collect = (scope: ParentNode) => {
    for (const el of scope.querySelectorAll<HTMLElement>('i[id]')) probes.set(el.id, el);
  };

  beforeAll(() => {
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    root = document.createElement('div');
    root.innerHTML = `
      <div data-odd-mode="dark">
        <div id="host-scope" data-odd-product="clinic"></div>
        <div data-odd-product="studio" data-odd-density="compact" data-odd-profile="layout.compact navigation.compact">
          <div id="outer-host"></div>
          <div id="profile-host"></div>
        </div>
        <div data-odd-product="clinic"><div id="unadopted-host"></div><div id="adopted-host"></div></div>
        <div id="slot-host"><i id="slotted"></i><i id="slotted-plain" slot="plain"></i></div>
        <div data-odd-product="clinic"><div data-odd-theme="acme"><div id="theme-host"></div></div></div>
        <div data-odd-product="studio" data-odd-density="spacious" data-odd-profile="layout.compact" data-odd-mode="light"><i id="same-element"></i></div>
        <div data-odd-density="compact"><div data-odd-profile="navigation.compact" data-odd-density="spacious"><i id="same-element-nested"></i></div></div>
      </div>`;
    document.body.append(root);
    const q = (id: string) => root.querySelector(`#${id}`) as HTMLElement;

    // A scope attribute on the shadow host itself is in the document tree.
    collect(shadow(q('host-scope'), '<i id="on-host"></i>'));
    // Two nested shadow roots inherit every axis from light-DOM ancestors.
    const outer = shadow(q('outer-host'), '<i id="level-1"></i><div id="inner-host"></div>');
    collect(outer);
    collect(shadow(outer.querySelector('#inner-host') as Element, '<i id="level-2"></i>'));
    // A nested scope inside a shadow root under a profiled light-DOM ancestor re-declares base
    // expressions, and the profile's re-application selector cannot cross the boundary: the
    // profile is lost there unless the inner scope repeats it (documented limit, §5.3).
    collect(
      shadow(
        q('profile-host'),
        `<div data-odd-density="spacious"><i id="profile-lost"></i></div>
         <div data-odd-density="spacious" data-odd-profile="layout.compact navigation.compact"><i id="profile-repeated"></i></div>`,
        true,
      ),
    );
    // A scope attribute inside a shadow tree: document sheets cannot match it…
    collect(
      shadow(q('unadopted-host'), '<div data-odd-density="compact"><i id="unadopted"></i></div>'),
    );
    // …but it applies when the generated CSS is adopted in that shadow root too.
    collect(
      shadow(
        q('adopted-host'),
        '<div data-odd-density="compact"><i id="adopted"></i><div data-odd-mode="light"><i id="adopted-light"></i></div></div>',
        true,
      ),
    );
    // Slotted content inherits through its slot (the flat tree), so a scope around a slot wins
    // over the slotted element's light-DOM ancestors.
    shadow(
      q('slot-host'),
      '<div data-odd-mode="light" data-odd-product="studio"><slot></slot></div><slot name="plain"></slot>',
      true,
    );
    collect(q('slot-host'));
    // A nested theme scope re-declares every token, so an outer product no longer applies;
    // the mode toggles still come from outside.
    collect(shadow(q('theme-host'), '<i id="in-theme"></i>'));
    // Several axes on one element (plan 244): emission order decides overlapping roles.
    collect(root);
  });

  afterAll(() => {
    root.remove();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  });

  const read = (id: string) => {
    const el = probes.get(id) as HTMLElement;
    el.style.cssText =
      'display: block; color: var(--odd-color-action-default); background-color: var(--odd-color-surface-default); outline-color: var(--odd-color-link); padding-left: var(--odd-space-md); margin-left: var(--odd-layout-gap); min-height: var(--odd-navigation-item-min-height); padding-top: var(--odd-navigation-item-padding-inline)';
    return getComputedStyle(el);
  };
  const rgb = (hex: string | undefined) => {
    const h = (hex ?? '').slice(1);
    return `rgb(${[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
  };
  const rootPx = () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  // calc() profile values resolve through the generator to a dimension; WebKit snaps to 1/64 px.
  const length = (value: string | undefined) => {
    const calc = /^calc\((.+) \/ 2\)$/.exec(value ?? '');
    const rem = Number.parseFloat(calc ? (calc[1] as string) : (value ?? '')) / (calc ? 2 : 1);
    return rem * rootPx();
  };

  const cases_: Array<[id: string, context: ResolveContext]> = [
    ['on-host', { mode: 'dark', product: 'clinic' }],
    [
      'level-1',
      {
        mode: 'dark',
        product: 'studio',
        density: 'compact',
        profiles: ['layout.compact', 'navigation.compact'],
      },
    ],
    [
      'level-2',
      {
        mode: 'dark',
        product: 'studio',
        density: 'compact',
        profiles: ['layout.compact', 'navigation.compact'],
      },
    ],
    ['unadopted', { mode: 'dark', product: 'clinic' }],
    ['profile-lost', { mode: 'dark', product: 'studio', density: 'spacious' }],
    [
      'profile-repeated',
      {
        mode: 'dark',
        product: 'studio',
        density: 'spacious',
        profiles: ['layout.compact', 'navigation.compact'],
      },
    ],
    ['adopted', { mode: 'dark', product: 'clinic', density: 'compact' }],
    ['adopted-light', { mode: 'light', product: 'clinic', density: 'compact' }],
    ['slotted', { mode: 'light', product: 'studio' }],
    ['slotted-plain', { mode: 'dark' }],
    ['in-theme', { mode: 'dark' }],
    [
      'same-element',
      { mode: 'light', product: 'studio', density: 'spacious', profiles: ['layout.compact'] },
    ],
    [
      'same-element-nested',
      { mode: 'dark', density: 'spacious', profiles: ['navigation.compact'] },
    ],
  ];

  for (const [id, context] of cases_) {
    it(`${id} resolves like the generator (${JSON.stringify(context)})`, () => {
      const style = read(id);
      const value = (name: string) => resolveToken(theme, name, context);
      expect(style.color).toBe(rgb(value('color.action.default')));
      expect(style.backgroundColor).toBe(rgb(value('color.surface.default')));
      expect(style.outlineColor).toBe(rgb(value('color.link')));
      expect(Number.parseFloat(style.paddingLeft)).toBeCloseTo(length(value('space.md')), 1);
      expect(Number.parseFloat(style.marginLeft)).toBeCloseTo(length(value('layout.gap')), 1);
      expect(Number.parseFloat(style.minHeight)).toBeCloseTo(
        length(value('navigation.item.min-height')),
        1,
      );
      expect(Number.parseFloat(style.paddingTop)).toBeCloseTo(
        length(value('navigation.item.padding.inline')),
        1,
      );
    });
  }

  it('the probes distinguish the scopes they claim to test', () => {
    const key = (id: string) => {
      const s = read(id);
      return [s.color, s.backgroundColor, s.paddingLeft, s.marginLeft, s.paddingTop].join();
    };
    // Each pair differs only in the axis under test, so a passing case is never vacuous.
    expect(key('unadopted')).not.toBe(key('adopted'));
    expect(key('adopted')).not.toBe(key('adopted-light'));
    expect(key('slotted')).not.toBe(key('slotted-plain'));
    expect(key('on-host')).not.toBe(key('slotted-plain'));
    expect(key('level-1')).not.toBe(key('on-host'));
    expect(key('profile-lost')).not.toBe(key('profile-repeated'));
    expect(key('in-theme')).not.toBe(key('on-host'));
    expect(read('in-theme').colorScheme).toBe('dark');
    expect(read('slotted').colorScheme).toBe('light');
  });
});
