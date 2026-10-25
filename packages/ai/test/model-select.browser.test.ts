import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';

// odd-model-select draws the shared field look of @oddkin/components (control.styles.ts): the
// shared medium control surface, also bound by the light/dark Figma model-select examples.
let theme: HTMLLinkElement;
let container: HTMLElement;
beforeAll(async () => {
  await import('../src/model-select/model-select.define.js');
  await import('@oddkin/components/define/input');
  theme = document.createElement('link');
  theme.rel = 'stylesheet';
  theme.href = new URL('../../tokens/dist/css/default.css', import.meta.url).href;
  await new Promise((resolve, reject) => {
    theme.onload = resolve;
    theme.onerror = reject;
    document.head.append(theme);
  });
});
afterAll(() => theme.remove());
afterEach(() => {
  container.remove();
  flush();
});

const LOOK = [
  'border-top-color',
  'border-top-width',
  'border-top-left-radius',
  'background-color',
  'min-height',
  'padding-left',
  'font-size',
];
const look = (el: Element) =>
  LOOK.map((property) => `${property}: ${getComputedStyle(el).getPropertyValue(property)}`);

describe('odd-model-select', () => {
  it('draws its label, select, and details with the field look every form control shares', async () => {
    container = document.createElement('div');
    container.innerHTML =
      '<odd-model-select></odd-model-select><odd-input label="Name"></odd-input>';
    document.body.append(container);
    const select = container.querySelector('odd-model-select')!;
    select.models = [
      { id: 'a', label: 'Model A', description: 'Fast', capabilities: ['text'], available: true },
    ];
    select.value = 'a';
    const input = container.querySelector('odd-input')!;
    for (const el of [select, input]) await el.updateComplete;
    flush();
    await new Promise(requestAnimationFrame);
    const part = (host: Element, name: string) =>
      host.shadowRoot!.querySelector(`[part="${name}"]`)!;
    const control = part(select, 'select');
    const chevron = select.shadowRoot!.querySelector('.control-end svg')!.getBoundingClientRect();
    const box = control.getBoundingClientRect();
    expect(chevron.width).toBeGreaterThan(0);
    expect(chevron.right).toBeLessThan(box.right);
    expect(chevron.left).toBeGreaterThan(box.left + box.width / 2);
    expect(box.height).toBe(part(input, 'control').getBoundingClientRect().height);
    // WebKit (Playwright 27.2) reports this select's computed style without the tokens it inherits
    // (unstyled values for seconds), though it renders them: the box above has the field height.
    if (server.browser === 'webkit') return;
    expect(look(control)).toEqual(look(part(input, 'control')));
    // The chevron replaces the engine's arrow, and the text stops before it.
    expect(getComputedStyle(control).getPropertyValue('appearance')).toBe('none');
    expect(box.right - parseFloat(getComputedStyle(control).paddingRight)).toBeLessThanOrEqual(
      chevron.left,
    );
    const font = (el: Element) => [getComputedStyle(el).fontSize, getComputedStyle(el).fontWeight];
    expect(font(part(select, 'label'))).toEqual(font(part(input, 'label')));
    container.style.setProperty('--odd-motion-duration-fast', '0s');
    container.style.setProperty('--odd-field-border-color', 'rgb(7, 8, 9)');
    expect(getComputedStyle(control).borderTopColor).toBe('rgb(7, 8, 9)');
  });

  it('is never wider than a narrow container, whatever its longest option', async () => {
    container = document.createElement('div');
    container.style.inlineSize = '8rem';
    container.innerHTML = '<odd-model-select></odd-model-select>';
    document.body.append(container);
    const select = container.querySelector('odd-model-select')!;
    select.models = [
      {
        id: 'long',
        label: 'A simulated model with an exceptionally long descriptive name',
        capabilities: ['text'],
        available: true,
      },
    ];
    select.value = 'long';
    await select.updateComplete;
    flush();
    const control = select.shadowRoot!.querySelector('select')!;
    expect(control.getBoundingClientRect().right).toBeLessThanOrEqual(
      container.getBoundingClientRect().right + 0.5,
    );
  });
});
