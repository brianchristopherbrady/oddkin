/**
 * `@oddkin/workbench/testing` — run examples and conformance suites inside the project's own
 * browser test runner. The runner's `expect` and user-input API are passed in, so this entry
 * depends on no test framework. Contract: change-impact-and-verification.md §3.
 */
import { scopeStats } from '@oddkin/core/scope';
import type {
  Adapter,
  CaseResult,
  ConformanceContext,
  ConformanceResult,
  ConformanceSuite,
  Expect,
  MountOptions,
  UserInput,
} from '../conformance/index.js';

/** Default adapter: anatomy roles are named parts (`part~="role"`) in the shadow root. */
export const partAdapter: Adapter = {
  part: (host, role) => host.shadowRoot?.querySelector<HTMLElement>(`[part~="${role}"]`) ?? null,
  settle: async (host) => {
    await (host as HTMLElement & { updateComplete?: Promise<void> }).updateComplete;
  },
};

export interface RunConformanceOptions {
  /** Tag of a registered implementation. */
  readonly tag: string;
  readonly expect: Expect;
  readonly user: UserInput;
  readonly adapter?: Adapter;
  /** Recorded with the result (theme, product, density, …). */
  readonly configuration?: Readonly<Record<string, string>>;
  readonly implementation?: { readonly package?: string; readonly definition?: string };
  /** Run only these case ids; the others are reported `not-executed`. */
  readonly only?: readonly string[];
}

/**
 * Run every case of `suite` against `options.tag`. Each case gets a fresh container that is
 * removed afterwards. Failures are recorded, not thrown.
 */
export async function runConformance(
  suite: ConformanceSuite,
  options: RunConformanceOptions,
): Promise<ConformanceResult> {
  if (!customElements.get(options.tag)) {
    throw new Error(`runConformance: <${options.tag}> is not registered.`);
  }
  const adapter = options.adapter ?? partAdapter;
  const results: CaseResult[] = [];
  for (const testCase of suite.cases) {
    if (options.only && !options.only.includes(testCase.id)) {
      results.push({ case: testCase.id, state: 'not-executed' });
      continue;
    }
    const container = document.createElement('div');
    document.body.append(container);
    const context: ConformanceContext = {
      tag: options.tag,
      expect: options.expect,
      user: options.user,
      adapter,
      async mount(mount: MountOptions = {}) {
        const element = document.createElement(options.tag);
        for (const [name, value] of Object.entries(mount.attributes ?? {}))
          element.setAttribute(name, value);
        if (mount.content) element.innerHTML = mount.content;
        if (mount.within) {
          container.innerHTML = mount.within.replace(
            '{{element}}',
            '<template data-slot></template>',
          );
          container.querySelector('template[data-slot]')!.replaceWith(element);
        } else container.append(element);
        await adapter.settle(element);
        return element;
      },
      ownedWork: () => ({ ...scopeStats() }),
      nextTask: () => new Promise((resolve) => setTimeout(resolve, 0)),
    };
    try {
      await testCase.run(context);
      results.push({ case: testCase.id, state: 'passed' });
    } catch (error) {
      results.push({
        case: testCase.id,
        state: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      container.remove();
    }
  }
  return {
    schema: 'https://oddkin.dev/schemas/conformance-result/v1.json',
    suite: { id: suite.id, version: suite.version },
    implementation: { tag: options.tag, ...options.implementation },
    configuration: { ...options.configuration },
    environment: { userAgent: navigator.userAgent },
    date: new Date().toISOString(),
    results,
  };
}
