import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { OddkinTextarea } from '../src/textarea/textarea.js';
import { loadTheme, themeValue } from './probe.js';

let container: HTMLElement;
beforeAll(async () => {
  await loadTheme();
  await import('../src/textarea/textarea.define.js');
});
beforeEach(() => {
  container = document.createElement('div');
  container.style.inlineSize = '20rem';
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const settle = async (el: { updateComplete: Promise<void> }) => {
  await el.updateComplete;
  flush();
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
};

async function mount(markup: string) {
  container.innerHTML = markup;
  const all = [...container.querySelectorAll('odd-textarea')];
  for (const one of all) await settle(one);
  const el = all[0]!;
  const control = el.shadowRoot!.querySelector('textarea')!;
  const part = (name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  return { el, control, part, all };
}
const height = (el: Element) => el.getBoundingClientRect().height;
const lines = (n: number) => Array.from({ length: n }, (_, i) => `Line ${i + 1}`).join('\n');

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/textarea/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'OddkinTextarea',
        'TEXTAREA_STRINGS',
        'changeEvent',
        'fieldStructuralStyles',
        'hostStyles',
        'inputEvent',
        'textareaStructuralStyles',
        'textareaTemplate',
      ].sort(),
    );
    const index = await import('../src/textarea/index.js');
    expect(Object.keys(index)).toContain('textareaStyles');
  });
});

describe('odd-textarea', () => {
  it('labels the native textarea and describes it with description, error, and count', async () => {
    const { el, control, part } = await mount(
      '<odd-textarea label="Project description" description="Shown on the card."></odd-textarea>',
    );
    expect(page.getByRole('textbox', { name: 'Project description', exact: true }).element()).toBe(
      control,
    );
    expect(control.getAttribute('aria-describedby')).toBe('description');
    expect(part('count').hidden).toBe(true);
    el.maxLength = 500;
    await settle(el);
    expect(control.getAttribute('aria-describedby')).toBe('description count');
    expect(part('count').textContent!.trim()).toBe('0 / 500 characters');
    expect(part('count').hasAttribute('aria-live')).toBe(false);
    el.error = 'Description is required.';
    await settle(el);
    // Figma draws one line under the field: the error takes the count's place.
    expect(control.getAttribute('aria-describedby')).toBe('description error');
    expect([part('count').hidden, part('error').hidden]).toEqual([true, false]);
    expect(control.getAttribute('aria-invalid')).toBe('true');
  });

  it('counts as the user types, in the page language, with translatable text', async () => {
    const { el, control, part } = await mount(
      '<odd-textarea label="Notes" maxlength="1000"></odd-textarea><div lang="de"><odd-textarea label="Notizen" maxlength="1000" value="Hallo"></odd-textarea></div>',
    );
    await userEvent.click(control);
    await userEvent.keyboard('Hi{Enter}there');
    await settle(el);
    expect(el.value).toBe('Hi\nthere');
    expect(part('count').textContent!.trim()).toBe(`8 / ${(1000).toLocaleString('en')} characters`);
    const german = container.querySelectorAll('odd-textarea')[1]!;
    german.strings = { count: '{count} von {max} Zeichen' };
    await settle(german);
    expect(german.shadowRoot!.querySelector('[part="count"]')!.textContent!.trim()).toBe(
      `5 von ${(1000).toLocaleString('de')} Zeichen`,
    );
  });

  it('treats the value attribute as defaultValue until the value is set or typed', async () => {
    const { el, control } = await mount('<odd-textarea label="Notes" value="Ada"></odd-textarea>');
    expect([el.value, control.value]).toEqual(['Ada', 'Ada']);
    el.setAttribute('value', 'Grace');
    await settle(el);
    expect(control.value).toBe('Grace');
    el.value = 'Lin\nLovelace';
    await settle(el);
    expect(control.value).toBe('Lin\nLovelace');
    el.setAttribute('value', 'Mary');
    await settle(el);
    expect([el.defaultValue, el.value]).toEqual(['Mary', 'Lin\nLovelace']);
  });

  it('Enter inserts a line break, the caret stays put, and input then change reach the host', async () => {
    const { el, control } = await mount('<odd-textarea label="Notes" value="ab"></odd-textarea>');
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input:${JSON.stringify(el.value)}`));
    el.addEventListener('change', (e) => events.push(`change:${e.composed}`));
    await userEvent.click(control);
    control.setSelectionRange(1, 1);
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(el.value).toBe('a\nb');
    expect(control.selectionStart).toBe(2);
    control.blur();
    expect(events).toEqual(['input:"a\\nb"', 'change:false']);
    el.value = 'quiet';
    await settle(el);
    expect(events).toHaveLength(2);
  });

  it('takes one Tab stop between its neighbours, as a native textarea does', async () => {
    await mount(
      '<button id="before">Before</button><odd-textarea label="Notes"></odd-textarea><button id="after">After</button>',
    );
    const el = container.querySelector('odd-textarea')!;
    container.querySelector<HTMLButtonElement>('#before')!.focus();
    await userEvent.tab();
    expect([document.activeElement, el.shadowRoot!.activeElement?.localName]).toEqual([
      el,
      'textarea',
    ]);
    await userEvent.tab();
    expect(document.activeElement!.id).toBe('after');
  });
});

describe('forms', () => {
  /** An odd-textarea and a native textarea with the same attributes, in one form. */
  async function pair(attributes: string) {
    const { el, control } = await mount(
      `<form><odd-textarea label="Field" name="a" ${attributes}></odd-textarea><textarea name="b" ${attributes}></textarea></form>`,
    );
    const native = container.querySelector<HTMLTextAreaElement>('textarea[name="b"]')!;
    const flags = (validity: ValidityState) =>
      Object.keys(ValidityState.prototype).filter(
        (k) => validity[k as keyof ValidityState] === true,
      );
    return { el, control, native, flags, form: container.querySelector('form')! };
  }

  it('submits name=value with its line breaks, validates required, and supports custom errors', async () => {
    const { el, native, flags, form } = await pair('required');
    expect(flags(el.validity)).toEqual(flags(native.validity));
    expect(el.validity.valueMissing).toBe(true);
    el.value = 'one\ntwo';
    native.value = 'one\ntwo';
    await settle(el);
    expect(el.checkValidity()).toBe(true);
    expect(new FormData(form).get('a')).toBe(new FormData(form).get('b'));
    el.setCustomValidity('Not allowed');
    await settle(el);
    expect([el.error, el.validity.customError]).toEqual(['Not allowed', true]);
  });

  it('minlength flags a short typed value and maxlength stops typing, as native', async () => {
    const { el, control, native, flags } = await pair('minlength="3" maxlength="5"');
    for (const field of [control, native]) {
      await userEvent.click(field);
      await userEvent.keyboard('ab');
    }
    await settle(el);
    expect(el.validity.tooShort).toBe(true);
    expect(flags(el.validity)).toEqual(flags(native.validity));
    for (const field of [control, native]) {
      await userEvent.click(field);
      await userEvent.keyboard('cdefg');
    }
    await settle(el);
    expect([el.value, native.value]).toEqual(['abcde', 'abcde']);
    expect(flags(el.validity)).toEqual(flags(native.validity));
  });

  it('reset restores the default; read-only submits, disabled and a disabled fieldset do not', async () => {
    const { el, control } = await mount(
      '<form><fieldset><odd-textarea label="Notes" name="n" value="Ada"></odd-textarea></fieldset></form>',
    );
    const form = container.querySelector('form')!;
    el.value = 'changed';
    await settle(el);
    form.reset();
    await settle(el);
    expect([el.value, control.value]).toEqual(['Ada', 'Ada']);
    el.readonly = true;
    await settle(el);
    expect([control.readOnly, [...new FormData(form)]]).toEqual([true, [['n', 'Ada']]]);
    el.readonly = false;
    el.disabled = true;
    await settle(el);
    expect([control.disabled, [...new FormData(form)]]).toEqual([true, []]);
    el.disabled = false;
    container.querySelector('fieldset')!.disabled = true;
    await settle(el);
    expect([control.disabled, [...new FormData(form)]]).toEqual([true, []]);
  });

  it('shows aria-invalid only after a failed validity check, and reset clears it', async () => {
    const { el, control } = await mount(
      '<form><odd-textarea label="Notes" name="n" required></odd-textarea></form>',
    );
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    el.addEventListener('invalid', (event) => event.preventDefault());
    container.querySelector('form')!.requestSubmit();
    await settle(el);
    expect([control.getAttribute('aria-invalid'), el.matches(':state(user-invalid)')]).toEqual([
      'true',
      true,
    ]);
    container.querySelector('form')!.reset();
    await settle(el);
    expect(control.hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('look', () => {
  it('insets the text on every side and shows four lines by default, like Figma', async () => {
    const { control } = await mount(
      '<odd-textarea label="Notes"></odd-textarea><textarea rows="4"></textarea>',
    );
    const style = getComputedStyle(control);
    const inset = themeValue('padding-top', '--odd-space-sm');
    expect([style.paddingTop, style.paddingBottom, style.paddingLeft]).toEqual([
      inset,
      inset,
      themeValue('padding-left', '--odd-control-padding-inline-md'),
    ]);
    expect(control.rows).toBe(4);
    const lineHeight = parseFloat(style.lineHeight);
    const border = parseFloat(style.borderTopWidth);
    expect(height(control)).toBeCloseTo(4 * lineHeight + 2 * parseFloat(inset) + 2 * border, 0);
    expect(style.resize).toBe('vertical');
  });

  it('turns the resize handle off for none and auto', async () => {
    const { all } = await mount(
      '<odd-textarea resize="none"></odd-textarea><odd-textarea resize="auto"></odd-textarea>',
    );
    for (const one of all)
      expect(getComputedStyle(one.shadowRoot!.querySelector('textarea')!).resize).toBe('none');
  });
});

describe('resize="auto"', () => {
  afterEach(() => {
    OddkinTextarea._fieldSizing = CSS.supports('field-sizing', 'content');
  });

  /** A field that follows its content, and a vertical one with the same rows for its floor. */
  async function grow(attributes = '') {
    const { el, control, all } = await mount(
      `<odd-textarea label="Message" resize="auto" rows="2" ${attributes}></odd-textarea><odd-textarea label="Floor" rows="2"></odd-textarea>`,
    );
    return { el, control, floor: height(all[1]!.shadowRoot!.querySelector('textarea')!) };
  }

  async function grows(el: OddkinTextarea, control: HTMLTextAreaElement, floor: number) {
    expect(height(control)).toBeCloseTo(floor, 0);
    el.value = lines(6);
    await settle(el);
    const tall = height(control);
    expect(tall).toBeGreaterThan(floor + 3 * parseFloat(getComputedStyle(control).lineHeight));
    expect(control.scrollHeight).toBeLessThanOrEqual(control.clientHeight);
    el.value = 'Short';
    await settle(el);
    expect(height(control)).toBeCloseTo(floor, 0);
    // Past the maximum it scrolls, keeping the caret where the user types.
    el.style.setProperty('--odd-textarea-max-height', '6rem');
    el.value = lines(20);
    await settle(el);
    expect(height(control)).toBeCloseTo(96, 0);
    control.focus();
    control.setSelectionRange(control.value.length, control.value.length);
    await userEvent.keyboard('!');
    await settle(el);
    expect(el.value.endsWith('Line 20!')).toBe(true);
    expect(control.selectionStart).toBe(el.value.length);
    expect(control.scrollHeight).toBeGreaterThan(control.clientHeight);
  }

  it('grows with native field sizing where the engine has it, between rows and the maximum', async () => {
    if (!CSS.supports('field-sizing', 'content')) return;
    const { el, control, floor } = await grow();
    expect(getComputedStyle(control).getPropertyValue('field-sizing')).toBe('content');
    await grows(el, control, floor);
    // Native and measured sizing never run together.
    expect(control.style.blockSize).toBe('');
  });

  it('measures its height where the engine has no field sizing, matching native sizing', async () => {
    OddkinTextarea._fieldSizing = false;
    const { el, control, floor } = await grow();
    expect(control.style.blockSize).not.toBe('');
    await grows(el, control, floor);
    el.style.removeProperty('--odd-textarea-max-height');
    el.value = lines(5);
    await settle(el);
    const measured = height(control);
    if (CSS.supports('field-sizing', 'content')) {
      // Same content in a field the engine sizes: the measured height matches it.
      OddkinTextarea._fieldSizing = true;
      container.insertAdjacentHTML(
        'beforeend',
        `<odd-textarea label="Native" resize="auto" rows="2" value="${lines(5)}"></odd-textarea>`,
      );
      const native = container.lastElementChild as OddkinTextarea;
      await settle(native);
      expect(measured).toBeCloseTo(height(native.shadowRoot!.querySelector('textarea')!), 0);
    }
  });

  it('measured: follows typing and a narrower field, and stops measuring when resize changes', async () => {
    OddkinTextarea._fieldSizing = false;
    const { el, control, floor } = await grow();
    await userEvent.click(control);
    await userEvent.keyboard('a{Enter}b{Enter}c{Enter}d');
    await settle(el);
    const typed = height(control);
    expect(typed).toBeGreaterThan(floor);
    el.value = 'word '.repeat(30);
    await settle(el);
    const wide = height(control);
    container.style.inlineSize = '10rem';
    await settle(el);
    await new Promise(requestAnimationFrame);
    expect(height(control)).toBeGreaterThan(wide);
    el.resize = 'vertical';
    await settle(el);
    expect(control.style.blockSize).toBe('');
  });
});

describe('ownership', () => {
  it('returns to baseline after reconnects', async () => {
    const { el } = await mount('<odd-textarea label="Notes" resize="auto"></odd-textarea>');
    const before = scopeStats();
    for (let i = 0; i < 10; i++) {
      el.remove();
      container.append(el);
      await settle(el);
    }
    expect(scopeStats()).toEqual(before);
  });
});

describe('text-entry hints', () => {
  it('forwards the host hints to the native textarea, and nothing without them', async () => {
    const { el, control } = await mount(
      '<odd-textarea label="Notes" spellcheck="false" autocapitalize="sentences"></odd-textarea>',
    );
    expect([control.getAttribute('spellcheck'), control.getAttribute('autocapitalize')]).toEqual([
      'false',
      'sentences',
    ]);
    el.removeAttribute('spellcheck');
    await new Promise((resolve) => setTimeout(resolve));
    await settle(el);
    expect(control.hasAttribute('spellcheck')).toBe(false);
  });
});
