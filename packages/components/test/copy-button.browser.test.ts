import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinCopyButton } from '../src/copy-button/copy-button.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-copy-button (component-contracts.md §3.2), with the shipped theme. The Clipboard API is
// stubbed per test: a resolving write, a rejected one (permission denied), and none at all (an
// insecure page has no navigator.clipboard).
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let written: string[];
let refuse: Error | undefined;
const own = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const stub = (clipboard: unknown) =>
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
beforeEach(() => {
  written = [];
  refuse = undefined;
  stub({
    writeText: async (text: string) => {
      if (refuse) throw refuse;
      written.push(text);
    },
  });
});

let container: HTMLElement;
afterEach(async () => {
  await userEvent.unhover(document.body);
  container?.remove();
  flush();
  if (own) Object.defineProperty(navigator, 'clipboard', own);
  else delete (navigator as { clipboard?: unknown }).clipboard;
  getSelection()?.removeAllRanges();
  // Moving the pointer away can scroll the page, and the removal scrolls it back: let that scroll
  // event pass before the next test shows a confirmation, which any scroll takes away.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});

async function mount(attributes = 'value="ws_83f2a9"', before = '') {
  container = document.createElement('div');
  container.innerHTML = `${before}<button id="first">first</button><odd-copy-button ${attributes}></odd-copy-button><button id="last">last</button>`;
  document.body.append(container);
  const el = container.querySelector<OddkinCopyButton>('odd-copy-button')!;
  await settle(el);
  const events: string[] = [];
  el.addEventListener('odd-copy', (e) => events.push(e.detail.value));
  return { el, events };
}
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
const live = (el: Element, which: 'polite' | 'assertive') =>
  el.shadowRoot!.querySelector<HTMLElement>(`.${which}`)!;
const button = (name = 'Copy') => page.getByRole('button', { name, exact: true });
const open = (el: Element) => part(el, 'confirmation')!.matches(':popover-open');

describe('odd-copy-button', () => {
  it('is a native button named by its text, in the native tab order', async () => {
    const { el } = await mount();
    await expect.element(button()).toBeVisible();
    expect(part(el, 'button')!.localName).toBe('button');
    expect(part(el, 'button')!.getAttribute('type')).toBe('button');
    (container.querySelector('#first') as HTMLElement).focus();
    await userEvent.tab();
    expect(el.shadowRoot!.activeElement).toBe(part(el, 'button'));
    await userEvent.tab();
    expect(document.activeElement?.id).toBe('last');
  });

  it('copies value, confirms it in a popover, shows the check, and dispatches odd-copy', async () => {
    const { el, events } = await mount();
    await userEvent.click(part(el, 'button')!);
    await settle(el);
    expect(written).toEqual(['ws_83f2a9']);
    expect(events).toEqual(['ws_83f2a9']);
    const confirmation = part(el, 'confirmation')!;
    await expect.poll(() => open(el)).toBe(true);
    expect(confirmation.textContent).toBe('Copied to clipboard.');
    expect(confirmation.getAttribute('aria-hidden')).toBe('true');
    expect(part(el, 'status')!.hidden).toBe(true);
    expect(part(el, 'button')!.querySelector('svg path')!.getAttribute('d')).toBe(
      'M5 10.5l3.5 3.5L15 7',
    );
    await expect.poll(() => live(el, 'polite').textContent).toBe('Copied to clipboard.');
    expect(live(el, 'polite').getAttribute('role')).toBe('status');
  });

  it('places the confirmation above the button without moving the page or taking focus', async () => {
    const { el } = await mount('value="ws_83f2a9" style="margin: 6rem 12rem 0"');
    const before = part(el, 'base')!.getBoundingClientRect();
    part(el, 'button')!.focus();
    await el.copy();
    await expect.poll(() => open(el)).toBe(true);
    const box = part(el, 'confirmation')!.getBoundingClientRect();
    const anchor = part(el, 'button')!.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(part(el, 'confirmation')!).rowGap);
    expect(gap).toBeGreaterThan(0);
    expect(box.bottom).toBeCloseTo(anchor.top - gap, 0);
    expect(box.left + box.width / 2).toBeCloseTo(anchor.left + anchor.width / 2, 0);
    expect(part(el, 'base')!.getBoundingClientRect().toJSON()).toEqual(before.toJSON());
    expect(el.shadowRoot!.activeElement).toBe(part(el, 'button'));
    expect(getComputedStyle(part(el, 'confirmation')!).backgroundColor).toBe(
      themeValue('color', '--odd-color-surface-raised'),
    );
  });

  it('places it below the button when there is no room above', async () => {
    const { el } = await mount('value="x" style="position: fixed; inset-block-start: 0"');
    await el.copy();
    await expect.poll(() => open(el)).toBe(true);
    const box = part(el, 'confirmation')!.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(part(el, 'button')!.getBoundingClientRect().bottom);
  });

  it('takes the confirmation away on a scroll in any tree around it', async () => {
    // A scroller in the page holds a shadow tree with its own scroller around the button.
    container = document.createElement('div');
    container.style.cssText = 'block-size: 8rem; overflow: auto; margin-block-start: 6rem';
    container.innerHTML = '<div style="block-size: 20rem"></div>';
    document.body.append(container);
    const root = container.firstElementChild!.attachShadow({ mode: 'open' });
    root.innerHTML = `<div style="block-size: 6rem; overflow: auto">
      <div style="block-size: 20rem"><odd-copy-button value="x"></odd-copy-button></div></div>`;
    const el = root.querySelector<OddkinCopyButton>('odd-copy-button')!;
    await settle(el);
    await el.copy();
    await expect.poll(() => open(el)).toBe(true);
    root.querySelector('div')!.scrollTop = 40;
    await expect.poll(() => open(el)).toBe(false);
    // The check stays for the two seconds; a later copy confirms again.
    expect(part(el, 'button')!.querySelector('svg path')!.getAttribute('d')).toBe(
      'M5 10.5l3.5 3.5L15 7',
    );
    await el.copy();
    await expect.poll(() => open(el)).toBe(true);
    container.scrollTop = 40;
    await expect.poll(() => open(el)).toBe(false);
  });

  it('returns to rest after two seconds, and announces every copy', async () => {
    const { el } = await mount();
    await el.copy();
    await settle(el);
    await expect.poll(() => open(el)).toBe(true);
    await expect.poll(() => open(el), { timeout: 3000 }).toBe(false);
    expect(part(el, 'button')!.querySelector('svg rect')).not.toBeNull();
    live(el, 'polite').textContent = '';
    await el.copy();
    await expect.poll(() => live(el, 'polite').textContent).toBe('Copied to clipboard.');
  });

  it('restarts the two seconds when copied again', async () => {
    const { el } = await mount();
    await el.copy();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await el.copy();
    await new Promise((resolve) => setTimeout(resolve, 900));
    await settle(el);
    expect(open(el)).toBe(true);
  });

  it('copies with Enter and Space', async () => {
    const { el } = await mount();
    part(el, 'button')!.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await expect.poll(() => written).toEqual(['ws_83f2a9', 'ws_83f2a9']);
  });

  it('copies the form value or the text of the element named by from', async () => {
    let { el } = await mount('from="key"', '<input id="key" value="sk_live_123">');
    await el.copy();
    container.remove();
    ({ el } = await mount('from="note"', '<textarea id="note">Line one</textarea>'));
    await el.copy();
    container.remove();
    ({ el } = await mount('from="code"', '<code id="code">  npm install @oddkin/core  </code>'));
    await el.copy();
    container.remove();
    ({ el } = await mount('from="code" value="explicit"', '<code id="code">ignored</code>'));
    await el.copy();
    expect(written).toEqual(['sk_live_123', 'Line one', 'npm install @oddkin/core', 'explicit']);
  });

  it('when the browser refuses, says so in the danger colour, announces it assertively, and selects the value in a field', async () => {
    const { el, events } = await mount();
    refuse = new DOMException('Write permission denied.', 'NotAllowedError');
    await userEvent.click(part(el, 'button')!);
    await settle(el);
    expect(written).toEqual([]);
    expect(events).toEqual([]);
    expect(open(el)).toBe(false);
    expect(part(el, 'status')!.textContent).toBe('Could not copy. Select the text.');
    expect(getComputedStyle(part(el, 'status')!).color).toBe(
      themeValue('color', '--odd-color-danger-foreground'),
    );
    await expect
      .poll(() => live(el, 'assertive').textContent)
      .toBe('Could not copy. Select the text.');
    const field = part(el, 'fallback') as HTMLInputElement;
    expect(field.readOnly).toBe(true);
    expect(field.value).toBe('ws_83f2a9');
    await expect.poll(() => el.shadowRoot!.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 9]);
    expect(getComputedStyle(field).outlineColor).toBe(
      themeValue('color', '--odd-color-focus-ring'),
    );
    // A later success clears the failure.
    refuse = undefined;
    await el.copy();
    await settle(el);
    expect(part(el, 'fallback')!.hidden).toBe(true);
    expect(part(el, 'status')!.hidden).toBe(true);
    await expect.poll(() => open(el)).toBe(true);
  });

  it('with no Clipboard API (an insecure page), fails the same way', async () => {
    stub(undefined);
    const { el } = await mount();
    expect(await el.copy()).toBe(false);
    await settle(el);
    expect(part(el, 'status')!.textContent).toBe('Could not copy. Select the text.');
    expect((part(el, 'fallback') as HTMLInputElement).value).toBe('ws_83f2a9');
  });

  it('keeps line breaks after a failure: text with several lines goes in a text area', async () => {
    const { el } = await mount();
    el.value = 'npm install\nnpm test';
    refuse = new DOMException('Denied.', 'NotAllowedError');
    await el.copy();
    await settle(el);
    const field = part(el, 'fallback') as HTMLTextAreaElement;
    expect(field.localName).toBe('textarea');
    expect(field.readOnly).toBe(true);
    expect(field.value).toBe('npm install\nnpm test');
    expect(field.rows).toBe(2);
    await expect.poll(() => el.shadowRoot!.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 20]);
    el.value = 'ws_83f2a9';
    await el.copy();
    await settle(el);
    expect(part(el, 'fallback')!.localName).toBe('input');
  });

  it('lets the announcer of the surrounding surface say the outcome, across shadow roots', async () => {
    // One announcer per surface (an @oddkin/ai conversation): it takes odd-announce and cancels it.
    const heard: { text: string; priority: string; key: string }[] = [];
    container = document.createElement('div');
    container.addEventListener('odd-announce', (e) => {
      e.preventDefault();
      heard.push((e as CustomEvent).detail);
    });
    document.body.append(container);
    const root = container.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<odd-copy-button value="a"></odd-copy-button><odd-copy-button value="b"></odd-copy-button>';
    const [first, second] = root.querySelectorAll<OddkinCopyButton>('odd-copy-button');
    await settle(first!);
    await settle(second!);
    await first!.copy();
    await second!.copy();
    refuse = new DOMException('Denied.', 'NotAllowedError');
    await first!.copy();
    await settle(first!);
    expect(heard.map(({ text, priority }) => [text, priority])).toEqual([
      ['Copied to clipboard.', 'polite'],
      ['Copied to clipboard.', 'polite'],
      ['Could not copy. Select the text.', 'assertive'],
    ]);
    // The surface's announcer says each key once, so two buttons never share one.
    expect(new Set(heard.map((h) => h.key)).size).toBe(3);
    await new Promise((resolve) => setTimeout(resolve, 300));
    for (const el of [first!, second!])
      expect([live(el, 'polite').textContent, live(el, 'assertive').textContent]).toEqual(['', '']);
  });

  it('when it fails with from, selects the source text instead of adding a field', async () => {
    refuse = new DOMException('Denied.', 'NotAllowedError');
    let { el } = await mount('from="key"', '<input id="key" value="sk_live_123">');
    await el.copy();
    await settle(el);
    const input = container.querySelector<HTMLInputElement>('#key')!;
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 11]);
    expect(part(el, 'fallback')!.hidden).toBe(true);
    container.remove();
    ({ el } = await mount('from="code"', '<code id="code">npm install</code>'));
    await el.copy();
    expect(getSelection()?.toString()).toBe('npm install');
  });

  it('copies nothing while disabled or with nothing to copy', async () => {
    let { el } = await mount('value="x" disabled');
    expect((part(el, 'button') as HTMLButtonElement).disabled).toBe(true);
    expect(await el.copy()).toBe(false);
    container.remove();
    ({ el } = await mount(''));
    expect(await el.copy()).toBe(false);
    ({ el } = await mount('from="missing"'));
    expect(await el.copy()).toBe(false);
    await settle(el);
    expect(written).toEqual([]);
    expect(part(el, 'status')!.hidden).toBe(true);
  });

  it('takes its text from label and its words from strings', async () => {
    const { el } = await mount('value="x" label="Copy link"');
    await expect.element(button('Copy link')).toBeVisible();
    el.label = '';
    el.strings = { copy: 'Copier', copied: 'Copié.' };
    await settle(el);
    await expect.element(button('Copier')).toBeVisible();
    await el.copy();
    await settle(el);
    expect(part(el, 'confirmation')!.textContent).toBe('Copié.');
  });

  it('releases its timer and announcer when removed while copied', async () => {
    const before = scopeStats();
    const { el } = await mount();
    await el.copy();
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
