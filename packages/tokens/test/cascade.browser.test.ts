import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generate, resolveToken, type ResolvedTheme } from '../src/index.js';

// Contract: css-architecture.md §4–§5, ADR 0039 (layer order) and ADR 0038 (gated syntax).
const config = { name: 'acme', brand: { primary: '#5b46e8' } };
const { css: layered = '', theme } = generate(config);
const unlayered = generate(config, { css: { layer: false } }).css ?? '';
const resolved = theme as ResolvedTheme;

const sheet = (text: string) => {
  const s = new CSSStyleSheet();
  s.replaceSync(text);
  return s;
};
const hexToRgb = (hex: string | undefined) => {
  const h = (hex ?? '').slice(1);
  return `rgb(${[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
};

let saved: CSSStyleSheet[];
let fixture: HTMLElement;

beforeEach(() => {
  saved = [...document.adoptedStyleSheets];
  fixture = document.createElement('div');
  fixture.innerHTML = `
    <div data-odd-mode="light" id="light"><span class="probe"></span>
      <div data-odd-mode="dark" id="dark"><span class="probe"></span></div>
    </div>`;
  document.body.append(fixture);
});
afterEach(() => {
  document.adoptedStyleSheets = saved;
  fixture.remove();
});

const use = (...sheets: CSSStyleSheet[]) => (document.adoptedStyleSheets = [...saved, ...sheets]);
const probe = (id: string, property = '--odd-color-text-primary') => {
  const el = fixture.querySelector(`#${id} > .probe`) as HTMLElement;
  el.style.color = `var(${property})`;
  return getComputedStyle(el).color;
};
const primary = (mode: 'light' | 'dark') =>
  hexToRgb(resolveToken(resolved, 'color.text.primary', { mode }));

describe('application overrides and the odd.tokens layer (F05)', () => {
  const override = (value: string) =>
    sheet(`[data-odd-mode] { --odd-color-text-primary: ${value}; }`);

  it('an unlayered override wins over layered tokens whatever the stylesheet order', () => {
    use(override('rgb(1, 2, 3)'), sheet(layered));
    expect(probe('light')).toBe('rgb(1, 2, 3)');
    use(sheet(layered), override('rgb(1, 2, 3)'));
    expect(probe('light')).toBe('rgb(1, 2, 3)');
  });

  it('unlayered token CSS makes the same override depend on stylesheet order', () => {
    use(override('rgb(1, 2, 3)'), sheet(unlayered));
    expect(probe('light')).toBe(primary('light'));
    use(sheet(unlayered), override('rgb(1, 2, 3)'));
    expect(probe('light')).toBe('rgb(1, 2, 3)');
  });

  it('an application layer wins only when it is ordered after odd', () => {
    const app = sheet('@layer app { [data-odd-mode] { --odd-color-text-primary: rgb(4, 5, 6); } }');
    use(sheet(layered), app);
    expect(probe('light')).toBe('rgb(4, 5, 6)');
    // Declared before the tokens load, `app` comes first and the tokens win…
    use(app, sheet(layered));
    expect(probe('light')).toBe(primary('light'));
    // …unless the application states the order up front.
    use(sheet('@layer odd, app;'), app, sheet(layered));
    expect(probe('light')).toBe('rgb(4, 5, 6)');
  });

  it('a root override does not cross a nested scope that re-declares the role', () => {
    use(sheet(layered), sheet(':root { --odd-color-text-primary: rgb(7, 8, 9); }'));
    // The probes' scopes re-declare mode-dependent roles, so a :root override reaches neither;
    // theme-wide changes belong in the configuration's overrides (generated into every scope).
    expect(probe('light')).toBe(primary('light'));
    expect(probe('dark')).toBe(primary('dark'));
    const outside = document.createElement('span');
    fixture.append(outside);
    outside.style.color = 'var(--odd-color-text-primary)';
    expect(getComputedStyle(outside).color).toBe('rgb(7, 8, 9)');
  });
});

describe('unsupported syntax inside custom properties (F02)', () => {
  // `oddkin-future-color()` is not CSS: every engine's parser rejects it, exactly as a floor
  // browser rejects syntax it does not implement. Nothing here mocks CSS.supports.
  const FUTURE = 'oddkin-future-color(red)';

  it('a defined property holding unparseable syntax invalidates its reader; var() fallbacks do not help', () => {
    use(
      sheet(`
        #light { color: rgb(1, 2, 3); }
        #light > .probe {
          --future: ${FUTURE};
          background-color: rgb(0, 128, 0);
          background-color: var(--future, rgb(0, 128, 0));
          color: var(--future, rgb(0, 128, 0));
        }`),
    );
    const el = fixture.querySelector('#light > .probe') as HTMLElement;
    const style = getComputedStyle(el);
    // Invalid at computed-value time: background-color becomes its initial value and color
    // inherits; neither the earlier declaration nor the var() fallback is used.
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style.color).toBe('rgb(1, 2, 3)');
  });

  it('a baseline value with an @supports-gated enhancement keeps the baseline', () => {
    expect(CSS.supports('background-color', FUTURE)).toBe(false);
    use(
      sheet(`
        #light > .probe { --future: rgb(0, 128, 0); }
        @supports (background-color: ${FUTURE}) { #light > .probe { --future: ${FUTURE}; } }
        #light > .probe { background-color: var(--future); }`),
    );
    const el = fixture.querySelector('#light > .probe') as HTMLElement;
    expect(getComputedStyle(el).backgroundColor).toBe('rgb(0, 128, 0)');
  });

  it('the generator warns before such a value reaches a token', () => {
    const result = generate({
      ...config,
      overrides: { 'control.gap': 'max({space.xs}, sibling-index() * 1px)' },
    });
    expect(result.diagnostics.map((d) => d.code)).toContain('value.syntax.aboveFloor');
  });
});

describe('an in-page reduced-motion scope (theming-and-styling.md §10.3)', () => {
  it('sets every duration to 0ms in its subtree, nested theme scopes included, and nowhere else', () => {
    use(sheet(layered));
    fixture.innerHTML = `
      <div id="full"><span class="probe"></span></div>
      <div data-odd-motion="reduce" id="reduced"><span class="probe"></span>
        <div data-odd-theme="acme" id="nested"><span class="probe"></span></div>
      </div>`;
    const duration = (id: string) => {
      const el = fixture.querySelector(`#${id} > .probe`) as HTMLElement;
      el.style.transitionDuration = 'var(--odd-motion-duration-normal)';
      return getComputedStyle(el).transitionDuration;
    };
    expect(duration('full')).not.toBe('0s');
    expect([duration('reduced'), duration('nested')]).toEqual(['0s', '0s']);
  });
});
