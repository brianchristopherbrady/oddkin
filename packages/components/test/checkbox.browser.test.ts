import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinCheckbox } from '../src/checkbox/checkbox.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
afterEach(async () => {
  await userEvent.unhover(document.body);
  container?.remove();
  flush();
});
async function mount(markup: string) {
  container = document.createElement('div');
  container.style.setProperty('--odd-motion-duration-fast', '0s');
  container.innerHTML = markup;
  document.body.append(container);
  const el = container.querySelector('odd-checkbox') as OddkinCheckbox;
  await settle(el);
  const control = el.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const part = (name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  return { el, control, part };
}
const visible = (el: Element) => getComputedStyle(el).visibility === 'visible';

describe('imports', () => {
  it('the foundation and the component entry register nothing', async () => {
    const foundation = await import('../src/checkbox/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'OddkinCheckbox',
        'changeEvent',
        'checkboxStructuralStyles',
        'checkboxTemplate',
        'controlIndicatorStructuralStyles',
        'fieldStructuralStyles',
        'glyphStyles',
        'hostStyles',
        'inputEvent',
      ].sort(),
    );
    const entry = await import('../src/checkbox/index.js');
    expect(Object.keys(entry)).toContain('checkboxDefinition');
  });
});

describe('odd-checkbox', () => {
  it('the slotted text names the native checkbox; description and error describe it', async () => {
    const { el, control, part } = await mount(
      '<odd-checkbox description="At most one a week.">Weekly summary</odd-checkbox>',
    );
    expect(control.type).toBe('checkbox');
    await expect
      .element(page.getByRole('checkbox', { name: 'Weekly summary' }))
      .toBeInTheDocument();
    expect(page.getByRole('checkbox', { name: 'Weekly summary' }).element()).toBe(control);
    expect(control.getAttribute('aria-describedby')).toBe('description');
    el.error = 'Required.';
    await settle(el);
    expect(control.getAttribute('aria-describedby')).toBe('description error');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(part('error').textContent).toBe('Required.');
  });

  it('the checked attribute is the default; setting checked or toggling detaches it', async () => {
    const { el, control } = await mount('<odd-checkbox checked>Updates</odd-checkbox>');
    expect([el.checked, el.defaultChecked, control.checked]).toEqual([true, true, true]);
    el.removeAttribute('checked');
    await settle(el);
    expect([el.checked, control.checked]).toEqual([false, false]);
    el.checked = true;
    await settle(el);
    el.setAttribute('checked', '');
    el.removeAttribute('checked');
    await settle(el);
    expect([el.checked, el.defaultChecked, control.checked]).toEqual([true, false, true]);
  });

  it('keeps checkedness assigned before the element was upgraded', async () => {
    const template = document.createElement('template');
    template.innerHTML = '<odd-checkbox>Late</odd-checkbox>';
    const early = template.content.firstElementChild as HTMLElement & { checked?: boolean };
    early.checked = true;
    container = document.createElement('div');
    container.append(early);
    document.body.append(container);
    const upgraded = early as OddkinCheckbox;
    await settle(upgraded);
    expect(upgraded.checked).toBe(true);
    expect(upgraded.shadowRoot!.querySelector('input')!.checked).toBe(true);
  });

  it('a click on the label toggles, clears the mixed state, and dispatches input then change at the host', async () => {
    const { el, control, part } = await mount(
      '<odd-checkbox indeterminate>All notifications</odd-checkbox>',
    );
    expect(control.indeterminate).toBe(true);
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input:${el.checked}`));
    el.addEventListener('change', (e) => events.push(`change:${e.composed}`));
    await userEvent.click(part('label'));
    await settle(el);
    expect([el.checked, el.indeterminate, el.hasAttribute('indeterminate')]).toEqual([
      true,
      false,
      false,
    ]);
    expect(events).toEqual(['input:true', 'change:false']);
  });

  it('Space toggles from the keyboard; Tab reaches it like a native checkbox', async () => {
    const { el, control } = await mount(
      '<button>before</button><odd-checkbox>Updates</odd-checkbox><input type="checkbox" aria-label="native" />',
    );
    container.querySelector('button')!.focus();
    await userEvent.tab();
    expect(el.shadowRoot!.activeElement).toBe(control);
    await userEvent.keyboard(' ');
    await settle(el);
    expect(el.checked).toBe(true);
    await userEvent.tab();
    expect(document.activeElement).toBe(container.querySelector('input[aria-label="native"]'));
  });

  it('programmatic changes dispatch no events', async () => {
    const { el } = await mount('<odd-checkbox>Updates</odd-checkbox>');
    const events: string[] = [];
    for (const type of ['input', 'change']) el.addEventListener(type, () => events.push(type));
    el.checked = true;
    el.indeterminate = true;
    await settle(el);
    expect(events).toEqual([]);
  });

  it('draws the mark of its state and the selection colours when checked or mixed', async () => {
    const { el, control } = await mount('<odd-checkbox>Updates</odd-checkbox>');
    const check = el.shadowRoot!.querySelector('.indicator-check')!;
    const mixed = el.shadowRoot!.querySelector('.indicator-mixed')!;
    expect([visible(check), visible(mixed)]).toEqual([false, false]);
    expect(getComputedStyle(control).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-default'),
    );
    el.checked = true;
    await settle(el);
    expect([visible(check), visible(mixed)]).toEqual([true, false]);
    expect(getComputedStyle(control).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-selection-background'),
    );
    el.indeterminate = true;
    await settle(el);
    expect([visible(check), visible(mixed)]).toEqual([false, true]);
    // The mark sits inside the box.
    const box = control.getBoundingClientRect();
    const mark = mixed.getBoundingClientRect();
    expect(mark.left).toBeGreaterThanOrEqual(box.left);
    expect(mark.right).toBeLessThanOrEqual(box.right);
  });

  it('mounts and disposes without leaking scopes', async () => {
    const before = scopeStats();
    const { el } = await mount('<odd-checkbox checked>Updates</odd-checkbox>');
    el.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the box and its mark visible in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el, control } = await mount('<odd-checkbox checked>Updates</odd-checkbox>');
        expect(matchMedia('(forced-colors: active)').matches).toBe(true);
        const system = (color: string) => {
          const probe = document.createElement('span');
          probe.style.color = color;
          container.append(probe);
          return getComputedStyle(probe).color;
        };
        expect(getComputedStyle(control).backgroundColor).toBe(system('Highlight'));
        const check = el.shadowRoot!.querySelector('.indicator-check')!;
        expect(getComputedStyle(check).color).toBe(system('HighlightText'));
        el.checked = false;
        await settle(el);
        expect(getComputedStyle(control).borderBlockStartColor).toBe(system('CanvasText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );
});

describe('forms', () => {
  it('submits its value only while checked, like a native checkbox', async () => {
    const { el } = await mount(
      '<form><odd-checkbox name="terms" value="accepted">Terms</odd-checkbox><input type="checkbox" name="native" value="accepted" /></form>',
    );
    const form = container.querySelector('form')!;
    const native = container.querySelector<HTMLInputElement>('input[name="native"]')!;
    expect(el.form).toBe(form);
    expect([...new FormData(form)]).toEqual([]);
    el.checked = true;
    native.checked = true;
    await settle(el);
    expect([...new FormData(form)]).toEqual([
      ['terms', 'accepted'],
      ['native', 'accepted'],
    ]);
  });

  it('a required checkbox blocks submission until checked; the error shows after a failed submit', async () => {
    const { el, control } = await mount(
      '<form><odd-checkbox name="terms" required>Terms</odd-checkbox></form>',
    );
    const form = container.querySelector('form')!;
    expect([el.validity.valueMissing, el.checkValidity(), form.checkValidity()]).toEqual([
      true,
      false,
      false,
    ]);
    expect(el.matches(':state(user-invalid)')).toBe(false);
    el.addEventListener('invalid', (event) => event.preventDefault());
    form.requestSubmit();
    await settle(el);
    expect([control.getAttribute('aria-invalid'), el.matches(':state(user-invalid)')]).toEqual([
      'true',
      true,
    ]);
    el.checked = true;
    await settle(el);
    expect(el.checkValidity()).toBe(true);
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    el.setCustomValidity('Not now');
    await settle(el);
    expect([el.error, el.validity.customError, el.validationMessage]).toEqual([
      'Not now',
      true,
      'Not now',
    ]);
  });

  it('reset restores the default checkedness; a disabled fieldset disables and excludes it', async () => {
    const { el, control } = await mount(
      '<form><fieldset><odd-checkbox name="n" checked>Updates</odd-checkbox></fieldset></form>',
    );
    const form = container.querySelector('form')!;
    el.checked = false;
    await settle(el);
    form.reset();
    await settle(el);
    expect([el.checked, control.checked]).toEqual([true, true]);
    container.querySelector('fieldset')!.disabled = true;
    await settle(el);
    expect(control.disabled).toBe(true);
    expect([...new FormData(form)]).toEqual([]);
  });

  it('restores its checkedness from the saved state', async () => {
    const { el } = await mount('<odd-checkbox name="n">Updates</odd-checkbox>');
    el.formStateRestoreCallback('checked', 'restore');
    expect(el.checked).toBe(true);
    el.formStateRestoreCallback('unchecked', 'restore');
    expect(el.checked).toBe(false);
  });
});
