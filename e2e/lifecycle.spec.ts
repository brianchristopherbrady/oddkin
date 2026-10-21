// Page suspension and restoration (core-contracts.md §9.1, ADR 0035) in real browsers, on
// examples/lifecycle. A real back/forward cache restoration is proven in Chromium only: Playwright
// launches Chromium with the cache disabled, so those tests start their own Chromium (the full
// build, new headless) without that switch. Playwright's Firefox disables the cache in its driver,
// and its WebKit never restored a page in our probes, so a real restoration there is not verified.
// Chromium also fires the Page Lifecycle `freeze`/`resume` events around the cache, which these
// tests observe; freezing a page outside the cache could not be triggered headless (CDP's
// Page.setWebLifecycleState fired neither event) and is not verified.
import { chromium, expect, test, type Browser, type Page } from '@playwright/test';

const url = '/examples/lifecycle/';
const ready = (page: Page) => expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
const probe = (page: Page) =>
  page.evaluate(() => {
    const example = (window as unknown as { lifecycleExample: Record<string, any> })
      .lifecycleExample;
    const audit = (window as unknown as { lifecycleAudit: Record<string, any> }).lifecycleAudit;
    return {
      loadId: example.loadId as string,
      running: example.app.running as boolean,
      suspended: example.app.suspended as boolean,
      restorations: (example.app.services?.lifecycle.state.value.restorations ?? null) as
        number | null,
      clicks: example.counter.state.value.clicks as number,
      service: { ...example.service, ticks: undefined },
      loads: { ...example.loads },
      stats: example.scopeStats() as {
        scopes: number;
        listeners: number;
        timers: number;
        effects: number;
      },
      active: Object.fromEntries(
        Object.entries(audit.active as Record<string, number>).filter(([, n]) => n !== 0),
      ),
      added: [...audit.added] as string[],
      transitions: [...audit.transitions] as string[],
    };
  });
/** The listeners the service keeps while running: once each, and freeze/resume in Chromium. */
const serviceListeners = (browserName: string) => ({
  'window:pagehide': 1,
  'window:pageshow': 1,
  'document:visibilitychange': 1,
  ...(browserName === 'chromium' ? { 'document:freeze': 1, 'document:resume': 1 } : {}),
});

let errors: string[];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test('the service registers the lifecycle listeners once, and nothing registers unload', async ({
  page,
  browserName,
}) => {
  await page.goto(url);
  await ready(page);
  const state = await probe(page);
  expect(state.active).toEqual(serviceListeners(browserName));
  expect(state.added.filter((entry) => /unload/.test(entry))).toEqual([]);
  expect(state.transitions).toEqual(['pageshow:false']);
  await expect(page.locator('[data-term="Resource with a restore policy"]')).toHaveText('load 1');
});

test('a reload is a new document, not a restoration', async ({ page }) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole('button', { name: 'Count' }).click();
  const before = await probe(page);
  expect(before.clicks).toBe(1);
  await page.reload();
  await ready(page);
  const after = await probe(page);
  expect(after.loadId).not.toBe(before.loadId);
  expect(after.transitions).toEqual(['pageshow:false']);
  expect(after).toMatchObject({
    clicks: 0,
    restorations: 0,
    service: { suspended: 0, resumed: 0 },
  });
});

test('history navigation inside the page suspends nothing', async ({ page }) => {
  await page.goto(url);
  await ready(page);
  await page.evaluate(() => history.pushState(null, '', '#step-2'));
  await page.goBack();
  await expect(page).toHaveURL(/\/examples\/lifecycle\/$/);
  const state = await probe(page);
  expect(state.transitions).toEqual(['pageshow:false']);
  expect(state).toMatchObject({ suspended: false, service: { suspended: 0, resumed: 0 } });
});

test('stopping the application removes its listeners; starting again adds them once', async ({
  page,
  browserName,
}) => {
  await page.goto(url);
  await ready(page);
  const running = await probe(page);
  await page.getByRole('button', { name: 'Stop the application' }).click();
  const stopped = await probe(page);
  expect(stopped.running).toBe(false);
  expect(stopped.active).toEqual({});
  expect(stopped.stats.listeners).toBe(
    running.stats.listeners - Object.keys(running.active).length,
  );
  await page.getByRole('button', { name: 'Start it again' }).click();
  const restarted = await probe(page);
  expect(restarted.active).toEqual(serviceListeners(browserName));
  expect(restarted.stats).toEqual(running.stats);
});

test.describe('a real back/forward cache restoration', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Not verified: Playwright’s Firefox disables the back/forward cache in its driver, and its WebKit never restored a page from it in our probes (pageshow.persisted stayed false, with a new document).',
  );

  let browser: Browser | undefined;
  let page: Page;
  test.beforeAll(async ({ browserName }, testInfo) => {
    if (browserName !== 'chromium') return;
    testInfo.setTimeout(60_000); // a cold first launch of the full build took over 30 s under load
    browser = await chromium.launch({
      channel: 'chromium', // the full build: the headless shell refuses the cache
      ignoreDefaultArgs: ['--disable-back-forward-cache'],
    });
  });
  test.afterAll(async ({}, testInfo) => {
    testInfo.setTimeout(60_000); // closing the full Chromium build took over 30 s once under load
    await browser?.close();
  });
  test.beforeEach(async ({ baseURL }) => {
    page = await browser!.newPage({ baseURL: baseURL! });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    await ready(page);
  });
  test.afterEach(async () => page?.close());

  /** Leave for another document, then come back with the browser's back button. */
  const awayAndBack = async () => {
    const restored = (transitions: string[]) =>
      transitions.filter((entry) => entry === 'pageshow:true').length;
    const before = restored((await probe(page)).transitions);
    await page.getByRole('link', { name: 'another page' }).click();
    await expect(page).toHaveTitle('Another page');
    await page.goBack({ waitUntil: 'commit' });
    await page.waitForFunction(
      (count) =>
        (
          (window as unknown as { lifecycleAudit?: { transitions: string[] } }).lifecycleAudit
            ?.transitions ?? []
        ).filter((entry) => entry === 'pageshow:true').length > count,
      before,
    );
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
    return probe(page);
  };

  test('restores the same page: services resume, state and listeners are kept, only policy resources reload', async () => {
    await page.getByRole('button', { name: 'Count' }).click();
    await page.getByRole('button', { name: 'Count' }).click();
    const before = await probe(page);
    expect(before).toMatchObject({ clicks: 2, loads: { revalidating: 1, kept: 1 } });

    const first = await awayAndBack();
    // The service is suspended at pagehide, before Chromium freezes the cached page, so it can
    // close connections that would keep the page out of the cache; Chromium's resume event
    // before pageshow does not resume it early, and it resumes once, at pageshow.
    expect(first.transitions).toEqual([
      'pageshow:false',
      'pagehide:true',
      'service:suspend',
      'freeze',
      'resume',
      'pageshow:true',
      'service:resume',
    ]);
    expect(first.loadId).toBe(before.loadId); // the same document, restored
    expect(first).toMatchObject({
      running: true,
      suspended: false,
      restorations: 1,
      clicks: 2,
      service: { suspended: 1, resumed: 1 },
      loads: { revalidating: 2, kept: 1 },
    });
    expect(first.active).toEqual(serviceListeners('chromium'));
    expect(first.added).toEqual(before.added); // nothing registered again
    expect(first.stats).toEqual(before.stats); // no scope, listener, or timer duplicated
    await expect(page.locator('[data-term="Resource with a restore policy"]')).toHaveText('load 2');
    await expect(page.locator('[data-term="Resource without one"]')).toHaveText('load 1');

    const second = await awayAndBack();
    expect(second.transitions.slice(7)).toEqual([
      'pagehide:true',
      'service:suspend',
      'freeze',
      'resume',
      'pageshow:true',
      'service:resume',
    ]);
    expect(second).toMatchObject({
      loadId: before.loadId,
      restorations: 2,
      clicks: 2,
      service: { suspended: 2, resumed: 2 },
      loads: { revalidating: 3, kept: 1 },
    });
    expect(second.added).toEqual(before.added);
    expect(second.stats).toEqual(before.stats);
  });

  test('after an explicit stop, a restoration resumes nothing and reloads nothing', async () => {
    await page.getByRole('button', { name: 'Stop the application' }).click();
    const stopped = await probe(page);
    const restored = await awayAndBack();
    expect(restored.transitions).toEqual([
      'pageshow:false',
      'pagehide:true',
      'freeze',
      'resume',
      'pageshow:true',
    ]);
    expect(restored).toMatchObject({
      loadId: stopped.loadId,
      running: false,
      service: { suspended: 0, resumed: 0 },
      loads: { revalidating: 1, kept: 1 },
    });
    expect(restored.active).toEqual({});
    expect(restored.stats).toEqual(stopped.stats);
  });
});
