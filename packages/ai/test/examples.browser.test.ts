/// <reference types="vite/client" />
import { describe, expect, it, vi } from 'vitest';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { ExampleSet } from '@oddkin/workbench/examples';
import { mountExample } from '@oddkin/workbench/testing';

// Every authored @oddkin/ai example mounts as written, reports nothing, renders its element, and
// releases everything it owned (ADR 0021). The contract harness renders slots and parts from them.

vi.setConfig({ testTimeout: 60_000 });

import.meta.glob('../src/**/*.define.ts', { eager: true });
const sets = Object.values(
  import.meta.glob<ExampleSet<Element>>('../src/**/*.examples.ts', {
    eager: true,
    import: 'default',
  }),
);

describe('@oddkin/ai authored examples', () => {
  it('each example mounts, reports nothing, and releases everything', async () => {
    expect(sets.length).toBeGreaterThan(0);
    for (const set of sets)
      for (const [name, example] of Object.entries(set.examples)) {
        if (example.incorrect) continue;
        const label = `${set.component}/${name}`;
        const before = scopeStats();
        const reported: string[] = [];
        setErrorHandler((_error, context) => reported.push(context.code ?? 'unknown'));
        try {
          const mounted = await mountExample(set, name);
          flush();
          await (mounted.element as Element & { updateComplete?: Promise<void> }).updateComplete;
          expect(mounted.element.shadowRoot?.childElementCount ?? 0, label).toBeGreaterThan(0);
          mounted.dispose();
          flush();
        } finally {
          setErrorHandler(undefined);
        }
        expect(reported, label).toEqual([]);
        expect(scopeStats(), label).toEqual(before);
      }
  });

  // What each explained mistake does when mounted: the observation differs from its correct
  // example, and only the mistakes core can see at runtime are reported.
  type Observed = Element & Record<string, unknown>;
  const effects: Record<string, { observe: (el: Observed) => unknown; wrong: unknown }> = {
    'odd-sources/sourcesAttribute': {
      observe: (el) => el.shadowRoot!.textContent!.includes('Web Content Accessibility'),
      wrong: false,
    },
    'odd-prompt-input/disabledFalse': { observe: (el) => el['disabled'], wrong: true },
    'odd-prompt-input/toolbarSlot': {
      observe: (el) => [...el.children].every((child) => child.assignedSlot !== null),
      wrong: false,
    },
    'odd-artifact/codeView': { observe: (el) => el['view'], wrong: 'preview' },
  };
  const runtime: Record<string, string[]> = {
    'odd-artifact/codeView': ['element.attribute.invalid'],
    'odd-sources/sourcesAttribute': ['element.attribute.propertyOnly'],
  };

  it('each explained mistake does what its explanation says, unlike its correct example', async () => {
    const seen: string[] = [];
    for (const set of sets)
      for (const [name, example] of Object.entries(set.examples)) {
        if (!example.incorrect) continue;
        const label = `${set.component}/${name}`;
        const effect = effects[label];
        expect(effect, `${label} has no observed effect`).toBeDefined();
        const reported: string[] = [];
        setErrorHandler((_error, context) => reported.push(context.code ?? 'unknown'));
        const mounted: { dispose(): void }[] = [];
        try {
          const wrong = await mountExample(set, name);
          mounted.push(wrong);
          const right = await mountExample(set, example.incorrect.correct);
          mounted.push(right);
          flush();
          await (wrong.element as Element & { updateComplete?: Promise<void> }).updateComplete;
          await (right.element as Element & { updateComplete?: Promise<void> }).updateComplete;
          expect(effect!.observe(wrong.element as Observed), label).toEqual(effect!.wrong);
          expect(effect!.observe(right.element as Observed), label).not.toEqual(effect!.wrong);
        } finally {
          setErrorHandler(undefined);
          for (const m of mounted) m.dispose();
          flush();
        }
        expect(reported, label).toEqual(runtime[label] ?? []);
        seen.push(label);
      }
    expect(seen.sort()).toEqual(Object.keys(effects).sort());
  });
});
