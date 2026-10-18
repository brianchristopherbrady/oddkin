import { expect, test } from '@playwright/test';

// The floor probe also runs in named floor browsers (npm run compat:floor, recorded in
// research/compatibility/floor-results.json); here it runs in the current Playwright engines.
test('floor probe passes in current engines', async ({ page }) => {
  await page.goto('/tests/floor/probe.html');
  await expect(page.locator('html')).toHaveAttribute('data-probe', 'done', { timeout: 30_000 });
  const results = await page.evaluate(
    () =>
      (
        window as unknown as {
          __probe: { checks: Array<{ id: string; ok: boolean; detail: string }> };
        }
      ).__probe,
  );
  expect(results.checks.length).toBeGreaterThanOrEqual(16);
  for (const check of results.checks) expect(check.ok, `${check.id}: ${check.detail}`).toBe(true);
});
