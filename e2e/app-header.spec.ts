import { expect, test, type Page } from '@playwright/test';

// examples/app-header/ (Figma appHeader): one banner landmark, named icon-only controls, the
// current destination in both layouts, and the narrow menu button that discloses the
// destinations; under a strict CSP, without horizontal scrolling.

async function open(page: Page, width: number) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __violations: string[] }).__violations = violations;
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(`${event.violatedDirective}: ${event.blockedURI}`),
    );
  });
  await page.setViewportSize({ width, height: 720 });
  await page.goto('/examples/app-header/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return async () => {
    expect(
      await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations),
    ).toEqual([]);
    expect(errors).toEqual([]);
  };
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('wide: one banner with the brand, the destinations, and named icon buttons', async ({
  page,
}) => {
  const done = await open(page, 1024);
  await expect(page.getByRole('banner')).toHaveCount(1);
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveText(['Overview', 'Projects', 'People']);
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  for (const name of ['Search', 'Notifications', 'Account'])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Navigation' })).toBeHidden();
  expect(await noHorizontalScroll(page)).toBe(true);
  // Tab order: brand, destinations, then the actions.
  await page.locator('body').focus();
  const order: string[] = [];
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    order.push(
      await page.evaluate(() => {
        const active = document.activeElement as HTMLElement;
        return active.getAttribute('label') ?? active.textContent!.trim();
      }),
    );
  }
  // WebKit's Tab skips links unless the user (or the platform: Linux) turns that on.
  const expected =
    test.info().project.name === 'webkit' && order[0] !== 'Oddkin'
      ? ['Search', 'Notifications', 'Account']
      : ['Oddkin', 'Overview', 'Projects', 'People', 'Search', 'Notifications', 'Account'];
  expect(order.slice(0, expected.length)).toEqual(expected);
  await done();
});

test('narrow: the menu button discloses the destinations below the bar, keeping the current one', async ({
  page,
}) => {
  const done = await open(page, 360);
  await expect(page.getByRole('banner')).toHaveCount(1);
  const toggle = page.getByRole('button', { name: 'Navigation' });
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveAttribute('aria-controls', 'primary');
  await expect(nav).toBeHidden();
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeHidden();
  for (const name of ['Search', 'Account'])
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveText([
    'Overview',
    'Projects',
    'People',
    'Notifications',
  ]);
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  // Below the bar's first row, and inside the viewport.
  const bar = await page.locator('.brand').boundingBox();
  const panel = await nav.boundingBox();
  expect(panel!.y).toBeGreaterThan(bar!.y + bar!.height - 1);
  expect(await noHorizontalScroll(page)).toBe(true);

  await toggle.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(nav).toBeHidden();
  await done();
});

test('reflows at 200% text in a 320 px viewport without horizontal scrolling', async ({ page }) => {
  const done = await open(page, 320);
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  await page.getByRole('button', { name: 'Navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await done();
});
