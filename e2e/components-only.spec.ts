import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, request, test, type Page } from '@playwright/test';

// The page runs from the workspace build through its import map, and from packed tarballs of
// core, tokens, and components installed outside the workspace (examples/components-only/
// packed.mjs, served on port 4174 by the Playwright configuration; packing starts on the first
// request).
const packed = 'http://localhost:4174';
const sources = [
  { name: 'workspace build', url: '/examples/components-only/' },
  { name: 'packed tarballs', url: `${packed}/` },
];
const axeSource = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);

/** axe-core WCAG 2.0, 2.1, and 2.2 A and AA rules over the whole document. */
async function axeViolations(page: Page): Promise<string[]> {
  // Evaluated through the automation channel, not a <script>, so the CSP stays as served.
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run(
            context: Document,
            options: object,
          ): Promise<{ violations: { id: string; nodes: { target: unknown }[] }[] }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return result.violations.map((v) => `${v.id}: ${JSON.stringify(v.nodes.map((n) => n.target))}`);
  });
}

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
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return errors;
}
const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);

interface Packed {
  installed: string[];
  imports: Record<string, string>;
}
async function packedConsumer(): Promise<Packed> {
  const api = await request.newContext();
  try {
    const response = await api.get(`${packed}/__ready`, { timeout: 170_000 });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()) as Packed;
  } finally {
    await api.dispose();
  }
}

for (const source of sources) {
  test.describe(source.name, () => {
    if (source.url.startsWith('http'))
      test.beforeAll(async () => {
        test.setTimeout(180_000);
        await packedConsumer();
      });

    test('components work from plain HTML with only core and tokens', async ({ page }) => {
      const errors = await open(page, source.url);

      // Buttons in the card footer belong to the form through the native `form` attribute.
      const save = page.getByRole('button', { name: 'Save' });
      await save.click();
      await expect(page.getByRole('status')).toHaveText(
        'Submitted email=ada@example.com&intent=save',
      );
      const email = page.getByRole('textbox', { name: 'Email' });
      await email.fill('changed@example.com');
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(page.getByRole('status')).toHaveText('Reset');
      await expect(email).toHaveValue('ada@example.com');

      // Keyboard: Tab reaches the native button inside the shadow root; Enter activates it.
      await save.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status')).toHaveText(/intent=save/);

      // Theme values from @oddkin/tokens/css/default.css reach the shadow DOM. Polled with the
      // pointer away: the pressed and hover colours fade back through a short transition.
      await page.mouse.move(0, 0);
      const actionColor = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--odd-color-action-default')
          .trim(),
      );
      expect(actionColor).not.toBe('');
      const background = () =>
        page
          .locator('#save')
          .evaluate(
            (el) => getComputedStyle(el.shadowRoot!.querySelector('button')!).backgroundColor,
          );
      const expected = await page.evaluate((color) => {
        const probe = document.createElement('span');
        probe.style.color = color;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      }, actionColor);
      await expect.poll(background).toBe(expected);

      // The icon-only button is named by `label`.
      await page.getByRole('button', { name: 'Billing help' }).click();
      await expect(page.getByRole('status')).toHaveText(
        'Receipts and invoices go to the email address above.',
      );

      expect(await violations(page)).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('has no axe violations in light and dark mode or after a blocked submission', async ({
      page,
    }) => {
      // The theme's durations are 0 ms under reduced motion, so colours are final when read.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors = await open(page, source.url);
      expect(await axeViolations(page)).toEqual([]);
      await page.evaluate(() => (document.documentElement.dataset['oddMode'] = 'dark'));
      expect(await axeViolations(page)).toEqual([]);
      await page.getByRole('textbox', { name: 'Email' }).fill('');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(await axeViolations(page)).toEqual([]);
      expect(await violations(page)).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('names cross shadow boundaries in the ARIA snapshot', async ({ page }) => {
      const errors = await open(page, source.url);
      // Computed by Playwright from each engine's DOM, styles, and open shadow roots: the text
      // field is named by the label in its own shadow root, buttons by slotted text or `label`.
      // ElementInternals semantics are invisible to it, so the card regions are checked below.
      await expect(page.locator('main')).toMatchAriaSnapshot(`
    - heading "Components only" [level=1]
    - heading "Billing" [level=2]
    - textbox "Email": ada@example.com
    - status
    - button "Reset"
    - button "Save"
    - button "Billing help"
    - heading "Plan" [level=2]
  `);
      // A blocked submission marks the field invalid.
      await page.getByRole('textbox', { name: 'Email' }).fill('');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('main')).toMatchAriaSnapshot(`
    - textbox "Email" [invalid]
  `);
      expect(errors).toEqual([]);
    });

    test('the browser accessibility tree exposes regions, names, descriptions, and states', async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName !== 'chromium',
        'Playwright exposes the native accessibility tree only through the Chromium DevTools protocol',
      );
      await open(page, source.url);
      const cdp = await page.context().newCDPSession(page);
      type Node = {
        role?: { value: string };
        name?: { value: string };
        description?: { value: string };
        ignored?: boolean;
        properties?: { name: string; value: { value: unknown } }[];
      };
      const tree = async () =>
        ((await cdp.send('Accessibility.getFullAXTree')) as { nodes: Node[] }).nodes.filter(
          (node) => !node.ignored,
        );
      const named = (nodes: Node[], role: string) =>
        nodes.filter((node) => node.role?.value === role).map((node) => node.name?.value ?? '');
      const property = (node: Node | undefined, name: string) =>
        String(node?.properties?.find((p) => p.name === name)?.value.value);

      let nodes = await tree();
      // `label` names one card and a slotted heading the other (ElementInternals); the unnamed
      // card is no landmark.
      expect(named(nodes, 'region')).toEqual(['Billing', 'Plan']);
      expect(named(nodes, 'button')).toEqual(['Reset', 'Save', 'Billing help']);
      const field = () => nodes.find((node) => node.role?.value === 'textbox');
      expect(field()?.name?.value).toBe('Email');
      expect(field()?.description?.value).toBe('Receipts go to this address.');
      expect([property(field(), 'required'), property(field(), 'invalid')]).toEqual([
        'true',
        'false',
      ]);

      await page.getByRole('textbox', { name: 'Email' }).fill('');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      nodes = await tree();
      expect(property(field(), 'invalid')).toBe('true');
    });
  });
}

test('the packed page installs only core, tokens, and components and loads only their published files', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { installed, imports } = await packedConsumer();
  expect(installed).toEqual(['@oddkin/components', '@oddkin/core', '@oddkin/tokens']);
  // Generated from the installed modules: every bare specifier they import, production builds.
  expect(Object.keys(imports).every((s) => /^@oddkin\/(core|tokens|components)\//.test(s))).toBe(
    true,
  );
  for (const [specifier, path] of Object.entries(imports))
    expect(path, specifier).toMatch(
      specifier.startsWith('@oddkin/core/')
        ? /^\.\/node_modules\/@oddkin\/core\/dist\/prod\//
        : /^\.\/node_modules\/@oddkin\/(tokens|components)\/dist\//,
    );
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  const errors = await open(page, `${packed}/`);
  const own = /^\/(main\.js|styles\.css)?$/;
  const published = /^\/node_modules\/@oddkin\/(core|tokens|components)\/dist\//;
  expect(requests.filter((path) => !own.test(path) && !published.test(path))).toEqual([]);
  expect(requests).toContain('/node_modules/@oddkin/tokens/dist/css/default.css');
  expect(requests).toContain('/node_modules/@oddkin/core/dist/prod/element/index.js');
  expect(await violations(page)).toEqual([]);
  expect(errors).toEqual([]);
});
