import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinDrawer } from '../src/drawer/drawer.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-drawer (component-contracts.md §3.5): odd-dialog with a side-sheet layout, modal or not.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
afterEach(() => {
  container?.remove();
  flush();
});
async function mount(markup: string) {
  container = document.createElement('div');
  container.innerHTML = `<button id="before">before</button>${markup}<button id="after">after</button>`;
  document.body.append(container);
  for (const el of container.querySelectorAll('*')) await settle(el);
  return container;
}
const byId = <E extends HTMLElement = HTMLElement>(id: string) =>
  container.querySelector<E>(`#${id}`)!;
const inner = (el: Element) => el.shadowRoot!.querySelector('dialog')!;
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
const closed = (el: Element) =>
  new Promise<Event>((resolve) => el.addEventListener('close', resolve, { once: true }));
const box = (el: Element) => el.getBoundingClientRect();
const px = (variable: string) => parseFloat(themeValue('inline-size', variable));
// Narrow enough to leave the page's buttons uncovered in the test viewport.
const DRAWER = `<button id="trigger">Details</button><odd-drawer id="d" label="Member details" style="--odd-drawer-inline-size: 12rem"><p>Alex Morgan</p><input id="name" value="Alex"><button id="save" slot="footer">Save</button></odd-drawer>`;
/** Activates the trigger from the keyboard: Safari does not focus a button on a press. */
async function press(trigger: HTMLElement) {
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  await new Promise(requestAnimationFrame);
}
/** Mounts `markup`, opens the drawer from the trigger, and returns it. */
async function opened(markup = DRAWER) {
  await mount(markup);
  const el = byId<OddkinDrawer>('d');
  const trigger = byId('trigger');
  trigger.addEventListener('click', () => el.show());
  await press(trigger);
  await settle(el);
  return { el, trigger };
}
const nonModal = (markup = DRAWER) => markup.replace('label=', 'no-modal label=');
/** Runs `body` as if the browser had no native `closedby`. */
async function withoutNativeClosedBy(body: () => Promise<void>) {
  const proto = HTMLDialogElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'closedBy');
  if (descriptor) delete (proto as { closedBy?: string }).closedBy;
  try {
    await body();
  } finally {
    if (descriptor) Object.defineProperty(proto, 'closedBy', descriptor);
  }
}

describe('odd-drawer', () => {
  it('opens modally at the inline end, the full height of the viewport less space.sm', async () => {
    const { el } = await opened();
    const dialog = inner(el);
    expect(dialog.matches(':modal')).toBe(true);
    expect(el.open).toBe(true);
    expect(el.side).toBe('inline-end');
    expect(el.getAttribute('side')).toBe('inline-end');
    // The page behind is inert.
    byId('after').focus();
    expect(document.activeElement).not.toBe(byId('after'));
    const sm = px('--odd-space-sm');
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(Math.round(box(dialog).right)).toBe(Math.round(innerWidth - sm));
    expect(Math.round(box(dialog).top)).toBe(Math.round(sm));
    expect(Math.round(box(dialog).bottom)).toBe(Math.round(innerHeight - sm));
    expect(box(dialog).width).toBe(12 * rem);
    expect(getComputedStyle(dialog, '::backdrop').backgroundColor).toBe(
      themeValue('color', '--odd-color-scrim'),
    );
    const done = closed(el);
    await userEvent.keyboard('{Escape}');
    await done;
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(byId('trigger'));
  });

  it('opens at either inline edge, mirrored in right-to-left text', async () => {
    const sm = px('--odd-space-sm');
    const edges = async (dir: 'ltr' | 'rtl') => {
      container.dir = dir;
      const el = byId<OddkinDrawer>('d');
      const result: Record<string, { left: number; right: number }> = {};
      for (const side of ['inline-end', 'inline-start'] as const) {
        el.side = side;
        await settle(el);
        const { left, right } = box(inner(el));
        result[side] = { left: Math.round(left), right: Math.round(right) };
      }
      return result;
    };
    await opened();
    const start = { left: Math.round(sm), right: Math.round(sm + box(inner(byId('d'))).width) };
    const end = {
      left: Math.round(innerWidth - sm - box(inner(byId('d'))).width),
      right: Math.round(innerWidth - sm),
    };
    expect(await edges('ltr')).toEqual({ 'inline-end': end, 'inline-start': start });
    expect(await edges('rtl')).toEqual({ 'inline-end': start, 'inline-start': end });
    const el = byId<OddkinDrawer>('d');
    expect(el.getAttribute('side')).toBe('inline-start');
  });

  it('with no-modal leaves the page usable: no backdrop, nothing inert, stacked above it', async () => {
    const { el, trigger } = await opened(nonModal());
    const dialog = inner(el);
    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(false);
    expect(el.open).toBe(true);
    // Focus moves in, as for a modal drawer, and may leave.
    expect(document.activeElement).toBe(byId('name'));
    byId('after').focus();
    expect(document.activeElement).toBe(byId('after'));
    expect(byId('after').matches(':focus')).toBe(true);
    // Fixed at the inline end above positioned page content, and there as the page scrolls.
    const sm = px('--odd-space-sm');
    const cover = document.createElement('div');
    cover.style.cssText = 'position: fixed; inset: 0; z-index: 1';
    const tall = document.createElement('div');
    tall.style.blockSize = '300vh';
    container.append(cover, tall);
    scrollTo(0, innerHeight);
    try {
      expect(getComputedStyle(dialog).zIndex).toBe(themeValue('z-index', '--odd-z-index-overlay'));
      const { left, top, right, bottom, width, height } = box(dialog);
      expect([top, bottom, right].map(Math.round)).toEqual(
        [sm, innerHeight - sm, innerWidth - sm].map(Math.round),
      );
      const hit = document.elementFromPoint(left + width / 2, top + height / 2);
      expect(hit === el || el.contains(hit)).toBe(true);
    } finally {
      scrollTo(0, 0);
      cover.remove();
      tall.remove();
    }
    // Focus that has left stays where it is when the drawer closes.
    const done = closed(el);
    el.close();
    await done;
    expect(document.activeElement).toBe(byId('after'));
    // Focus still inside returns to the opener.
    await press(trigger);
    await settle(el);
    expect(document.activeElement).toBe(byId('name'));
    const again = closed(el);
    el.open = false;
    await again;
    expect(document.activeElement).toBe(trigger);
  });

  it('reads no-modal at each opening', async () => {
    const { el } = await opened();
    expect(inner(el).matches(':modal')).toBe(true);
    // A change while open waits for the next opening.
    el.noModal = true;
    await settle(el);
    expect(inner(el).matches(':modal')).toBe(true);
    el.close();
    el.show();
    expect(inner(el).open).toBe(true);
    expect(inner(el).matches(':modal')).toBe(false);
    el.close();
    el.noModal = false;
    await settle(el);
    el.show();
    expect(inner(el).matches(':modal')).toBe(true);
  });

  for (const native of [true, false]) {
    const run = native
      ? (body: () => Promise<void>) => body()
      : (body: () => Promise<void>) => withoutNativeClosedBy(body);
    const how = native ? 'natively where supported' : 'emulated';

    it(`with no-modal closes on Escape after a cancelable cancel, from anywhere (${how})`, async () => {
      await run(async () => {
        const { el, trigger } = await opened(nonModal());
        const seen: string[] = [];
        el.addEventListener('cancel', (event) => seen.push(`cancel ${event.cancelable}`));
        el.addEventListener('close', () => seen.push('close'));
        // Other keys are not its business.
        await userEvent.keyboard('x');
        await new Promise(requestAnimationFrame);
        expect(seen).toEqual([]);
        el.addEventListener('cancel', (event) => event.preventDefault(), { once: true });
        await userEvent.keyboard('{Escape}');
        await new Promise(requestAnimationFrame);
        expect(inner(el).open).toBe(true);
        expect(seen).toEqual(['cancel true']);
        // Escape that something inside has handled does not reach it.
        const handled = (event: KeyboardEvent) => event.preventDefault();
        byId('name').addEventListener('keydown', handled);
        await userEvent.click(byId('name'));
        await userEvent.keyboard('{Escape}');
        await new Promise(requestAnimationFrame);
        expect(inner(el).open).toBe(true);
        byId('name').removeEventListener('keydown', handled);
        // With focus on the page beside it (Safari does not focus a button on a press).
        await userEvent.click(byId('after'));
        byId('after').focus();
        const done = closed(el);
        await userEvent.keyboard('{Escape}');
        await done;
        expect(seen.at(-1)).toBe('close');
        expect(seen.filter((s) => s.startsWith('cancel'))).toHaveLength(2);
        expect(el.open).toBe(false);
        expect(document.activeElement).toBe(byId('after'));
        // Closed, Escape is not its business.
        await userEvent.keyboard('{Escape}');
        await new Promise(requestAnimationFrame);
        expect(seen.filter((s) => s.startsWith('cancel'))).toHaveLength(2);
        // closedby="none" leaves only its controls.
        el.closedBy = 'none';
        await settle(el);
        await press(trigger);
        await settle(el);
        await userEvent.keyboard('{Escape}');
        await new Promise(requestAnimationFrame);
        expect(inner(el).open).toBe(true);
        el.close();
      });
    });

    it(`with no-modal and closedby="any" closes on a press outside, not inside (${how})`, async () => {
      await run(async () => {
        const { el, trigger } = await opened(
          nonModal(DRAWER.replace('label=', 'closedby="any" label=')),
        );
        const seen: string[] = [];
        el.addEventListener('cancel', () => seen.push('cancel'));
        el.addEventListener('close', () => seen.push('close'));
        await userEvent.click(byId('save'));
        await userEvent.click(part(el, 'title')!);
        await new Promise(requestAnimationFrame);
        expect(inner(el).open).toBe(true);
        expect(seen).toEqual([]);
        // A cancelled cancel keeps it open.
        el.addEventListener('cancel', (event) => event.preventDefault(), { once: true });
        await userEvent.click(byId('before'));
        await new Promise(requestAnimationFrame);
        expect(inner(el).open).toBe(true);
        const done = closed(el);
        await userEvent.click(byId('after'));
        await done;
        expect(seen).toEqual(['cancel', 'cancel', 'close']);
        expect(el.open).toBe(false);
        // closerequest, the default, ignores a press outside.
        el.closedBy = 'closerequest';
        await settle(el);
        await press(trigger);
        await settle(el);
        await userEvent.click(byId('after'));
        await new Promise(requestAnimationFrame);
        expect(inner(el).open).toBe(true);
        el.close();
      });
    });

    it(`modal, leaves Escape to the browser: one cancel, and cancelling it keeps it open (${how})`, async () => {
      await run(async () => {
        const { el } = await opened();
        const seen: string[] = [];
        el.addEventListener('cancel', () => seen.push('cancel'));
        el.addEventListener('close', () => seen.push('close'));
        el.addEventListener('cancel', (event) => event.preventDefault(), { once: true });
        await userEvent.keyboard('{Escape}');
        await new Promise(requestAnimationFrame);
        expect(inner(el).open).toBe(true);
        expect(seen).toEqual(['cancel']);
      });
    });
  }

  it('lays out the Figma drawer: dividers under the header and above the actions', async () => {
    const { el } = await opened();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const header = part(el, 'header')!;
    const body = part(el, 'body')!;
    const footer = part(el, 'footer')!;
    expect(getComputedStyle(header).paddingBlockStart).toBe(
      themeValue('inline-size', '--odd-space-md'),
    );
    expect(getComputedStyle(header).paddingBlockEnd).toBe(
      themeValue('inline-size', '--odd-space-md'),
    );
    expect(getComputedStyle(header).paddingInlineStart).toBe(`${1.5 * rem}px`);
    expect(getComputedStyle(body).paddingBlockStart).toBe(`${1.5 * rem}px`);
    expect(getComputedStyle(body).color).toBe(themeValue('color', '--odd-color-text-primary'));
    expect(getComputedStyle(part(el, 'title')!).fontSize).toBe(`${1.25 * rem}px`);
    for (const [divider, edge] of [
      [getComputedStyle(header, '::after'), 'bottom'],
      [getComputedStyle(footer, '::before'), 'top'],
    ] as const) {
      expect(divider.backgroundColor).toBe(themeValue('color', '--odd-color-border-default'));
      expect(divider.blockSize).toBe(themeValue('inline-size', '--odd-border-width-default'));
      expect(divider.position).toBe('absolute');
      expect(divider[edge]).toBe('0px');
      expect([divider.left, divider.right]).toEqual(['0px', '0px']);
    }
    // The header holds its divider.
    expect(getComputedStyle(header).position).toBe('relative');
    // The header divider spans the drawer at the header's bottom.
    expect(Math.round(box(header).width)).toBe(Math.round(box(inner(el)).width) - 2);
    // The footer sits at the bottom; the body takes the rest and scrolls.
    expect(Math.round(box(footer).bottom)).toBe(Math.round(box(inner(el)).bottom) - 1);
    byId('save').remove();
    await settle(el);
    expect(footer.hidden).toBe(true);
    // Read only: no actions, one divider.
    expect(getComputedStyle(header, '::after').content).not.toBe('none');
  });

  it('scrolls its body within the viewport, and takes its width from --odd-drawer-inline-size', async () => {
    const { el } = await opened(
      DRAWER.replace('<p>Alex Morgan</p>', `<p>${'A long body. '.repeat(400)}</p>`),
    );
    const sm = px('--odd-space-sm');
    const dialog = inner(el);
    expect(Math.round(box(dialog).height)).toBe(Math.round(innerHeight - 2 * sm));
    const body = part(el, 'body')!;
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    expect(Math.round(box(part(el, 'footer')!).bottom)).toBe(Math.round(box(dialog).bottom) - 1);
    el.style.setProperty('--odd-drawer-inline-size', '200rem');
    expect(Math.round(box(dialog).width)).toBe(Math.round(innerWidth - 2 * sm));
    el.style.removeProperty('--odd-drawer-inline-size');
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(box(dialog).width).toBe(Math.min(24 * rem, innerWidth - 2 * sm));
    // odd-dialog's width property does not reach it.
    el.style.setProperty('--odd-dialog-inline-size', '10rem');
    expect(box(dialog).width).toBe(Math.min(24 * rem, innerWidth - 2 * sm));
  });

  it('is odd-dialog otherwise: alert, no-close, strings, and forms', async () => {
    const { el } = await opened(
      DRAWER.replace(
        '<button id="save" slot="footer">Save</button>',
        '<form id="f" method="dialog"></form><button id="save" slot="footer" form="f" value="save">Save</button>',
      ),
    );
    expect(part(el, 'close')!.getAttribute('aria-label')).toBe('Close');
    el.strings = { close: 'Schließen' };
    el.alert = true;
    await settle(el);
    expect(part(el, 'close')!.getAttribute('aria-label')).toBe('Schließen');
    expect(inner(el).getAttribute('role')).toBe('alertdialog');
    const done = closed(el);
    await userEvent.click(byId('save'));
    await done;
    expect(el.returnValue).toBe('save');
    el.noClose = true;
    await settle(el);
    expect(part(el, 'close')).toBeNull();
  });

  it.runIf(server.browser === 'chromium')(
    'keeps its header divider in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el } = await opened();
        const probe = document.createElement('span');
        probe.style.color = 'CanvasText';
        container.append(probe);
        const divider = getComputedStyle(part(el, 'header')!, '::after');
        expect(divider.borderBlockEndColor).toBe(getComputedStyle(probe).color);
        expect(divider.borderBlockEndStyle).toBe('solid');
        expect(divider.borderBlockEndWidth).toBe('1px');
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  for (const modal of [true, false])
    it(`closes and releases everything it owns when removed while open (${modal ? 'modal' : 'no-modal'})`, async () => {
      const before = scopeStats();
      const { el } = await opened(modal ? DRAWER : nonModal());
      container.remove();
      flush();
      expect(inner(el).open).toBe(false);
      expect(el.open).toBe(false);
      expect(scopeStats()).toEqual(before);
      document.body.append(container);
      await settle(el);
      expect(inner(el).open).toBe(false);
    });
});
