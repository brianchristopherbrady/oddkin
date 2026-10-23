import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// The CSS recipes for native markup (component-contracts.md §4), loaded as a page would load them
// from the built package (`dist/css/<name>.css`), with the shipped theme.
const RECIPES = ['typography', 'link', 'divider', 'kbd', 'list', 'table', 'avatar-group'];
let links: HTMLLinkElement[] = [];
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
  links = await Promise.all(
    RECIPES.map(
      (name) =>
        new Promise<HTMLLinkElement>((resolve, reject) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = new URL(`../dist/css/${name}.css`, import.meta.url).href;
          link.onload = () => resolve(link);
          link.onerror = reject;
          document.head.append(link);
        }),
    ),
  );
});
afterAll(() => {
  for (const link of links) link.remove();
  unload();
});

let container: HTMLElement;
afterEach(() => container?.remove());
const mount = (markup: string) => {
  container = document.createElement('div');
  container.innerHTML = markup;
  document.body.append(container);
  return container;
};
const style = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo);

describe('typography recipe', () => {
  it('gives each role its type tokens; small, eyebrow, and code take the secondary colour', () => {
    const roles = ['display', 'title', 'section', 'body', 'ui', 'small', 'eyebrow', 'code'];
    const root = mount(roles.map((role) => `<p class="odd-type-${role}">${role}</p>`).join(''));
    for (const role of roles) {
      const el = root.querySelector(`.odd-type-${role}`)!;
      expect(style(el).fontSize, role).toBe(themeValue('font-size', `--odd-type-${role}-size`));
      expect(style(el).fontWeight, role).toBe(
        themeValue('font-weight', `--odd-type-${role}-weight`),
      );
      const secondary = ['small', 'eyebrow', 'code'].includes(role);
      expect(style(el).color === themeValue('color', '--odd-color-text-secondary'), role).toBe(
        secondary,
      );
    }
    expect(style(root.querySelector('.odd-type-title')!).marginBlockStart).toBe('0px');
  });
});

describe('link recipe', () => {
  it('shows the link colour, an underline on hover, and the focus ring on keyboard focus', async () => {
    const root = mount(
      '<button>before</button> <a class="odd-link" href="#docs">Read the documentation</a>',
    );
    const link = root.querySelector('a')!;
    expect(style(link).color).toBe(themeValue('color', '--odd-color-link'));
    expect(style(link).textDecorationLine).toBe('none');
    await userEvent.hover(link);
    expect(style(link).textDecorationLine).toBe('underline');
    await userEvent.unhover(link);
    root.querySelector('button')!.focus();
    await userEvent.tab();
    // WebKit leaves links out of the Tab order by default; focus the link directly there.
    if (document.activeElement !== link) link.focus();
    expect(style(link).outlineStyle).toBe('solid');
    expect(style(link).outlineColor).toBe(themeValue('color', '--odd-color-focus-ring'));
  });

  it('is always underlined inside running text', () => {
    const root = mount('<p>See <a class="odd-link" href="#x">the guide</a> first.</p>');
    expect(style(root.querySelector('a')!).textDecorationLine).toBe('underline');
  });
});

describe('divider recipe', () => {
  it('draws a rule for hr and rules on both sides of a label', () => {
    const root = mount(
      '<hr class="odd-divider"><div class="odd-divider" role="separator" aria-label="or">OR</div>',
    );
    const border = themeValue('border-top-color', '--odd-color-border-default');
    expect(style(root.querySelector('hr')!).borderBlockStartColor).toBe(border);
    const labelled = root.querySelector('div')!;
    expect(style(labelled, '::before').borderBlockStartColor).toBe(border);
    expect(style(labelled, '::after').borderBlockStartColor).toBe(border);
    expect(style(labelled).color).toBe(themeValue('color', '--odd-color-text-secondary'));
  });
});

describe('keyboard key recipe', () => {
  it('draws a key cap in the code type role, not a button', () => {
    const root = mount('<kbd class="odd-kbd">Ctrl</kbd> <kbd class="odd-kbd">K</kbd>');
    const key = root.querySelector('kbd')!;
    expect(style(key).fontSize).toBe(themeValue('font-size', '--odd-type-code-size'));
    expect(style(key).borderBlockStartColor).toBe(
      themeValue('border-top-color', '--odd-color-border-default'),
    );
    expect(style(key).cursor).not.toBe('pointer');
  });
});

describe('list recipe', () => {
  it('divides rows and shows the current item in the selection colours', () => {
    const root = mount(`<ul class="odd-list">
      <li>Foundations <span class="odd-list-meta">Tokens</span></li>
      <li aria-current="true">Components <span class="odd-list-meta">Controls</span></li>
    </ul>`);
    const [first, current] = root.querySelectorAll('li');
    expect(style(first!).borderBlockStartWidth).toBe('0px');
    expect(style(current!).borderBlockStartColor).toBe(
      themeValue('border-top-color', '--odd-color-border-default'),
    );
    expect(style(current!).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-selection-background'),
    );
    expect(style(current!.querySelector('.odd-list-meta')!).color).toBe(style(current!).color);
    expect(style(first!.querySelector('.odd-list-meta')!).color).toBe(
      themeValue('color', '--odd-color-text-secondary'),
    );
  });
});

describe('table recipe', () => {
  it('styles header cells, sorted headers, and rows whose checkbox is checked', () => {
    const root = mount(`<table class="odd-table">
      <thead><tr><th>Select</th><th aria-sort="ascending">Name</th><th>Role</th></tr></thead>
      <tbody>
        <tr><td><input type="checkbox" aria-label="Select Avery"></td><td>Avery</td><td>Designer</td></tr>
        <tr><td><input type="checkbox" aria-label="Select Jordan"></td><td>Jordan</td><td>Owner</td></tr>
      </tbody>
    </table>`);
    const [plain, sorted] = root.querySelectorAll('th');
    expect(style(plain!).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-sunken'),
    );
    expect(style(plain!).color).toBe(themeValue('color', '--odd-color-text-secondary'));
    expect(style(sorted!).color).toBe(themeValue('color', '--odd-color-text-primary'));
    const rows = root.querySelectorAll('tbody tr');
    root.querySelectorAll('input')[1]!.checked = true;
    expect(style(rows[1]!).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-selection-background'),
    );
    expect(style(rows[0]!).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });
});

describe('avatar group recipe', () => {
  it('overlaps the avatars and colours the overflow count', async () => {
    const root =
      mount(`<span class="odd-avatar-group" role="group" aria-label="6 workspace members">
      <odd-avatar label="Amelia Morgan"></odd-avatar>
      <odd-avatar label="Jo Lee"></odd-avatar>
      <odd-avatar class="odd-avatar-group-more" label="3 more">+3</odd-avatar>
    </span>`);
    const avatars = [...root.querySelectorAll('odd-avatar')];
    for (const avatar of avatars) await settle(avatar);
    const [a, b] = avatars.map((avatar) => avatar.getBoundingClientRect());
    expect(b!.left).toBeLessThan(a!.right);
    const more = avatars[2]!.shadowRoot!.querySelector('[part="base"]')!;
    expect(style(more).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-action-default'),
    );
    expect(style(more).color).toBe(themeValue('color', '--odd-color-text-on-action'));
  });
});
