/**
 * `MoteElement` — the authoring base class. Owns the native callbacks; authors use
 * `connected`, `mounted`, `updated`, `disconnected`, `adopted`, and `moved`.
 * Contract: docs/architecture/core-contracts.md §1–§3.
 */
import { MoteError, reportMoteError } from '../diagnostics/index.js';
import { effect, settled, signal, untracked, type Signal } from '../reactive/index.js';
import { Scope } from '../scope/index.js';
import { adoptStyles, type StyleInput } from '../styles/index.js';
import { ChildPart } from '../template/parts.js';
import { emit, type EventDefinition } from './events.js';
import {
  attributeNameFor,
  type PropDefinition,
  type PropDefinitions,
  type PropValues,
} from './props.js';

/** A resolved public property on an element class. */
export interface ElementProperty {
  readonly name: string;
  readonly attribute: string | null;
  readonly definition: PropDefinition<unknown>;
}

export type MoteElementClass = abstract new () => MoteElement;

/** The class returned by `with()`: the base's statics plus a typed instance. */
export type WithProps<B extends MoteElementClass, D extends PropDefinitions> = Omit<
  B,
  'prototype'
> & {
  new (): InstanceType<B> & PropValues<D>;
  prototype: InstanceType<B> & PropValues<D>;
};

const PROPS: unique symbol = Symbol('mote.properties') as never;

/** Attributes that belong to the platform or the host page, never to a component property. */
const RESERVED_ATTRIBUTES = new Set([
  'id',
  'class',
  'style',
  'slot',
  'part',
  'exportparts',
  'is',
  'hidden',
  'title',
  'lang',
  'dir',
  'tabindex',
  'role',
  'inert',
  'popover',
  'autofocus',
  'nonce',
  'contenteditable',
  'draggable',
]);

type PropTable = ReadonlyMap<string, ElementProperty>;
const EMPTY: PropTable = new Map();
const attributeTables = new WeakMap<object, ReadonlyMap<string, ElementProperty>>();

function propsOf(ctor: unknown): PropTable {
  return ((ctor as Record<symbol, PropTable | undefined>)[PROPS] ?? EMPTY) as PropTable;
}

function attributesOf(ctor: object): ReadonlyMap<string, ElementProperty> {
  let table = attributeTables.get(ctor);
  if (!table) {
    table = new Map(
      [...propsOf(ctor).values()].flatMap((p) => (p.attribute ? [[p.attribute, p] as const] : [])),
    );
    attributeTables.set(ctor, table);
  }
  return table;
}

/** Public properties declared on an element class (including inherited ones). For tooling. */
export function elementProperties(
  ctor: CustomElementConstructor | MoteElementClass,
): readonly ElementProperty[] {
  return [...propsOf(ctor).values()];
}

const NOT_RENDERED = Symbol('not rendered');

// Importing element modules must not throw where no DOM exists (server rendering, Node tooling).
// Constructing or defining elements there is still unsupported.
const ElementBase: typeof HTMLElement =
  globalThis.HTMLElement ?? (class {} as unknown as typeof HTMLElement);

export class MoteElement extends ElementBase {
  /** Styles adopted into the shadow root, shared per document. */
  static styles: StyleInput | undefined = undefined;
  /** Shadow root options, or `null` to render into the element itself (light DOM). */
  static shadowRootOptions: ShadowRootInit | null = { mode: 'open' };
  /** CSP nonce for the `<style>` fallback where constructable sheets are unavailable. */
  static styleNonce: string | undefined = undefined;
  /** Elements `define()` registers before this one. */
  static dependencies: Readonly<Record<string, CustomElementConstructor>> | undefined = undefined;
  /** Event contracts, for metadata and typed dispatch. */
  static events: Readonly<Record<string, EventDefinition<any>>> | undefined = undefined;

  static get observedAttributes(): string[] {
    return [...attributesOf(this).keys()];
  }

  /**
   * Derive a base class with typed public properties: DOM accessors backed by signals,
   * attribute conversion, and opt-in reflection. Chain on subclasses to add properties.
   */
  static with<B extends MoteElementClass, const D extends PropDefinitions>(
    this: B,
    definitions: D,
  ): WithProps<B, D> {
    const Base = this as unknown as typeof MoteElement;
    const inherited = propsOf(Base);
    const table = new Map(inherited);
    const attributes = new Map(
      [...inherited.values()].flatMap((p) => (p.attribute ? [[p.attribute, p.name] as const] : [])),
    );

    for (const [name, definition] of Object.entries(definitions)) {
      if (inherited.has(name)) {
        throw new MoteError(
          'element.prop.duplicate',
          `Property "${name}" is already declared by ${Base.name}. Each property is declared once.`,
        );
      }
      if (name in Base.prototype) {
        throw new MoteError(
          'element.prop.reserved',
          `Property "${name}" would replace an existing HTMLElement or MoteElement member. Choose another name.`,
        );
      }
      const attribute =
        definition.attribute === false ? null : (definition.attribute ?? attributeNameFor(name));
      if (definition.reflect && !attribute) {
        throw new MoteError(
          'element.prop.reflectWithoutAttribute',
          `Property "${name}" reflects but has no attribute.`,
        );
      }
      if (attribute) {
        if (
          RESERVED_ATTRIBUTES.has(attribute) ||
          attribute.startsWith('aria-') ||
          (attribute.startsWith('on') && attribute in ElementBase.prototype)
        ) {
          throw new MoteError(
            'element.attribute.reserved',
            `Attribute "${attribute}" for property "${name}" belongs to the platform. Pick another attribute name or use attribute: false.`,
          );
        }
        const owner = attributes.get(attribute);
        if (owner) {
          throw new MoteError(
            'element.attribute.duplicate',
            `Attribute "${attribute}" is used by both "${owner}" and "${name}".`,
          );
        }
        attributes.set(attribute, name);
      }
      table.set(name, { name, attribute, definition });
    }

    const Derived = class extends Base {};
    Object.defineProperty(Derived, 'name', { value: `${Base.name || 'MoteElement'}WithProps` });
    Object.defineProperty(Derived, PROPS, { value: table });
    for (const name of Object.keys(definitions)) {
      const property = table.get(name) as ElementProperty;
      Object.defineProperty(Derived.prototype, name, {
        configurable: true,
        enumerable: true,
        get(this: MoteElement) {
          return this.#read(property);
        },
        set(this: MoteElement, value: unknown) {
          this.#write(property, value);
        },
      });
    }
    return Derived as unknown as WithProps<B, D>;
  }

  readonly #signals = new Map<string, Signal<unknown>>();
  readonly #changes = new Map<string, unknown>();
  readonly #commits = signal(0);
  #connection: Scope | undefined;
  #generation = 0;
  #root: ChildPart | undefined;
  #reflecting: string | undefined;
  #internals: ElementInternals | undefined;
  #checkedFields = false;

  constructor() {
    super();
    // Replay properties assigned before the element was upgraded.
    for (const name of propsOf(this.constructor).keys()) {
      if (Object.hasOwn(this, name)) {
        const value = (this as unknown as Record<string, unknown>)[name];
        delete (this as unknown as Record<string, unknown>)[name];
        (this as unknown as Record<string, unknown>)[name] = value;
      }
    }
  }

  // ---- Authoring hooks (override as needed) ----

  /** Return the element's content. Runs in a tracked context; `.value` reads re-run it. */
  protected render(): unknown {
    return NOT_RENDERED;
  }

  /** Synchronous setup on every connection, with a fresh scope disposed on disconnect. */
  protected connected(_scope: Scope): void {}

  /** Once per connection after the current DOM is committed. */
  protected mounted(_scope: Scope): void {}

  /** After each commit batch. `changes` maps changed public properties to previous values. */
  protected updated(_changes: ReadonlyMap<string, unknown>): void {}

  /** After connection work is disposed. Instance state and retained DOM survive. */
  protected disconnected(): void {}

  /** After moving to another document; styles are already re-adopted for it. */
  protected adopted(_oldDocument: Document, _newDocument: Document): void {}

  /** After a state-preserving move (`moveBefore`), which keeps the connection. */
  protected moved(): void {}

  // ---- Public element API ----

  /** Resolves after scheduled commits and synchronous lifecycle work have flushed. */
  get updateComplete(): Promise<void> {
    return settled();
  }

  // ---- Helpers for subclasses ----

  /** Lazily attached `ElementInternals`. Do not call `attachInternals()` separately. */
  protected get internals(): ElementInternals {
    return (this.#internals ??= this.attachInternals());
  }

  /** Toggle a custom state, matched in CSS by `:state(name)`. */
  protected setState(name: string, on: boolean): void {
    const states = this.internals.states;
    if (on) states.add(name);
    else states.delete(name);
  }

  /** Dispatch a defined event from this element. Returns false if it was cancelled. */
  protected emit<D>(definition: EventDefinition<D>, ...detail: D extends void ? [] : [D]): boolean {
    return emit(this, definition, ...detail);
  }

  /** Increments on each connection; compare in async work before committing results. */
  protected get connectionGeneration(): number {
    return this.#generation;
  }

  // ---- Native callbacks ----

  connectedCallback(): void {
    if (this.#connection) return;
    this.#generation++;
    const scope = new Scope({ name: this.localName });
    this.#connection = scope;
    if (!this.#checkedFields) {
      this.#checkedFields = true;
      this.#rejectShadowingFields();
    }
    this.#guard('connected', () => this.connected(scope));
    if (scope.disposed) return;

    let first = true;
    scope.add(
      effect(
        () => {
          this.#commits.value;
          if (first) {
            first = false;
            return;
          }
          const changes = new Map(this.#changes);
          this.#changes.clear();
          untracked(() => this.#guard('updated', () => this.updated(changes)));
        },
        { phase: 'post', name: `<${this.localName}> updated` },
      ),
      'updated',
    );

    const reflected = [...propsOf(this.constructor).values()].filter(
      (p) => p.definition.reflect && p.attribute,
    );
    if (reflected.length) {
      scope.add(
        effect(
          () => {
            for (const property of reflected) {
              const value = property.definition.toAttribute(this.#read(property));
              untracked(() => this.#reflect(property.attribute as string, value));
            }
          },
          { phase: 'commit', name: `<${this.localName}> reflection` },
        ),
        'reflection',
      );
    }

    if (this.render !== MoteElement.prototype.render) {
      const root = this.#ensureRoot();
      scope.add(
        effect(
          () => {
            const result = this.render();
            untracked(() => root.setValue(result));
          },
          { phase: 'commit', name: `<${this.localName}> render` },
        ),
        'render',
      );
    }

    if (!scope.disposed) this.#guard('mounted', () => this.mounted(scope));
  }

  disconnectedCallback(): void {
    const scope = this.#connection;
    if (!scope) return;
    this.#connection = undefined;
    scope.dispose(new DOMException(`<${this.localName}> disconnected`, 'AbortError'));
    this.#root?.pause();
    this.#guard('disconnected', () => this.disconnected());
  }

  /** Opting in lets `moveBefore()` keep the connection instead of disconnect + connect. */
  connectedMoveCallback(): void {
    this.#guard('moved', () => this.moved());
  }

  adoptedCallback(oldDocument: Document, newDocument: Document): void {
    const ctor = this.constructor as typeof MoteElement;
    if (this.#root && this.shadowRoot)
      adoptStyles(this.shadowRoot, ctor.styles, { nonce: ctor.styleNonce });
    this.#guard('adopted', () => this.adopted(oldDocument, newDocument));
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (this.#reflecting === name) return;
    const property = attributesOf(this.constructor).get(name);
    if (!property) return;
    const parsed = property.definition.fromAttribute(value);
    if (parsed.ok) this.#write(property, parsed.value);
    else {
      this.#invalid('element.attribute.invalid', `attribute "${name}"`, parsed.reason);
      this.#write(property, property.definition.initial());
    }
  }

  // ---- Internals ----

  #signal(property: ElementProperty): Signal<unknown> {
    let s = this.#signals.get(property.name);
    if (!s) {
      s = signal(property.definition.initial());
      this.#signals.set(property.name, s);
    }
    return s;
  }

  #read(property: ElementProperty): unknown {
    return this.#signal(property).value;
  }

  #write(property: ElementProperty, value: unknown): void {
    const coerced = property.definition.coerce(value);
    let next: unknown;
    if (coerced.ok) next = coerced.value;
    else {
      this.#invalid('element.prop.invalid', `property "${property.name}"`, coerced.reason);
      next = property.definition.initial();
    }
    const s = this.#signal(property);
    const previous = s.peek();
    if (Object.is(previous, next)) return;
    if (!this.#changes.has(property.name)) this.#changes.set(property.name, previous);
    s.value = next;
    this.#bump();
  }

  #invalid(code: string, subject: string, reason: string): void {
    reportMoteError(
      new MoteError(code, `<${this.localName}> ${subject}: ${reason}. Using the default value.`),
      {
        code,
        origin: this.localName,
      },
    );
  }

  #bump(): void {
    this.#commits.value = this.#commits.peek() + 1;
  }

  #reflect(attribute: string, value: string | null): void {
    if (this.getAttribute(attribute) === value) return;
    this.#reflecting = attribute;
    try {
      if (value === null) this.removeAttribute(attribute);
      else this.setAttribute(attribute, value);
    } finally {
      this.#reflecting = undefined;
    }
    this.#bump();
  }

  #ensureRoot(): ChildPart {
    if (this.#root) return this.#root;
    const ctor = this.constructor as typeof MoteElement;
    const options = ctor.shadowRootOptions;
    let container: ShadowRoot | HTMLElement = this;
    if (options) {
      const root = this.shadowRoot ?? this.attachShadow(options);
      // Server-rendered (declarative) content is replaced; hydration is not supported.
      root.replaceChildren();
      adoptStyles(root, ctor.styles, { nonce: ctor.styleNonce });
      container = root;
    } else if (ctor.styles) {
      reportMoteError(
        new MoteError(
          'element.styles.lightDom',
          `<${this.localName}> renders into light DOM, so static styles are not applied. Use a shadow root or document-level styles.`,
        ),
        { code: 'element.styles.lightDom', origin: this.localName },
      );
    }
    this.#root = new ChildPart(container, null, null, { host: this, onCommit: () => this.#bump() });
    return this.#root;
  }

  #rejectShadowingFields(): void {
    for (const property of propsOf(this.constructor).values()) {
      if (!Object.hasOwn(this, property.name)) continue;
      const value = (this as unknown as Record<string, unknown>)[property.name];
      delete (this as unknown as Record<string, unknown>)[property.name];
      reportMoteError(
        new MoteError(
          'element.prop.shadowed',
          `<${this.localName}> has a class field "${property.name}" that hides the reactive property. Remove the field and set the default in prop.*({ default }), or use "declare ${property.name}: …" for types only. The field value was applied through the property.`,
        ),
        { code: 'element.prop.shadowed', origin: this.localName },
      );
      (this as unknown as Record<string, unknown>)[property.name] = value;
    }
  }

  #guard(hook: string, run: () => void): void {
    try {
      run();
    } catch (error) {
      reportMoteError(error, { code: `element.${hook}.error`, origin: this.localName });
    }
  }
}
