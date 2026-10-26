import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
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

  it('reports the same validity and messages as a native number field', async () => {
    const { el, native, flags } = await pair('type="number" min="1" max="50" step="2" required');
    for (const value of ['60', '0', '4', '5', '']) {
      el.value = value;
      native.value = value;
      await settle(el);
      expect([value, flags(el.validity), el.validationMessage]).toEqual([
        value,
        flags(native.validity),
        native.validationMessage,
      ]);
    }
    // A changed bound re-checks the same value.
    el.value = '41';
    native.value = '41';
    await settle(el);
    expect(el.validity.valid).toBe(true);
    el.max = '30';
    native.max = '30';
    await settle(el);
    expect(flags(el.validity)).toEqual(flags(native.validity));
    expect(el.validity.rangeOverflow).toBe(true);
    // Read-only and disabled fields are barred: their range is not a failure.
    for (const bar of ['readonly', 'disabled']) {
      el.setAttribute(bar, '');
      await settle(el);
      expect([bar, el.validity.valid]).toEqual([bar, true]);
      el.removeAttribute(bar);
      await settle(el);
    }
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

  it('forwards the host text-entry hints to the inner input', async () => {
    const { el, control } = await mount(
      '<odd-input label="Code" inputmode="numeric" enterkeyhint="next" autocapitalize="characters" autocorrect="off" spellcheck="false"></odd-input>',
    );
    expect(
      ['inputmode', 'enterkeyhint', 'autocapitalize', 'autocorrect', 'spellcheck'].map((name) =>
        control.getAttribute(name),
      ),
    ).toEqual(['numeric', 'next', 'characters', 'off', 'false']);
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

describe('number', () => {
  let unload: () => void;
  beforeAll(async () => {
    unload = await loadTheme();
  });
  afterAll(() => unload());

  /** An odd-input number field and a native one with the same attributes, in one form. */
  async function pair(attributes: string) {
    const { el, control, part } = await mount(
      `<form><odd-input label="Seats" name="a" type="number" ${attributes}></odd-input><input name="b" type="number" ${attributes} /></form>`,
    );
    const native = container.querySelector<HTMLInputElement>('input[name="b"]')!;
    const events: string[] = [];
    for (const target of [el, native])
      for (const type of ['input', 'change'])
        target.addEventListener(type, () =>
          events.push(`${target === el ? 'odd' : 'native'} ${type}:${target.value}`),
        );
    // Each side's events, without the prefix, to compare the two.
    const side = (name: string) =>
      events.filter((e) => e.startsWith(name)).map((e) => e.slice(name.length + 1));
    return { el, control, part, native, events, side };
  }

  it('is a spinbutton named by its label, with its value, bounds, and a decimal keyboard', async () => {
    const { el, control } = await mount(
      '<odd-input label="Seats" type="number" min="1" max="50" value="12"></odd-input>',
    );
    expect(page.getByRole('spinbutton', { name: 'Seats', exact: true }).element()).toBe(control);
    const aria = () =>
      [
        'type',
        'inputmode',
        'aria-valuenow',
        'aria-valuetext',
        'aria-valuemin',
        'aria-valuemax',
      ].map((name) => control.getAttribute(name));
    expect(aria()).toEqual(['text', 'decimal', '12', null, '1', '50']);
    // The text is not the plain number: the number and the text are both given.
    el.value = '1e1';
    el.min = undefined;
    await settle(el);
    expect(aria()).toEqual(['text', 'decimal', '10', '1e1', null, '50']);
    el.value = '';
    el.setAttribute('inputmode', 'numeric');
    await new Promise((resolve) => setTimeout(resolve));
    await settle(el);
    expect(aria()).toEqual(['text', 'numeric', null, null, null, '50']);
  });

  it('sanitizes the value, valueAsNumber, and the submission as a native number field', async () => {
    const { el, native } = await pair('value="7"');
    const form = container.querySelector('form')!;
    expect([el.value, el.valueAsNumber]).toEqual([native.value, native.valueAsNumber]);
    for (const value of ['12', '1e3', '-.5', '01', '1.', 'abc', '+1', ' 1', '1,5', '1e400', '']) {
      el.value = value;
      native.value = value;
      await settle(el);
      expect([value, el.value, el.valueAsNumber]).toEqual([
        value,
        native.value,
        native.valueAsNumber,
      ]);
      expect([...new FormData(form)].map(([, v]) => v)).toEqual([native.value, native.value]);
      expect(el.validity.badInput).toBe(false);
    }
    for (const number of [2.5, Number.NaN, -0.25]) {
      el.valueAsNumber = number;
      native.valueAsNumber = number;
      expect([number, el.value]).toEqual([number, native.value]);
    }
    expect(() => (el.valueAsNumber = Infinity)).toThrow(TypeError);
    // A default that is not a number is no value and no bad input, and the field shows nothing.
    el.setAttribute('value', 'abc');
    native.setAttribute('value', 'abc');
    form.reset();
    await settle(el);
    expect([el.value, el.shadowRoot!.querySelector('input')!.value, el.validity.badInput]).toEqual([
      native.value,
      '',
      false,
    ]);
    // Other types answer as their native input does.
    el.type = 'date';
    el.value = '2026-10-26';
    native.type = 'date';
    native.value = '2026-10-26';
    expect(el.valueAsNumber).toEqual(native.valueAsNumber);
  });

  it('typed text that is not a number is bad input, as native: the value is empty and the text stays', async () => {
    const { el, control, native } = await pair('');
    const form = container.querySelector('form')!;
    // Every engine lets 'e' (an exponent) into a number field, so both sides hold "1e".
    await userEvent.click(control);
    await userEvent.keyboard('1e');
    await userEvent.click(native);
    await userEvent.keyboard('1e');
    await settle(el);
    expect([control.value, el.value, native.value]).toEqual(['1e', '', '']);
    expect([el.validity.badInput, native.validity.badInput]).toEqual([true, true]);
    expect(el.validationMessage).toBe('Enter a number.');
    expect([...new FormData(form)]).toEqual([
      ['a', ''],
      ['b', ''],
    ]);
    el.strings = { badInput: 'Saisissez un nombre.' };
    await settle(el);
    expect(el.validationMessage).toBe('Saisissez un nombre.');
    // Barred while read-only or disabled, as the native field is.
    for (const bar of ['readonly', 'disabled']) {
      el.setAttribute(bar, '');
      await settle(el);
      expect([bar, el.validity.valid]).toEqual([bar, true]);
      el.removeAttribute(bar);
      await settle(el);
    }
    expect(el.validity.badInput).toBe(true);
    // A trailing full stop on the way to decimals is read as the number, as the engines do.
    await userEvent.click(control);
    await userEvent.keyboard('{Backspace}{Backspace}2.');
    await settle(el);
    expect([control.value, el.value, el.validity.badInput]).toEqual(['2.', '2', false]);
    await userEvent.keyboard('{Backspace}{Backspace}x');
    await settle(el);
    expect(el.validity.badInput).toBe(true);
    form.reset();
    await settle(el);
    expect([control.value, el.value, el.validity.badInput]).toEqual(['', '', false]);
  });

  it('Up and Down step as a native number field, dispatching input and change for each move', async () => {
    const { el, control, native, side } = await pair('min="1" max="50" step="2" value="4"');
    const runs = [
      [control, (value: string) => (el.value = value)],
      [native, (value: string) => (native.value = value)],
    ] as const;
    for (const [field, set] of runs) {
      for (const [start, keys] of [
        // Off the grid (1, 3, 5, …) to the next grid value, then by step.
        ['4', '{ArrowUp}{ArrowUp}{ArrowDown}'],
        // An empty field goes to the first grid value; the highest one (49) goes no further.
        ['', '{ArrowUp}'],
        ['49', '{ArrowUp}{ArrowUp}'],
      ] as const) {
        // Set before focus: Firefox's native field reports a change on blur for a value set while focused.
        set(start);
        await settle(el);
        field.focus();
        await userEvent.keyboard(keys);
        field.blur();
      }
    }
    await settle(el);
    expect(side('odd')).toEqual(side('native'));
    expect(side('odd')).toEqual([
      'input:5',
      'change:5',
      'input:7',
      'change:7',
      'input:5',
      'change:5',
      'input:1',
      'change:1',
    ]);
  });

  it('Page Up and Page Down move ten steps; Home and End go to the ends of the grid when bounded', async () => {
    const { el, control } = await mount(
      '<odd-input label="Seats" type="number" min="1" max="50" step="2" value="11"></odd-input>',
    );
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input:${el.value}`));
    el.addEventListener('change', () => events.push(`change:${el.value}`));
    const seen: boolean[] = [];
    el.addEventListener('keydown', (event) => seen.push(event.defaultPrevented));
    control.focus();
    await userEvent.keyboard('{PageUp}');
    expect(el.value).toBe('31');
    await userEvent.keyboard('{PageDown}{PageDown}{PageDown}');
    expect(el.value).toBe('1');
    // 50 is off the grid: End goes to 49, the highest value on it.
    await userEvent.keyboard('{End}');
    expect(el.value).toBe('49');
    await userEvent.keyboard('{Home}');
    expect(el.value).toBe('1');
    // Already at the lowest value: Home and Down move nothing and dispatch nothing.
    await userEvent.keyboard('{Home}{ArrowDown}');
    expect(events).toEqual([
      'input:31',
      'change:31',
      'input:11',
      'change:11',
      'input:1',
      'change:1',
      'input:49',
      'change:49',
      'input:1',
      'change:1',
    ]);
    expect(seen).toEqual([true, true, true, true, true, true, true, true]);
    // Without bounds, Home and End stay text-editing keys.
    el.min = undefined;
    el.max = undefined;
    await settle(el);
    await userEvent.keyboard('{End}');
    expect(seen.at(-1)).toBe(false);
    // With a modifier, the keys are the platform's (line and document moves).
    await userEvent.keyboard('{Control>}{ArrowUp}{/Control}');
    expect([el.value, seen.at(-1)]).toEqual(['1', false]);
    // Read-only and disabled fields do not step; `step="any"` steps by one, Home and End to the bounds.
    el.readonly = true;
    await settle(el);
    await userEvent.keyboard('{ArrowUp}');
    expect(el.value).toBe('1');
    el.readonly = false;
    el.step = 'any';
    el.value = '1.5';
    await settle(el);
    await userEvent.keyboard('{ArrowUp}');
    expect(el.value).toBe('2.5');
    el.min = '0.25';
    el.max = '9.75';
    await settle(el);
    await userEvent.keyboard('{End}');
    expect(el.value).toBe('9.75');
    await userEvent.keyboard('{ArrowUp}');
    expect(el.value).toBe('9.75');
    await userEvent.keyboard('{Home}');
    expect(el.value).toBe('0.25');
  });

  it('stepUp and stepDown step as native, without events; step="any" has no step', async () => {
    const { el, native, events } = await pair('');
    const cases = [
      // min, max, step, value, n, expected (the HTML stepUp algorithm)
      ['1', '50', '1', '', 1, '1'],
      ['1', '50', '1', '', -1, '1'],
      ['', '', '', '', -1, '-1'],
      ['1', '50', '2', '4', 1, '5'],
      ['1', '50', '2', '4', -1, '3'],
      ['1', '50', '1', '60', -1, '50'],
      ['1', '50', '1', '60', 1, '60'],
      ['1', '50', '1', '-5', 1, '1'],
      ['1', '50', '1', '-5', -1, '-5'],
      ['', '', '0.1', '0.2', 1, '0.3'],
      ['', '', '', '1.5', 1, '2'],
      ['1', '50', '1', '45', 10, '50'],
      ['', '', '0.001', '1', 3, '1.003'],
      // A step JavaScript writes with an exponent.
      ['', '', '1e-7', '1', 3, '1.0000003'],
      // Crossed bounds leave the value; a step that is not positive is the default, 1.
      ['10', '5', '', '7', 1, '7'],
      ['10', '5', '', '7', -1, '7'],
      ['', '', '0', '2', 1, '3'],
      ['', '', '-1', '2', -1, '1'],
    ] as const;
    for (const [min, max, step, value, n, expected] of cases) {
      el.min = min || undefined;
      el.max = max || undefined;
      el.step = step || undefined;
      el.value = value;
      Object.assign(native, { min, max, step, value });
      if (n > 0) {
        el.stepUp(n);
        native.stepUp(n);
      } else {
        el.stepDown(-n);
        native.stepDown(-n);
      }
      expect([min, max, step, value, n, el.value]).toEqual([min, max, step, value, n, expected]);
      // WebKit leaves an empty field empty on stepDown; the other engines agree with the algorithm.
      if (value !== '' || n > 0 || server.browser !== 'webkit') {
        expect([min, max, step, value, n, el.value]).toEqual([
          min,
          max,
          step,
          value,
          n,
          native.value,
        ]);
      }
    }
    expect(events).toEqual([]);
    // One step by default, from a grid that starts at the default value when there is no minimum.
    Object.assign(el, { min: undefined, max: undefined, step: '1' });
    Object.assign(native, { min: '', max: '', step: '1' });
    for (const field of [el, native]) {
      field.setAttribute('value', '0.5');
      field.value = '2.5';
      field.stepUp();
    }
    expect([el.value, native.value]).toEqual(['3.5', '3.5']);
    el.stepDown();
    expect(el.value).toBe('2.5');
    el.step = 'ANY';
    native.step = 'ANY';
    expect(() => native.stepUp()).toThrow(DOMException);
    expect(() => el.stepUp()).toThrow(expect.objectContaining({ name: 'InvalidStateError' }));
    // Other types step through their native input (an engine without one throws, as natively).
    Object.assign(el, { type: 'date', step: undefined, value: '2026-10-26' });
    Object.assign(native, { type: 'date', step: '', value: '2026-10-26' });
    const date = (field: { stepUp(n?: number): void; value: string }) => {
      try {
        field.stepUp(2);
        return field.value;
      } catch (error) {
        return (error as Error).name;
      }
    };
    expect(date(el)).toBe(date(native));
    el.type = 'text';
    expect(() => el.stepUp()).toThrow(expect.objectContaining({ name: 'InvalidStateError' }));
  });

  it('the stepper buttons step and keep focus in the field; they are not Tab stops and are disabled where they cannot move', async () => {
    const { el, control, part } = await mount(
      '<odd-input label="Seats" type="number" min="1" max="3" value="2"></odd-input><button>after</button>',
    );
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input:${el.value}`));
    el.addEventListener('change', () => events.push(`change:${el.value}`));
    const [down, up] = [
      part('decrement') as HTMLButtonElement,
      part('increment') as HTMLButtonElement,
    ];
    expect([down.getAttribute('aria-label'), up.getAttribute('aria-label')]).toEqual([
      'Decrease value',
      'Increase value',
    ]);
    expect([down.tabIndex, up.tabIndex, down.type]).toEqual([-1, -1, 'button']);
    control.focus();
    let blurs = 0;
    control.addEventListener('blur', () => blurs++);
    await userEvent.click(up);
    await settle(el);
    expect([el.value, control.value, el.shadowRoot!.activeElement, blurs]).toEqual([
      '3',
      '3',
      control,
      0,
    ]);
    expect([down.disabled, up.disabled]).toEqual([false, true]);
    await userEvent.click(down);
    await userEvent.click(down);
    await settle(el);
    expect([el.value, down.disabled, up.disabled]).toEqual(['1', true, false]);
    expect(events).toEqual(['input:3', 'change:3', 'input:2', 'change:2', 'input:1', 'change:1']);
    // From outside the field, a press steps and moves focus into it.
    control.blur();
    await userEvent.click(up);
    expect([el.value, el.shadowRoot!.activeElement]).toEqual(['2', control]);
    // Tab leaves the field without stopping on the buttons.
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(container.querySelector('button'));
    for (const bar of ['readonly', 'disabled']) {
      el.setAttribute(bar, '');
      await settle(el);
      expect([bar, down.disabled, up.disabled]).toEqual([bar, true, true]);
      el.removeAttribute(bar);
      await settle(el);
    }
    el.strings = { decrement: 'Moins', increment: 'Plus' };
    await settle(el);
    expect([down.getAttribute('aria-label'), up.getAttribute('aria-label')]).toEqual([
      'Moins',
      'Plus',
    ]);
  });

  it('draws the stepper as a sunken segment inside the border at the end, two control heights wide, mirrored right to left', async () => {
    const { el, control, part } = await mount(
      '<odd-input label="Seats" type="number" min="1" value="1" style="inline-size: 16rem"></odd-input><odd-input label="Seats" type="number" value="1" dir="rtl" style="inline-size: 16rem"></odd-input>',
    );
    const stepper = part('stepper');
    const border = parseFloat(themeValue('padding-top', '--odd-border-width-default'));
    const height = parseFloat(themeValue('padding-top', '--odd-control-height-md'));
    const box = control.getBoundingClientRect();
    const segment = stepper.getBoundingClientRect();
    expect(getComputedStyle(stepper).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-sunken'),
    );
    expect(segment.right).toBeCloseTo(box.right - border);
    expect(segment.top).toBeCloseTo(box.top + border);
    expect(segment.bottom).toBeCloseTo(box.bottom - border);
    expect(segment.width).toBeCloseTo(2 * height);
    for (const name of ['decrement', 'increment']) {
      const button = part(name).getBoundingClientRect();
      const glyph = part(name).querySelector('svg')!.getBoundingClientRect();
      expect([name, button.width]).toEqual([name, height]);
      expect(button.height).toBeCloseTo(box.height - 2 * border);
      expect(glyph.left + glyph.width / 2).toBeCloseTo(button.left + button.width / 2, 0);
      expect(glyph.top + glyph.height / 2).toBeCloseTo(button.top + button.height / 2, 0);
    }
    // The text stops space.xs before the segment.
    expect(box.right - parseFloat(getComputedStyle(control).paddingRight)).toBeCloseTo(
      segment.left - parseFloat(themeValue('padding-top', '--odd-space-xs')),
    );
    expect(getComputedStyle(part('decrement')).color).toBe(
      themeValue('color', '--odd-color-text-disabled'),
    );
    expect(getComputedStyle(part('decrement')).cursor).toBe('not-allowed');
    expect(getComputedStyle(part('increment')).color).toBe(
      themeValue('color', '--odd-color-text-primary'),
    );
    // The segment's end corners follow the field's, clipping its buttons: the button is not hit
    // there. WebKit's hit testing does not apply a rounded overflow clip to descendants.
    const radius = parseFloat(getComputedStyle(stepper).borderStartEndRadius);
    expect(radius).toBeGreaterThan(2);
    for (const y of [segment.top + 0.5, segment.bottom - 0.5]) {
      if (server.browser !== 'webkit')
        expect(el.shadowRoot!.elementFromPoint(segment.right - 0.5, y)).not.toBe(part('increment'));
      expect(el.shadowRoot!.elementFromPoint(segment.right - radius - 1, y)).toBe(
        part('increment'),
      );
    }
    await userEvent.hover(part('increment'));
    expect(getComputedStyle(part('increment')).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-hover'),
    );
    await userEvent.unhover(document.body);
    const rtl = container.querySelectorAll('odd-input')[1] as OddkinInput;
    await settle(rtl);
    const rtlBox = rtl.shadowRoot!.querySelector('input')!.getBoundingClientRect();
    const rtlSegment = rtl.shadowRoot!.querySelector('[part="stepper"]')!.getBoundingClientRect();
    expect(rtlSegment.left).toBeCloseTo(rtlBox.left + border);
    el.disabled = true;
    await settle(el);
    expect(getComputedStyle(part('increment')).color).toBe(
      themeValue('color', '--odd-color-text-disabled'),
    );
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the stepper glyphs visible in forced colours, the unavailable one in GrayText',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { part } = await mount(
          '<odd-input label="Seats" type="number" min="1" value="1"></odd-input>',
        );
        expect(matchMedia('(forced-colors: active)').matches).toBe(true);
        const probe = document.createElement('span');
        container.append(probe);
        const system = (color: string) => {
          probe.style.color = color;
          return getComputedStyle(probe).color;
        };
        const stroke = (name: string) => getComputedStyle(part(name).querySelector('svg')!).color;
        expect(stroke('increment')).toBe(system('ButtonText'));
        expect(stroke('decrement')).toBe(system('GrayText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );
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
