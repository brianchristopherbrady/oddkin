import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinSwitch } from '../src/switch/switch.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-switch (component-contracts.md §3.3). The checked, form, and validity behaviour it shares
// with odd-checkbox (OddkinCheckable) is covered in checkbox.browser.test.ts.
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
  const el = container.querySelector('odd-switch') as OddkinSwitch;
  await settle(el);
  const control = el.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const part = (name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  return { el, control, part };
}

describe('odd-switch', () => {
  it('is a switch named by the slotted text, without its visible state text', async () => {
    const { el, control, part } = await mount('<odd-switch>Notifications</odd-switch>');
    expect([control.type, control.getAttribute('role')]).toEqual(['checkbox', 'switch']);
    expect(page.getByRole('switch', { name: 'Notifications', exact: true }).element()).toBe(
      control,
    );
    expect(part('state').getAttribute('aria-hidden')).toBe('true');
    expect('indeterminate' in el).toBe(false);
  });

  it('shows the state text from strings and toggles with it', async () => {
    const { el, part } = await mount(
      '<odd-switch checked>Notifications</odd-switch><odd-switch lang="fr">Notifications</odd-switch>',
    );
    expect(part('state').textContent).toBe('On');
    await userEvent.click(part('label'));
    await settle(el);
    expect([el.checked, part('state').textContent]).toEqual([false, 'Off']);
    const french = container.querySelectorAll<OddkinSwitch>('odd-switch')[1]!;
    french.strings = { on: 'Activé', off: 'Désactivé' };
    await settle(french);
    expect(french.shadowRoot!.querySelector('[part="state"]')!.textContent).toBe('Désactivé');
  });

  it('a click toggles and dispatches input then change at the host; Space toggles', async () => {
    const { el, control } = await mount(
      '<button>before</button><odd-switch>Notifications</odd-switch>',
    );
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input:${el.checked}`));
    el.addEventListener('change', (e) => events.push(`change:${e.composed}`));
    await userEvent.click(control);
    await settle(el);
    expect(events).toEqual(['input:true', 'change:false']);
    container.querySelector('button')!.focus();
    await userEvent.tab();
    expect(el.shadowRoot!.activeElement).toBe(control);
    await userEvent.keyboard(' ');
    await settle(el);
    expect(el.checked).toBe(false);
  });

  it('moves the thumb to the inline end when on, mirrored right to left', async () => {
    const { el, control, part } = await mount(
      '<odd-switch>Notifications</odd-switch><odd-switch dir="rtl">Notifications</odd-switch>',
    );
    const inset = (s: OddkinSwitch) => {
      const track = s.shadowRoot!.querySelector('input')!.getBoundingClientRect();
      const thumb = s.shadowRoot!.querySelector('[part="thumb"]')!.getBoundingClientRect();
      return [thumb.left - track.left, track.right - thumb.right];
    };
    const box = control.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([40, 24]);
    expect(part('thumb').getBoundingClientRect().height).toBe(16);
    const rtl = container.querySelectorAll<OddkinSwitch>('odd-switch')[1]!;
    expect([inset(el), inset(rtl)]).toEqual([
      [4, 20],
      [20, 4],
    ]);
    el.checked = true;
    rtl.checked = true;
    await settle(el);
    await settle(rtl);
    expect([inset(el), inset(rtl)]).toEqual([
      [20, 4],
      [4, 20],
    ]);
  });

  it('the whole row toggles: a pointer cursor, not-allowed while disabled', async () => {
    const { el } = await mount('<odd-switch>Notifications</odd-switch>');
    const row = el.shadowRoot!.querySelector('.choice')!;
    expect(getComputedStyle(row).cursor).toBe('pointer');
    el.disabled = true;
    await settle(el);
    expect(getComputedStyle(row).cursor).toBe('not-allowed');
  });

  it('draws the danger border while it shows an error', async () => {
    const { el, control } = await mount('<odd-switch>Notifications</odd-switch>');
    const border = () => getComputedStyle(control).borderBlockStartColor;
    expect(border()).toBe(themeValue('border-block-start-color', '--odd-color-border-strong'));
    el.error = 'Turn this on to continue.';
    await settle(el);
    expect(border()).toBe(themeValue('border-block-start-color', '--odd-color-danger-foreground'));
  });

  it('submits its value only while on; reset restores the default', async () => {
    const { el } = await mount(
      '<form><odd-switch name="alerts" value="yes" checked>Alerts</odd-switch></form>',
    );
    const form = container.querySelector('form')!;
    expect([...new FormData(form)]).toEqual([['alerts', 'yes']]);
    el.checked = false;
    await settle(el);
    expect([...new FormData(form)]).toEqual([]);
    form.reset();
    await settle(el);
    expect(el.checked).toBe(true);
  });

  it('mounts and disposes without leaking scopes', async () => {
    const before = scopeStats();
    const { el } = await mount('<odd-switch checked>Notifications</odd-switch>');
    el.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the track and thumb visible in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el, control, part } = await mount('<odd-switch>Notifications</odd-switch>');
        expect(matchMedia('(forced-colors: active)').matches).toBe(true);
        const system = (color: string) => {
          const probe = document.createElement('span');
          probe.style.color = color;
          container.append(probe);
          return getComputedStyle(probe).color;
        };
        expect(getComputedStyle(control).borderBlockStartColor).toBe(system('CanvasText'));
        expect(getComputedStyle(part('thumb')).backgroundColor).toBe(system('CanvasText'));
        el.checked = true;
        await settle(el);
        expect(getComputedStyle(control).backgroundColor).toBe(system('Highlight'));
        expect(getComputedStyle(part('thumb')).backgroundColor).toBe(system('HighlightText'));
        el.disabled = true;
        el.checked = false;
        await settle(el);
        expect(getComputedStyle(part('thumb')).backgroundColor).toBe(system('GrayText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );
});
