/**
 * Registration. `define()` is idempotent for the same constructor, reports collisions
 * clearly, and registers declared dependencies first.
 */
import { DEV } from '../internal/dev.js';
import { MoteError } from '../diagnostics/index.js';

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
 * Define `tagName` for `ctor`. Re-defining the same pair is a no-op; a different
 * constructor for a taken name throws `registry.collision`. Where no registry exists (server
 * rendering, Node tooling) it does nothing, so modules that register on import stay importable.
 */
export function define<C extends CustomElementConstructor>(
  tagName: string,
  ctor: C,
  options: DefineOptions = {},
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
    define(name, dependency, options);
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
