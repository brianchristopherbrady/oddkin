import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { relativeUnit, type OddkinRelativeTime } from '../src/relative-time/relative-time.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-relative-time (component-contracts.md §3.2), with the shipped theme.
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

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
async function mount(attributes = '', lang = 'en') {
  container = document.createElement('div');
  container.lang = lang;
  container.innerHTML = `<odd-relative-time ${attributes}></odd-relative-time>`;
  document.body.append(container);
  const el = container.querySelector<OddkinRelativeTime>('odd-relative-time')!;
  await settle(el);
  return el;
}
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
const style = (el: Element) => getComputedStyle(el);

describe('relativeUnit', () => {
  it('picks the unit that says the distance best, rounded', () => {
    const now = Date.UTC(2026, 9, 25, 12);
    const at = (seconds: number) => relativeUnit(now + seconds * 1000, now);
    expect(at(0)).toEqual([0, 'second']);
    expect(at(-44)).toEqual([0, 'second']);
    expect(at(-45)).toEqual([-1, 'minute']);
    expect(at(30 * 60)).toEqual([30, 'minute']);
    expect(at(-45 * 60)).toEqual([-1, 'hour']);
    expect(at(-3 * 3600)).toEqual([-3, 'hour']);
    expect(at(-22 * 3600)).toEqual([-1, 'day']);
    expect(at(2 * 86400)).toEqual([2, 'day']);
    expect(at(-6.5 * 86400)).toEqual([-1, 'week']);
    expect(at(-25 * 86400)).toEqual([-4, 'week']);
    expect(at(-26 * 86400)).toEqual([-1, 'month']);
    expect(at(-319 * 86400)).toEqual([-10, 'month']);
    expect(at(-320 * 86400)).toEqual([-1, 'year']);
    expect(at(3 * 365.25 * 86400)).toEqual([3, 'year']);
  });
});

describe('odd-relative-time', () => {
  it('says the time relative to now in a <time> that keeps the exact value', async () => {
    const datetime = iso(-3 * HOUR);
    const el = await mount(`datetime="${datetime}"`);
    const time = part(el, 'time')!;
    expect(time.localName).toBe('time');
    expect(time.getAttribute('datetime')).toBe(datetime);
    expect(time.textContent).toBe('3 hours ago');
    await expect.element(page.getByText('3 hours ago', { exact: true })).toBeVisible();
  });

  it('says past, future, and now in words, as Intl does', async () => {
    for (const [offset, text] of [
      [-1 * DAY, 'yesterday'],
      [2 * DAY + HOUR, 'in 2 days'],
      [-10_000, 'now'],
      [-5 * 60_000, '5 minutes ago'],
    ] as const) {
      const el = await mount(`datetime="${iso(offset)}"`);
      expect(part(el, 'time')!.textContent, text).toBe(text);
      container.remove();
    }
  });

  it('speaks the page’s language, from the nearest lang', async () => {
    const datetime = iso(-3 * HOUR);
    for (const lang of ['de', 'fr', 'ja']) {
      const el = await mount(`datetime="${datetime}"`, lang);
      const expected = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(-3, 'hour');
      expect(part(el, 'time')!.textContent, lang).toBe(expected);
      container.remove();
    }
  });

  it('gives the absolute date and time as the tooltip, and shows it with detail', async () => {
    const datetime = '2026-10-24T09:30:00-07:00';
    const el = await mount(`datetime="${datetime}"`);
    const absolute = new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(datetime));
    expect(part(el, 'time')!.title).toBe(absolute);
    expect(part(el, 'detail')).toBeNull();
    el.detail = true;
    await settle(el);
    expect(el.hasAttribute('detail')).toBe(true);
    expect(part(el, 'detail')!.textContent).toBe(absolute);
    // Below the relative text, `space.xs` apart, in the primary colour; the relative text secondary.
    const relative = part(el, 'time')!.getBoundingClientRect();
    const detail = part(el, 'detail')!.getBoundingClientRect();
    expect(detail.top).toBeGreaterThanOrEqual(relative.bottom);
    expect(style(part(el, 'detail')!).color).toBe(themeValue('color', '--odd-color-text-primary'));
    expect(style(part(el, 'time')!).color).toBe(themeValue('color', '--odd-color-text-secondary'));
    expect(style(part(el, 'time')!).fontSize).toBe(
      themeValue('font-size', '--odd-type-small-size'),
    );
  });

  it('says "Time unavailable" for a missing or unparseable datetime, and never renders a <time>', async () => {
    for (const attributes of ['', 'datetime="3 hours ago"', 'datetime="2026-13-45"']) {
      const el = await mount(`${attributes} detail`);
      expect(part(el, 'time')!.localName, attributes).toBe('span');
      expect(part(el, 'time')!.textContent).toBe('Time unavailable');
      expect(part(el, 'detail')).toBeNull();
      container.remove();
    }
    const el = await mount();
    el.strings = { unavailable: 'Heure inconnue' };
    await settle(el);
    expect(part(el, 'time')!.textContent).toBe('Heure inconnue');
  });

  it('renders again when datetime changes', async () => {
    const el = await mount(`datetime="${iso(-3 * HOUR)}"`);
    el.datetime = iso(2 * DAY + HOUR);
    await settle(el);
    expect(part(el, 'time')!.textContent).toBe('in 2 days');
    el.datetime = '';
    await settle(el);
    expect(part(el, 'time')!.textContent).toBe('Time unavailable');
  });

  it('draws the clock glyph before the text, at the start in right-to-left text', async () => {
    const el = await mount(`datetime="${iso(-3 * HOUR)}"`);
    const glyph = el.shadowRoot!.querySelector('svg.glyph')!;
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
    expect(glyph.getBoundingClientRect().width).toBe(
      parseFloat(themeValue('inline-size', '--odd-icon-size-sm')),
    );
    expect(glyph.getBoundingClientRect().right).toBeLessThanOrEqual(
      part(el, 'time')!.getBoundingClientRect().left,
    );
    container.dir = 'rtl';
    expect(glyph.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      part(el, 'time')!.getBoundingClientRect().right,
    );
  });

  it('releases everything when removed', async () => {
    const before = scopeStats();
    await mount(`datetime="${iso(-HOUR)}" detail`);
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
