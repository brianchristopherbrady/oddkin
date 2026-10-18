import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

// The three static @oddkin/ai demonstrations (examples/ai-*/), built by `npm run build`. Every
// interaction documented on the pages is exercised here against the production bundles, under
// the pages' strict CSP (no inline script or style, Trusted Types required).

const require = createRequire(import.meta.url);
const REFUSED_STYLE =
  /^Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline'/;

async function watch(page: Page) {
  const engine = page.context().browser()?.browserType().name();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __violations: string[] }).__violations = violations;
    document.addEventListener(
      'securitypolicyviolation',
      (event) => {
        const target = event.composedPath()[0] as Element | undefined;
        const host = (target?.getRootNode?.() as ShadowRoot | undefined)?.host?.localName ?? '';
        violations.push(
          `${event.violatedDirective}: ${event.blockedURI} ${target?.nodeName ?? ''} ${host}`.trim(),
        );
      },
      true,
    );
  });
  return async () => {
    const violations = await page.evaluate(
      () => (window as unknown as { __violations: string[] }).__violations,
    );
    // WebKit reports a style-src violation for every native <select> under a strict style-src,
    // with no author style involved (reproduced with a bare <select> page). Exactly those
    // reports, and the matching console messages, are excluded there; nothing else is.
    const isEngineSelect = (v: string) =>
      engine === 'webkit' && v.startsWith('style-src-attr: inline SELECT');
    const engineReports = violations.filter(isEngineSelect).length;
    if (engineReports)
      test.info().annotations.push({
        type: 'csp',
        description: `webkit: ${engineReports} native <select> style-src report(s) excluded`,
      });
    expect(violations.filter((v) => !isEngineSelect(v))).toEqual([]);
    expect(errors.filter((e) => REFUSED_STYLE.test(e)).length).toBeLessThanOrEqual(engineReports);
    expect(errors.filter((e) => !REFUSED_STYLE.test(e))).toEqual([]);
  };
}

async function open(page: Page, demo: string) {
  await page.goto(`/examples/${demo}/`);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
}

const state = (page: Page) => page.locator('#state');

test.describe('research assistant', () => {
  test('streams a cited answer with tools, sources, artifact, usage, and history', async ({
    page,
  }) => {
    const check = await watch(page);
    await open(page, 'ai-research');
    await page.getByText('Simulation controls').click();

    // History: the latest page is shown; earlier messages load on request.
    await expect(page.getByText('Which datasets do you trust for ocean heat?')).toBeVisible();
    await page.getByRole('button', { name: 'Load earlier messages' }).click();
    await expect(page.getByText('I am preparing a brief on ocean warming.')).toBeVisible();

    const composer = page.getByRole('textbox', { name: 'Ask a research question' });
    await composer.fill('Summarize ocean warming');
    await composer.press('Enter');
    await expect(composer).toHaveValue('');
    await expect(state(page)).toContainText('attempt completed', { timeout: 15_000 });

    const conversation = page.locator('odd-conversation');
    await expect(conversation.getByRole('heading', { name: 'Summary' })).toBeVisible();
    await expect(conversation.getByRole('table')).toBeVisible();
    await expect(conversation.getByText('Finished')).toBeVisible();
    // Resolved citations name their source; the missing one is explicit.
    const citation = conversation
      .getByRole('button', { name: /Source 1: Ocean heat content/ })
      .first();
    await expect(citation).toBeVisible();
    await citation.click();
    await expect(citation).toHaveAttribute('aria-expanded', 'true');
    await expect(
      conversation.getByText('Upper-ocean heat content rose in every decade since 1990.').first(),
    ).toBeVisible();
    await expect(
      conversation.getByRole('button', { name: 'Unresolved source reference c' }),
    ).toBeVisible();
    await expect(
      conversation.getByText('Ocean warming brief', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.locator('odd-usage-meter')).toContainText('Context window');
    await check();
  });

  test('stop, disconnect and resume, and conversation isolation', async ({ page }) => {
    const check = await watch(page);
    await open(page, 'ai-research');
    await page.getByText('Simulation controls').click();
    await page.getByLabel('Chunk delay (ms)').fill('120');
    await page.getByLabel('Chunk delay (ms)').dispatchEvent('change');
    const composer = page.getByRole('textbox', { name: 'Ask a research question' });

    // Stop is a request; the composer shows Stop only while work runs.
    await composer.fill('First question');
    await composer.press('Enter');
    const stop = page.locator('odd-prompt-input').getByRole('button', { name: 'Stop' });
    await expect(stop).toBeVisible();
    await stop.click();
    await expect(state(page)).toContainText('attempt cancelled', { timeout: 10_000 });
    await expect(state(page)).toContainText('stop confirmed');

    // A dropped connection is not completion; resuming continues the same attempt.
    await composer.fill('Second question');
    await composer.press('Enter');
    await expect(state(page)).toContainText('attempt streaming', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Disconnect stream' }).click();
    await expect(state(page)).toContainText('connection disconnected');
    await page.getByRole('button', { name: 'Resume', exact: true }).first().click();
    await expect(state(page)).toContainText('attempt completed', { timeout: 30_000 });

    // Switching conversations isolates late events from the previous one.
    await page.getByLabel('Chunk delay (ms)').fill('10');
    await page.getByLabel('Chunk delay (ms)').dispatchEvent('change');
    await composer.fill('Third question');
    await composer.press('Enter');
    await expect(state(page)).toContainText('attempt', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Switch conversation' }).click();
    await expect(
      page.getByText('A different conversation, loaded to show isolation.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Inject late event' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('LATE EVENT FROM A PREVIOUS CONVERSATION')).toHaveCount(0);
    await expect(page.getByText('Third question')).toHaveCount(0);
    await check();
  });
});

test.describe('inline writing assistant', () => {
  async function select(page: Page, text: string) {
    await page.locator('#editor').evaluate((el: HTMLTextAreaElement, text) => {
      const start = el.value.indexOf(text);
      el.focus();
      el.setSelectionRange(start, start + text.length);
      el.dispatchEvent(new Event('select'));
    }, text);
  }

  test('proposes, applies, and undoes a change with provenance', async ({ page }) => {
    const check = await watch(page);
    await open(page, 'ai-writing');
    const editor = page.locator('#editor');
    const original = await editor.inputValue();
    await select(page, 'Our team is very excited to share the quarterly update.');
    await page.getByRole('button', { name: 'Rewrite' }).click();
    await expect(page.getByText('A proposal is ready for review.')).toBeVisible({ timeout: 5_000 });
    const review = page.locator('odd-change-review');
    await review.getByRole('button', { name: 'Accept' }).click();
    await expect(editor).toHaveValue(/^Our team is excited to share/);
    await expect(page.locator('odd-ai-label')).toBeVisible();
    await review.getByRole('button', { name: 'Undo' }).click();
    await expect(editor).toHaveValue(original);
    await check();
  });

  test('a proposal for edited text is stale and cannot be applied', async ({ page }) => {
    const check = await watch(page);
    await open(page, 'ai-writing');
    await page.getByText('Simulation controls').click();
    await select(page, 'Sales grew in every region');
    await page.getByRole('button', { name: 'Translate' }).click();
    await page.getByRole('button', { name: /Edit the document now/ }).click();
    await expect(page.locator('odd-change-review')).toContainText('Out of date', {
      timeout: 5_000,
    });
    await expect(
      page.locator('odd-change-review').getByRole('button', { name: 'Accept' }),
    ).toHaveCount(0);
    await expect(page.locator('#editor')).toHaveValue(/\(edited while waiting\)$/);
    await check();
  });

  test('explains a selection and dictates text', async ({ page }) => {
    const check = await watch(page);
    await open(page, 'ai-writing');
    await select(page, 'the new onboarding flow reduced support tickets');
    await page.getByRole('button', { name: 'Explain' }).click();
    await expect(page.locator('odd-inline-assist')).toContainText('Explanation (simulated).', {
      timeout: 5_000,
    });

    await page.getByRole('button', { name: 'Start voice input' }).click();
    await expect(page.locator('odd-voice-input')).toContainText(
      'Next quarter we plan to expand to two new markets.',
      { timeout: 5_000 },
    );
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await page.getByRole('button', { name: 'Use transcript' }).click();
    await expect(page.locator('#editor')).toHaveValue(
      /Next quarter we plan to expand to two new markets\.$/,
    );
    await check();
  });
});

test.describe('agent task panel', () => {
  test('runs a plan with parallel tools, a question, an approval revision, and a checkpoint', async ({
    page,
  }) => {
    const check = await watch(page);
    await open(page, 'ai-agent');
    await page.getByRole('button', { name: 'Start run' }).click();
    const tools = page.locator('#tools');
    await expect(tools.locator('odd-tool-call')).toHaveCount(2);
    await expect(tools.getByText('Finished')).toHaveCount(2, { timeout: 10_000 });

    const question = page.locator('odd-question');
    await expect(question).toBeVisible();
    await question.getByRole('radio', { name: /Beta/ }).check();
    await question.getByRole('button', { name: 'Answer' }).click();
    await expect(question).toContainText('Answered.', { timeout: 5_000 });

    const approval = page.locator('odd-action-approval');
    await expect(approval).toBeVisible({ timeout: 10_000 });
    await expect(approval).toContainText('3 of 3');
    await page.getByText('Simulation controls').click();
    await page.getByRole('button', { name: /Change the pending proposal/ }).click();
    await expect(approval).toContainText('1 of 3 (canary first)');
    await approval.getByRole('button', { name: 'Approve' }).click();
    // Approval is not success: it is pending, then approved, then the action runs separately.
    await expect(approval).toContainText('Approved. The action runs separately', {
      timeout: 5_000,
    });
    await expect(page.locator('#run-log')).toContainText('Deployed.', { timeout: 10_000 });

    const checkpoint = page.locator('odd-checkpoint').first();
    await checkpoint.getByRole('button', { name: 'Restore…' }).click();
    await checkpoint.getByRole('button', { name: 'Restore this checkpoint' }).click();
    await expect(checkpoint).toContainText('Restoring… Not restored yet.');
    await expect(checkpoint).toContainText('Restored.', { timeout: 5_000 });
    await check();
  });

  test('tool failure and retry, interruption, approval expiry, and failed restore', async ({
    page,
  }) => {
    const check = await watch(page);
    await open(page, 'ai-agent');
    await page.getByText('Simulation controls').click();
    await page.getByLabel('Make one parallel tool fail').check();
    await page.getByLabel('Approval expires after 4 seconds').check();
    await page.getByLabel('Checkpoint restore fails').check();
    await page.getByRole('button', { name: 'Start run' }).click();

    const failed = page.locator('odd-tool-call').filter({ hasText: 'Failed' });
    await expect(failed).toHaveCount(1, { timeout: 10_000 });
    await expect(failed).toContainText('Registry timed out (simulated).');
    await failed.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('#tools').getByText('Finished')).toHaveCount(2, { timeout: 10_000 });

    const question = page.locator('odd-question');
    await question.getByRole('radio', { name: /Stable/ }).check();
    await question.getByRole('button', { name: 'Answer' }).click();
    const approval = page.locator('odd-action-approval');
    await expect(approval).toContainText('This request expired', { timeout: 15_000 });
    await expect(approval.getByRole('button', { name: 'Approve' })).toHaveCount(0);

    const checkpoint = page.locator('odd-checkpoint').first();
    await checkpoint.getByRole('button', { name: 'Restore…' }).click();
    await checkpoint.getByRole('button', { name: 'Restore this checkpoint' }).click();
    await expect(checkpoint).toContainText('Restore failed: Uncommitted changes conflict', {
      timeout: 5_000,
    });

    // A new run can be interrupted; running tools are cancelled.
    await page.getByLabel('Make one parallel tool fail').uncheck();
    await page.getByRole('button', { name: 'Start run' }).click();
    const stop = page.locator('odd-activity').getByRole('button', { name: 'Stop' });
    await expect(stop).toBeVisible({ timeout: 5_000 });
    await stop.click();
    await expect(page.locator('#run-log')).toContainText('Stopped.', { timeout: 5_000 });
    await check();
  });
});

test.describe('reflow at 320 CSS px and reduced motion', () => {
  test.use({ viewport: { width: 320, height: 720 }, reducedMotion: 'reduce' });
  for (const demo of ['ai-research', 'ai-writing', 'ai-agent']) {
    test(`${demo} has no horizontal scrolling and no running animations`, async ({ page }) => {
      await open(page, demo);
      if (demo === 'ai-research') {
        const composer = page.getByRole('textbox', { name: 'Ask a research question' });
        await composer.fill('Summarize ocean warming');
        await composer.press('Enter');
        await expect(page.locator('#state')).toContainText('attempt completed', {
          timeout: 15_000,
        });
      }
      if (demo === 'ai-agent') {
        await page.getByRole('button', { name: 'Start run' }).click();
        await expect(page.locator('odd-question')).toBeVisible({ timeout: 10_000 });
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const running = await page.evaluate(
        () => document.getAnimations().filter((a) => a.playState === 'running').length,
      );
      expect(running).toBe(0);
    });
  }
});

test.describe('accessibility (axe-core)', () => {
  for (const demo of ['ai-research', 'ai-writing', 'ai-agent']) {
    test(`${demo} has no axe violations`, async ({ page }) => {
      await open(page, demo);
      if (demo === 'ai-research') {
        const composer = page.getByRole('textbox', { name: 'Ask a research question' });
        await composer.fill('Summarize ocean warming');
        await composer.press('Enter');
        await expect(page.locator('#state')).toContainText('attempt completed', {
          timeout: 15_000,
        });
      }
      if (demo === 'ai-agent') {
        await page.getByRole('button', { name: 'Start run' }).click();
        await expect(page.locator('odd-question')).toBeVisible({ timeout: 10_000 });
      }
      // Evaluated through the automation channel (not a <script>), so the page's CSP and
      // Trusted Types policy stay as served.
      await page.evaluate(readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
      const violations = await page.evaluate(async () => {
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
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
          },
        });
        return result.violations.map(
          (v) => `${v.id}: ${JSON.stringify(v.nodes.map((n) => n.target))}`,
        );
      });
      expect(violations).toEqual([]);
    });
  }
});
