// The router example (examples/router) in real browsers: what the vitest fixtures cannot do —
// actual new tabs, downloads, other documents, back and forward through the browser, and reloads.
import { expect, test, type Page } from '@playwright/test';

const base = '/examples/router/';
const ready = (page: Page) => expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const loadId = (page: Page) =>
  page.evaluate(() => (window as unknown as { loadId: string }).loadId);
const sectionTop = (page: Page) =>
  page.evaluate(() =>
    Math.round(document.getElementById('section-2')!.getBoundingClientRect().top),
  );
const link = (page: Page, name: string) => page.getByRole('link', { name, exact: true });

let errors: string[];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test('navigates in place with titles, focus, announcements, redirects, and scroll restoration', async ({
  page,
}) => {
  await page.goto(base);
  await ready(page);
  await expect(page).toHaveTitle('Home · Router example');
  const id = await loadId(page);

  await link(page, 'Long page').click();
  await expect(page).toHaveURL(/\/examples\/router\/long$/);
  await expect(page).toHaveTitle('Long page · Router example');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.locator('body > [aria-live="polite"]')).toHaveText(
    'Long page · Router example',
  );

  await page.evaluate(() => window.scrollTo(0, 1200));
  await link(page, 'Guide one').click();
  await expect(page.getByText('The one guide.')).toBeVisible();
  await expect(page).toHaveTitle('Guide one · Router example');
  expect(await scrollY(page)).toBe(0);

  await page.goBack();
  await expect(page).toHaveTitle('Long page · Router example');
  await expect.poll(() => scrollY(page)).toBe(1200);
  await page.goForward();
  await expect(page).toHaveTitle('Guide one · Router example');
  await expect.poll(() => scrollY(page)).toBe(0);

  await link(page, 'Long page, section 2').click();
  await expect(page).toHaveURL(/\/long#section-2$/);
  await expect.poll(() => sectionTop(page)).toBeLessThan(200);

  await link(page, 'Old guides').click();
  await expect(page).toHaveURL(/\/examples\/router\/guides$/);
  await expect(page).toHaveTitle('Guides · Router example');
  expect(await loadId(page)).toBe(id); // one document throughout
});

test('leaves new tabs and other documents to the browser', async ({ page, context }) => {
  await page.goto(base);
  await ready(page);
  const id = await loadId(page);

  const [tab] = await Promise.all([
    context.waitForEvent('page'),
    link(page, 'Guide one in a new tab').click(),
  ]);
  await expect.poll(() => tab.url()).toContain('/examples/router/guides/one');
  await tab.close();
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  expect(await loadId(page)).toBe(id);

  await link(page, 'Hash-mode page').click(); // rel="external" inside the base path
  await expect(page).toHaveURL(/\/examples\/router\/hash\.html$/);
  await ready(page);
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'hash');
  expect(await loadId(page)).not.toBe(id);
});

test('leaves downloads to the browser', async ({ page }) => {
  await page.goto(base);
  await ready(page);
  const id = await loadId(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    link(page, 'Download the example script').click(),
  ]);
  expect(download.suggestedFilename()).toBe('app.js');
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  expect(await loadId(page)).toBe(id);
});

test('a modified click is the browser’s', async ({ page, context, browserName }) => {
  test.skip(
    browserName === 'firefox',
    "Playwright's Firefox does not reliably report the page a Ctrl+click opens, and the original page sometimes stops responding afterwards; the router's decision is covered in all three engines by packages/app/test/router.browser.test.ts",
  );
  await page.goto(base);
  await ready(page);
  const id = await loadId(page);
  // Recorded after the router's document listener, without changing anything.
  await page.evaluate(() =>
    window.addEventListener('click', (event) => {
      (window as unknown as { clickPrevented: boolean }).clickPrevented = event.defaultPrevented;
    }),
  );
  const opened = context.waitForEvent('page', { timeout: 5000 }).catch(() => undefined);
  await link(page, 'Guide two').click({ modifiers: ['ControlOrMeta'] });
  const tab = await opened;
  const stayed = (await loadId(page).catch(() => undefined)) === id;
  console.log(
    `${test.info().project.name} modified click: ${tab ? 'another page opened' : 'no other page'}; ${stayed ? 'this document stayed' : 'this page loaded a new document'}`,
  );
  if (stayed) {
    expect(
      await page.evaluate(() => (window as unknown as { clickPrevented: boolean }).clickPrevented),
    ).toBe(false); // the router left it to the browser
    await expect(page).toHaveURL(new RegExp(`${base}$`));
  } else {
    await expect(page).toHaveURL(/\/examples\/router\/guides\/two$/);
  }
  if (tab) await expect.poll(() => tab.url()).toContain('/examples/router/guides/two');
});

test('returns to where the page was left after a reload', async ({ page }) => {
  await page.goto(base);
  await ready(page);
  await page.evaluate(() => window.scrollTo(0, 900));
  // Once scrolling pauses, the position is stored in the history entry.
  await expect
    .poll(() =>
      page.evaluate(
        () => (history.state as { oddkinRouter?: { y?: number } } | null)?.oddkinRouter?.y,
      ),
    )
    .toBe(900);
  await page.reload();
  await ready(page);
  await expect.poll(() => scrollY(page)).toBe(900);
});

test('hash mode: deep links and reloads on a static host; in-page fragments keep the route', async ({
  page,
}) => {
  await page.goto(`${base}hash.html#/guides/one`);
  await ready(page);
  await expect(page).toHaveTitle('Guide one · Router example');
  await page.reload();
  await ready(page);
  await expect(page).toHaveTitle('Guide one · Router example');
  await expect(page.getByText('The one guide.')).toBeVisible();

  await link(page, 'Long page').click();
  await expect(page).toHaveURL(/hash\.html#\/long$/);
  await link(page, 'Long page, section 2').click();
  await expect(page).toHaveURL(/hash\.html#\/long#section-2$/);
  await expect.poll(() => sectionTop(page)).toBeLessThan(200);
  await expect(page).toHaveTitle('Long page · Router example');

  await page.goBack();
  await expect(page).toHaveURL(/hash\.html#\/long$/);
  await expect.poll(() => scrollY(page)).toBe(0);
  await page.goBack();
  await expect(page).toHaveTitle('Guide one · Router example');
});
