import { afterEach, describe, expect, it, vi } from 'vitest';
import { linkThemeStudio } from '../src/theme-link/index.js';

// `@oddkin/workbench/theme-link` in the app's page (P1.5 item 6). Theme Studio's window is an
// iframe here, whose script sends what the test hands it, so each message comes from that window.
const studioFrame = async () => {
  const frame = document.createElement('iframe');
  frame.srcdoc = `<script>
    window.received = [];
    addEventListener('message', (event) => {
      if (event.data && event.data.relay) parent.postMessage(event.data.relay, '*');
      else window.received.push(event.data);
    });
  </script>`;
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  document.body.append(frame);
  await loaded;
  const studio = frame.contentWindow as Window & { received: unknown[] };
  cleanups.push(() => frame.remove());
  return {
    studio,
    /** Theme Studio sends `message` to this page. */
    send: (message: unknown) => studio.postMessage({ relay: message }, '*'),
  };
};

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

const until = async (check: () => boolean, what: string) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 20));
  if (!check()) throw new Error(`Timed out waiting for ${what}`);
};

const css = (value: string) => ({
  protocol: 'oddkin.theme-link',
  version: 1,
  type: 'css',
  css: `:root { --theme-link-probe: ${value}; }`,
});

const probe = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--theme-link-probe').trim();

describe('theme-link', () => {
  it("replaces one stylesheet with each CSS from Theme Studio's window, and restores it", async () => {
    const style = document.createElement('style');
    style.textContent = ':root { --theme-link-probe: base; }';
    style.id = 'app-theme';
    document.head.append(style);
    cleanups.push(() => style.remove());
    const { studio, send } = await studioFrame();
    const before = document.adoptedStyleSheets.length;
    const stop = linkThemeStudio({
      studio: location.origin,
      stylesheet: '#app-theme',
      studioWindow: studio,
    });
    cleanups.push(stop);
    // It says it is ready, to Theme Studio's window only.
    await until(() => studio.received.length > 0, 'the ready message');
    expect(studio.received).toEqual([{ protocol: 'oddkin.theme-link', version: 1, type: 'ready' }]);
    expect(probe()).toBe('base');
    send(css('draft'));
    await until(() => probe() === 'draft', 'the draft');
    expect(style.disabled).toBe(true);
    expect(document.adoptedStyleSheets).toHaveLength(before + 1);
    // Each later CSS replaces the draft's sheet: one sheet, whatever the number of drafts.
    send(css('newer'));
    await until(() => probe() === 'newer', 'the newer draft');
    expect(document.adoptedStyleSheets).toHaveLength(before + 1);
    // Messages from any other window, or of another shape, apply nothing.
    const applied = vi.spyOn(CSSStyleSheet.prototype, 'replaceSync');
    cleanups.push(() => applied.mockRestore());
    window.postMessage(css('this page'), '*');
    send({ ...css('old'), version: 2 });
    send({ ...css('ready'), type: 'ready' });
    send({ protocol: 'oddkin.theme-link', version: 1, type: 'css', css: 5 });
    send(css('last'));
    await until(() => probe() === 'last', 'the last draft');
    expect(applied.mock.calls).toEqual([[css('last').css]]);
    stop();
    expect(probe()).toBe('base');
    expect(style.disabled).toBe(false);
    expect(document.adoptedStyleSheets).toHaveLength(before);
  });

  it("takes nothing from another origin than Theme Studio's, and adds the draft on top without a stylesheet", async () => {
    const { studio, send } = await studioFrame();
    // Theme Studio named at another origin: the ready message is not delivered here, and this
    // window's messages are not taken.
    const other = linkThemeStudio({ studio: 'http://studio.invalid:4175', studioWindow: studio });
    cleanups.push(other);
    send(css('elsewhere'));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect([studio.received, probe()]).toEqual([[], '']);
    other();
    const own = linkThemeStudio({ studio: location.origin, studioWindow: studio });
    cleanups.push(own);
    await until(() => studio.received.length === 1, 'the ready message');
    send(css('on top'));
    await until(() => probe() === 'on top', 'the draft');
    expect(document.adoptedStyleSheets.length).toBeGreaterThan(0);
    own();
    expect(probe()).toBe('');
    // A page that Theme Studio did not open (no opener) does nothing.
    expect(window.opener).toBeNull();
    linkThemeStudio({ studio: location.origin })();
  });

  it("refuses a studio that is not Theme Studio's http or https origin", async () => {
    const { studio } = await studioFrame();
    for (const value of [
      '*',
      'javascript:alert(1)',
      'data:text/html,x',
      '/studio',
      'localhost:4175',
    ])
      expect(() => linkThemeStudio({ studio: value, studioWindow: studio }), value).toThrow(
        expect.objectContaining({ code: 'themeLink.studio.invalid' }),
      );
    // Even without a Theme Studio window, so a wrong setting shows at once.
    expect(() => linkThemeStudio({ studio: '*' })).toThrow(/themeLink\.studio\.invalid/);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(studio.received).toEqual([]);
  });
});
