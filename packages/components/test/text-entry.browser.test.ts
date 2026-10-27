import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import '../src/input/input.define.js';
import '../src/textarea/textarea.define.js';
import '../src/one-time-code/one-time-code.define.js';
import '../src/color-picker/color-picker.define.js';
import { settle } from './probe.js';

// Real-browser text entry: typing and selection as on native fields, input-method composition
// (Chromium, driven through the DevTools protocol), and autofill.

type Host = HTMLElement & { value: string; validity: ValidityState };
type Field = HTMLInputElement | HTMLTextAreaElement;

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

async function mount(markup: string): Promise<{ el: Host; control: Field }> {
  container.innerHTML = markup;
  const el = container.firstElementChild as Host;
  await settle(el);
  return { el, control: el.shadowRoot!.querySelector<Field>('[part~="control"]')! };
}

// Each input and change event as the page sees it at `host`: the kind of edit and the value then.
function listen(host: Host): string[] {
  const log: string[] = [];
  host.addEventListener('input', (e) =>
    log.push(`input ${(e as InputEvent).inputType ?? ''} ${JSON.stringify(host.value)}`),
  );
  host.addEventListener('change', () => log.push(`change ${JSON.stringify(host.value)}`));
  return log;
}

async function typeInto(host: Host, field: Field, keys: string): Promise<string[]> {
  const log = listen(host);
  await userEvent.click(field);
  await userEvent.keyboard(keys);
  field.blur();
  await settle(host);
  return log;
}

describe('typing', () => {
  const cases: [type: string, keys: string][] = [
    ['text', 'Ab c{Backspace}d'],
    ['email', ' ada@x.io '],
    ['url', 'https://x.io'],
    ['tel', '+1 555'],
    ['search', 'find{Backspace}'],
    ['password', 'pw 1'],
    ['number', '-1.5e2{Backspace}'],
  ];
  for (const [type, keys] of cases) {
    it(`odd-input type="${type}" reports each edit and the value then, as the native input`, async () => {
      const { el, control } = await mount(`<odd-input label="Field" type="${type}"></odd-input>`);
      const native = document.createElement('input');
      native.type = type;
      container.append(native);
      const ours = await typeInto(el, control, keys);
      expect(ours).toEqual(await typeInto(native as unknown as Host, native, keys));
    });
  }

  it('odd-textarea reports each edit and the value then, as the native textarea', async () => {
    const { el, control } = await mount('<odd-textarea label="Field"></odd-textarea>');
    const native = document.createElement('textarea');
    container.append(native);
    const keys = 'one{Enter}two{Backspace}';
    const ours = await typeInto(el, control, keys);
    expect(ours).toEqual(await typeInto(native as unknown as Host, native, keys));
  });

  it('a number field reports a change of its value, not of its text, as the native number field', async () => {
    const { el, control } = await mount(
      '<odd-input label="Field" type="number" value="5"></odd-input>',
    );
    const native = document.createElement('input');
    native.type = 'number';
    native.value = '5';
    container.append(native);
    // Firefox's native step is an `insertReplacementText` edit; Chromium's and WebKit's, as
    // Oddkin's, carry no input type.
    const run = async (host: Host, field: Field) =>
      [
        ...(await typeInto(host, field, '.')),
        '|',
        ...(await typeInto(host, field, '{ArrowUp}.')),
        '|',
        ...(await typeInto(host, field, '{Backspace}{Backspace}7{Enter}.')),
      ].map((entry) => entry.replace('input insertReplacementText ', 'input  '));
    expect(await run(el, control)).toEqual(await run(native as unknown as Host, native));
  });

  it('a number field reads full-width digits as the native number field', async () => {
    const { el, control } = await mount('<odd-input label="Field" type="number"></odd-input>');
    const native = document.createElement('input');
    native.type = 'number';
    container.append(native);
    for (const field of [control, native]) {
      await userEvent.click(field);
      await userEvent.keyboard('１２．５');
    }
    await settle(el);
    expect({ engine: server.browser, value: el.value }).toEqual({
      engine: server.browser,
      value: native.value,
    });
  });
});

describe('caret and selection', () => {
  const at = (field: Field) => [
    field.value,
    field.selectionStart,
    field.selectionEnd,
    field.selectionDirection,
  ];

  // Typing, a re-render, the same value set again, and typing over a selection.
  async function edit(host: Host, field: Field, rerender: () => void): Promise<unknown[]> {
    const log: unknown[] = [];
    await userEvent.click(field);
    await userEvent.keyboard('abcdef');
    field.setSelectionRange(1, 4, 'backward');
    rerender();
    await settle(host);
    log.push(at(field));
    host.value = host.value;
    await settle(host);
    log.push(at(field));
    await userEvent.keyboard('X');
    await settle(host);
    log.push(at(field), host.value);
    return log;
  }

  for (const [tag, nativeTag] of [
    ['odd-input', 'input'],
    ['odd-textarea', 'textarea'],
  ] as const) {
    it(`${tag} keeps the caret and selection through re-renders, as native, and through a new value`, async () => {
      const { el, control } = await mount(`<${tag} label="Field"></${tag}>`);
      const native = document.createElement(nativeTag);
      container.append(native);
      const ours = await edit(el, control, () => {
        el.setAttribute('error', 'Check this.');
        el.setAttribute('placeholder', 'Type here');
      });
      expect(ours).toEqual(
        await edit(native as unknown as Host, native, () =>
          native.setAttribute('placeholder', 'Type here'),
        ),
      );
      // A value set while the field has focus keeps the caret where it was (`live()`); a native
      // field moves it to the end.
      control.focus();
      control.setSelectionRange(2, 2);
      el.value = 'xyz';
      await settle(el);
      expect([control.value, control.selectionStart, control.selectionEnd]).toEqual(['xyz', 2, 2]);
    });
  }

  it('a number field keeps text it cannot hold yet, and its caret, through a re-render', async () => {
    const { el, control } = await mount('<odd-input label="Field" type="number"></odd-input>');
    await userEvent.click(control);
    await userEvent.keyboard('1.');
    el.setAttribute('error', 'Check this.');
    await settle(el);
    expect([control.value, control.selectionStart, el.value]).toEqual(['1.', 2, '1']);
    await userEvent.keyboard('5');
    await settle(el);
    expect([control.value, el.value]).toEqual(['1.5', '1.5']);
  });

  it('the colour picker field keeps its caret while typing and through a re-render; Enter commits', async () => {
    const { el, control } = await mount(
      '<odd-color-picker label="Colour" value="#2563eb"></odd-color-picker>',
    );
    const log = listen(el);
    await userEvent.click(control);
    control.setSelectionRange(1, 7);
    await userEvent.keyboard('ab');
    await settle(el);
    expect([control.value, control.selectionStart, el.value]).toEqual(['#ab', 3, '#2563eb']);
    control.setSelectionRange(1, 2);
    el.setAttribute('label', 'Accent');
    await settle(el);
    expect([control.value, control.selectionStart, control.selectionEnd]).toEqual(['#ab', 1, 2]);
    control.setSelectionRange(3, 3);
    await userEvent.keyboard('c{Enter}');
    await settle(el);
    expect([el.value, log]).toEqual(['#aabbcc', ['input  "#aabbcc"', 'change "#aabbcc"']]);
  });

  it('the colour picker field and its popup take full-width hex', async () => {
    const { el, control } = await mount(
      '<odd-color-picker label="Colour" value="#2563eb" alpha></odd-color-picker>',
    );
    await userEvent.click(control);
    control.select();
    await userEvent.keyboard('＃ａｂｃ{Enter}');
    await settle(el);
    expect(el.value).toBe('color(srgb 0.666667 0.733333 0.8)');
    el.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!.click();
    await settle(el);
    const hex = el.shadowRoot!.querySelector<HTMLInputElement>('[part~="hex"]')!;
    const opacity = el.shadowRoot!.querySelector<HTMLInputElement>('[part~="opacity"]')!;
    await userEvent.click(hex);
    hex.select();
    await userEvent.keyboard('１２３');
    await userEvent.click(opacity);
    opacity.select();
    await userEvent.keyboard('５０');
    await settle(el);
    el.shadowRoot!.querySelector<HTMLElement>('[part~="apply"]')!.click();
    await settle(el);
    expect(el.value).toBe('color(srgb 0.066667 0.133333 0.2 / 0.5)');
  });

  it('odd-textarea reads line breaks as the native textarea, in the value and in the form', async () => {
    container.innerHTML = `<form><odd-textarea label="Field" name="ours"></odd-textarea><textarea name="native"></textarea></form>`;
    const form = container.querySelector('form')!;
    const el = form.firstElementChild as Host;
    const native = form.lastElementChild as HTMLTextAreaElement;
    await settle(el);
    for (const field of [el, native]) field.value = 'a\r\nb\rc\nd';
    await settle(el);
    const data = new FormData(form);
    expect([el.value, data.get('ours')]).toEqual([native.value, data.get('native')]);
  });

  it('the one-time code takes full-width digits and keeps its caret at the end through script sets', async () => {
    const { el, control } = await mount('<odd-one-time-code label="Code"></odd-one-time-code>');
    await userEvent.click(control);
    await userEvent.keyboard('１２a3');
    await settle(el);
    expect([el.value, control.value]).toEqual(['123', '123']);
    el.value = '1234';
    await settle(el);
    expect([control.value, control.selectionStart, control.selectionEnd]).toEqual(['1234', 4, 4]);
    el.setAttribute('label', 'Verification code');
    await settle(el);
    expect([control.selectionStart, control.selectionEnd]).toEqual([4, 4]);
  });
});

describe.runIf(server.browser === 'chromium')('input-method composition (Chromium)', () => {
  // Chromium's input method through the DevTools protocol: the composition so far, then the
  // text it commits. Firefox and WebKit have no driver for it.
  const composing = (text: string) =>
    cdp().send('Input.imeSetComposition', {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
  const commit = (text: string) => cdp().send('Input.insertText', { text });
  const key = async (key: string, code: number) => {
    for (const type of ['rawKeyDown', 'keyUp'] as const)
      await cdp().send('Input.dispatchKeyEvent', {
        type,
        key,
        code: key,
        windowsVirtualKeyCode: code,
      });
  };

  it('odd-input takes composed text as the native input does, and commits nothing before it ends', async () => {
    for (const [type, steps, text] of [
      ['text', ['に', 'にほ'], '日本'],
      ['number', ['１', '１２'], '１２'],
    ] as const) {
      container.innerHTML = `<odd-input label="Field" type="${type}"></odd-input><input type="${type}">`;
      const el = container.firstElementChild as Host;
      await settle(el);
      const control = el.shadowRoot!.querySelector('input')!;
      const native = container.lastElementChild as HTMLInputElement;
      const results: unknown[] = [];
      for (const [host, field] of [
        [el, control],
        [native as unknown as Host, native],
      ] as const) {
        const changes: string[] = [];
        host.addEventListener('change', () => changes.push(host.value));
        field.focus();
        for (const step of steps) await composing(step);
        await commit(text);
        await settle(el);
        results.push([host.value, changes.length]);
      }
      expect([type, results[0]]).toEqual([type, results[1]]);
    }
  });

  it('keys an input method composes with are its own: no stepping, no clearing, no caret lock', async () => {
    container.innerHTML = `<odd-input label="Count" type="number" value="5"></odd-input>
      <odd-input label="Find" type="search" value="abc"></odd-input>
      <odd-one-time-code label="Code"></odd-one-time-code>
      <odd-color-picker label="Colour" alpha value="color(srgb 0 0 0 / 0.5)"></odd-color-picker>`;
    const [count, find, code, picker] = [...container.children] as Host[];
    for (const el of [count, find, code, picker]) await settle(el!);
    const control = (el: Host) => el.shadowRoot!.querySelector('input')!;
    const keys: string[] = [];
    container.addEventListener('keydown', (e) =>
      keys.push(`${e.key} ${e.isComposing} ${e.defaultPrevented}`),
    );

    control(count!).focus();
    await composing('１');
    await key('ArrowUp', 38);
    await commit('１');
    await settle(count!);
    expect([count!.value, control(count!).value]).toEqual(['51', '5１']);

    control(find!).focus();
    await composing('に');
    await key('Escape', 27);
    await settle(find!);
    expect(find!.value).not.toBe('');

    control(code!).focus();
    await composing('１');
    await key('ArrowLeft', 37);
    await commit('１');
    await settle(code!);
    expect(code!.value).toBe('1');

    picker!.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!.click();
    await settle(picker!);
    const opacity = picker!.shadowRoot!.querySelector<HTMLInputElement>('[part~="opacity"]')!;
    opacity.focus();
    opacity.select();
    await composing('７');
    await key('ArrowUp', 38);
    await commit('７０');
    await settle(picker!);
    expect(opacity.value).toBe('７０');
    expect(keys).toEqual([
      'ArrowUp true false',
      'Escape true false',
      'ArrowLeft true false',
      'ArrowUp true false',
    ]);
  });

  it('the one-time code keeps the composition until it ends, then keeps its digits', async () => {
    const { el, control } = await mount('<odd-one-time-code label="Code"></odd-one-time-code>');
    const log = listen(el);
    const filled = () =>
      el.shadowRoot!.querySelectorAll('[part~="cell"][data-state="filled"]').length;
    control.focus();
    await composing('に');
    await settle(el);
    expect([control.value, el.value, filled(), control.selectionEnd]).toEqual(['に', '', 0, 1]);
    await composing('１');
    await settle(el);
    expect([control.value, el.value, filled()]).toEqual(['１', '1', 1]);
    await commit('１２');
    await settle(el);
    expect([control.value, el.value]).toEqual(['12', '12']);
    expect(log.at(-1)).toBe('input insertCompositionText "12"');
    await composing('３４５６７８');
    await commit('３４５６７８');
    await settle(el);
    expect([control.value, el.value, filled()]).toEqual(['123456', '123456', 6]);
  });

  it('the colour picker field commits composed full-width hex only on Enter', async () => {
    const { el, control } = await mount(
      '<odd-color-picker label="Colour" value="#2563eb"></odd-color-picker>',
    );
    const log = listen(el);
    control.focus();
    control.select();
    await composing('＃');
    await composing('＃ａｂ');
    await commit('＃ａｂｃ');
    await settle(el);
    expect([el.value, el.validity.valid, log]).toEqual(['#2563eb', true, []]);
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(el.value).toBe('#aabbcc');
  });
});

describe('autofill', () => {
  // What autofill does to a field: sets its value, then fires input (composed) and change.
  function autofill(field: Field, text: string): void {
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('forwards each autofill hint to the native field', async () => {
    container.innerHTML = `<odd-input label="Email" autocomplete="email"></odd-input>
      <odd-textarea label="Address" autocomplete="street-address"></odd-textarea>
      <odd-one-time-code label="Code"></odd-one-time-code>
      <odd-one-time-code label="Code" autocomplete="off"></odd-one-time-code>
      <odd-color-picker label="Colour"></odd-color-picker>`;
    const hosts = [...container.children] as Host[];
    for (const el of hosts) await settle(el);
    expect(
      hosts.map((el) =>
        el.shadowRoot!.querySelector('[part~="control"]')!.getAttribute('autocomplete'),
      ),
    ).toEqual(['email', 'street-address', 'one-time-code', 'off', 'off']);
  });

  it('an autofilled value reaches the value, validity, events, and the form', async () => {
    container.innerHTML = `<form>
      <odd-input label="Email" name="email" type="email" autocomplete="email" required></odd-input>
      <odd-input label="Quantity" name="quantity" type="number" required></odd-input>
      <odd-textarea label="Address" name="address" autocomplete="street-address" required></odd-textarea>
      <odd-one-time-code label="Code" name="code" required></odd-one-time-code>
      <odd-color-picker label="Colour" name="colour" value="#2563eb"></odd-color-picker>
    </form>`;
    const form = container.querySelector('form')!;
    const hosts = [...form.children] as Host[];
    for (const el of hosts) await settle(el);
    expect(hosts.map((el) => el.validity.valid)).toEqual([false, false, false, false, true]);
    const fills = ['ada@example.com', '42', 'Line 1\nLine 2', '123 4567', '#abcdef'];
    const logs = hosts.map((el, i) => {
      const log = listen(el);
      autofill(el.shadowRoot!.querySelector<Field>('[part~="control"]')!, fills[i]!);
      return log;
    });
    for (const el of hosts) await settle(el);
    expect(hosts.map((el) => [el.value, el.validity.valid])).toEqual([
      ['ada@example.com', true],
      ['42', true],
      ['Line 1\nLine 2', true],
      ['123456', true],
      ['#abcdef', true],
    ]);
    expect(logs.map((log) => log.map((entry) => entry.split(' ')[0]))).toEqual(
      hosts.map(() => ['input', 'change']),
    );
    expect([...new FormData(form)]).toEqual([
      ['email', 'ada@example.com'],
      ['quantity', '42'],
      ['address', 'Line 1\nLine 2'],
      ['code', '123456'],
      ['colour', '#abcdef'],
    ]);
  });

  it('reports :autofill support; no element styles autofill, so the engine shows its own', async () => {
    container.innerHTML = `<odd-input label="A"></odd-input><odd-textarea label="B"></odd-textarea>
      <odd-one-time-code label="C"></odd-one-time-code><odd-color-picker label="D"></odd-color-picker>`;
    const hosts = [...container.children] as Host[];
    for (const el of hosts) await settle(el);
    const rules = hosts.flatMap((el) =>
      [
        ...el.shadowRoot!.adoptedStyleSheets,
        ...[...el.shadowRoot!.querySelectorAll('style')].map((style) => style.sheet!),
      ].flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText)),
    );
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.filter((rule) => /autofill/i.test(rule))).toEqual([]);
    expect({
      engine: server.browser,
      autofill: CSS.supports('selector(:autofill)'),
      webkitAutofill: CSS.supports('selector(:-webkit-autofill)'),
    }).toEqual({ engine: server.browser, autofill: true, webkitAutofill: true });
  });
});
