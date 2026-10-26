import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinOneTimeCode } from '../src/one-time-code/one-time-code.js';
import { loadTheme, themeValue } from './probe.js';

let container: HTMLElement;
beforeAll(async () => {
  await loadTheme();
  await import('../src/one-time-code/one-time-code.define.js');
});
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  container.remove();
  flush();
  await userEvent.unhover(document.body);
});

const settle = async (el: { updateComplete: Promise<void> }) => {
  await el.updateComplete;
  flush();
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
};

async function mount(markup: string) {
  container.innerHTML = markup;
  const code = container.querySelector('odd-one-time-code') as OddkinOneTimeCode;
  await settle(code);
  const part = (name: string) => code.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  const input = code.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const cells = () => [...code.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
  const digits = () => cells().map((cell) => cell.textContent);
  return { code, part, input, cells, digits, form: container.querySelector('form') };
}

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/one-time-code/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'ONE_TIME_CODE_STRINGS',
        'OddkinOneTimeCode',
        'changeEvent',
        'fieldStructuralStyles',
        'glyphStyles',
        'hostStyles',
        'inputEvent',
        'oneTimeCodeStructuralStyles',
        'oneTimeCodeTemplate',
        'spinnerStyles',
      ].sort(),
    );
    const index = await import('../src/one-time-code/index.js');
    expect(Object.keys(index)).toContain('oneTimeCodeDefinition');
  });
});

describe('odd-one-time-code', () => {
  it('is one text input with the one-time-code autofill hint over six hidden cells', async () => {
    const { input, cells, part } = await mount(
      '<odd-one-time-code label="Verification code" description="Sent to your email."></odd-one-time-code>',
    );
    expect(page.getByRole('textbox', { name: 'Verification code', exact: true }).element()).toBe(
      input,
    );
    expect([
      input.getAttribute('autocomplete'),
      input.inputMode,
      input.maxLength,
      input.minLength,
      input.getAttribute('aria-describedby'),
      input.spellcheck,
      getComputedStyle(input).opacity,
    ]).toEqual(['one-time-code', 'numeric', 6, 6, 'description status', false, '0']);
    expect(cells()).toHaveLength(6);
    expect(cells()[0]!.parentElement!.getAttribute('aria-hidden')).toBe('true');
    expect([part('status').getAttribute('role'), part('status').textContent!.trim()]).toEqual([
      'status',
      'You can paste the entire code.',
    ]);
  });

  it('typing fills the cells with digits only; Backspace removes the last; the caret stays at the end', async () => {
    const { code, input, digits } = await mount(
      '<odd-one-time-code label="Verification code"></odd-one-time-code>',
    );
    const events: string[] = [];
    code.addEventListener('input', () => events.push(code.value));
    await userEvent.click(input);
    await userEvent.keyboard('4a9');
    await userEvent.keyboard('{ArrowLeft}{Home}2');
    expect([code.value, digits()]).toEqual(['492', ['4', '9', '2', '', '', '']]);
    await userEvent.keyboard('{Backspace}');
    expect(code.value).toBe('49');
    // A click at the start puts the caret after the last digit.
    await userEvent.click(input, { position: { x: 2, y: 8 } });
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 2]);
    expect(events).toEqual(['4', '4', '49', '492', '49']);
  });

  it('a pasted code fills every cell, without separators, cut at maxlength', async () => {
    const { code, input, digits } = await mount(
      '<odd-one-time-code label="Verification code"></odd-one-time-code>',
    );
    input.focus();
    // A trusted paste inserts the text and dispatches input; scripts cannot paste, so do the same.
    input.value = '492 816 77';
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertFromPaste' }),
    );
    await settle(code);
    expect([code.value, input.value, digits()]).toEqual([
      '492816',
      '492816',
      ['4', '9', '2', '8', '1', '6'],
    ]);
  });

  it('draws 40 by 48 px cells with the strong border; the active cell carries the focus ring and the caret', async () => {
    const { code, cells, part } = await mount(
      '<button id="before">Before</button><odd-one-time-code label="Verification code" value="49"></odd-one-time-code>',
    );
    const cell = cells()[0]!;
    const box = cell.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([
      parseFloat(themeValue('width', '--odd-control-height-md')),
      parseFloat(themeValue('height', '--odd-control-height-lg')),
    ]);
    expect([
      getComputedStyle(cell).borderTopColor,
      getComputedStyle(cell).borderTopLeftRadius,
      getComputedStyle(cell).backgroundColor,
      getComputedStyle(part('field')).rowGap,
    ]).toEqual([
      themeValue('border-top-color', '--odd-color-border-strong'),
      themeValue('border-top-left-radius', '--odd-control-radius'),
      themeValue('background-color', '--odd-color-surface-default'),
      themeValue('row-gap', '--odd-space-sm'),
    ]);
    const caret = () => code.shadowRoot!.querySelector<HTMLElement>('.caret')!;
    expect([cells()[2]!.hasAttribute('data-active'), getComputedStyle(caret()).display]).toEqual([
      true,
      'none',
    ]);
    container.querySelector<HTMLButtonElement>('#before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(getComputedStyle(cells()[2]!).outlineColor).toBe(
      themeValue('outline-color', '--odd-color-focus-ring'),
    );
    expect(getComputedStyle(cells()[1]!).outlineStyle).toBe('none');
    expect(caret().parentElement).toBe(cells()[2]);
    expect(getComputedStyle(caret()).display).toBe('block');
    // Tab selected the digits, as in any field: typing replaces them. A full code: the last
    // cell is active, with no caret.
    await userEvent.keyboard('492816');
    expect([code.value, caret(), cells()[5]!.hasAttribute('data-active')]).toEqual([
      '492816',
      null,
      true,
    ]);
    expect(getComputedStyle(cells()[5]!).outlineStyle).toBe('solid');
  });

  it('pending: read-only, sunken cells, a busy line; complete: the success border and a check', async () => {
    const { code, input, cells, part } = await mount(
      '<odd-one-time-code label="Verification code" value="492816"></odd-one-time-code>',
    );
    code.status = 'pending';
    await settle(code);
    expect([input.readOnly, part('status').textContent!.trim()]).toEqual([true, 'Verifying code…']);
    expect(part('status').querySelector('.spinner')).not.toBeNull();
    expect([
      getComputedStyle(cells()[0]!).backgroundColor,
      getComputedStyle(cells()[0]!).color,
    ]).toEqual([
      themeValue('background-color', '--odd-color-surface-sunken'),
      themeValue('color', '--odd-color-text-disabled'),
    ]);
    await userEvent.click(input);
    // Not Backspace: in Playwright's WebKit on Windows, Backspace in any read-only input closes the page.
    await userEvent.keyboard('7');
    expect(code.value).toBe('492816');
    code.status = 'complete';
    await settle(code);
    expect([input.readOnly, part('status').textContent!.trim()]).toEqual([false, 'Code accepted.']);
    const check = part('status').querySelector('svg')!;
    expect(check.getBoundingClientRect().width).toBe(
      parseFloat(themeValue('width', '--odd-icon-size-sm')),
    );
    expect([
      getComputedStyle(cells()[0]!).borderTopColor,
      getComputedStyle(part('status')).color,
    ]).toEqual([
      themeValue('border-top-color', '--odd-color-success-foreground'),
      themeValue('color', '--odd-color-success-foreground'),
    ]);
  });

  it('an error replaces the status line and marks the cells', async () => {
    const { input, cells, part } = await mount(
      '<odd-one-time-code label="Verification code" value="492816" error="That code has expired."></odd-one-time-code>',
    );
    expect([
      part('status').hidden,
      getComputedStyle(part('status')).display,
      part('error').textContent,
      input.getAttribute('aria-describedby'),
    ]).toEqual([true, 'none', 'That code has expired.', 'error']);
    expect(getComputedStyle(cells()[0]!).borderTopColor).toBe(
      themeValue('border-top-color', '--odd-color-danger-foreground'),
    );
  });

  it('dims the label and the cells while disabled', async () => {
    const { input, cells, part } = await mount(
      '<odd-one-time-code label="Verification code" disabled></odd-one-time-code>',
    );
    expect(input.disabled).toBe(true);
    expect([
      getComputedStyle(part('label')).color,
      getComputedStyle(cells()[0]!).backgroundColor,
    ]).toEqual([
      themeValue('color', '--odd-color-text-disabled'),
      themeValue('background-color', '--odd-color-surface-sunken'),
    ]);
  });

  it('maxlength sets the cells; strings change the words', async () => {
    const { code, cells, part } = await mount(
      '<odd-one-time-code label="PIN" maxlength="4"></odd-one-time-code>',
    );
    expect(cells()).toHaveLength(4);
    code.strings = { hint: 'Collez le code.', pending: 'Vérification…' };
    await settle(code);
    expect(part('status').textContent!.trim()).toBe('Collez le code.');
    code.status = 'pending';
    await settle(code);
    expect(part('status').textContent!.trim()).toBe('Vérification…');
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the cells and the active cell visible in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { cells, input } = await mount(
          '<odd-one-time-code label="Verification code" value="4"></odd-one-time-code>',
        );
        expect(matchMedia('(forced-colors: active)').matches).toBe(true);
        input.focus();
        await userEvent.keyboard('9');
        const probe = document.createElement('span');
        probe.style.color = 'CanvasText';
        container.append(probe);
        expect(getComputedStyle(cells()[0]!).borderTopColor).toBe(getComputedStyle(probe).color);
        expect(getComputedStyle(cells()[2]!).outlineStyle).toBe('solid');
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );
});

describe('forms', () => {
  it('validates as a native input with the same constraints: required, then too short after typing', async () => {
    const { code, input, form } = await mount(
      '<form><odd-one-time-code label="Code" name="code" required></odd-one-time-code><input id="native" name="native" required minlength="6" maxlength="6" /></form>',
    );
    const native = form!.querySelector<HTMLInputElement>('#native')!;
    expect([code.validity.valueMissing, code.validationMessage]).toEqual([
      true,
      native.validationMessage,
    ]);
    await userEvent.click(input);
    await userEvent.keyboard('12');
    await userEvent.click(native);
    await userEvent.keyboard('12');
    await settle(code);
    expect([code.validity.tooShort, code.validationMessage]).toEqual([
      native.validity.tooShort,
      native.validationMessage,
    ]);
    await userEvent.click(input);
    await userEvent.keyboard('3456');
    expect([...new FormData(form!)][0]).toEqual(['code', '123456']);
    expect(code.checkValidity()).toBe(true);
    // A shorter code makes it too short again; while the page checks it, it is read-only and barred.
    code.maxLength = 8;
    await settle(code);
    expect(code.validity.tooShort).toBe(true);
    code.status = 'pending';
    await settle(code);
    expect([code.willValidate, code.checkValidity()]).toEqual([true, true]);
    code.status = 'idle';
    await settle(code);
    expect(code.checkValidity()).toBe(false);
    form!.reset();
    await settle(code);
    expect(code.value).toBe('');
  });
});

describe('ownership', () => {
  it('returns to baseline after reconnects', async () => {
    const { code } = await mount(
      '<odd-one-time-code label="Verification code" value="12"></odd-one-time-code>',
    );
    const before = scopeStats();
    for (let i = 0; i < 10; i++) {
      code.remove();
      container.append(code);
      await settle(code);
    }
    expect(scopeStats()).toEqual(before);
  });
});
