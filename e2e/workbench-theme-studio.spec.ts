import { readFileSync } from 'node:fs';
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

  test('shapes corners, controls, motion, type, and gamut from the scale inputs', async ({
    page,
  }) => {
    const style = () =>
      specimen(page, 0, 'primaryAction').evaluate((el) => {
        const css = getComputedStyle(el);
        const target = el.shadowRoot?.querySelector('button') ?? el;
        return {
          radius: getComputedStyle(target).borderTopLeftRadius,
          duration: css.getPropertyValue('--odd-motion-duration-normal').trim(),
          size: css.getPropertyValue('--odd-font-size-md').trim(),
          p3: [...el.ownerDocument.adoptedStyleSheets].some((sheet) =>
            [...sheet.cssRules].some((rule) => rule.cssText.includes('color-gamut: p3')),
          ),
        };
      });
    expect(await style()).toEqual({ radius: '8px', duration: '200ms', size: '1rem', p3: false });
    const choose = (path: string, label: string) =>
      page.locator(`select[data-path="${path}"]`).selectOption({ label });
    await choose('/radius/scale', 'Square');
    await expect.poll(async () => (await style()).radius).toBe('0px');
    await choose('/overrides/control.radius', 'Pill');
    await expect.poll(async () => (await style()).radius).toBe('9999px');
    const fill = async (path: string, value: string) => {
      const input = page.locator(`input[data-path="${path}"]`);
      await input.fill(value);
      await input.dispatchEvent('change');
    };
    await fill('/motion/scale', '2');
    await fill('/typography/scale/base', '1.25rem');
    await fill('/typography/scale/ratio', '1.25');
    await choose('/gamut', 'Display P3 where supported');
    await expect
      .poll(style)
      .toEqual({ radius: '9999px', duration: '400ms', size: '1.25rem', p3: true });
    expect(JSON.parse(await page.locator('#ts-json').inputValue())).toMatchObject({
      radius: { scale: 0 },
      motion: { scale: 2 },
      typography: { scale: { base: '1.25rem', ratio: 1.25 } },
      gamut: 'p3',
      overrides: { 'control.radius': '{radius.full}' },
    });
  });

  test('shows the ramps and the contrast of the role pairs, as the generator reports them', async ({
    page,
  }) => {
    const ramps = page.locator('#ramps');
    await expect(ramps.locator('thead th')).toHaveText([
      'Step',
      ...['brand', 'danger', 'info', 'neutral', 'success', 'warning'],
    ]);
    await expect(ramps.locator('tbody th')).toHaveText([
      '0',
      '50',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      '700',
      '800',
      '900',
      '950',
      '1000',
    ]);
    const summary = page.locator('#ts-contrast-summary');
    await expect(summary).toHaveText(
      /^\s*\d+ role pairs for the theme: \d+ pass, 0 fail,\s+\d+ exempt\.\s*$/,
    );
    const fill = async (selector: string, value: string) => {
      const input = page.locator(selector);
      await input.fill(value);
      await input.dispatchEvent('change');
    };
    // The brand ramp's 500 step follows the primary.
    const brand = ramps.locator('tbody tr:nth-child(7) td:nth-child(2) code');
    const before = (await brand.textContent()) ?? '';
    await fill('#ts-brand-primary', '#0a7d33');
    await expect(brand).not.toHaveText(before);
    // A low-contrast override still generates; its failing pairs come first.
    await fill('input[data-path="/overrides/color.text.secondary/light"]', '#bbbbbb');
    await expect(summary).not.toContainText(' 0 fail');
    const first = page.locator('#contrast tbody tr').first();
    await expect(first).toHaveAttribute('data-status', 'fail');
    await expect(first.locator('th')).toContainText('color.text.secondary');
  });

  test('exports the draft it shows, by keyboard, once that draft is generated', async ({
    page,
  }) => {
    // Edit by keyboard: the change applies when the field loses focus.
    await page.locator('input[data-path="/overrides/color.action.default/light"]').focus();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('#0a7d33');
    await page.keyboard.press('Tab');
    await expect.poll(async () => (await primary(page, 0)).background).toBe('rgb(10, 125, 51)');

    const config = page.getByRole('button', { name: 'Download default.theme.json' });
    const css = page.getByRole('button', { name: 'Download default.theme.css' });
    await config.focus();
    const [file] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
    expect(file.suggestedFilename()).toBe('default.theme.json');
    expect(JSON.parse(readFileSync(await file.path(), 'utf8'))).toMatchObject({
      name: 'default',
      overrides: { 'color.action.default': { light: '#0a7d33' } },
    });
    // The downloads' status; saving to the theme file, which the dev server offers, has its own.
    await expect(
      page.locator('#export').getByRole('status').filter({ hasText: 'Downloaded' }),
    ).toHaveText('Downloaded default.theme.json.');
    await page.keyboard.press('Tab');
    await expect(css).toBeFocused();
    const [sheet] = await Promise.all([
      page.waitForEvent('download'),
      page.keyboard.press('Enter'),
    ]);
    expect(sheet.suggestedFilename()).toBe('default.theme.css');
    expect(readFileSync(await sheet.path(), 'utf8')).toContain(
      '--odd-color-action-default: var(--odd-mode-light, #0a7d33)',
    );

    // Text that does not parse is not the draft: nothing exports, and the page says why.
    await page.locator('#ts-json').fill('{ "brand": ');
    await expect(config).toBeDisabled();
    await expect(css).toBeDisabled();
    await expect(page.locator('#ts-export-note')).toContainText('The JSON has an error');
  });

  const frames = (page: Page) =>
    [0, 1].map((i) => page.frameLocator('oddkin-workbench-theme-studio iframe').nth(i));

  test("shows any component's examples under the same theme, in light and dark", async ({
    page,
  }) => {
    await page.locator('#ts-screen').selectOption({ label: 'Button' });
    for (const frame of frames(page)) {
      await expect(frame.locator('figure[data-role="ghost"] > odd-button')).toBeAttached();
      const tags = await frame
        .locator('figure > :last-child')
        .evaluateAll((all) => [...new Set(all.map((el) => el.localName))]);
      expect(tags).toEqual(['odd-button']);
    }
    // An example with setup code is shown by its values, captioned as without that code.
    await expect(frames(page)[0]!.locator('figure[data-role="inForm"] > figcaption')).toHaveText(
      'Submits a form (without its setup code)',
    );
    const cell = page.locator('input[data-path="/overrides/color.action.default/light"]');
    await cell.fill('#0a7d33');
    await cell.dispatchEvent('change');
    const background = (i: number) =>
      frames(page)
        [i]!.locator('figure[data-role="primary"] > odd-button')
        .evaluate(
          (el) => getComputedStyle(el.shadowRoot!.querySelector('button')!).backgroundColor,
        );
    await expect.poll(() => background(0)).toBe('rgb(10, 125, 51)');
    expect(await background(1)).not.toBe('rgb(10, 125, 51)');
  });

  test('renders starter screens and a document an agent wrote, whose actions do nothing', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const screen = page.locator('#ts-screen');
    const editor = page.locator('#ts-composition');
    await screen.selectOption({ label: 'Report card' });
    for (const [i, frame] of frames(page).entries()) {
      // The first composition loads the renderer and its elements' module graphs.
      await expect(frame.locator('odd-card > odd-stat')).toHaveCount(2, { timeout: 20_000 });
      await expect(frame.locator('[data-oddkin-preview]')).toHaveAttribute(
        'data-odd-mode',
        MODES[i]!,
      );
    }
    expect(JSON.parse(await editor.inputValue())).toMatchObject({ version: 1 });
    await screen.selectOption({ label: 'Sign-in dialog' });
    for (const frame of frames(page))
      await expect(frame.locator('odd-dialog[open] odd-input#password')).toBeAttached();
    await screen.selectOption({ label: 'Settings form' });
    const save = frames(page)[0]!.locator('odd-button', { hasText: 'Save' });
    await expect(save).toBeAttached();
    await save.click();
    await expect(frames(page)[0]!.locator('odd-card')).toBeAttached();
    await expect(status(page)).not.toHaveAttribute('role', 'alert');

    // The app layout: navigation beside a sorted table with two rows selected, in each mode's
    // selection colours. A document is a screen: it fills the frame from the top, in the theme's
    // body type, where an example is centred.
    await screen.selectOption({ label: 'App layout' });
    const selection: string[] = [];
    for (const frame of frames(page)) {
      await expect(frame.locator('odd-split-panel > odd-side-nav')).toBeAttached();
      const table = frame.locator('odd-split-panel odd-table');
      await expect(table.locator('tr[part="row"]')).toHaveCount(4);
      await expect(table.locator('th[aria-sort="descending"]')).toContainText('Open tasks');
      const selected = table.locator('tr[part="row"].selected');
      await expect(selected).toHaveCount(2);
      selection.push(
        await selected.first().evaluate((row) => getComputedStyle(row).backgroundColor),
      );
      const layout = await frame.locator('odd-split-panel').evaluate((panel) => {
        const screen = panel.parentElement!;
        const heading = panel.querySelector('h1')!;
        const page = getComputedStyle(panel.querySelector('section')!);
        const header = getComputedStyle(panel.querySelector('header')!);
        return {
          share: panel.getBoundingClientRect().width / screen.clientWidth,
          top: panel.getBoundingClientRect().top - screen.getBoundingClientRect().top,
          font: getComputedStyle(heading).fontFamily,
          page: getComputedStyle(document.body).fontFamily,
          // The document's containers, laid out by the frame's layout.css.
          stack: [page.display, page.flexDirection, page.rowGap !== 'normal'],
          row: [header.display, header.justifyContent],
        };
      });
      expect(layout.share).toBeGreaterThan(0.9);
      expect(layout.top).toBeLessThan(40);
      expect(layout.font).not.toBe(layout.page);
      expect(layout.stack).toEqual(['flex', 'column', true]);
      expect(layout.row).toEqual(['flex', 'space-between']);
    }
    expect(selection[0]).not.toBe(selection[1]);

    // A team pastes the document an agent wrote from the packaged kit.
    await screen.selectOption({ label: 'Your document' });
    await editor.fill(
      readFileSync('tests/agent-run/settings-app/settings.composition.json', 'utf8'),
    );
    for (const frame of frames(page))
      await expect(frame.locator('odd-card > odd-switch#digest')).toBeAttached();
    expect(errors).toEqual([]);
  });

  test('explains documents it cannot render, and keeps each screen and the focus', async ({
    page,
  }) => {
    const screen = page.locator('#ts-screen');
    const editor = page.locator('#ts-composition');
    await screen.selectOption({ label: 'Settings form' });
    const [light] = frames(page);
    await expect(light!.locator('odd-card > odd-textarea')).toBeAttached({ timeout: 20_000 });
    await editor.fill((await editor.inputValue()).replace('"Save"', '"Save changes"'));
    for (const frame of frames(page))
      await expect(frame.locator('odd-button', { hasText: 'Save changes' })).toBeAttached();
    // Text that does not parse keeps the document shown.
    await editor.fill('{ "version": 1, ');
    await expect(page.locator('#ts-composition-note')).toContainText('Not rendered');
    await expect(light!.locator('odd-button', { hasText: 'Save changes' })).toBeAttached();
    // The renderer refuses a document whole and says where.
    await editor.fill(
      '{ "version": 1, "root": [{ "element": "odd-card", "children": [{ "element": "script" }] }] }',
    );
    await expect(page.getByRole('list', { name: 'Composition diagnostics' })).toContainText(
      '/root/0/children/0/element',
    );
    await expect(light!.locator('odd-card')).toHaveCount(0);
    // Each screen keeps its own text.
    await screen.selectOption({ label: 'Report card' });
    await expect(light!.locator('odd-card > odd-stat')).toHaveCount(2);
    await screen.selectOption({ label: 'Settings form' });
    await expect(editor).toHaveValue(/"script"/);

    // A modal dialog in a frame does not take the focus from the editor.
    await screen.selectOption({ label: 'Sign-in dialog' });
    const dialog = light!.locator('odd-dialog[open]');
    await expect(dialog).toBeAttached();
    await dialog.evaluate((el) => ((el as HTMLElement & { seen?: true }).seen = true));
    await editor.focus();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' ');
    await expect
      .poll(() => dialog.evaluate((el) => (el as HTMLElement & { seen?: true }).seen === true))
      .toBe(false);
    await expect(editor).toBeFocused();
  });
});
