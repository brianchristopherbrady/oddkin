import { expect, test, type Page } from '@playwright/test';

// Real submissions from tests/forms/: every request to /__forms/ is intercepted and answered, so
// method, URL, encoding, body, and target frame are the browser's own form submission.
interface Submission {
  method: string;
  path: string;
  contentType: string;
  body: string;
  frame: string;
}
interface SubmitRecord {
  form: string;
  submitter: string | null;
  className: string;
  connectedAfterDispatch: boolean | null;
}

async function open(page: Page) {
  const submissions: Submission[] = [];
  await page.route(/\/__forms\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    submissions.push({
      method: request.method(),
      path: url.pathname + url.search,
      contentType: (await request.allHeaders())['content-type'] ?? '',
      body: request.postData() ?? '',
      frame: request.frame().name(),
    });
    await route.fulfill({ contentType: 'text/html', body: '<p>Received</p>' });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tests/forms/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return { submissions, errors };
}
const records = (page: Page) =>
  page.evaluate(() => (window as unknown as { __submits: SubmitRecord[] }).__submits);
const invalid = (page: Page) =>
  page.evaluate(() => (window as unknown as { __invalid: string[] }).__invalid.length);

/** Clicks a native submit button with the same attributes as the odd-button `id`, then removes it. */
async function nativeTwin(page: Page, id: string) {
  await page.evaluate((id) => {
    const source = document.getElementById(id)!;
    const twin = document.createElement('button');
    for (const { name, value } of source.attributes)
      if (name !== 'id') twin.setAttribute(name, value);
    twin.id = `${id}-native`;
    twin.textContent = 'Native twin';
    source.after(twin);
  }, id);
  await page.locator(`#${id}-native`).click();
  await page.evaluate((id) => document.getElementById(`${id}-native`)!.remove(), id);
}
/** Multipart boundaries differ per request. */
const comparable = ({ contentType, body, ...rest }: Submission) => {
  const boundary = /boundary=(.+)$/.exec(contentType)?.[1];
  return boundary
    ? { ...rest, contentType: 'multipart/form-data', body: body.replaceAll(boundary, '<boundary>') }
    : { ...rest, contentType, body };
};

test('odd-button submits its name and value, and its form* overrides, like a native submit button', async ({
  page,
  browserName,
}) => {
  const { submissions, errors } = await open(page);
  await page.locator('#buy').click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toEqual({
    method: 'GET',
    path: '/__forms/order?item=tea&intent=buy',
    contentType: '',
    body: '',
    frame: 'sink',
  });
  // The submitter is a temporary native button, removed after dispatch.
  expect(await records(page)).toEqual([
    { form: 'order', submitter: 'button', className: '', connectedAfterDispatch: false },
  ]);

  // formnovalidate submits an empty required field; the other overrides set URL, method,
  // encoding, and frame.
  const item = page.getByRole('textbox', { name: 'Item' });
  await item.fill('');
  await page.locator('#draft').click();
  await expect.poll(() => submissions.length).toBe(2);
  const draft = submissions[1]!;
  expect([draft.method, draft.path, draft.frame]).toEqual(['POST', '/__forms/drafts', 'drafts']);
  expect(draft.contentType).toMatch(/^multipart\/form-data; boundary=/);
  expect(draft.body).toContain('name="item"\r\n\r\n\r\n');
  expect(draft.body).toContain('name="intent"\r\n\r\ndraft\r\n');
  await expect(page.frameLocator('iframe[name="drafts"]').locator('p')).toHaveText('Received');
  await nativeTwin(page, 'draft');
  await expect.poll(() => submissions.length).toBe(3);
  expect(comparable(submissions[2]!)).toEqual(comparable(draft));

  // Without formnovalidate, the empty required field blocks submission.
  await page.locator('#buy').click();
  await expect.poll(() => invalid(page)).toBe(1);
  expect(submissions).toHaveLength(3);

  // Overrides apply per button: this one keeps the form's action and target.
  await item.fill('tea');
  await page.locator('#note').click();
  await expect.poll(() => submissions.length).toBe(4);
  expect(submissions[3]).toEqual({
    method: 'POST',
    path: '/__forms/order',
    contentType: 'text/plain',
    // Chromium sends a urlencoded body, labelled text/plain, when a button overrides a GET form
    // with formmethod="post" formenctype="text/plain"; its native buttons do the same (twin below).
    body: browserName === 'chromium' ? 'item=tea&intent=note' : 'item=tea\r\nintent=note\r\n',
    frame: 'sink',
  });
  await nativeTwin(page, 'note');
  await expect.poll(() => submissions.length).toBe(5);
  expect(submissions[4]).toEqual(submissions[3]);
  expect(errors).toEqual([]);
});

test('a native button styled by button.css keeps native submit-button semantics', async ({
  page,
}) => {
  const { submissions, errors } = await open(page);
  // Enter in a text field submits through the form's default button, the native one.
  await page.getByRole('textbox', { name: 'Query' }).press('Enter');
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toEqual({
    method: 'POST',
    path: '/__forms/native',
    contentType: 'application/x-www-form-urlencoded',
    body: 'q=native&intent=search',
    frame: 'sink',
  });
  expect(await records(page)).toEqual([
    { form: 'native', submitter: 'button', className: 'odd-button', connectedAfterDispatch: true },
  ]);
  // It has the primary appearance from the tokens.
  const [background, action] = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--odd-color-action-default)';
    document.body.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const button = document.querySelector('button.odd-button')!;
    return [getComputedStyle(button).backgroundColor, expected];
  });
  expect(background).toBe(action);

  // An odd-button outside the form, associated through `form`, submits it with its own value.
  await page.locator('#outside').click();
  await expect.poll(() => submissions.length).toBe(2);
  expect(submissions[1]!.body).toBe('q=native&intent=outside');
  expect(errors).toEqual([]);
});
