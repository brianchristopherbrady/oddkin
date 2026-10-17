/**
 * Registration. `define()` is idempotent for the same constructor or definition, reports
 * collisions clearly, and registers declared dependencies first.
 */
import { DEV } from '../internal/dev.js';
import { MoteError, reportMoteError } from '../diagnostics/index.js';
import { bindDefinition, definitionFor, unbindDefinition } from '../internal/definitions.js';
import { isElementDefinition, type ElementDefinition } from './definition.js';
import { MoteElement } from './element.js';

export interface DefineOptions {
  /** Registry to define in (e.g. a scoped registry where supported). Defaults to `customElements`. */
  readonly registry?: CustomElementRegistry;
}

// Valid custom element names (HTML spec), simplified to the ASCII-and-common-Unicode form.
const VALID_NAME =
  /^[a-z][-.0-9_a-z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*-[-.0-9_a-z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*$/u;
const RESERVED = new Set([
  'annotation-xml',
  'color-profile',
  'font-face',
  'font-face-src',
  'font-face-uri',
  'font-face-format',
  'font-face-name',
  'missing-glyph',
]);

type WithDependencies = CustomElementConstructor & {
  dependencies?: Readonly<Record<string, CustomElementConstructor>> | undefined;
};

/**
 * Register a definition created by `compose()`: its dependencies first, then its element.
 * Re-defining the same definition is a no-op; a different definition for a name already
 * registered with the same constructor throws `registry.definitionConflict`.
 */
export function define<D extends ElementDefinition<any>>(definition: D, options?: DefineOptions): D;
/**
 * Define `tagName` for `ctor`. Re-defining the same pair is a no-op; a different
 * constructor for a taken name throws `registry.collision`. Where no registry exists (server
 * rendering, Node tooling) it does nothing, so modules that register on import stay importable.
 */
export function define<C extends CustomElementConstructor>(
  tagName: string,
  ctor: C,
  options?: DefineOptions,
): C;
export function define(
  target: string | ElementDefinition<any>,
  ctorOrOptions?: CustomElementConstructor | DefineOptions,
  maybeOptions?: DefineOptions,
): unknown {
  if (typeof target !== 'string') {
    return defineDefinition(target, (ctorOrOptions as DefineOptions | undefined) ?? {});
  }
  return defineElement(target, ctorOrOptions as CustomElementConstructor, maybeOptions ?? {});
}

function defineDefinition<D extends ElementDefinition<any>>(
  definition: D,
  options: DefineOptions,
): D {
  if (!isElementDefinition(definition)) {
    throw new MoteError(
      'registry.definition.invalid',
      DEV ? 'define(definition) needs a definition created by compose().' : '',
    );
  }
  const registry = options.registry ?? globalThis.customElements;
  if (!registry) return definition;
  for (const dependency of Object.values(definition.dependencies ?? {})) {
    defineDefinition(dependency, options);
  }
  const ctor = definition.element as unknown as CustomElementConstructor;
  const current = definitionFor(ctor);
  if (registry.get(definition.name) === ctor) {
    if (current === definition) return definition;
    throw new MoteError(
      'registry.definitionConflict',
      DEV
        ? `<${definition.name}> is already registered from a different definition with the same class. Register one definition per name, or extend the class to create a separate implementation.`
        : '',
    );
  }
  if (current && current !== definition) {
    throw new MoteError(
      'registry.constructorReused',
      DEV
        ? `${ctor.name || 'This class'} already belongs to the definition for <${(current as ElementDefinition).name}>. Extend the class to register another definition.`
        : '',
    );
  }
  if (
    DEV &&
    definition.template &&
    (ctor.prototype as { render?: unknown }).render !==
      (MoteElement.prototype as unknown as { render: unknown }).render
  ) {
    reportMoteError(
      new MoteError(
        'definition.render.ignored',
        `<${definition.name}>: the definition's template replaces ${ctor.name || 'the class'}.render(). Remove render() or the template.`,
      ),
      { code: 'definition.render.ignored', origin: definition.name },
    );
  }
  // Bind before registering: upgrades of existing elements run during define().
  bindDefinition(ctor, definition);
  try {
    defineElement(definition.name, ctor, options);
  } catch (error) {
    unbindDefinition(ctor, definition);
    throw error;
  }
  return definition;
}

function defineElement<C extends CustomElementConstructor>(
  tagName: string,
  ctor: C,
  options: DefineOptions,
): C {
  const registry = options.registry ?? globalThis.customElements;
  if (!registry) return ctor;
  if (!VALID_NAME.test(tagName) || RESERVED.has(tagName)) {
    throw new MoteError(
      'registry.name.invalid',
      DEV
        ? `"${tagName}" is not a valid custom element name. Names start with a lowercase letter, contain a hyphen, and have no uppercase letters.`
        : '',
    );
  }
  for (const [name, dependency] of Object.entries((ctor as WithDependencies).dependencies ?? {})) {
    defineElement(name, dependency, options);
  }
  const existing = registry.get(tagName);
  if (existing === ctor) return ctor;
  if (existing) {
    throw new MoteError(
      'registry.collision',
      DEV
        ? `<${tagName}> is already defined by a different class (${existing.name || 'anonymous'}). This usually means two copies or versions of a package are loaded; deduplicate them, or use a scoped registry.`
        : '',
    );
  }
  const otherName = registry.getName?.(ctor);
  if (otherName) {
    throw new MoteError(
      'registry.constructorReused',
      DEV
        ? `${ctor.name || 'This class'} is already defined as <${otherName}>. A class can be registered under one name; extend it to register another.`
        : '',
    );
  }
  registry.define(tagName, ctor);
  return ctor;
}
