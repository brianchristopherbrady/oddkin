import { expect, request, test, type Page } from '@playwright/test';

// @oddkin/ai streaming from a real endpoint, from packed packages (priority plan P0.4;
// scripts/ai-stream-consumer.mjs). A fresh project installs the packed core, tokens, components,
// and ai from tarballs and runs examples/ai-stream: the page sends over HTTP to the example's own
// server, which answers in the AI SDK UI message stream format (canned answers), and stops on
// request. The page runs under its strict CSP (connect-src 'self', Trusted Types required).
const packed = 'http://127.0.0.1:4174/ai-stream/';

interface Report {
  readonly installed: readonly string[];
  readonly imports: Readonly<Record<string, string>>;
  readonly url: string;
}

let report: Report;

test.beforeAll(async () => {
  // Four packages packed and installed: a minute or more on a cold npm cache.
  test.setTimeout(600_000);
  const api = await request.newContext();
  try {
    const response = await api.get(`${packed}__ready`, { timeout: 590_000 });
    expect(response.ok(), await response.text()).toBe(true);
    report = (await response.json()) as Report;
  } finally {
    await api.dispose();
  }
});

/** Page errors and CSP violations; call the result to read them. */
async function watch(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __violations: string[] }).__violations = violations;
    document.addEventListener(
      'securitypolicyviolation',
      (event) => violations.push(`${event.violatedDirective}: ${event.blockedURI}`),
      true,
    );
  });
  return async () => [
    ...errors,
    ...(await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)),
  ];
}

async function send(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: 'Message' });
  await input.fill(text);
  await input.press('Enter');
}

test.describe.configure({ timeout: 60_000 });

test('installs @oddkin/ai and its peers from tarballs, with their published files', () => {
  expect(report.installed).toEqual(
    expect.arrayContaining(['@oddkin/ai', '@oddkin/components', '@oddkin/core', '@oddkin/tokens']),
  );
  // The installed package's production build, through its exports (default condition).
  expect(report.imports['@oddkin/ai/stream']).toBe(
    './node_modules/@oddkin/ai/dist/prod/stream/index.js',
  );
  expect(report.url).toBe('http://127.0.0.1:4178/');
});

test('streams an answer with reasoning, a tool call, and a source from the server', async ({
  page,
}) => {
  const problems = await watch(page);
  await page.goto(report.url);
  const answer = page.waitForResponse(
    (response) => response.url().endsWith('/api/chat') && response.request().method() === 'POST',
  );
  await send(page, 'What is the weather in Lisbon?');
  const response = await answer;
  expect(response.headers()['content-type']).toBe('text/event-stream');
  expect(response.headers()['x-vercel-ai-ui-message-stream']).toBe('v1');
  const body = response.request().postDataJSON() as {
    trigger: string;
    messages: { role: string; parts: { type: string; text: string }[] }[];
  };
  expect(body.trigger).toBe('submit-message');
  expect(body.messages.at(-1)?.parts).toEqual([
    { type: 'text', text: 'What is the weather in Lisbon?' },
  ]);
  await expect(
    page.getByText('It is sunny in Lisbon today, with a high of 24 °C and a low of 16 °C.').first(),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('getWeather').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'AI SDK stream protocol' })).toBeVisible();
  expect(await problems()).toEqual([]);
});

test('stops a long answer on the server and keeps what arrived', async ({ page }) => {
  const problems = await watch(page);
  await page.goto(report.url);
  await send(page, 'Tell me something long');
  // The first words arrive while the rest is still streaming.
  await expect(page.getByText(/This is a long answer/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/at a steady pace/)).toHaveCount(0);
  const stopped = page.waitForResponse((response) => response.url().endsWith('/api/stop'));
  await page.getByRole('button', { name: /stop/i }).first().click();
  expect(await (await stopped).json()).toEqual({ status: 'cancelled' });
  await expect(page.getByText('Stopped. The partial response is kept.').first()).toBeVisible();
  await expect(page.getByText(/at a steady pace/)).toHaveCount(0);
  expect(await problems()).toEqual([]);
});

test('shows an error the stream reports', async ({ page }) => {
  const problems = await watch(page);
  await page.goto(report.url);
  await send(page, 'Please fail');
  // The conversation shows it in the message and repeats it in its status.
  await expect(page.getByText(/model provider is unavailable/).first()).toBeVisible({
    timeout: 20_000,
  });
  expect(await problems()).toEqual([]);
});
