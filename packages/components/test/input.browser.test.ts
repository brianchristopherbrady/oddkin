import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinInput } from '../src/input/input.js';

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
        'OddkinInput',
        'changeEvent',
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
