// Shared by the router browser tests. Each test file runs in its own document, so each gets its
// own copy of this state and its own share of WebKit's limit of 100 history changes per 10 seconds.
// A window listener records each click's outcome and then prevents any real navigation, so
// escaped links never leave the test page.
import { afterEach, beforeEach, expect } from 'vitest';
import { setErrorHandler, type ErrorContext } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import { createScope, type Scope } from '@oddkin/core/scope';
import { createRouter, type Router, type RouterOptions } from '../src/router/index.js';

export const fixture = {
  container: undefined as unknown as HTMLElement,
  reported: [] as ErrorContext[],
  lastClick: undefined as { prevented: boolean } | undefined,
  owner: undefined as Scope | undefined,
  /**
   * History entries pushed during the test. `history.length` cannot count them: in a serial run
   * every test file shares the tab's session history, which Chromium caps at 50 entries.
   */
  pushes: 0,
};

/** Register the hooks: a container, captured reports, the click guard, and a clean URL after. */
export function useRouterFixture(): void {
  const original = { href: location.href, title: document.title };
  const guard = (event: MouseEvent) => {
    fixture.lastClick = { prevented: event.defaultPrevented };
    event.preventDefault();
  };
  beforeEach(() => {
    fixture.lastClick = undefined;
    fixture.reported = [];
    fixture.pushes = 0;
    const push = History.prototype.pushState;
    history.pushState = function (...args: Parameters<History['pushState']>) {
      fixture.pushes++;
      push.apply(this, args);
    };
    setErrorHandler((_error, context) => fixture.reported.push(context));
    window.addEventListener('click', guard);
    fixture.container = document.createElement('div');
    document.body.append(fixture.container);
  });
  afterEach(() => {
    stop();
    delete (history as Partial<History>).pushState;
    fixture.container.remove();
    window.removeEventListener('click', guard);
    setErrorHandler(undefined);
    history.replaceState(null, '', original.href);
    document.title = original.title;
    window.scrollTo(0, 0);
    flush();
  });
}

/** Start a router at `url` on a new history entry, so back() only reaches this test's entries. */
export function start(
  url: string,
  options: Omit<RouterOptions, 'base'> & { base?: string },
): Router {
  history.pushState(null, '', url);
  const router = createRouter({ base: '/app/', ...options });
  fixture.owner = createScope();
  fixture.owner.use(router);
  return router;
}

/** Stop the router started by `start()`. */
export function stop(): void {
  fixture.owner?.dispose();
  fixture.owner = undefined;
}

export const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  flush();
};
export const until = async (condition: () => boolean) => {
  for (let i = 0; i < 200 && !condition(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(condition()).toBe(true);
};
export const traverse = async (step: () => void) => {
  const popped = new Promise<void>((resolve) =>
    window.addEventListener('popstate', () => resolve(), { once: true }),
  );
  step();
  await popped;
  await settle();
};
export const back = () => traverse(() => history.back());
export const forward = () => traverse(() => history.forward());

export const here = () => location.pathname + location.search + location.hash;
export const link = (href: string, attributes: Record<string, string> = {}) => {
  const anchor = document.createElement('a');
  anchor.setAttribute('href', href);
  for (const [name, value] of Object.entries(attributes)) anchor.setAttribute(name, value);
  anchor.textContent = href;
  fixture.container.append(anchor);
  return anchor;
};
/** Click `anchor`; resolves whether the router (or the page) prevented the default action. */
export const click = async (anchor: HTMLAnchorElement, init?: MouseEventInit) => {
  if (init) {
    anchor.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, ...init }),
    );
  } else {
    anchor.click();
  }
  await settle();
  return fixture.lastClick?.prevented;
};
