import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __violations: string[] }).__violations = violations;
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(`${event.violatedDirective}: ${event.blockedURI}`),
    );
  });
});

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/examples/components-only/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return errors;
}
const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);

test('components work from plain HTML with only core and tokens', async ({ page }) => {
  const errors = await open(page);

  // Buttons in the card footer belong to the form through the native `form` attribute.
  const save = page.getByRole('button', { name: 'Save' });
  await save.click();
  await expect(page.getByRole('status')).toHaveText('Submitted email=ada@example.com&intent=save');
  const email = page.getByRole('textbox', { name: 'Email' });
  await email.fill('changed@example.com');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('status')).toHaveText('Reset');
  await expect(email).toHaveValue('ada@example.com');

  // Keyboard: Tab reaches the native button inside the shadow root; Enter activates it.
  await save.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText(/intent=save/);

  // Theme values from @oddkin/tokens/css/default.css reach the shadow DOM.
  const actionColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--odd-color-action-default')
      .trim(),
  );
  expect(actionColor).not.toBe('');
  const background = await page
    .locator('#save')
    .evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('button')!).backgroundColor);
  const expected = await page.evaluate((color) => {
    const probe = document.createElement('span');
    probe.style.color = color;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, actionColor);
  expect(background).toBe(expected);

  // The icon-only button is named by `label`.
  await page.getByRole('button', { name: 'Billing help' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Receipts and invoices go to the email address above.',
  );

  expect(await violations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('names cross shadow boundaries in the ARIA snapshot', async ({ page }) => {
  const errors = await open(page);
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
  await open(page);
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
  expect([property(field(), 'required'), property(field(), 'invalid')]).toEqual(['true', 'false']);

  await page.getByRole('textbox', { name: 'Email' }).fill('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  nodes = await tree();
  expect(property(field(), 'invalid')).toBe('true');
});
