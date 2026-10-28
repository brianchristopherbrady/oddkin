import { expect, test, type Page } from '@playwright/test';

// Theme Studio on the Workbench dev server (port 4175; tests/fixtures/workbench-oddkin sets
// themeStudio.themeConfig to the default theme). Specimens are the real components, mapped to
// roles by their examples' previewRoles.
const url = 'http://127.0.0.1:4175/theme-studio';
const MODES = ['light', 'dark'] as const;

const specimen = (page: Page, i: number, role: string) =>
  page
    .frameLocator('oddkin-workbench-theme-studio iframe')
    .nth(i)
    .locator(`figure[data-role="${role}"] > :last-child`);

/** The primary action's background, and whether it is still the first element seen. */
const primary = (page: Page, i: number) =>
  specimen(page, i, 'primaryAction').evaluate((el) => {
    const host = el as HTMLElement & { __seen?: true };
    const same = host.__seen === true;
    host.__seen = true;
    const target = el.shadowRoot?.querySelector('button') ?? el;
    return { same, background: getComputedStyle(target).backgroundColor };
  });

const status = (page: Page) => page.locator('#live-preview .wb-status');

test.describe('Theme Studio', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto(url);
    for (const i of [0, 1])
      await expect(specimen(page, i, 'primaryAction')).toBeAttached({ timeout: 45_000 });
    await expect(status(page)).toContainText('Generated in', { timeout: 30_000 });
  });

  test('previews the baseline on the real components, in light and dark', async ({ page }) => {
    await expect(page.locator('main h1')).toHaveText('Theme Studio');
    for (const [i, mode] of MODES.entries()) {
      const frame = page.frameLocator('oddkin-workbench-theme-studio iframe').nth(i);
      const figures = await frame
        .locator('figure')
        .evaluateAll((all) =>
          all.map((f) => `${(f as HTMLElement).dataset['role']}:${f.lastElementChild?.localName}`),
        );
      // The built-in specimen roles first, in their order; then the roles examples add, by name.
      expect(figures.slice(0, 8)).toEqual([
        'surface:odd-card',
        'badge:odd-badge',
        'textInput:odd-input',
        'checkbox:odd-checkbox',
        'switch:odd-switch',
        'primaryAction:odd-button',
        'secondaryAction:odd-button',
        'navigation:odd-side-nav',
      ]);
      const added = figures.slice(8).map((figure) => figure.split(':'));
      expect(added.length).toBeGreaterThan(0);
      const names = added.map(([role]) => role ?? '');
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      for (const [, tag] of added) expect(tag).toMatch(/^odd-[a-z-]+$/);
      await expect(frame.locator('[data-oddkin-preview]')).toHaveAttribute('data-odd-mode', mode);
    }
    // Roles without a claiming example, or claimed twice, are labelled with what supplies them.
    await expect(page.locator('[data-missing="role:heading"]')).toContainText(
      "previewRoles: ['heading']",
    );
    await expect(page.locator('[data-missing="role:menu"]')).toContainText(
      'themeStudio.preview.roles.menu (claimed by odd-menu/',
    );
  });

  test('applies an edit in place, only in the edited mode', async ({ page }) => {
    const [light, dark] = [await primary(page, 0), await primary(page, 1)];
    const cell = page.locator('input[data-path="/overrides/color.action.default/light"]');
    await cell.fill('#0a7d33');
    await cell.dispatchEvent('change');
    await expect.poll(async () => (await primary(page, 0)).background).toBe('rgb(10, 125, 51)');
    // Same element instances (no remount); the dark specimen is unchanged.
    expect((await primary(page, 0)).same).toBe(true);
    expect(await primary(page, 1)).toEqual({ same: true, background: dark.background });
    expect(light.background).not.toBe('rgb(10, 125, 51)');
    // The JSON editor shows the same draft.
    expect(JSON.parse(await page.locator('#ts-json').inputValue())).toMatchObject({
      overrides: { 'color.action.default': { light: '#0a7d33' } },
    });
  });

  test('keeps the last valid theme for invalid drafts and says why', async ({ page }) => {
    const before = await primary(page, 0);
    const json = page.locator('#ts-json');
    await json.fill('{ "brand": ');
    await expect(page.locator('#ts-json-error')).toContainText('Not applied');
    await json.fill('{ "name": "x", "brand": { "primary": "not-a-colour" } }');
    await expect(status(page)).toHaveText(/invalid: the preview keeps the last valid theme/);
    await expect(status(page)).toHaveAttribute('role', 'alert');
    await expect(page.getByRole('list', { name: 'Generator diagnostics' })).toContainText(
      '/brand/primary',
    );
    expect(await primary(page, 0)).toEqual({ same: true, background: before.background });
  });

  test('generates only the newest of rapid edits', async ({ page }) => {
    const cell = page.locator('input[data-path="/overrides/color.action.default/light"]');
    const values = ['#7a1f1f', '#1f7a2a', '#1f2a7a', '#7a6a1f', '#0a7d33'];
    await cell.evaluate((input, list) => {
      for (const value of list) {
        (input as HTMLInputElement).value = value;
        input.dispatchEvent(new Event('change'));
      }
    }, values);
    await expect.poll(async () => (await primary(page, 0)).background).toBe('rgb(10, 125, 51)');
    const stats = await page
      .locator('oddkin-workbench-theme-studio')
      .evaluate((el) => (el as unknown as { generation: Record<string, number> }).generation);
    // Baseline + the first edit run; the next three are superseded before they run.
    expect(stats['sent']).toBeLessThan(1 + values.length);
    expect(stats['superseded']).toBeGreaterThan(0);
  });
});
