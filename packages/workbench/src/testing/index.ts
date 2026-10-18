/**
 * `@oddkin/workbench/testing` — run examples and conformance suites inside the project's own
 * browser test runner. The runner's `expect` and user-input API are passed in, so this entry
 * depends on no test framework. Contract: change-impact-and-verification.md §3.
 */
import { createScope, scopeStats, type Scope } from '@oddkin/core/scope';
import { render, type ChildPart } from '@oddkin/core/template';
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
import { exampleId, type ExampleSet } from '../examples/index.js';

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

export interface MountedExample<E extends Element> {
  /** The example's element. */
  readonly element: E;
  /** Holds the element and everything the fixture mounted; `data-example` is the example id. */
  readonly root: HTMLElement;
  /** The scope passed to the fixture. */
  readonly scope: Scope;
  /** Dispose the fixture's scope and templates and remove the root. */
  dispose(): void;
}

/**
 * Mount one authored example the way a preview frame does: create the registered element, set
 * its attributes, properties, and slot text, connect it, then run its fixture. The tag (and any
 * element the fixture uses) must already be registered.
 */
export async function mountExample<E extends Element>(
  set: ExampleSet<E>,
  name: string,
  container: HTMLElement = document.body,
): Promise<MountedExample<E>> {
  const example = set.examples[name];
  if (!example) throw new Error(`mountExample: <${set.component}> has no example "${name}".`);
  if (!customElements.get(set.component)) {
    throw new Error(`mountExample: <${set.component}> is not registered.`);
  }
  const id = exampleId(set.component, name);
  const root = document.createElement('div');
  root.dataset['example'] = id;
  container.append(root);
  const element = document.createElement(set.component) as unknown as E;
  for (const [attribute, value] of Object.entries(example.attributes ?? {}))
    if (value !== null) element.setAttribute(attribute, value);
  Object.assign(element, example.props ?? {});
  for (const [slot, text] of Object.entries(example.slots ?? {})) {
    if (slot === 'default') element.append(text);
    else {
      const span = document.createElement('span');
      span.slot = slot;
      span.textContent = text;
      element.append(span);
    }
  }
  root.append(element);
  const scope = createScope({ name: id });
  const parts: ChildPart[] = [];
  try {
    await example.fixture?.({
      scope,
      element,
      mount(content) {
        const host = document.createElement('div');
        root.append(host);
        parts.push(render(content, host));
        return host.firstElementChild ?? host;
      },
    });
    await (element as Element & { updateComplete?: Promise<void> }).updateComplete;
  } catch (error) {
    scope.dispose();
    root.remove();
    throw error;
  }
  return {
    element,
    root,
    scope,
    dispose() {
      scope.dispose();
      for (const part of parts) part.dispose();
      root.remove();
    },
  };
}
