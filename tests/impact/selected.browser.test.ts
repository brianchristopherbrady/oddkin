import { describe, expect, it, vi } from 'vitest';
import { commands, server, userEvent } from 'vitest/browser';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { buttonConformance } from '@oddkin/workbench/conformance/button';
import { mountExample, runConformance } from '@oddkin/workbench/testing';
import type { ExampleSet } from '@oddkin/workbench/examples';

// Runs the checks a change-impact report selected (scripts/impact.mjs writes the selection;
// change-impact-and-verification.md §2.4) in each engine, and records one result per check.
// Without a selection file there is nothing to run, so ordinary test runs skip it.

vi.setConfig({ testTimeout: 120_000 });

const SELECTION = '.oddkin/impact/selection.json';
interface Selection {
  readonly checks: readonly { readonly id: string; readonly product?: string }[];
}
const selection = await commands
  .readFile(SELECTION)
  .then((text) => JSON.parse(text) as Selection)
  .catch(() => undefined);

import.meta.glob('../../packages/components/src/*/*.define.ts', { eager: true });
const sets = Object.values(
  import.meta.glob<ExampleSet<Element>>('../../packages/components/src/*/*.examples.ts', {
    eager: true,
    import: 'default',
  }),
);
const suites = { [buttonConformance.id]: buttonConformance };

const settle = async (root: Element) => {
  flush();
  await Promise.all(
    [...root.querySelectorAll<Element & { updateComplete?: Promise<void> }>('*')].map(
      (el) => el.updateComplete,
    ),
  );
  flush();
};

/** Mount an example in its product context; it must render, report nothing, and release its work. */
async function runExample(tag: string, name: string, product: string | undefined) {
  const set = sets.find((s) => s.component === tag);
  if (!set?.examples[name]) return { state: 'not-executed' as const, message: 'no such example' };
  const container = document.createElement('div');
  if (product) container.dataset['oddProduct'] = product;
  document.body.append(container);
  const reported: string[] = [];
  setErrorHandler((_error, context) => reported.push(context.code ?? 'unknown'));
  const before = scopeStats();
  try {
    const mounted = await mountExample(set, name, container);
    await settle(mounted.root);
    expect(mounted.element.isConnected).toBe(true);
    expect(mounted.element.shadowRoot?.childElementCount ?? 0).toBeGreaterThan(0);
    mounted.dispose();
    flush();
    expect(scopeStats()).toEqual(before);
    expect(reported, 'reported errors').toEqual([]);
    return { state: 'passed' as const };
  } catch (error) {
    return {
      state: 'failed' as const,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    setErrorHandler(undefined);
    container.remove();
  }
}

async function runSuite(id: string, tag: string, product: string | undefined) {
  const suite = suites[id];
  if (!suite) return { state: 'not-executed' as const, message: `no runner for suite ${id}` };
  const result = await runConformance(suite, {
    tag,
    expect,
    user: userEvent,
    configuration: product ? { product } : {},
  });
  const failed = result.results.filter((r) => r.state !== 'passed');
  return failed.length
    ? {
        state: 'failed' as const,
        message: failed.map((r) => `${r.case}: ${r.message ?? r.state}`).join('; '),
      }
    : { state: 'passed' as const };
}

describe.skipIf(!selection)('checks selected by change impact', () => {
  it('runs each selected check and records its result', async () => {
    const conditions = {
      browser: server.browser,
      userAgent: navigator.userAgent,
    };
    const results = [];
    for (const check of selection!.checks) {
      const example = /^example:([^/]+)\/(.+)$/.exec(check.id);
      const suite = /^suite:([^#]+)#(.+)$/.exec(check.id);
      const outcome = example
        ? await runExample(example[1]!, example[2]!, check.product)
        : suite
          ? await runSuite(suite[1]!, suite[2]!, check.product)
          : { state: 'not-executed' as const, message: 'unknown check kind' };
      results.push({
        check: check.id,
        ...(check.product ? { product: check.product } : {}),
        ...outcome,
        conditions,
      });
    }
    await commands.writeFile(
      `.oddkin/impact/results/${server.browser}.json`,
      `${JSON.stringify(results, null, 2)}\n`,
    );
    expect(results.length).toBe(selection!.checks.length);
  });
});
