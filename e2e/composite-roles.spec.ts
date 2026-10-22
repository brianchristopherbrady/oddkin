import { expect, test } from '@playwright/test';

// ADR 0043 spike: composite roles under a strict CSP with Trusted Types required.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __violations: string[] }).__violations = violations;
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(`${event.violatedDirective}: ${event.blockedURI}`),
    );
  });
});

test('one composite template renders each family under a strict CSP', async ({
  page,
  browserName,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/examples/composite-roles/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

  for (const prefix of ['demo', 'studio']) {
    const rows = page.locator(`${prefix}-rows li`);
    await expect(rows).toHaveCount(3);
    await expect(page.locator(`${prefix}-rows ${prefix}-field`)).toHaveCount(3);
    await expect(page.locator(`${prefix}-rows ${prefix}-button`)).toHaveCount(3);
    const other = prefix === 'demo' ? 'studio' : 'demo';
    await expect(page.locator(`${prefix}-rows ${other}-field`)).toHaveCount(0);
    await expect(page.locator(`${prefix}-rows ${prefix}-field input`).nth(1)).toHaveValue(
      'Grace Hopper',
    );
  }

  // A child's event reaches the composite, and the reordered rows keep their children.
  const studio = page.locator('studio-rows');
  const grace = studio.locator('li[data-key="grace"] studio-field');
  const before = await grace.elementHandle();
  await studio.locator('li[data-key="grace"] studio-button button').click();
  await expect(studio.locator('li').first()).toHaveAttribute('data-key', 'grace');
  expect(await grace.evaluate((el, old) => el === old, before)).toBe(true);

  expect(
    await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations),
  ).toEqual([]);
  const trustedTypes = await page.evaluate(() => {
    if (!('trustedTypes' in window)) return 'unsupported';
    try {
      document.createElement('div').innerHTML = '<b>x</b>';
      return 'not enforced';
    } catch {
      return 'enforced';
    }
  });
  test
    .info()
    .annotations.push({ type: 'trusted-types', description: `${browserName}: ${trustedTypes}` });
  expect(['enforced', 'unsupported']).toContain(trustedTypes);
  expect(errors).toEqual([]);
});
