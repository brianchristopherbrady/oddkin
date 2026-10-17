/**
 * `@mote/workbench/conformance` — portable conformance suites (conformance.v1). DOM-free at
 * import: suites are data plus case functions that touch the DOM only when a runner calls them.
 * Contract: docs/architecture/change-impact-and-verification.md §3; ADR 0034.
 */
import { DiagnosticList, type WorkbenchDiagnostic } from '../internal/diagnostics.js';

/** Declared changes an invariant is about. Identity invariants apply only to value changes. */
export type ChangeKind =
  'theme-value' | 'density' | 'programmatic' | 'keyed-reorder' | 'reconnect' | 'invalid-draft';

/** The subset of a test runner's `expect` that suites use (Vitest and Jest compatible). */
export interface Matchers {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toBeGreaterThan(expected: number): void;
  toContain(expected: unknown): void;
}
export type Expect = (actual: unknown, message?: string) => Matchers;

/** Real user input from the project's browser runner (e.g. Vitest's `userEvent`). */
export interface UserInput {
  click(element: Element): Promise<unknown>;
  keyboard(text: string): Promise<unknown>;
}

/** Locates documented anatomy roles in an implementation. */
export interface Adapter {
  /** The element that plays `role` (e.g. `control`), or null if absent. */
  part(host: HTMLElement, role: string): HTMLElement | null;
  /** Resolve once pending updates are committed. */
  settle(host: HTMLElement): Promise<void>;
}

export interface MountOptions {
  readonly attributes?: Readonly<Record<string, string>>;
  readonly content?: string;
  /** Markup to place the element in; `{{element}}` marks its position, e.g. inside a form. */
  readonly within?: string;
}

export interface ConformanceContext {
  /** Tag name of the implementation under test. */
  readonly tag: string;
  readonly expect: Expect;
  readonly user: UserInput;
  readonly adapter: Adapter;
  /** Mount the implementation in a fresh container owned by this case. */
  mount(options?: MountOptions): Promise<HTMLElement>;
  /** Live counts of owned work (`scopeStats()` from `@mote/core/scope`). */
  ownedWork(): Readonly<Record<string, number>>;
  /** Resolve after the current task, letting deferred default actions run. */
  nextTask(): Promise<void>;
}

export interface ConformanceCase {
  readonly id: string;
  readonly title: string;
  readonly kind: 'assertion' | 'invariant';
  /** For invariants: the declared change that must preserve the asserted relationship. */
  readonly change?: ChangeKind;
  readonly run: (context: ConformanceContext) => Promise<void> | void;
}

export interface ConformanceSuite {
  /** Stable suite id, e.g. `mote.button`. */
  readonly id: string;
  /** Suite version (semver), tied to the contract version range below. */
  readonly version: string;
  /** The foundation contract verified: a component id and the versions it targets. */
  readonly contract: { readonly component: string; readonly versions: string };
  readonly description?: string;
  /** Public capabilities an implementation must provide. */
  readonly requires: {
    readonly properties?: readonly string[];
    readonly events?: readonly string[];
    readonly slots?: readonly string[];
    readonly anatomy?: readonly string[];
  };
  readonly cases: readonly ConformanceCase[];
}

const CHANGES: readonly ChangeKind[] = [
  'theme-value',
  'density',
  'programmatic',
  'keyed-reorder',
  'reconnect',
  'invalid-draft',
];

/** Freeze a suite. Use `checkConformance` (or a test) to validate it. */
export function defineConformance(suite: ConformanceSuite): ConformanceSuite {
  return Object.freeze({ ...suite, cases: Object.freeze([...suite.cases]) });
}

/** Structural problems in a suite, as diagnostics with JSON-pointer paths. */
export function checkConformance(suite: ConformanceSuite): WorkbenchDiagnostic[] {
  const out = new DiagnosticList();
  if (!/^[a-z][\w.-]*$/.test(suite.id))
    out.error('conformance.id.invalid', `Suite id "${suite.id}" must be a lowercase id.`, '/id');
  if (!/^\d+\.\d+\.\d+/.test(suite.version))
    out.error('conformance.version.invalid', 'Suite version must be semver.', '/version');
  if (!/^component:[a-z][\w.]*-[\w.-]*$/.test(suite.contract.component))
    out.error(
      'conformance.contract.invalid',
      'Use a component id such as "component:mote-button".',
      '/contract/component',
    );
  if (!suite.cases.length) out.error('conformance.cases.empty', 'A suite needs cases.', '/cases');
  const seen = new Set<string>();
  suite.cases.forEach((c, index) => {
    const path = `/cases/${index}`;
    if (seen.has(c.id)) out.error('conformance.case.duplicate', `Case "${c.id}" repeats.`, path);
    seen.add(c.id);
    if (c.kind === 'invariant' && !(c.change && CHANGES.includes(c.change)))
      out.error('conformance.invariant.change', `Invariant "${c.id}" must name a change.`, path);
    if (c.kind === 'assertion' && c.change)
      out.error('conformance.assertion.change', `Assertion "${c.id}" names a change.`, path);
  });
  return out.items;
}

/** The serializable `conformance.v1` description of a suite (no functions). */
export function toConformanceJSON(suite: ConformanceSuite): Record<string, unknown> {
  return {
    schema: 'https://mote.dev/schemas/conformance/v1.json',
    id: suite.id,
    version: suite.version,
    contract: { ...suite.contract },
    ...(suite.description ? { description: suite.description } : {}),
    requires: { ...suite.requires },
    cases: suite.cases.map((c) => ({
      id: c.id,
      title: c.title,
      kind: c.kind,
      ...(c.change ? { change: c.change } : {}),
    })),
  };
}

/** One case outcome. Untested cases are `not-executed`, never `passed`. */
export interface CaseResult {
  readonly case: string;
  readonly state: 'passed' | 'failed' | 'not-executed';
  readonly message?: string;
}

/** A `conformance-result.v1` record: evidence for one implementation, configuration, and browser. */
export interface ConformanceResult {
  readonly schema: 'https://mote.dev/schemas/conformance-result/v1.json';
  readonly suite: { readonly id: string; readonly version: string };
  readonly implementation: {
    readonly tag: string;
    readonly package?: string;
    readonly definition?: string;
  };
  readonly configuration: Readonly<Record<string, string>>;
  readonly environment: { readonly userAgent: string };
  readonly date: string;
  readonly results: readonly CaseResult[];
}
