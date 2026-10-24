import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinToast } from '../src/toast/toast.js';
import { toastDefinition } from '../src/toast/index.js';
import './register.js';
import { loadTheme, probeTag, semantics, settle, themeValue } from './probe.js';

// odd-toast (component-contracts.md §3.5; WCAG 2.2.1, 4.1.3).
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
  container.innerHTML = `<button id="before">before</button>${markup}<button id="after">after</button>`;
  document.body.append(container);
  for (const el of container.querySelectorAll('*')) await settle(el);
  return container;
}
const byId = <E extends HTMLElement = HTMLElement>(id: string) =>
  container.querySelector<E>(`#${id}`)!;
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const box = (el: Element) => el.getBoundingClientRect();
const px = (variable: string) => parseFloat(themeValue('inline-size', variable));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise(requestAnimationFrame);
/** When `el` next reaches `state`: the moment its clock starts or stops. */
const when = (el: Element, state: 'open' | 'closed') =>
  new Promise<number>((resolve) => {
    const listener = (event: Event) => {
      if ((event as ToggleEvent).newState !== state) return;
      el.removeEventListener('toggle', listener);
      resolve(performance.now());
    };
    el.addEventListener('toggle', listener);
  });
/** Waits until `ms` after `start`. */
const until = (start: number, ms: number) => wait(Math.max(0, start + ms - performance.now()));
const toast = (id: string, attributes = '', action = '') =>
  `<odd-toast id="${id}" label="Toast ${id}" ${attributes}>Message ${id}.${action}</odd-toast>`;
const UNDO = '<button id="undo" slot="end">Undo</button>';
const SENT = `<odd-toast id="t" label="Invitation sent" tone="success">Alex can now join the workspace.${UNDO}</odd-toast>`;
/** Shows each toast and waits until it is laid out. */
async function show(...toasts: OddkinToast[]) {
  for (const el of toasts) {
    el.show();
    await settle(el);
  }
  await frame();
  await frame();
}

describe('odd-toast', () => {
  it('opens at the block-end and inline-end corner without taking focus, mirrored right to left', async () => {
    await mount(SENT);
    const el = byId<OddkinToast>('t');
    expect(el.getAttribute('popover')).toBe('manual');
    expect(el.open).toBe(false);
    byId('before').focus();
    await show(el);
    expect(el.matches(':popover-open')).toBe(true);
    expect(el.open).toBe(true);
    expect(document.activeElement).toBe(byId('before'));
    const md = px('--odd-space-md');
    expect(Math.round(box(el).right)).toBe(Math.round(innerWidth - md));
    expect(Math.round(box(el).bottom)).toBe(Math.round(innerHeight - md));
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(box(el).width).toBe(Math.min(24 * rem, innerWidth - 2 * md));
    // Narrower than the viewport, it keeps to the inline end.
    el.style.setProperty('--odd-toast-inline-size', '12rem');
    expect(box(el).width).toBe(12 * rem);
    expect(Math.round(box(el).right)).toBe(Math.round(innerWidth - md));
    container.dir = 'rtl';
    expect(Math.round(box(el).left)).toBe(Math.round(md));
    expect(Math.round(box(el).bottom)).toBe(Math.round(innerHeight - md));
    // The title is visible text, never a name.
    expect(part(el, 'label').textContent!.trim()).toBe('Invitation sent');
    expect(el.hasAttribute('aria-label')).toBe(false);
    el.label = '';
    await settle(el);
    expect(part(el, 'label').hidden).toBe(true);
  });

  it('is a status region whose title and message join just after it shows; danger is an alert', async () => {
    const tag = probeTag(toastDefinition);
    await mount(SENT.replaceAll('odd-toast', tag));
    const el = byId<OddkinToast>('t');
    expect(semantics(el)).toEqual({ role: 'status', label: null, hidden: null });
    const text = () => [part(el, 'label'), el.shadowRoot!.querySelector('.message')!];
    el.show();
    await settle(el);
    for (const node of text()) expect(node.getAttribute('aria-hidden')).toBe('true');
    expect(part(el, 'close').hasAttribute('aria-hidden')).toBe(false);
    await wait(150);
    await settle(el);
    for (const node of text()) expect(node.hasAttribute('aria-hidden')).toBe(false);
    el.close();
    await settle(el);
    for (const node of text()) expect(node.getAttribute('aria-hidden')).toBe('true');
    el.tone = 'danger';
    await settle(el);
    expect(semantics(el).role).toBe('alert');
    // Each opening joins them again, so each is announced.
    el.show();
    await wait(150);
    await settle(el);
    for (const node of text()) expect(node.hasAttribute('aria-hidden')).toBe(false);
    // Closed before they join, they stay out until the next opening's moment.
    el.close();
    await settle(el);
    await show(el);
    el.close();
    await settle(el);
    await wait(150);
    el.show();
    await settle(el);
    for (const node of text()) expect(node.getAttribute('aria-hidden')).toBe('true');
  });

  it.runIf(server.browser === 'chromium')(
    'the accessibility tree gets the title and the message inside the region after it shows',
    async () => {
      await mount(SENT);
      const el = byId<OddkinToast>('t');
      const session = cdp();
      await session.send('Accessibility.enable');
      try {
        type Frame = { frame: { id: string }; childFrames?: Frame[] };
        const ids = (tree: Frame): string[] => [
          tree.frame.id,
          ...(tree.childFrames ?? []).flatMap((child) => ids(child)),
        ];
        type AXNode = { ignored?: boolean; role?: { value: string }; name?: { value: string } };
        const texts = async () => {
          const { frameTree } = (await session.send('Page.getFrameTree')) as { frameTree: Frame };
          const nodes: AXNode[] = [];
          for (const frameId of ids(frameTree))
            nodes.push(
              ...(
                (await session.send('Accessibility.getFullAXTree', { frameId })) as {
                  nodes: AXNode[];
                }
              ).nodes,
            );
          const shown = nodes.filter((n) => !n.ignored);
          return {
            status: shown.some((n) => n.role?.value === 'status'),
            title: shown.some((n) => n.name?.value === 'Invitation sent'),
            message: shown.some((n) => n.name?.value === 'Alex can now join the workspace.'),
          };
        };
        el.show();
        await settle(el);
        expect(await texts()).toEqual({ status: true, title: false, message: false });
        await wait(150);
        await settle(el);
        expect(await texts()).toEqual({ status: true, title: true, message: true });
      } finally {
        await session.send('Accessibility.disable');
      }
    },
  );

  it('closes after duration; no time runs while the pointer or focus is on any open toast', async () => {
    await mount(`${toast('a', 'duration="3000"')}${toast('b', 'duration="3000"')}`);
    const [a, b] = [byId<OddkinToast>('a'), byId<OddkinToast>('b')];
    const opened = when(b, 'open');
    await show(a, b);
    // The pointer on one holds them all, and they go on with the time they had left.
    const start = await opened;
    await until(start, 1000);
    const arrived = performance.now();
    await userEvent.hover(b);
    await wait(3500);
    expect([a.open, b.open]).toEqual([true, true]);
    const closed = when(b, 'closed');
    await userEvent.hover(byId('before'));
    const left = performance.now();
    expect((await closed) - left).toBeLessThan(3000 - (arrived - start) + 300);
    await until(left, 2500);
    expect(a.open).toBe(false);
    // So does focus in one; the time it had left goes on after it.
    a.duration = 1500;
    await settle(a);
    const reopened = when(a, 'open');
    a.show();
    const begin = await reopened;
    part(a, 'close').focus();
    const focused = performance.now();
    await wait(2000);
    expect(a.open).toBe(true);
    const closedA = when(a, 'closed');
    const blurred = performance.now();
    byId('after').focus();
    expect((await closedA) - blurred).toBeGreaterThan(1500 - (focused - begin) - 300);
  });

  it('keeps one clock per toast when another toast closes', async () => {
    await mount(`${toast('a', 'duration="3000"')}${toast('b', 'duration="0"')}`);
    const [a, b] = [byId<OddkinToast>('a'), byId<OddkinToast>('b')];
    const opened = when(a, 'open');
    await show(a, b);
    const start = await opened;
    part(b, 'close').click();
    await settle(b);
    await frame();
    expect(b.open).toBe(false);
    // Hovering a pauses its only clock: a second one would close it while hovered.
    await userEvent.hover(a);
    await until(start, 3600);
    expect(a.open).toBe(true);
  });

  it('counts no time while the page is hidden', async () => {
    await mount(toast('a', 'duration="1000"'));
    const a = byId<OddkinToast>('a');
    const opened = when(a, 'open');
    a.show();
    await opened;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      await wait(1200);
      expect(a.open).toBe(true);
    } finally {
      delete (document as { hidden?: boolean }).hidden;
    }
    document.dispatchEvent(new Event('visibilitychange'));
    await wait(1300);
    expect(a.open).toBe(false);
    // A closed toast's clock stays stopped when the page shows again.
    await show(a);
    a.close();
    document.dispatchEvent(new Event('visibilitychange'));
    a.duration = 0;
    await settle(a);
    await show(a);
    await wait(450);
    expect(a.open).toBe(true);
    // Opened while the page is hidden, it counts no time until the page shows.
    a.close();
    a.duration = 600;
    await settle(a);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      await show(a);
      await wait(800);
      expect(a.open).toBe(true);
    } finally {
      delete (document as { hidden?: boolean }).hidden;
    }
    document.dispatchEvent(new Event('visibilitychange'));
    await wait(1000);
    expect(a.open).toBe(false);
  });

  it('counts no time for a toast opened while another is held', async () => {
    // b above a, so b opens away from the pointer.
    await mount(`${toast('b', 'duration="600"')}${toast('a', 'duration="0"')}`);
    const [a, b] = [byId<OddkinToast>('a'), byId<OddkinToast>('b')];
    await show(a);
    await userEvent.hover(a);
    await show(b);
    await wait(900);
    expect(b.open).toBe(true);
    await userEvent.hover(byId('before'));
    await wait(1200);
    expect(b.open).toBe(false);
  });

  it('stays with an action, or with duration 0 (WCAG 2.2.1)', async () => {
    await mount(toast('a', 'duration="100"', UNDO));
    const a = byId<OddkinToast>('a');
    await show(a);
    await wait(300);
    expect(a.open).toBe(true);
    a.close();
    byId('undo').remove();
    a.duration = 0;
    await settle(a);
    await show(a);
    await wait(300);
    expect(a.open).toBe(true);
    // Read at each opening.
    a.close();
    a.duration = 100;
    await settle(a);
    await show(a);
    await wait(300);
    expect(a.open).toBe(false);
    // Closed early, its time stops: it does not close the next opening.
    a.duration = 300;
    await settle(a);
    await show(a);
    a.close();
    a.duration = 0;
    await settle(a);
    await show(a);
    await wait(450);
    expect(a.open).toBe(true);
  });

  it('runs no clock while closed', async () => {
    await mount(toast('a', 'duration="3000"'));
    const a = byId<OddkinToast>('a');
    const idle = scopeStats().timers;
    const opened = when(a, 'open');
    a.show();
    await opened;
    await wait(200);
    expect(scopeStats().timers).toBe(idle + 1);
    const closed = when(a, 'closed');
    a.close();
    await closed;
    expect(scopeStats().timers).toBe(idle);
    // Not even when the page shows again.
    document.dispatchEvent(new Event('visibilitychange'));
    expect(scopeStats().timers).toBe(idle);
  });

  it('starts over when it closes and opens again in one task', async () => {
    await mount(`${toast('a', 'duration="0"')}${toast('b', 'duration="3000"')}`);
    const [a, b] = [byId<OddkinToast>('a'), byId<OddkinToast>('b')];
    const opened = when(b, 'open');
    await show(a, b);
    const start = await opened;
    await wait(150);
    const label = part(b, 'label');
    expect(label.hasAttribute('aria-hidden')).toBe(false);
    b.duration = 0;
    await settle(b);
    // One toggle event for both.
    b.close();
    b.show();
    await settle(b);
    await frame();
    // The text leaves the region and joins it again, so it is announced again.
    expect(label.getAttribute('aria-hidden')).toBe('true');
    // It is stacked once.
    const corner = Math.round(innerHeight - px('--odd-space-md'));
    expect(Math.round(box(b).bottom)).toBe(corner);
    expect(Math.round(box(a).bottom)).toBe(Math.round(box(b).top - px('--odd-space-sm')));
    // Its first clock stopped: duration 0 now keeps it.
    await until(start, 3600);
    expect(b.open).toBe(true);
  });

  it('stacks open toasts in document order, the last at the corner, space.sm apart', async () => {
    await mount(`${toast('a', 'duration="0"')}${toast('b', 'duration="0"')}`);
    const [a, b] = [byId<OddkinToast>('a'), byId<OddkinToast>('b')];
    const md = px('--odd-space-md');
    const sm = px('--odd-space-sm');
    const corner = Math.round(innerHeight - md);
    await show(b);
    expect(Math.round(box(b).bottom)).toBe(corner);
    // Opened later but earlier in the document: above, and b stays where it is.
    await show(a);
    expect(Math.round(box(b).bottom)).toBe(corner);
    expect(Math.round(box(a).bottom)).toBe(Math.round(box(b).top - sm));
    // A new toast inserted before the open ones stacks above them.
    const c = document.createElement('odd-toast') as OddkinToast;
    c.label = 'Toast c';
    c.duration = 0;
    a.before(c);
    await settle(c);
    await show(c);
    expect(Math.round(box(b).bottom)).toBe(corner);
    expect(Math.round(box(c).bottom)).toBe(Math.round(box(a).top - sm));
    // Closing one moves the ones above it down.
    b.close();
    await frame();
    await frame();
    expect(Math.round(box(a).bottom)).toBe(corner);
    expect(Math.round(box(c).bottom)).toBe(Math.round(box(a).top - sm));
    // Taller content restacks the ones above.
    a.textContent = 'A much longer message. '.repeat(20);
    await frame();
    await frame();
    expect(Math.round(box(c).bottom)).toBe(Math.round(box(a).top - sm));
  });

  it('closes from its close button, close(), and open, firing toggle at the host', async () => {
    await mount(SENT);
    const el = byId<OddkinToast>('t');
    const seen: string[] = [];
    el.addEventListener('toggle', (event) => seen.push((event as ToggleEvent).newState));
    await show(el);
    const close = part(el, 'close');
    expect(close.getAttribute('aria-label')).toBe('Dismiss');
    el.strings = { close: 'Schließen' };
    await settle(el);
    expect(close.getAttribute('aria-label')).toBe('Schließen');
    close.click();
    await settle(el);
    await frame();
    expect(el.open).toBe(false);
    el.open = true;
    await settle(el);
    expect(el.matches(':popover-open')).toBe(true);
    el.close();
    await settle(el);
    await frame();
    expect(el.matches(':popover-open')).toBe(false);
    expect(seen).toEqual(['open', 'closed', 'open', 'closed']);
  });

  it('draws Figma toast: the default surface, card radius, title, message, and tone glyph', async () => {
    await mount(SENT);
    // Dark mode, where the default and raised surfaces differ.
    container.dataset['oddMode'] = 'dark';
    const token = (property: string, variable: string) => {
      const probe = document.createElement('div');
      probe.style.setProperty(property, `var(${variable})`);
      container.append(probe);
      const value = getComputedStyle(probe).getPropertyValue(property);
      probe.remove();
      return value;
    };
    const el = byId<OddkinToast>('t');
    await show(el);
    const style = getComputedStyle(el);
    expect(style.backgroundColor).toBe(token('background-color', '--odd-color-surface-default'));
    expect(style.backgroundColor).not.toBe(token('background-color', '--odd-color-surface-raised'));
    expect(style.borderTopLeftRadius).toBe(token('border-top-left-radius', '--odd-card-radius'));
    expect(style.boxShadow).toBe(token('box-shadow', '--odd-elevation-lg'));
    const label = getComputedStyle(part(el, 'label'));
    expect(label.color).toBe(token('color', '--odd-color-text-primary'));
    expect(label.fontSize).toBe(token('font-size', '--odd-type-ui-size'));
    const messageEl = el.shadowRoot!.querySelector<HTMLElement>('.message')!;
    const message = getComputedStyle(messageEl);
    expect(message.color).toBe(token('color', '--odd-color-text-secondary'));
    expect(message.fontSize).toBe(token('font-size', '--odd-type-small-size'));
    expect(getComputedStyle(part(el, 'marker')).color).toBe(
      token('color', '--odd-color-success-foreground'),
    );
    const base = getComputedStyle(part(el, 'base'));
    const [sm, md] = ['--odd-space-sm', '--odd-space-md'].map((v) => token('padding-top', v));
    expect([base.paddingBlockStart, base.paddingInlineEnd]).toEqual([sm, sm]);
    expect([base.paddingBlockEnd, base.paddingInlineStart]).toEqual([md, md]);
    // The title and the close button share the first line; the message and the action the second.
    const [marker, title, closeBox, text, action, end] = [
      part(el, 'marker'),
      part(el, 'label'),
      part(el, 'close'),
      messageEl,
      byId('undo'),
      el.shadowRoot!.querySelector('.end')!,
    ].map(box);
    const range = document.createRange();
    range.selectNodeContents(part(el, 'label'));
    const line = range.getBoundingClientRect();
    expect(
      Math.abs(line.top + line.height / 2 - (closeBox!.top + closeBox!.height / 2)),
    ).toBeLessThan(1);
    expect(Math.round(Math.min(text!.top, action!.top))).toBe(
      Math.round(Math.max(marker!.bottom, title!.bottom, closeBox!.bottom)),
    );
    expect(Math.round(title!.left - marker!.right)).toBe(Math.round(parseFloat(sm!)));
    expect(marker!.height).toBe(box(part(el, 'marker').querySelector('svg')!).height);
    expect(marker!.height).toBe(parseFloat(token('font-size', '--odd-icon-size-md')));
    expect(action!.left).toBeGreaterThan(text!.right - 1);
    expect(action!.right).toBeLessThanOrEqual(closeBox!.left);
    expect(end!.height).toBe(action!.height);
    // A long word wraps inside the message.
    el.firstChild!.textContent = 'x'.repeat(200);
    await frame();
    expect(messageEl.scrollWidth).toBeLessThanOrEqual(messageEl.clientWidth);
  });

  it('closes and releases everything it owns when removed while open, holding no other toast', async () => {
    const before = scopeStats();
    // b above a, so nothing slides under the pointer when b goes.
    await mount(`${toast('b', 'duration="0"')}${toast('a', 'duration="800"')}`);
    const [a, b] = [byId<OddkinToast>('a'), byId<OddkinToast>('b')];
    await show(a, b);
    await userEvent.hover(b);
    b.remove();
    flush();
    expect(b.open).toBe(false);
    await wait(1200);
    expect(a.open).toBe(false);
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
