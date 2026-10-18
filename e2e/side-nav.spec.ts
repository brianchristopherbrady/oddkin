import { expect, test, type Locator, type Page } from '@playwright/test';

// examples/side-nav/: odd-side-nav from data, slots, and both; narrow and wide containers;
// recipe vs handwritten CSS; nested scopes; keyboard; reflow; under a strict CSP.

test.describe.configure({ timeout: 60_000 });

async function open(page: Page) {
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
  await page.goto('/examples/side-nav/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return async () => {
    expect(
      await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations),
    ).toEqual([]);
    expect(errors).toEqual([]);
  };
}

const inner = (host: Locator, selector: string, property: string) =>
  host.evaluate(
    (el, [s, p]) => getComputedStyle(el.shadowRoot!.querySelector(s!)!).getPropertyValue(p!),
    [selector, property] as const,
  );

const content = (nav: Locator) =>
  nav.evaluate((el) => {
    const s = getComputedStyle(el.shadowRoot!.querySelector('.content')!);
    return { display: s.display, columns: s.gridTemplateColumns.split(' ').length };
  });

test('renders narrow and wide instances of one definition with container queries only', async ({
  page,
}) => {
  const clean = await open(page);
  expect((await content(page.locator('#nav-narrow'))).display).toBe('flex');
  expect(await content(page.locator('#nav-wide'))).toEqual({ display: 'grid', columns: 3 });
  // Links are native: the current one is marked for assistive technology.
  const current = page.locator('#nav-narrow').getByRole('link', { name: 'Theming' });
  await expect(current).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#nav-narrow').getByRole('navigation')).toHaveAccessibleName(
    'Primary, narrow',
  );
  await clean();
});

test('the recipe and the handwritten CSS compute the same styles at every width', async ({
  page,
}) => {
  const clean = await open(page);
  const recipe = page.locator('#nav-recipe');
  const hand = page.locator('.hand-nav');
  for (const rem of [12, 24, 36, 44, 56]) {
    await page.locator('#width').fill(String(rem));
    const left = await recipe.evaluate((el) => {
      const root = el.shadowRoot!;
      const c = getComputedStyle(root.querySelector('.content')!);
      const a = getComputedStyle(root.querySelector('a[aria-current]')!);
      const b = getComputedStyle(root.querySelector('a:not([aria-current])')!);
      return [
        c.display,
        c.gridTemplateColumns,
        c.rowGap,
        a.paddingInlineStart,
        a.minHeight,
        a.borderInlineStartColor,
        a.backgroundColor,
        a.fontWeight,
        b.fontSize,
        b.lineHeight,
        b.borderTopLeftRadius,
      ];
    });
    const right = await hand.evaluate((el) => {
      const c = getComputedStyle(el.querySelector('.hand-nav__content')!);
      const a = getComputedStyle(el.querySelector('a[aria-current]')!);
      const b = getComputedStyle(el.querySelector('a:not([aria-current])')!);
      return [
        c.display,
        c.gridTemplateColumns,
        c.rowGap,
        a.paddingInlineStart,
        a.minHeight,
        a.borderInlineStartColor,
        a.backgroundColor,
        a.fontWeight,
        b.fontSize,
        b.lineHeight,
        b.borderTopLeftRadius,
      ];
    });
    expect(left, `${rem}rem`).toEqual(right);
  }
  await clean();
});

test('slotted links, hybrid regions, nested profiles, and modes', async ({ page }) => {
  const clean = await open(page);
  const declarative = page.locator('#nav-declarative');
  await expect(declarative.getByRole('link')).toHaveCount(3);
  const hybrid = page.locator('#nav-hybrid');
  await expect(hybrid.getByText('Workspace')).toBeVisible();
  await expect(hybrid.getByText('Signed in as Ada')).toBeVisible();
  // The compact profile re-declares navigation roles inside its scope only.
  const padding = (id: string) => inner(page.locator(id), 'a', 'padding-inline-start');
  const normal = parseFloat(await padding('#nav-default'));
  const compact = parseFloat(await padding('#nav-compact'));
  expect(compact).toBeLessThan(normal);
  const color = (id: string) => inner(page.locator(id), '.root', 'color');
  expect(await color('#nav-dark')).not.toBe(await color('#nav-default'));
  await clean();
});

test('keyboard: Tab order, disclosure groups, actions, and a visible focus ring', async ({
  page,
  browserName,
}) => {
  const clean = await open(page);
  const nav = page.locator('#nav-narrow');
  const guides = nav.getByRole('button', { name: 'Guides' });
  if (browserName === 'webkit') {
    // WebKit's default keeps links out of the Tab order (Safari's "Press Tab to highlight
    // each item" setting), so only the buttons are reached by Tab there.
    await guides.focus();
  } else {
    await nav.getByRole('link', { name: 'Overview' }).focus();
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link', { name: /Components/ })).toBeFocused();
    await page.keyboard.press('Tab');
  }
  await expect(guides).toBeFocused();
  await expect(guides).toHaveAttribute('aria-expanded', 'true');
  const outline = await guides.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(guides).toHaveAttribute('aria-expanded', 'false');
  await expect(nav.getByRole('link', { name: 'Theming' })).toBeHidden();
  await expect(page.locator('#log')).toHaveText('guides collapsed');
  await page.keyboard.press('Space');
  await expect(guides).toHaveAttribute('aria-expanded', 'true');
  await nav.getByRole('button', { name: 'New project' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#log')).toHaveText('Action project.create from new-project');
  await clean();
});

test('reflows at 320 CSS pixels and at 200% text without horizontal scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const clean = await open(page);
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  expect(await overflow()).toBeLessThanOrEqual(0);
  // Entries grow with the text and never clip their labels.
  const clipped = await page
    .locator('#nav-narrow')
    .evaluate((el) =>
      [...el.shadowRoot!.querySelectorAll<HTMLElement>('.entry')].some(
        (entry) => entry.scrollHeight > entry.clientHeight + 1,
      ),
    );
  expect(clipped).toBe(false);
  await clean();
});
