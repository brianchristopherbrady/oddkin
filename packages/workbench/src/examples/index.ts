/**
 * `@oddkin/workbench/examples` — authored examples, defined once and reused by Workbench,
 * documentation, browser tests, Theme Studio, and agents (ADR 0021). DOM-free: importing
 * this entry never touches the DOM; fixtures run only inside preview frames and tests.
 */
import type { Scope } from '@oddkin/core';
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

/**
 * Marks an example as a common mistake. It is never offered as a preset or recommendation; it
 * explains what goes wrong, names the diagnostic `validateUsage` reports for it, and points at
 * the correct example in the same set.
 */
export interface IncorrectUsage {
  readonly explanation: string;
  /** Diagnostic code `validateUsage` reports, e.g. `usage.attribute.propertyOnly`. */
  readonly diagnostic: string;
  /** Name of the correct example in the same set. */
  readonly correct: string;
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
  /** A common mistake, explained (see `IncorrectUsage`). */
  readonly incorrect?: IncorrectUsage;
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

export const EXAMPLES_SCHEMA = 'https://oddkin.dev/schemas/examples/v1.json';

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
    // An incorrect example breaks the contract on purpose; validateUsage reports how.
    const checked = example.incorrect ? {} : example;
    for (const key of Object.keys(checked.props ?? {})) {
      if (properties && !properties.has(key)) {
        out.error(
          'examples.prop.unknown',
          `<${set.component}> has no public property "${key}" (example "${name}").`,
          `${path}/props/${key}`,
        );
      }
    }
    for (const slot of Object.keys(checked.slots ?? {})) {
      if (slots && !slots.has(slot)) {
        out.error(
          'examples.slot.unknown',
          `<${set.component}> declares no slot "${slot}" (example "${name}").`,
          `${path}/slots/${slot}`,
        );
      }
    }
    const incorrect = example.incorrect;
    if (incorrect) {
      const correct = set.examples[incorrect.correct];
      if (!correct || correct.incorrect)
        out.error(
          'examples.incorrect.correct',
          `Incorrect example "${name}" must name a correct example of <${set.component}>, not "${incorrect.correct}".`,
          `${path}/incorrect/correct`,
        );
      if (!incorrect.explanation.trim() || !/^[a-z]+(\.[a-zA-Z-]+)+$/.test(incorrect.diagnostic))
        out.error(
          'examples.incorrect.explanation',
          `Incorrect example "${name}" needs an explanation and a diagnostic code.`,
          `${path}/incorrect`,
        );
      if (example.preset || example.recommended || example.previewRoles?.length)
        out.error(
          'examples.incorrect.recommended',
          `Incorrect example "${name}" cannot be a preset, a recommendation, or a preview role.`,
          path,
        );
    }
  }
  return out.items;
}

/** What `validateUsage` checks examples against: the published contract of the element. */
export interface UsageContract {
  /** Public writable properties; `attribute` is absent for property-only ones (`.items`). */
  readonly properties: readonly {
    name: string;
    type?: string | undefined;
    attribute?: string | undefined;
  }[];
  readonly slots: readonly string[];
}

// Attributes every element accepts.
const GLOBAL_ATTRIBUTE =
  /^(?:id|class|style|slot|part|lang|dir|title|hidden|inert|tabindex|role|autofocus|exportparts|data-.+|aria-.+)$/;
const unionOf = (type: string | undefined) =>
  type && /^"[^"]*"( \| "[^"]*")*$/.test(type)
    ? [...type.matchAll(/"([^"]*)"/g)].map((m) => m[1] as string)
    : undefined;

/**
 * Diagnostics for how each example uses the element, from its published contract: rich data
 * written as an attribute, `"false"` on a boolean attribute, values outside an enum, unknown
 * attributes, and unknown slots. Correct examples produce none; an incorrect example produces
 * the diagnostic it declares.
 */
export function validateUsage<E extends Element>(
  set: ExampleSet<E>,
  contract: UsageContract,
): WorkbenchDiagnostic[] {
  const out = new DiagnosticList();
  const byAttribute = new Map(
    contract.properties.filter((p) => p.attribute).map((p) => [p.attribute as string, p]),
  );
  const slots = new Set(contract.slots.map((s) => s || 'default'));
  const tag = set.component;
  for (const [name, example] of Object.entries(set.examples)) {
    const path = `/examples/${name}`;
    for (const [attribute, value] of Object.entries(example.attributes ?? {})) {
      const at = `${path}/attributes/${attribute}`;
      const property = byAttribute.get(attribute);
      const named = contract.properties.find((p) => p.name === attribute);
      if (!property && named && !named.attribute)
        out.error(
          'usage.attribute.propertyOnly',
          `<${tag}> reads "${attribute}" only as a property; set .${attribute} with a value, not an attribute string.`,
          at,
        );
      else if (!property && !GLOBAL_ATTRIBUTE.test(attribute))
        out.error(
          'usage.attribute.unknown',
          `<${tag}> has no attribute "${attribute}"${named ? `; use "${named.attribute}"` : ''}.`,
          at,
        );
      else if (property?.type === 'boolean' && value === 'false')
        out.error(
          'usage.boolean.false',
          `[${attribute}="false"] still turns ${property.name} on: the attribute's presence means true. Remove the attribute instead.`,
          at,
        );
      else {
        const allowed = unionOf(property?.type);
        if (value !== null && allowed && !allowed.includes(value))
          out.error(
            'usage.attribute.value',
            `<${tag}> ${attribute}="${value}" is not one of ${allowed.join(', ')}; the default is used.`,
            at,
          );
      }
    }
    for (const slot of Object.keys(example.slots ?? {}))
      if (!slots.has(slot))
        out.error(
          'usage.slot.unknown',
          `<${tag}> declares no slot "${slot}"; the content is not shown.`,
          `${path}/slots/${slot}`,
        );
  }
  return out.items;
}
