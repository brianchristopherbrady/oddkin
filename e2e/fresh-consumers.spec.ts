import { expect, request, test } from '@playwright/test';

// Fresh projects (priority plan P0.1): Vite with TypeScript and Sass, React, Vue, and Svelte. Each
// installs the packed packages and its own build tools (scripts/packed-consumers.mjs on port
// 4174), type-checks when it is TypeScript, and is served from its production build.
const server = 'http://127.0.0.1:4174';
const consumers = ['vite-ts', 'react', 'vue', 'svelte'] as const;

// Each install takes minutes on a cold npm cache: start all four at once (the server keeps each
// one's result), then each block waits for its own.
test.beforeAll(() => {
  for (const name of consumers) void fetch(`${server}/${name}/__ready`).catch(() => {});
});

for (const name of consumers)
  test.describe(name, () => {
    test.beforeAll(async () => {
      test.setTimeout(900_000);
      const api = await request.newContext();
      try {
        const response = await api.get(`${server}/${name}/__ready`, { timeout: 890_000 });
        expect(response.ok(), await response.text()).toBe(true);
        const packed = (await response.json()) as { installed: string[]; files: string[] };
        expect(packed.installed).toEqual(['@oddkin/components', '@oddkin/core', '@oddkin/tokens']);
        expect(packed.files.some((file) => file.endsWith('.js'))).toBe(true);
      } finally {
        await api.dispose();
      }
    });

    test('registers the elements, reports typed input, and submits their values with the form', async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto(`${server}/${name}/`);
      await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();
      const defined = await page.evaluate(() =>
        ['odd-card', 'odd-input', 'odd-checkbox', 'odd-button'].filter(
          (tag) => !customElements.get(tag),
        ),
      );
      expect(defined).toEqual([]);
      const canvas = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--odd-color-canvas').trim(),
      );
      expect(canvas).not.toBe('');

      await page.getByLabel('Email').fill('ada@example.com');
      if (name !== 'vite-ts') await expect(page.locator('#typed')).toHaveText('ada@example.com');
      await page.getByRole('checkbox', { name: 'Send me updates' }).check();
      await page.getByRole('button', { name: 'Join' }).click();
      const expected = {
        email: 'ada@example.com',
        updates: 'yes',
        ...(name === 'vite-ts' ? { valid: true } : {}),
      };
      await expect(page.locator('#result')).toHaveText(JSON.stringify(expected));
      expect(errors).toEqual([]);
    });
  });
