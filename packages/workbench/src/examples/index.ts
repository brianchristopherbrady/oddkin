/**
 * `@mote/workbench/examples` — authored examples, defined once and reused by Workbench,
 * documentation, browser tests, Theme Studio, and agents (ADR 0021). DOM-free: importing
 * this entry never touches the DOM; fixtures run only inside preview frames and tests.
 */
import type { Scope } from '@mote/core';
import { DiagnosticList, type WorkbenchDiagnostic } from '../internal/diagnostics.js';

export type { WorkbenchDiagnostic } from '../internal/diagnostics.js';

type DataKeys<E> = {
  [K in keyof E]-?: E[K] extends (...args: never[]) => unknown ? never : K;
}[keyof E];

/** Public data properties of an element type, excluding those every `HTMLElement` has. */
export type ElementProps<E> = Partial<Pick<E, Exclude<DataKeys<E>, keyof HTMLElement>>>;

/** The element type for a tag: from `HTMLElementTagNameMap` when registered there. */
export type ElementFor<T extends string> = T extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[T]
  : HTMLElement & { [property: string]: unknown };

export interface ExampleFixtureContext<E extends Element = Element> {
  /** Owns listeners, timers, and effects; disposed when the preview or test ends. */
  readonly scope: Scope;
  /** The example's element, already created with its props, attributes, and slots. */
  readonly element: E;
  /** Render more content into the preview root; returns its first element. */
  mount(content: unknown): Element;
}

export interface ExampleDefinition<E extends Element = HTMLElement> {
  readonly label?: string;
  /** Property values, checked against the element type (TypeScript) or metadata (checkExamples). */
  readonly props?: ElementProps<E>;
  readonly attributes?: Readonly<Record<string, string | null>>;
  /** Plain-text slot content keyed by slot name; `default` is the default slot. */
  readonly slots?: Readonly<Record<string, string>>;
  readonly previewRoles?: readonly string[];
  /** Offered as a preset on the component page. */
  readonly preset?: boolean;
  readonly recommended?: boolean;
  readonly guidance?: string;
  /** Owned setup code; runs only in preview frames and tests. */
  readonly fixture?: (context: ExampleFixtureContext<E>) => void | Promise<void>;
}

export interface ExampleSet<E extends Element = HTMLElement> {
  readonly component: string;
  readonly examples: Readonly<Record<string, ExampleDefinition<E>>>;
}

/**
 * Define the examples for one component. With TypeScript and a registered tag
 * (`HTMLElementTagNameMap`), unknown property keys and wrong value types are compile errors.
 */
export function defineExamples<T extends string>(
  tag: T,
  examples: Readonly<Record<string, ExampleDefinition<ElementFor<T>>>>,
): ExampleSet<ElementFor<T>> {
  return Object.freeze({ component: tag, examples: Object.freeze({ ...examples }) });
}

export const EXAMPLES_SCHEMA = 'https://mote.dev/schemas/examples/v1.json';

/** The serializable layer (`examples.v1`); fixtures appear only as `hasFixture`. */
export interface ExamplesJSON {
  readonly schema: typeof EXAMPLES_SCHEMA;
  readonly component: string;
  readonly examples: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

export function toExamplesJSON<E extends Element>(set: ExampleSet<E>): ExamplesJSON {
  const examples: Record<string, Record<string, unknown>> = {};
  for (const [name, example] of Object.entries(set.examples)) {
    const { fixture, ...rest } = example;
    examples[name] = {
      ...JSON.parse(JSON.stringify(rest)),
      ...(fixture ? { hasFixture: true } : {}),
    };
  }
  return { schema: EXAMPLES_SCHEMA, component: set.component, examples };
}

/** Example id shared with metadata, docs content, and agents: `example:<tag>/<name>`. */
export const exampleId = (tag: string, name: string): string => `example:${tag}/${name}`;

/** The parts of a component contract that examples are checked against (e.g. from CEM). */
export interface ExampleContract {
  readonly properties?: readonly string[];
  readonly slots?: readonly string[];
}

const TAG = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
const NAME = /^[a-zA-Z][a-zA-Z0-9-]*$/;

/**
 * Check names and, when a contract is given, property keys and slot names. Plain JavaScript
 * authors get the same checks TypeScript gives at compile time.
 */
export function checkExamples<E extends Element>(
  set: ExampleSet<E>,
  contract?: ExampleContract,
): WorkbenchDiagnostic[] {
  const out = new DiagnosticList();
  if (!TAG.test(set.component)) {
    out.error(
      'examples.component.invalid',
      `"${set.component}" is not a valid custom element name.`,
      '/component',
    );
  }
  const properties = contract?.properties ? new Set(contract.properties) : undefined;
  const slots = contract?.slots ? new Set(contract.slots.map((s) => s || 'default')) : undefined;
  for (const [name, example] of Object.entries(set.examples)) {
    const path = `/examples/${name}`;
    if (!NAME.test(name)) {
      out.error(
        'examples.name.invalid',
        `Example name "${name}" must start with a letter and use letters, digits, and hyphens.`,
        path,
      );
    }
    for (const key of Object.keys(example.props ?? {})) {
      if (properties && !properties.has(key)) {
        out.error(
          'examples.prop.unknown',
          `<${set.component}> has no public property "${key}" (example "${name}").`,
          `${path}/props/${key}`,
        );
      }
    }
    for (const slot of Object.keys(example.slots ?? {})) {
      if (slots && !slots.has(slot)) {
        out.error(
          'examples.slot.unknown',
          `<${set.component}> declares no slot "${slot}" (example "${name}").`,
          `${path}/slots/${slot}`,
        );
      }
    }
  }
  return out.items;
}
