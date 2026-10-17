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

test('components work from plain HTML with only core and tokens', async ({ page, browserName }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/examples/components-only/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

  // Buttons in the card footer belong to the form through the native `form` attribute.
  const save = page.getByRole('button', { name: 'Save' });
  await save.click();
  await expect(page.getByRole('status')).toHaveText('Submitted email=ada@example.com&intent=save');
  const email = page.getByLabel('Email');
  await email.fill('changed@example.com');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('status')).toHaveText('Reset');
  await expect(email).toHaveValue('ada@example.com');

  // Keyboard: Tab reaches the native button inside the shadow root; Enter activates it.
  await save.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText(/intent=save/);

  // Theme values from @mote/tokens/css/default.css reach the shadow DOM.
  const actionColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--mote-color-action-default')
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

  if (browserName === 'chromium') {
    // Accessibility tree from the browser itself: ElementInternals semantics are invisible to
    // DOM-based role queries.
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
      nodes: { role?: { value: string }; name?: { value: string }; ignored?: boolean }[];
    };
    const named = (role: string) =>
      nodes.filter((n) => !n.ignored && n.role?.value === role).map((n) => n.name?.value ?? '');
    expect(named('region')).toEqual(['Billing']);
    expect(named('button')).toEqual(expect.arrayContaining(['Save', 'Reset']));
  } else {
    test.info().annotations.push({
      type: 'accessibility-tree',
      description: `${browserName}: not verified (no accessibility-tree API in Playwright for this engine)`,
    });
  }

  expect(
    await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations),
  ).toEqual([]);
  expect(errors).toEqual([]);
});
