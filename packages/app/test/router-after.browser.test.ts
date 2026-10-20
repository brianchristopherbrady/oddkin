// After a navigation (core-contracts.md §9): focus, announcements, and scroll restoration in a
// real document. A file of its own, so each router test document stays well within WebKit's limit
// of 100 history changes per 10 seconds.
import { describe, expect, it, vi } from 'vitest';
import { route } from '../src/router/index.js';
import {
  back,
  fixture,
  forward,
  settle,
  start,
  stop,
  until,
  useRouterFixture,
} from './router-fixture.js';

useRouterFixture();

/** The text of the router's polite live region (added to the end of the body). */
const announced = () =>
  [...document.querySelectorAll('body > [aria-live="polite"]')].at(-1)?.textContent ?? '';
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const scrolled = async (y: number) => {
  window.scrollTo(0, y);
  await frame(); // scroll events are dispatched with the next frame
};

describe('after a navigation', () => {
  it('focuses the target and announces the title when the path changes, not for a query or fragment', async () => {
    const heading = document.createElement('h1');
    const other = document.createElement('button');
    fixture.container.append(heading, other);
    let target: HTMLElement = heading;
    const router = start('/app/one', {
      routes: [route({ path: ':name', title: ({ params }) => `Page ${params['name']}` })],
      focus: () => target,
    });
    await settle();
    expect(document.activeElement).not.toBe(heading); // the first load moves nothing
    await new Promise((r) => setTimeout(r, 200));
    expect(announced()).toBe('');

    await router.navigate('/two');
    await settle();
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
    await until(() => announced() === 'Page two');

    other.focus();
    await router.navigate('/two?tab=api');
    await router.navigate('/two?tab=api#usage');
    await settle();
    expect(document.activeElement).toBe(other);
    await new Promise((r) => setTimeout(r, 200));
    expect(announced()).toBe('Page two');

    await back();
    await back();
    expect(router.state.value.location?.path).toBe('/two');
    expect(document.activeElement).toBe(other);
    await back();
    expect(router.state.value.location?.path).toBe('/one');
    expect(document.activeElement).toBe(heading);
    await until(() => announced() === 'Page one');

    const button = document.createElement('button');
    fixture.container.append(button);
    target = button; // already focusable: no tabindex is added
    await router.navigate('/three');
    await settle();
    expect(document.activeElement).toBe(button);
    expect(button.hasAttribute('tabindex')).toBe(false);
  });

  it('announces what the application says, or nothing; failing hooks are reported', async () => {
    const regions = () => document.querySelectorAll('body > [aria-live]').length;
    const before = regions();
    const router = start('/app/one', {
      routes: [route({ path: ':name' })],
      announce: (state) => `Opened ${state.location?.path}`,
    });
    expect(regions()).toBe(before + 2);
    await router.navigate('/two');
    await until(() => announced() === 'Opened /two');
    stop();
    expect(regions()).toBe(before);

    const silent = start('/app/one', { routes: [route({ path: ':name' })], announce: false });
    expect(regions()).toBe(before);
    await silent.navigate('/two');
    stop();

    const failing = start('/app/one', {
      routes: [route({ path: ':name' })],
      focus: () => {
        throw new Error('focus bug');
      },
      announce: () => {
        throw new Error('announce bug');
      },
    });
    await failing.navigate('/two');
    await settle();
    expect(fixture.reported.map((r) => r.code)).toEqual([
      'app.router.focus',
      'app.router.announce',
    ]);
  });

  it('starts a new path at the top or its fragment; back and forward return to where entries were left', async () => {
    const page = document.createElement('div');
    page.style.cssText = 'position: relative; height: 6000px';
    const deep = document.createElement('p');
    deep.id = 'deep';
    deep.style.cssText = 'position: absolute; top: 3000px; margin: 0';
    page.append(deep);
    fixture.container.append(page);
    history.scrollRestoration = 'auto';
    const router = start('/app/a', { routes: [route({ path: ':name' })] });
    expect(history.scrollRestoration).toBe('manual');

    await scrolled(1200);
    await router.navigate('/b');
    await settle();
    expect(window.scrollY).toBe(0);
    await scrolled(500);
    await back();
    expect(router.state.value.location?.path).toBe('/a');
    expect(window.scrollY).toBe(1200);
    await forward();
    expect(window.scrollY).toBe(500);

    await router.navigate('/c#deep');
    await settle();
    expect(Math.round(deep.getBoundingClientRect().top)).toBe(0);
    const atDeep = window.scrollY;
    await router.navigate('/c?q=1'); // only the query: the position is kept
    await router.refresh();
    await settle();
    expect(window.scrollY).toBe(atDeep);

    // A native fragment navigation scrolls before `popstate`: the position before it is kept.
    await scrolled(800);
    const changed = new Promise<void>((resolve) =>
      window.addEventListener('popstate', () => resolve(), { once: true }),
    );
    location.hash = 'deep';
    await changed;
    await settle();
    await frame();
    await back();
    expect(window.scrollY).toBe(800);

    stop();
    expect(history.scrollRestoration).toBe('auto'); // given back
  });

  it('writes one history entry per navigation from the top, and stores a position once scrolling pauses', async () => {
    const page = document.createElement('div');
    page.style.height = '6000px';
    fixture.container.append(page);
    const router = start('/app/a', { routes: [route({ path: ':name' })] });
    const push = vi.spyOn(history, 'pushState');
    const replace = vi.spyOn(history, 'replaceState');
    try {
      await router.navigate('/b');
      await router.navigate('/c');
      expect([push.mock.calls.length, replace.mock.calls.length]).toEqual([2, 0]);
      await scrolled(1500);
      await until(
        () => (history.state as { oddkinRouter?: { y?: number } } | null)?.oddkinRouter?.y === 1500,
      );
      expect(replace.mock.calls.length).toBe(1); // one write for the pause
    } finally {
      push.mockRestore();
      replace.mockRestore();
    }
  });

  it('leaves scrolling alone with scroll: false', async () => {
    const page = document.createElement('div');
    page.style.height = '6000px';
    fixture.container.append(page);
    history.scrollRestoration = 'auto';
    const router = start('/app/a', { routes: [route({ path: ':name' })], scroll: false });
    expect(history.scrollRestoration).toBe('auto'); // left alone
    // The application manages scrolling itself; with `auto`, Chromium's own restoration after an
    // earlier test's traversals reset the position at the next frame.
    history.scrollRestoration = 'manual';
    await scrolled(700);
    expect(window.scrollY).toBe(700);
    await router.navigate('/b');
    await settle();
    expect(window.scrollY).toBe(700);
  });
});
