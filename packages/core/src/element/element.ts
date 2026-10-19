/**
 * `OddkinElement` — the authoring base class. Owns the native callbacks; authors use
 * `connected`, `mounted`, `updated`, `disconnected`, `adopted`, and `moved`.
 * Contract: docs/architecture/core-contracts.md §1–§3.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError, reportOddkinError } from '../diagnostics/index.js';
import { effect, settled, signal, untracked, type Signal } from '../reactive/index.js';
import { enterRender, exitRender } from '../internal/render-context.js';
import { definitionFor } from '../internal/definitions.js';
import { Scope } from '../scope/index.js';
import { adoptStyles, flattenStyles, retainStyles, type StyleInput } from '../styles/index.js';
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

export type OddkinElementClass = abstract new () => OddkinElement;

/** The class returned by `with()`: the base's statics plus a typed instance. */
export type WithProps<B extends OddkinElementClass, D extends PropDefinitions> = Omit<
  B,
  'prototype'
> & {
  new (): InstanceType<B> & PropValues<D> & DeclaredProps<D>;
  prototype: InstanceType<B> & PropValues<D> & DeclaredProps<D>;
};

/** Type-only record of the `prop.*` properties, including function values such as renderers. */
interface DeclaredProps<D extends PropDefinitions> {
  readonly _props?: PropValues<D>;
}

type IfWritable<T, K extends keyof T> =
  (<F>() => F extends { [Q in K]: T[K] } ? 1 : 2) extends <F>() => F extends {
    -readonly [Q in K]: T[K];
  }
    ? 1
    : 2
    ? K
    : never;

/**
 * Properties a framework can set on an element: its `prop.*` properties and other writable,
 * non-method public fields and accessors (such as `odd-input`'s `value`), without `HTMLElement`'s.
 */
export type ElementProperties<E> = {
  [
    K in keyof E as K extends `_${string}` | keyof HTMLElement
      ? never
      : E[K] extends (...args: never[]) => unknown
        ? never
        : IfWritable<E, K>
  ]?: E[K];
} & Partial<E extends { readonly _props?: infer P } ? NonNullable<P> : {}>;

const PROPS: unique symbol = Symbol('oddkin.properties') as never;

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
  ctor: CustomElementConstructor | OddkinElementClass,
): readonly ElementProperty[] {
  return [...propsOf(ctor).values()];
}

const NOT_RENDERED = Symbol('not rendered');
const checkedLightDomStyles = new WeakSet<object>();

// Importing element modules must not throw where no DOM exists (server rendering, Node tooling).
// Constructing or defining elements there is still unsupported.
const ElementBase: typeof HTMLElement =
  globalThis.HTMLElement ?? (class {} as unknown as typeof HTMLElement);

/** The listener map an element declares as `_events` (type-only), or none. */
type OwnEvents<T> = T extends { readonly _events?: infer M } ? NonNullable<M> : {};

// Type-only: listeners for the element's own events get their published event types.
export interface OddkinElement {
  addEventListener<K extends keyof OwnEvents<this> & string>(
    type: K,
    listener: (this: this, event: OwnEvents<this>[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: this, event: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof OwnEvents<this> & string>(
    type: K,
    listener: (this: this, event: OwnEvents<this>[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: this, event: HTMLElementEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

export class OddkinElement extends ElementBase {
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
  static with<B extends OddkinElementClass, const D extends PropDefinitions>(
    this: B,
    definitions: D,
  ): WithProps<B, D> {
    const Base = this as unknown as typeof OddkinElement;
    const inherited = propsOf(Base);
    const table = new Map(inherited);
    const attributes = new Map(
      [...inherited.values()].flatMap((p) => (p.attribute ? [[p.attribute, p.name] as const] : [])),
    );

    for (const [name, definition] of Object.entries(definitions)) {
      if (inherited.has(name)) {
        throw new OddkinError(
          'element.prop.duplicate',
          DEV
            ? `Property "${name}" is already declared by ${Base.name}. Each property is declared once.`
            : '',
        );
      }
      if (name in Base.prototype) {
        throw new OddkinError(
          'element.prop.reserved',
          DEV
            ? `Property "${name}" would replace an existing HTMLElement or OddkinElement member. Choose another name.`
            : '',
        );
      }
      const attribute =
        definition.attribute === false ? null : (definition.attribute ?? attributeNameFor(name));
      if (definition.reflect && !attribute) {
        throw new OddkinError(
          'element.prop.reflectWithoutAttribute',
          DEV ? `Property "${name}" reflects but has no attribute.` : '',
        );
      }
      if (attribute) {
        if (
          RESERVED_ATTRIBUTES.has(attribute) ||
          attribute.startsWith('aria-') ||
          (attribute.startsWith('on') && attribute in ElementBase.prototype)
        ) {
          throw new OddkinError(
            'element.attribute.reserved',
            DEV
              ? `Attribute "${attribute}" for property "${name}" belongs to the platform. Pick another attribute name or use attribute: false.`
              : '',
          );
        }
        const owner = attributes.get(attribute);
        if (owner) {
          throw new OddkinError(
            'element.attribute.duplicate',
            DEV ? `Attribute "${attribute}" is used by both "${owner}" and "${name}".` : '',
          );
        }
        attributes.set(attribute, name);
      }
      table.set(name, { name, attribute, definition });
    }

    const Derived = class extends Base {};
    Object.defineProperty(Derived, 'name', { value: `${Base.name || 'OddkinElement'}WithProps` });
    Object.defineProperty(Derived, PROPS, { value: table });
    for (const name of Object.keys(definitions)) {
      const property = table.get(name) as ElementProperty;
      Object.defineProperty(Derived.prototype, name, {
        configurable: true,
        enumerable: true,
        get(this: OddkinElement) {
          return this.#read(property);
        },
        set(this: OddkinElement, value: unknown) {
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
      // React 19 and Vue set attributes on not-yet-defined elements; property-only props ignore them.
      if (DEV) {
        for (const property of propsOf(this.constructor).values()) {
          if (property.attribute || !this.hasAttribute(property.name)) continue;
          reportOddkinError(
            new OddkinError(
              'element.attribute.propertyOnly',
              `<${this.localName}> has an attribute "${property.name}", but "${property.name}" is a property only, so the attribute is ignored. A framework that renders the element before it is defined sets an attribute instead of the property: define the element first, or bind it as a property.`,
            ),
            { code: 'element.attribute.propertyOnly', origin: this.localName },
          );
        }
      }
    }
    this.#retainLightDomStyles(scope);
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

    const template = definitionFor(this.constructor)?.template as
      ((host: this) => unknown) | undefined;
    if (template || this.render !== OddkinElement.prototype.render) {
      const root = this.#ensureRoot();
      scope.add(
        effect(
          () => {
            enterRender();
            let result: unknown;
            try {
              result = template ? template(this) : this.render();
            } finally {
              exitRender();
            }
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
    const ctor = this.constructor as typeof OddkinElement;
    if (this.#root && this.shadowRoot)
      adoptStyles(this.shadowRoot, stylesOf(ctor), { nonce: ctor.styleNonce });
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
    reportOddkinError(
      new OddkinError(
        code,
        DEV ? `<${this.localName}> ${subject}: ${reason}. Using the default value.` : '',
      ),
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
    const ctor = this.constructor as typeof OddkinElement;
    const options = ctor.shadowRootOptions;
    let container: ShadowRoot | HTMLElement = this;
    if (options) {
      const root = this.shadowRoot ?? this.attachShadow(options);
      // Server-rendered (declarative) content is replaced; hydration is not supported.
      root.replaceChildren();
      adoptStyles(root, stylesOf(ctor), { nonce: ctor.styleNonce });
      container = root;
    }

    this.#root = new ChildPart(container, null, null, { host: this, onCommit: () => this.#bump() });
    return this.#root;
  }

  #retainLightDomStyles(scope: Scope): void {
    const ctor = this.constructor as typeof OddkinElement;
    const styles = stylesOf(ctor);
    if (ctor.shadowRootOptions || !styles) return;
    const root = this.getRootNode();
    if (root.nodeType !== Node.DOCUMENT_NODE && !(root instanceof ShadowRoot)) return;
    if (DEV && !checkedLightDomStyles.has(ctor)) {
      checkedLightDomStyles.add(ctor);
      if (flattenStyles(styles).some((s) => /:host\b/.test(s.cssText))) {
        reportOddkinError(
          new OddkinError(
            'element.styles.lightDomHost',
            DEV
              ? `<${this.localName}> renders into light DOM, where :host never matches. Select the element by tag name or class instead.`
              : '',
          ),
          { code: 'element.styles.lightDomHost', origin: this.localName },
        );
      }
    }
    scope.add(
      retainStyles(root as Document | ShadowRoot, styles, { nonce: ctor.styleNonce }),
      'light-DOM styles',
    );
  }
  #rejectShadowingFields(): void {
    for (const property of propsOf(this.constructor).values()) {
      if (!Object.hasOwn(this, property.name)) continue;
      const value = (this as unknown as Record<string, unknown>)[property.name];
      delete (this as unknown as Record<string, unknown>)[property.name];
      reportOddkinError(
        new OddkinError(
          'element.prop.shadowed',
          DEV
            ? `<${this.localName}> has a class field "${property.name}" that hides the reactive property. Remove the field and set the default in prop.*({ default }), or use "declare ${property.name}: …" for types only. The field value was applied through the property.`
            : '',
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
      reportOddkinError(error, { code: `element.${hook}.error`, origin: this.localName });
    }
  }
}

/** A registered definition's styles replace the class's `static styles`; otherwise the class's apply. */
function stylesOf(ctor: typeof OddkinElement): StyleInput | undefined {
  const definition = definitionFor(ctor);
  return definition && definition.styles !== undefined ? definition.styles : ctor.styles;
}
