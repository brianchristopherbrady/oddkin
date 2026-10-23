import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinInput } from '../src/input/input.js';
import { loadTheme, themeValue } from './probe.js';

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
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
};

async function mount(markup: string) {
  await import('../src/input/input.define.js');
  container.innerHTML = markup;
  const el = container.querySelector('odd-input') as OddkinInput;
  await settle(el);
  const control = el.shadowRoot!.querySelector('input')!;
  const part = (name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  return { el, control, part };
}

describe('imports', () => {
  it('the foundation and the component entry register nothing', async () => {
    const foundation = await import('../src/input/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'INPUT_STRINGS',
        'OddkinInput',
        'changeEvent',
        'fieldStructuralStyles',
        'inputEvent',
        'inputStructuralStyles',
        'inputTemplate',
        'hostStyles',
      ].sort(),
    );
    await import('../src/input/index.js');
    expect(customElements.get('odd-input')).toBeUndefined();
  });
});

describe('odd-input', () => {
  it('labels the native input and describes it with description and error', async () => {
    const { el, control, part } = await mount(
      '<odd-input label="Email" description="We never share it."></odd-input>',
    );
    expect(part('label').getAttribute('for')).toBe('control');
    expect(control.labels?.[0]?.textContent).toBe('Email');
    expect(control.getAttribute('aria-describedby')).toBe('description');
    el.error = 'Enter a work address.';
    await settle(el);
    expect(control.getAttribute('aria-describedby')).toBe('description error');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(part('error').textContent).toBe('Enter a work address.');
    expect(part('error').hidden).toBe(false);
  });

  it('treats the value attribute as defaultValue until the value is set or typed', async () => {
    const { el, control } = await mount('<odd-input label="Name" value="Ada"></odd-input>');
    expect(el.value).toBe('Ada');
    expect(control.value).toBe('Ada');
    el.setAttribute('value', 'Grace');
    await settle(el);
    expect(el.value).toBe('Grace');
    el.value = 'Lin';
    await settle(el);
    expect(control.value).toBe('Lin');
    el.setAttribute('value', 'Mary');
    await settle(el);
    expect(el.defaultValue).toBe('Mary');
    expect(el.value).toBe('Lin');
  });

  it('keeps a value assigned before the element was upgraded', async () => {
    await import('../src/input/input.define.js');
    // Elements parsed in a <template> are not upgraded until adopted into this document.
    const template = document.createElement('template');
    template.innerHTML = '<odd-input label="Late"></odd-input>';
    const early = template.content.firstElementChild as HTMLElement & { value?: string };
    early.value = 'early';
    container.append(early);
    const upgraded = early as OddkinInput;
    await settle(upgraded);
    expect(upgraded.value).toBe('early');
    expect(upgraded.shadowRoot!.querySelector('input')!.value).toBe('early');
  });

  it('typing updates value, keeps the caret, and dispatches input once and change at the host', async () => {
    const { el, control } = await mount('<odd-input label="Name" value="Ada"></odd-input>');
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input:${el.value}`));
    el.addEventListener('change', (e) => events.push(`change:${e.composed}`));
    document.addEventListener('change', () => events.push('document-change'), { once: true });
    await userEvent.click(control);
    control.setSelectionRange(1, 1);
    await userEvent.keyboard('x');
    await settle(el);
    expect(el.value).toBe('Axda');
    expect(control.selectionStart).toBe(2);
    // Leaving the field commits the change (blur directly: Tab handling differs in test frames).
    control.blur();
    expect(events).toEqual(['input:Axda', 'change:false', 'document-change']);
  });

  it('programmatic value changes dispatch no events', async () => {
    const { el } = await mount('<odd-input label="Name"></odd-input>');
    const events: string[] = [];
    for (const type of ['input', 'change']) el.addEventListener(type, () => events.push(type));
    el.value = 'set';
    el.error = 'x';
    await settle(el);
    expect(events).toEqual([]);
  });
});

describe('forms', () => {
  it('submits name=value, validates required and type, and supports custom errors', async () => {
    const { el, control } = await mount(
      '<form><odd-input label="Email" name="email" type="email" required></odd-input></form>',
    );
    const form = container.querySelector('form')!;
    expect(el.form).toBe(form);
    expect(el.checkValidity()).toBe(false);
    expect(el.validity.valueMissing).toBe(true);
    expect(form.checkValidity()).toBe(false);
    el.value = 'not-an-email';
    await settle(el);
    expect(el.validity.typeMismatch).toBe(true);
    el.value = 'ada@example.com';
    await settle(el);
    expect(el.checkValidity()).toBe(true);
    expect([...new FormData(form)]).toEqual([['email', 'ada@example.com']]);
    el.error = 'Taken';
    await settle(el);
    expect(el.validity.customError).toBe(true);
    expect(el.validationMessage).toBe('Taken');
    el.error = '';
    await settle(el);
    expect(el.checkValidity()).toBe(true);
    el.setCustomValidity('Not allowed');
    await settle(el);
    expect([el.error, el.validity.customError, el.validationMessage]).toEqual([
      'Not allowed',
      true,
      'Not allowed',
    ]);
    el.setCustomValidity('');
    await settle(el);
    expect(el.checkValidity()).toBe(true);
  });

  it('shows aria-invalid only after a failed validity check or leaving the field', async () => {
    const { el, control } = await mount(
      '<form><odd-input label="Email" name="email" required></odd-input></form>',
    );
    expect(el.validity.valid).toBe(false);
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    expect(el.matches(':state(user-invalid)')).toBe(false);
    // Suppress the browser's validation bubble, which can swallow later clicks in Firefox.
    el.addEventListener('invalid', (event) => event.preventDefault());
    container.querySelector('form')!.requestSubmit();
    await settle(el);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    // The custom state mirrors aria-invalid, so consumers can style the host and its parts.
    expect(el.matches(':state(user-invalid)')).toBe(true);
    container.querySelector('form')!.reset();
    await settle(el);
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    expect(el.matches(':state(user-invalid)')).toBe(false);
    el.error = 'Taken';
    await settle(el);
    expect([control.getAttribute('aria-invalid'), el.matches(':state(user-invalid)')]).toEqual([
      'true',
      true,
    ]);
  });

  it('reset restores defaultValue; a disabled fieldset disables and excludes it', async () => {
    const { el, control } = await mount(
      '<form><fieldset><odd-input label="Name" name="n" value="Ada"></odd-input></fieldset></form>',
    );
    const form = container.querySelector('form')!;
    el.value = 'changed';
    await settle(el);
    form.reset();
    await settle(el);
    expect(el.value).toBe('Ada');
    expect(control.value).toBe('Ada');
    container.querySelector('fieldset')!.disabled = true;
    await settle(el);
    expect(control.disabled).toBe(true);
    expect([...new FormData(form)]).toEqual([]);
  });

  it('an invalid value is not a failure while disabled, read-only, or in a disabled fieldset', async () => {
    const errors: unknown[] = [];
    const previous = setErrorHandler((error) => errors.push(error));
    try {
      const { el, control } = await mount(
        '<form><fieldset><odd-input label="Email" name="email" type="email" value="x"></odd-input></fieldset></form>',
      );
      const form = container.querySelector('form')!;
      const fieldset = container.querySelector('fieldset')!;
      expect(el.validity.typeMismatch).toBe(true);
      // Like native inputs: read-only values are still submitted, disabled ones are not.
      const bars = [
        ['disabled', (on: boolean) => (el.disabled = on), []],
        ['readonly', (on: boolean) => (el.readonly = on), [['email', 'x']]],
        ['fieldset', (on: boolean) => (fieldset.disabled = on), []],
      ] as const;
      for (const [name, bar, submitted] of bars) {
        bar(true);
        await settle(el);
        expect([name, el.validity.valid, form.checkValidity()]).toEqual([name, true, true]);
        expect([...new FormData(form)]).toEqual(submitted);
        bar(false);
        await settle(el);
        expect([name, el.validity.typeMismatch]).toEqual([name, true]);
        expect(el.validationMessage).toBe(control.validationMessage);
      }
      expect(errors).toEqual([]);
    } finally {
      setErrorHandler(previous);
    }
  });

  it('reflects a name set as a property, so frameworks that set properties submit it', async () => {
    const { el } = await mount(
      '<form><odd-input label="Email" value="ada@example.com"></odd-input></form>',
    );
    const form = container.querySelector('form')!;
    expect(el.hasAttribute('name')).toBe(false);
    expect([...new FormData(form)]).toEqual([]);
    el.name = 'email';
    await settle(el);
    expect(el.getAttribute('name')).toBe('email');
    expect([...new FormData(form)]).toEqual([['email', 'ada@example.com']]);
    el.name = undefined;
    await settle(el);
    expect(el.hasAttribute('name')).toBe(false);
  });

  it('does not submit on Enter in the field (documented limitation)', async () => {
    const { control } = await mount(
      '<form><odd-input label="Name" name="n" value="Ada"></odd-input><button>Go</button></form>',
    );
    const form = container.querySelector('form')!;
    let submits = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits++;
    });
    // The inner input has no form owner, so implicit submission never starts.
    control.focus();
    await userEvent.keyboard('{Enter}');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(submits).toBe(0);
    container.querySelector<HTMLButtonElement>('button')!.click();
    expect(submits).toBe(1);
  });

  it('typing then submitting sends the typed value through an odd-button', async () => {
    await import('../src/button/button.define.js');
    const { el, control } = await mount(
      '<form><odd-input label="Name" name="n"></odd-input><odd-button type="submit">Go</odd-button></form>',
    );
    const form = container.querySelector('form')!;
    const data: [string, FormDataEntryValue][][] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      data.push([...new FormData(form, event.submitter)]);
    });
    await userEvent.click(control);
    await userEvent.keyboard('Ada');
    await userEvent.click(container.querySelector('odd-button')!);
    // The button submits after the click's dispatch (a task later); wait for it under load.
    await expect.poll(() => data.length).toBe(1);
    expect(el.value).toBe('Ada');
    expect(data).toEqual([[['n', 'Ada']]]);
  });
});

describe('form reassociation', () => {
  it('moved to another form, it submits, validates, and resets only with its new owner', async () => {
    const { el } = await mount(
      '<form id="a"><odd-input label="Email" name="email" required></odd-input></form><form id="b"></form>',
    );
    const [a, b] = [...container.querySelectorAll('form')] as [HTMLFormElement, HTMLFormElement];
    expect(el.form).toBe(a);
    expect(a.checkValidity()).toBe(false);
    b.append(el);
    await settle(el);
    expect(el.form).toBe(b);
    expect(a.checkValidity()).toBe(true);
    expect(b.checkValidity()).toBe(false);
    el.value = 'ada@example.com';
    await settle(el);
    expect([...new FormData(a)]).toEqual([]);
    expect([...new FormData(b)]).toEqual([['email', 'ada@example.com']]);
    a.reset();
    await settle(el);
    expect(el.value).toBe('ada@example.com');
    b.reset();
    await settle(el);
    expect(el.value).toBe('');
  });

  it('follows its form attribute and the form it names', async () => {
    const { el } = await mount(
      '<odd-input label="Email" name="email" value="ada@example.com" form="signup"></odd-input>',
    );
    expect(el.form).toBe(null);
    const signup = document.createElement('form');
    signup.id = 'signup';
    container.append(signup);
    await settle(el);
    expect(el.form).toBe(signup);
    expect([...new FormData(signup)]).toEqual([['email', 'ada@example.com']]);
    el.removeAttribute('form');
    await settle(el);
    expect(el.form).toBe(null);
    expect([...new FormData(signup)]).toEqual([]);
  });
});

describe('ownership', () => {
  it('returns to baseline after reconnects', async () => {
    const { el } = await mount('<odd-input label="Name"></odd-input>');
    const before = scopeStats();
    for (let i = 0; i < 10; i++) {
      el.remove();
      container.append(el);
      await settle(el);
    }
    expect(scopeStats()).toEqual(before);
  });
});

describe('types and constraints', () => {
  /** An odd-input and a native input with the same attributes, in one form. */
  async function pair(attributes: string) {
    const { el, control } = await mount(
      `<form><odd-input label="Field" name="a" ${attributes}></odd-input><input name="b" ${attributes} /></form>`,
    );
    const native = container.querySelector<HTMLInputElement>('input[name="b"]')!;
    const flags = (validity: ValidityState) =>
      Object.keys(ValidityState.prototype).filter(
        (k) => validity[k as keyof ValidityState] === true,
      );
    return { el, control, native, flags };
  }

  it('passes min, max, and step to a number field and reports the same validity as native', async () => {
    const { el, control, native, flags } = await pair('type="number" min="1" max="50" step="2"');
    expect([control.type, control.min, control.max, control.step]).toEqual([
      'number',
      '1',
      '50',
      '2',
    ]);
    for (const value of ['60', '0', '4', '5', '']) {
      el.value = value;
      native.value = value;
      await settle(el);
      expect([value, flags(el.validity)]).toEqual([value, flags(native.validity)]);
    }
  });

  it('steps with the arrow keys, reporting input as native', async () => {
    const { el, control } = await mount(
      '<odd-input label="Seats" type="number" value="12"></odd-input>',
    );
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input:${el.value}`));
    control.focus();
    await userEvent.keyboard('{ArrowUp}');
    await settle(el);
    expect(el.value).toBe('13');
    expect(events).toEqual(['input:13']);
  });

  it('passes minlength, maxlength, and pattern; typing stops at maxlength', async () => {
    const { el, control, native, flags } = await pair(
      'minlength="3" maxlength="5" pattern="[a-z]+"',
    );
    expect([control.minLength, control.maxLength, control.pattern]).toEqual([3, 5, '[a-z]+']);
    for (const value of ['ab1', 'abc']) {
      el.value = value;
      native.value = value;
      await settle(el);
      expect([value, flags(el.validity)]).toEqual([value, flags(native.validity)]);
    }
    el.value = '';
    await settle(el);
    await userEvent.click(control);
    await userEvent.keyboard('abcdefg');
    await settle(el);
    expect(el.value).toBe('abcde');
  });

  it('passes date and time types with their ranges', async () => {
    for (const [type, min, value] of [
      ['date', '2026-01-01', '2025-12-31'],
      ['time', '09:00', '08:30'],
      ['datetime-local', '2026-01-01T09:00', '2025-12-31T09:00'],
      ['month', '2026-02', '2026-01'],
      ['week', '2026-W10', '2026-W09'],
    ] as const) {
      const { el, control, native, flags } = await pair(`type="${type}" min="${min}"`);
      // An engine without the type falls back to text, as the native input does.
      expect([type, control.type]).toEqual([type, native.type]);
      el.value = value;
      native.value = value;
      await settle(el);
      expect([type, flags(el.validity)]).toEqual([type, flags(native.validity)]);
    }
  });

  it('forwards the host inputmode attribute to the inner input', async () => {
    const { el, control } = await mount('<odd-input label="Code" inputmode="numeric"></odd-input>');
    expect(control.inputMode).toBe('numeric');
    el.setAttribute('inputmode', 'decimal');
    await settle(el);
    await new Promise((resolve) => setTimeout(resolve));
    await settle(el);
    expect(control.inputMode).toBe('decimal');
    el.removeAttribute('inputmode');
    await new Promise((resolve) => setTimeout(resolve));
    await settle(el);
    expect(control.hasAttribute('inputmode')).toBe(false);
  });
});

describe('search', () => {
  let unload: () => void;
  beforeAll(async () => {
    unload = await loadTheme();
  });
  afterAll(() => unload());

  it('is a searchbox named by its label with a search glyph and a clear button only while there is a value', async () => {
    const { el, control, part } = await mount(
      '<odd-input label="Search projects" type="search"></odd-input>',
    );
    expect(page.getByRole('searchbox', { name: 'Search projects', exact: true }).element()).toBe(
      control,
    );
    expect([control.type, control.getAttribute('enterkeyhint')]).toEqual(['text', 'search']);
    expect(part('icon').getAttribute('aria-hidden')).toBe('true');
    expect(part('icon').querySelector('svg.glyph')).not.toBeNull();
    expect(part('clear').querySelector('svg.glyph')).not.toBeNull();
    expect(part('clear').hidden).toBe(true);
    el.value = 'design';
    await settle(el);
    expect(part('clear').hidden).toBe(false);
    expect(part('clear').getAttribute('aria-label')).toBe('Clear');
    expect(part('clear').tabIndex).toBe(-1);
    for (const bar of ['readonly', 'disabled']) {
      el.setAttribute(bar, '');
      await settle(el);
      expect([bar, part('clear').hidden]).toEqual([bar, true]);
      el.removeAttribute(bar);
      await settle(el);
    }
    el.disabled = true;
    await settle(el);
    expect(['property', part('clear').hidden]).toEqual(['property', true]);
    el.disabled = false;
    const fieldset = document.createElement('fieldset');
    el.before(fieldset);
    fieldset.append(el);
    fieldset.disabled = true;
    await settle(el);
    expect(['fieldset', part('clear').hidden]).toEqual(['fieldset', true]);
    fieldset.disabled = false;
    await settle(el);
    expect(part('clear').hidden).toBe(false);
    el.strings = { clear: 'Effacer' };
    await settle(el);
    expect(part('clear').getAttribute('aria-label')).toBe('Effacer');
    const box = part('clear').getBoundingClientRect();
    expect([box.width, box.height]).toEqual([24, 24]);
  });

  it('the clear button clears, reports input then change, and keeps focus in the field', async () => {
    const { el, control, part } = await mount(
      '<odd-input label="Search" type="search" value="design"></odd-input>',
    );
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input:${el.value}`));
    el.addEventListener('change', () => events.push('change'));
    control.focus();
    await userEvent.click(part('clear'));
    await settle(el);
    expect(el.value).toBe('');
    expect(control.value).toBe('');
    expect(events).toEqual(['input:', 'change']);
    expect(el.shadowRoot!.activeElement).toBe(control);
  });

  it('Escape clears a value and is cancelled; with no value it passes through', async () => {
    const { el, control } = await mount(
      '<odd-input label="Search" type="search" value="design"></odd-input>',
    );
    const seen: boolean[] = [];
    document.addEventListener('keydown', (event) => seen.push(event.defaultPrevented));
    control.focus();
    await userEvent.keyboard('{Escape}');
    await settle(el);
    expect(el.value).toBe('');
    await userEvent.keyboard('{Escape}');
    expect(seen).toEqual([true, false]);
  });

  it('clears on Escape only, and only in a search field', async () => {
    const { el, control } = await mount(
      '<odd-input label="Search" type="search" value="design"></odd-input><odd-input label="Name" value="Ada"></odd-input>',
    );
    control.focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(el.value).toBe('design');
    const text = container.querySelectorAll('odd-input')[1] as OddkinInput;
    await settle(text);
    const seen: boolean[] = [];
    text.addEventListener('keydown', (event) => seen.push(event.defaultPrevented));
    text.shadowRoot!.querySelector('input')!.focus();
    await userEvent.keyboard('{Escape}');
    await settle(text);
    expect([text.value, seen]).toEqual(['Ada', [false]]);
  });

  it('sets the glyph in from the start edge, lets the pointer through to the field, and dims it when disabled', async () => {
    const { el, control, part } = await mount(
      '<odd-input label="Search" type="search"></odd-input>',
    );
    const icon = part('icon').getBoundingClientRect();
    const box = control.getBoundingClientRect();
    expect(icon.left - box.left).toBeCloseTo(
      parseFloat(themeValue('padding-left', '--odd-control-padding-inline-md')),
    );
    expect(
      el.shadowRoot!.elementFromPoint(icon.left + icon.width / 2, icon.top + icon.height / 2),
    ).toBe(control);
    el.disabled = true;
    await settle(el);
    expect(getComputedStyle(part('icon')).color).toBe(
      themeValue('color', '--odd-color-text-disabled'),
    );
  });

  it('draws the clear button as a quiet round target around its centred glyph', async () => {
    const { part } = await mount(
      '<odd-input label="Search" type="search" value="design"></odd-input>',
    );
    const clear = part('clear');
    const style = getComputedStyle(clear);
    expect(style.borderTopWidth).toBe('0px');
    expect(style.borderTopLeftRadius).toBe(
      themeValue('border-top-left-radius', '--odd-radius-full'),
    );
    expect(style.color).toBe(themeValue('color', '--odd-color-text-secondary'));
    expect(parseFloat(style.marginTop)).toBeCloseTo((parseFloat(style.fontSize) - 24) / 2);
    const glyph = clear.querySelector('svg')!.getBoundingClientRect();
    const box = clear.getBoundingClientRect();
    expect(glyph.left + glyph.width / 2).toBeCloseTo(box.left + box.width / 2, 0);
    expect(glyph.top + glyph.height / 2).toBeCloseTo(box.top + box.height / 2, 0);
    await userEvent.hover(clear);
    expect(getComputedStyle(clear).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-hover'),
    );
    expect(getComputedStyle(clear).color).toBe(themeValue('color', '--odd-color-text-primary'));
    await userEvent.unhover(document.body);
  });

  it('pads the text clear of the glyph and the button, mirrored right to left', async () => {
    const { control, part } = await mount(
      '<odd-input label="Search" type="search" value="design" style="inline-size: 20rem"></odd-input><odd-input label="Search" type="search" value="design" dir="rtl" style="inline-size: 20rem"></odd-input>',
    );
    const rtl = container.querySelectorAll('odd-input')[1]!;
    await settle(rtl as OddkinInput);
    const rtlPart = (name: string) =>
      rtl.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
    const box = control.getBoundingClientRect();
    const style = getComputedStyle(control);
    expect(part('icon').getBoundingClientRect().right).toBeLessThanOrEqual(
      box.left + parseFloat(style.paddingLeft),
    );
    expect(part('clear').getBoundingClientRect().left).toBeGreaterThanOrEqual(
      box.right - parseFloat(style.paddingRight) - 6,
    );
    expect(rtlPart('icon').getBoundingClientRect().left).toBeGreaterThan(
      rtlPart('clear').getBoundingClientRect().right,
    );
  });
});
