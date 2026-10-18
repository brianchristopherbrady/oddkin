import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __violations: string[] }).__violations = violations;
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(`${event.violatedDirective}: ${event.blockedURI}`),
    );
  });
});

test('core-only elements run under a strict CSP with Trusted Types required', async ({
  page,
  browserName,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/examples/core-counter/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

  // Local state: a direct binding updates the output.
  const counter = page.locator('demo-counter');
  const button = counter.getByRole('button');
  await expect(button).toHaveText(/Clicks:\s*0/);
  await button.click();
  await button.click();
  await expect(button).toHaveText(/Clicks:\s*4/);
  expect(await counter.evaluate((el) => el.matches(':state(positive)'))).toBe(true);
  await expect(
    page.getByRole('list', { name: 'Event log' }).getByRole('listitem').first(),
  ).toHaveText('count-change: 4');
  await button.press('Escape');
  await expect(button).toHaveText(/Clicks:\s*0/);

  // Public properties: attributes in, properties from ordinary DOM code, reflection out.
  const greeting = page.locator('demo-greeting');
  await expect(greeting.getByText('Lovely to see you, reader.')).toBeVisible();
  // styleMap writes through the CSSOM, which style-src 'self' permits (a parsed style attribute would be blocked).
  await expect(greeting.locator('p')).toHaveCSS('color', 'rgb(154, 52, 18)');
  await page.getByLabel('Name').fill('Ada');
  await page.getByLabel('Name').press('Enter');
  await page.getByLabel('Name').blur();
  await expect(greeting.getByText('Lovely to see you, Ada.')).toBeVisible();
  await expect(greeting.getByText('Earlier: reader')).toBeVisible();
  await page.getByLabel('Excited').check();
  await expect(greeting).toHaveAttribute('excited', '');
  await expect(greeting.getByText('Lovely to see you, Ada!')).toBeVisible();

  // Styles come from constructed sheets, which style-src 'self' does not block.
  expect(await greeting.evaluate((el) => el.shadowRoot?.adoptedStyleSheets.length)).toBe(1);

  // No policy violations from Oddkin or the page (checked before the deliberate probe below).
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
