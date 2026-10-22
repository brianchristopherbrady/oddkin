import { expect, request, test, type Page } from '@playwright/test';

// Packed consumers (M8): core-only, CSS-only, and full-application pages from tarballs installed
// outside the workspace (scripts/packed-consumers.mjs on port 4174; the components-only consumer
// is checked in e2e/components-only.spec.ts). Each installs only the packages it uses, and its
// actual import graph holds production builds of the runtime entries it imports: no development
// builds, Node or tooling entries, examples, or optional modules it does not use.
const server = 'http://127.0.0.1:4174';
const tooling =
  /\/(node|inspect|test|frameworks)\/|\.examples\.|@oddkin\/(analyzer|workbench|ai)\//;

interface Packed {
  installed: string[];
  imports: Record<string, string>;
  files: string[];
}
async function ready(name: string): Promise<Packed> {
  const api = await request.newContext();
  try {
    const response = await api.get(`${server}/${name}/__ready`, { timeout: 170_000 });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()) as Packed;
  } finally {
    await api.dispose();
  }
}
const installedModules = ({ files }: Packed) =>
  files.filter((f) => f.startsWith('./node_modules/'));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __violations: string[] }).__violations = violations;
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(`${event.violatedDirective}: ${event.blockedURI}`),
    );
  });
});

async function open(page: Page, url: string) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  return errors;
}
const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);

test.describe('core only', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    await ready('core-only');
  });

  test('installs only @oddkin/core and loads only its production runtime modules', async () => {
    const packed = await ready('core-only');
    expect(packed.installed).toEqual(['@oddkin/core']);
    const modules = installedModules(packed);
    expect(modules).toContain('./node_modules/@oddkin/core/dist/prod/element/index.js');
    expect(modules.filter((f) => !f.startsWith('./node_modules/@oddkin/core/dist/prod/'))).toEqual(
      [],
    );
    expect(modules.filter((f) => tooling.test(f))).toEqual([]);
  });

  test('its elements run under the strict CSP', async ({ page }) => {
    const errors = await open(page, `${server}/core-only/`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const button = page.locator('demo-counter').getByRole('button');
    await button.click();
    await button.click();
    await expect(button).toHaveText(/Clicks:\s*4/);
    expect(await violations(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('CSS only', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    await ready('css-only');
  });

  test('installs only @oddkin/tokens, whose CLI generates the page stylesheet, and loads no script', async ({
    page,
  }) => {
    const packed = await ready('css-only');
    expect(packed.installed).toEqual(['@oddkin/tokens']);
    expect(packed.files).toEqual([]);
    const requests: string[] = [];
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    const errors = await open(page, `${server}/css-only/`);
    expect(requests.filter((path) => path.endsWith('.js'))).toEqual([]);
    expect(requests).toContain('/css-only/generated/harbor.css');
    const generated = await (
      await page.request.get(`${server}/css-only/generated/harbor.css`)
    ).text();
    const workspace = await (
      await page.request.get('/examples/tokens-css-only/generated/harbor.css')
    ).text();
    expect(generated).toBe(workspace);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--odd-color-canvas').trim(),
      ),
    ).not.toBe('');
    expect(errors).toEqual([]);
  });
});

test.describe('full application', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);
    await ready('full-app');
  });

  for (const source of [
    { name: 'workspace build', url: '/examples/full-app/' },
    { name: 'packed tarballs', url: `${server}/full-app/` },
  ]) {
    test(`routes, a store, and the components work together (${source.name})`, async ({ page }) => {
      const errors = await open(page, source.url);
      await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
      await expect(page).toHaveTitle('Profile · Full application');
      await page.getByLabel('Name').fill('Grace');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page).toHaveTitle('Summary · Full application');
      await expect(page.locator('#summary')).toHaveText('Grace, saved 1 time.');
      await expect(page.getByRole('heading', { level: 1, name: 'Summary' })).toBeFocused();
      await page.getByRole('link', { name: 'Edit the profile' }).click();
      await expect(page).toHaveTitle('Profile · Full application');
      await expect(page.getByLabel('Name')).toHaveValue('Grace');
      expect(await violations(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test('the packed application installs its five packages and loads only runtime modules it uses', async () => {
    const packed = await ready('full-app');
    expect(packed.installed).toEqual([
      '@oddkin/app',
      '@oddkin/components',
      '@oddkin/core',
      '@oddkin/state',
      '@oddkin/tokens',
    ]);
    const modules = installedModules(packed);
    const production =
      /^\.\/node_modules\/@oddkin\/((core|state|app)\/dist\/prod|tokens\/dist|components\/dist)\//;
    expect(modules.filter((f) => !production.test(f))).toEqual([]);
    expect(modules.filter((f) => tooling.test(f))).toEqual([]);
    // Optional entries this page does not import stay out of its graph.
    expect(
      Object.keys(packed.imports).filter((s) =>
        /\/(persist|inspect|resource|command|lifecycle|collections|model|layout)\b/.test(s),
      ),
    ).toEqual([]);
  });
});
