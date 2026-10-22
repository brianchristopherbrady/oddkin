import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';

// Contract: css-architecture.md §5 (shadow boundaries), §7 (intrinsic layout), §11 (text).
// Loads the shipped token stylesheet with a <link>, as consumers do, so sizes and colours are
// the real ones.
let tokens: HTMLLinkElement;
let container: HTMLElement;

beforeAll(async () => {
  await import('../src/button/button.define.js');
  await import('../src/card/card.define.js');
  await import('../src/input/input.define.js');
  tokens = document.createElement('link');
  tokens.rel = 'stylesheet';
  tokens.href = new URL('../../tokens/dist/css/default.css', import.meta.url).href;
  const loaded = new Promise((resolve, reject) => {
    tokens.onload = resolve;
    tokens.onerror = reject;
  });
  document.head.append(tokens);
  await loaded;
  // Guard: the tokens really apply (a missing sheet would make later checks pass vacuously).
  expect(getComputedStyle(document.documentElement).getPropertyValue('--odd-space-md').trim()).toBe(
    '1rem',
  );
});
afterAll(() => {
  tokens.remove();
});
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  document.documentElement.style.fontSize = '';
  flush();
});

async function render(markup: string) {
  container.innerHTML = markup;
  const elements = [...container.querySelectorAll('odd-button, odd-card, odd-input')] as Array<
    HTMLElement & { updateComplete: Promise<void> }
  >;
  for (const el of elements) await el.updateComplete;
  flush();
  await new Promise((resolve) => requestAnimationFrame(resolve));
}
const $ = <T extends Element = HTMLElement>(selector: string) =>
  container.querySelector(selector) as T;
const inner = (host: Element, selector: string) =>
  host.shadowRoot!.querySelector(selector) as HTMLElement;

describe('narrow containers and long content (F07)', () => {
  it('keeps long unbroken labels, URLs, and words inside a narrow container', async () => {
    container.style.inlineSize = '8rem';
    await render(`
      <odd-button id="b">Supercalifragilisticexpialidocious</odd-button>
      <odd-card id="c"><p id="url">https://example.com/a/very/long/path/that/never/breaks</p></odd-card>
      <odd-input id="i" label="Elektrizitätswirtschaftsunternehmensverband"></odd-input>`);
    const right = container.getBoundingClientRect().right;
    for (const id of ['#b', '#c', '#i'])
      expect($(id).getBoundingClientRect().right, id).toBeLessThanOrEqual(right + 0.5);
    const control = inner($('#b'), 'button');
    expect(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth + 1);
    // The label wraps onto several lines instead of widening the button.
    const labelBox = inner($('#b'), '.label');
    expect(labelBox.getBoundingClientRect().height).toBeGreaterThan(
      1.5 * parseFloat(getComputedStyle(labelBox).lineHeight),
    );
    const url = $('#url');
    expect(url.scrollWidth).toBeLessThanOrEqual(url.clientWidth + 1);
    const label = inner($('#i'), '.label');
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1);
  });

  it('mirrors slots and spacing with direction', async () => {
    await render(`
      <odd-button id="ltr"><span slot="start" id="ltr-start">★</span>Label</odd-button>
      <div dir="rtl"><odd-button id="rtl"><span slot="start" id="rtl-start">★</span>Label</odd-button></div>`);
    const ltrLabel = inner($('#ltr'), '.label').getBoundingClientRect();
    const rtlLabel = inner($('#rtl'), '.label').getBoundingClientRect();
    expect($('#ltr-start').getBoundingClientRect().left).toBeLessThan(ltrLabel.left);
    expect($('#rtl-start').getBoundingClientRect().left).toBeGreaterThan(rtlLabel.left);
  });

  it('marks interactive and disabled controls with cursors', async () => {
    await render(`
      <odd-button id="on">Go</odd-button>
      <odd-button id="off" disabled>Go</odd-button>`);
    expect(getComputedStyle(inner($('#on'), 'button')).cursor).toBe('pointer');
    expect(getComputedStyle(inner($('#off'), 'button')).cursor).toBe('not-allowed');
  });
});

describe('customization across the shadow boundary (F05)', () => {
  let page: CSSStyleSheet;
  beforeEach(() => {
    page = new CSSStyleSheet();
    page.replaceSync(`
      odd-button#part::part(control) { background-color: rgb(1, 2, 3); }
      odd-button#variable { --odd-button-background: rgb(4, 5, 6); }
      odd-button#host { display: block; }
      button { background-color: rgb(255, 0, 0) !important; }`);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, page];
  });
  afterEach(() => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== page);
  });

  it('parts, component variables, and host styles override; page selectors never reach internals', async () => {
    await render(`
      <odd-button id="part" appearance="primary">Part</odd-button>
      <odd-button id="variable" appearance="primary">Variable</odd-button>
      <odd-button id="host">Host</odd-button>
      <odd-button id="plain" appearance="primary">Plain</odd-button>`);
    const background = (id: string) => getComputedStyle(inner($(id), 'button')).backgroundColor;
    // An outer ::part() rule wins over the more specific inner :host([appearance]) rule.
    expect(background('#part')).toBe('rgb(1, 2, 3)');
    expect(background('#variable')).toBe('rgb(4, 5, 6)');
    expect(getComputedStyle($('#host')).display).toBe('block');
    // The page's !important `button` rule matches no element inside the shadow root.
    const reference = document.createElement('span');
    reference.style.backgroundColor = 'var(--odd-color-action-default)';
    container.append(reference);
    expect(getComputedStyle(reference).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(background('#plain')).toBe(getComputedStyle(reference).backgroundColor);
    expect(background('#plain')).not.toBe('rgb(255, 0, 0)');
  });
});

describe('text enlargement (F14)', () => {
  it('controls grow with the root font size and never clip their text', async () => {
    await render(`
      <odd-button id="b">Save changes</odd-button>
      <odd-input id="i" label="Name" description="As it appears on your card"></odd-input>`);
    const before = parseFloat(getComputedStyle(inner($('#b'), 'button')).minHeight);
    document.documentElement.style.fontSize = '200%';
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const button = inner($('#b'), 'button');
    expect(parseFloat(getComputedStyle(button).minHeight)).toBeCloseTo(before * 2, 0);
    expect(button.scrollHeight).toBeLessThanOrEqual(button.clientHeight + 1);
    const control = inner($('#i'), 'input');
    expect(parseFloat(getComputedStyle(control).minHeight)).toBeCloseTo(before * 2, 0);
  });
});

describe('shared primitives', () => {
  it('hide hosts and internals with the hidden attribute, even against display rules', async () => {
    await render(`
      <style>#b { display: block; }</style>
      <odd-button id="b" hidden>Hidden</odd-button>
      <odd-button id="l" loading>Loading</odd-button>
      <odd-button id="v">Visible</odd-button>`);
    expect(getComputedStyle($('#b')).display).toBe('none');
    // `.spinner` sets display; `hidden` still wins inside the shadow root.
    expect(getComputedStyle(inner($('#v'), '.spinner')).display).toBe('none');
    expect(getComputedStyle(inner($('#l'), '.spinner')).display).not.toBe('none');
  });

  it('draw one focus ring from the focus tokens on every component', async () => {
    await render(`
      <odd-button id="b">Save</odd-button>
      <odd-input id="i" label="Name"></odd-input>`);
    const root = getComputedStyle(document.documentElement);
    const width = root.getPropertyValue('--odd-focus-width').trim();
    for (const [id, selector] of [
      ['#b', 'button'],
      ['#i', 'input'],
    ] as const) {
      const control = inner($(id), selector);
      control.focus({ focusVisible: true } as FocusOptions);
      if (!control.matches(':focus-visible')) continue;
      const style = getComputedStyle(control);
      expect(style.outlineStyle, id).toBe('solid');
      expect(style.outlineWidth, id).toBe(width);
      control.blur();
    }
  });

  it('share one constructed sheet per primitive across components', async () => {
    await render(`<odd-button id="b">A</odd-button><odd-input id="i" label="B"></odd-input>`);
    const sheets = (id: string) => $(id).shadowRoot!.adoptedStyleSheets;
    if (!sheets('#b').length) return;
    const shared = sheets('#b').filter((sheet) => sheets('#i').includes(sheet));
    // Host defaults and the focus ring.
    expect(shared).toHaveLength(2);
  });
});

describe('native <button> styling path (button.css)', () => {
  let sheet: HTMLLinkElement;
  beforeAll(async () => {
    sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = new URL('../dist/css/button.css', import.meta.url).href;
    const loaded = new Promise((resolve, reject) => {
      sheet.onload = resolve;
      sheet.onerror = reject;
    });
    document.head.append(sheet);
    await loaded;
  });
  afterAll(() => sheet.remove());

  const properties = [
    'display',
    'box-sizing',
    'align-items',
    'justify-content',
    'min-height',
    'padding-top',
    'padding-left',
    'padding-right',
    'column-gap',
    'margin-top',
    'border-top-width',
    'border-top-style',
    'border-top-color',
    'border-top-left-radius',
    'background-color',
    'color',
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'letter-spacing',
    'text-align',
    'cursor',
    'transition-property',
    'transition-duration',
  ];
  const styles = (el: Element) => {
    const style = getComputedStyle(el);
    return Object.fromEntries(properties.map((name) => [name, style.getPropertyValue(name)]));
  };
  /** Each odd-button paired with the native button that follows it. */
  const pairs = () => {
    const hosts = [...container.querySelectorAll('odd-button')];
    const natives = [...container.querySelectorAll<HTMLButtonElement>('button.odd-button')];
    expect(natives).toHaveLength(hosts.length);
    return hosts.map((host, i) => [inner(host, 'button'), natives[i]!] as const);
  };
  /**
   * The pointer may rest where an earlier test left it, over a button just rendered: park it on
   * plain text and let the hover transitions that leaves running finish.
   */
  const restPointer = async () => {
    const rest = document.createElement('p');
    rest.textContent = 'Pointer rests here';
    container.prepend(rest);
    await userEvent.hover(rest);
    const animations = pairs().flatMap((pair) => pair.flatMap((el) => el.getAnimations()));
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  };

  it('matches odd-button in every appearance, size, and disabled state, in light and dark mode', async () => {
    const cases = ['primary', 'secondary', 'ghost'].flatMap((appearance) =>
      ['sm', 'md', 'lg'].flatMap((size) =>
        ['', 'disabled'].map(
          (disabled) =>
            `<odd-button appearance="${appearance}" size="${size}" ${disabled}>Label</odd-button>` +
            `<button class="odd-button" data-appearance="${appearance}" data-size="${size}" ${disabled}>Label</button>`,
        ),
      ),
    );
    await render(
      `<div data-odd-mode="light">${cases.join('')}</div><div data-odd-mode="dark">${cases.join('')}</div>`,
    );
    await restPointer();
    const all = pairs();
    expect(all).toHaveLength(36);
    for (const [control, native] of all)
      expect(styles(native), native.outerHTML).toEqual(styles(control));
    // The disabled look differs from the enabled one (it once lost to the appearance rules).
    const [primary, disabledPrimary] = all;
    expect(getComputedStyle(disabledPrimary![1]).backgroundColor).not.toBe(
      getComputedStyle(primary![1]).backgroundColor,
    );
  });

  it('defaults to secondary and md, and follows component variables and full width', async () => {
    await render(`
      <odd-button>Default</odd-button><button class="odd-button">Default</button>
      <div style="--odd-button-background: rgb(1, 2, 3); --odd-button-color: rgb(250, 251, 252);
        --odd-button-border-color: rgb(4, 5, 6); --odd-button-radius: 0px;
        --odd-button-height: 3.5rem; --odd-button-padding-inline: 2rem">
        <odd-button appearance="primary">Custom</odd-button>
        <button class="odd-button" data-appearance="primary">Custom</button>
      </div>
      <div style="inline-size: 15rem">
        <odd-button full-width>Wide</odd-button>
        <button class="odd-button" data-full-width>Wide</button>
      </div>`);
    await restPointer();
    for (const [control, native] of pairs())
      expect(styles(native), native.outerHTML).toEqual(styles(control));
    const [, custom, wide] = pairs();
    expect(getComputedStyle(custom![1]).backgroundColor).toBe('rgb(1, 2, 3)');
    expect(getComputedStyle(custom![1]).borderTopLeftRadius).toBe('0px');
    expect(wide![1].getBoundingClientRect().width).toBe(wide![0].getBoundingClientRect().width);
    expect(wide![1].getBoundingClientRect().width).toBe(
      wide![1].parentElement!.getBoundingClientRect().width,
    );
  });

  it('draws the same focus ring and hover backgrounds', async () => {
    await render(`
      <odd-button appearance="primary">A</odd-button>
      <button class="odd-button" data-appearance="primary">A</button>
      <odd-button>B</odd-button><button class="odd-button">B</button>`);
    for (const [control, native] of pairs()) {
      const ring: string[][] = [];
      for (const target of [control, native]) {
        target.focus({ focusVisible: true } as FocusOptions);
        if (!target.matches(':focus-visible')) continue;
        const style = getComputedStyle(target);
        ring.push([
          style.outlineStyle,
          style.outlineWidth,
          style.outlineColor,
          style.outlineOffset,
        ]);
        target.blur();
      }
      if (ring.length === 2) expect(ring[1]).toEqual(ring[0]);
    }
    if (!matchMedia('(hover: hover)').matches) return;
    const resolve = (role: string) => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = `var(--odd-${role})`;
      container.append(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    };
    const expected = [resolve('color-action-hover'), resolve('color-surface-hover')];
    for (const [i, pair] of pairs().entries())
      for (const target of pair) {
        await userEvent.hover(target);
        // Polled: the background transitions to the hover colour.
        await expect.poll(() => getComputedStyle(target).backgroundColor).toBe(expected[i]);
        await userEvent.unhover(target);
      }
  }, 30_000);
});
