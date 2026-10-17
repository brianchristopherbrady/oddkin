/**
 * Binding parts and template instances. Each part owns exactly one binding position.
 * Readables bind through commit-phase effects on the shared reactive graph, so a value
 * reached by both a render rerun and a direct binding is written once.
 */
import { MoteError, reportMoteError } from '../diagnostics/index.js';
import { effect, isReadable, untracked, type Readable } from '../reactive/index.js';
import { prepareTemplate, type AttributeDescriptor, type PreparedTemplate } from './prepare.js';
import { isTemplateResult, type TemplateResult } from './result.js';

export interface RenderOptions {
  /** `this` for event handlers. Defaults to the element the listener is on. */
  readonly host?: object | undefined;
  /** Called after any part writes to the DOM. */
  readonly onCommit?: (() => void) | undefined;
}

export interface Part {
  pause(): void;
  dispose(): void;
}

const REPEAT: unique symbol = Symbol.for('mote.repeat') as never;

/** @internal Keyed list description produced by `repeat()`. */
export interface RepeatDirective<T = unknown> {
  readonly [REPEAT]: true;
  readonly items: Iterable<T>;
  readonly key: (item: T, index: number) => unknown;
  readonly template: (item: T, index: number) => unknown;
}

export function createRepeat<T>(
  items: Iterable<T>,
  key: (item: T, index: number) => unknown,
  template: (item: T, index: number) => unknown,
): RepeatDirective<T> {
  return { [REPEAT]: true, items, key, template };
}

function isRepeat(value: unknown): value is RepeatDirective {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[REPEAT] === true
  );
}

const supportsMoveBefore = typeof Element !== 'undefined' && 'moveBefore' in Element.prototype;

function moveRange(start: Node, end: Node, before: Node | null): void {
  const parent = start.parentNode as ParentNode & Node;
  const nodes: Node[] = [];
  for (let node: Node | null = start; node; node = node.nextSibling) {
    nodes.push(node);
    if (node === end) break;
  }
  for (const node of nodes) {
    if (supportsMoveBefore && parent.isConnected) {
      try {
        // State-preserving move (focus, iframes, animations) where supported.
        (parent as unknown as { moveBefore(n: Node, ref: Node | null): void }).moveBefore(
          node,
          before,
        );
        continue;
      } catch {
        // Fall back to a normal insertion.
      }
    }
    parent.insertBefore(node, before);
  }
}

// ---------------------------------------------------------------------------
// Child (node) parts

type ChildContent = 'empty' | 'text' | 'node' | 'template' | 'list' | 'repeat';

export class ChildPart implements Part {
  readonly #container: Node;
  readonly #start: Comment | null;
  readonly #end: Node | null;
  readonly #options: RenderOptions;
  #content: ChildContent = 'empty';
  #text: Text | undefined;
  #node: Node | undefined;
  #instance: TemplateInstance | undefined;
  #items: ChildPart[] = [];
  #keys: unknown[] = [];
  #readable: Readable<unknown> | undefined;
  #unbind: (() => void) | undefined;

  /**
   * @param container Parent node used when `end` is null (append position).
   * @param end Node the content is inserted before; null appends to `container`.
   * @param start Optional start marker; required for parts that move as a range.
   */
  constructor(container: Node, end: Node | null, start: Comment | null, options: RenderOptions) {
    this.#container = container;
    this.#end = end;
    this.#start = start;
    this.#options = options;
  }

  get startNode(): Comment | null {
    return this.#start;
  }

  get endNode(): Node | null {
    return this.#end;
  }

  setValue(value: unknown): void {
    if (isReadable(value)) {
      if (value === this.#readable && this.#unbind) return;
      this.#release();
      this.#readable = value;
      this.#unbind = effect(
        () => {
          const next = value.value;
          untracked(() => this.#commit(next));
        },
        { phase: 'commit', name: 'template binding' },
      );
      return;
    }
    this.#release();
    this.#commit(value);
  }

  pause(): void {
    this.#release();
    this.#instance?.pause();
    for (const item of this.#items) item.pause();
  }

  dispose(): void {
    this.#release();
    this.#clear();
  }

  /** Remove this part's markers too (list items). */
  remove(): void {
    this.dispose();
    this.#start?.remove();
    (this.#end as ChildNode | null)?.remove();
  }

  #release(): void {
    this.#unbind?.();
    this.#unbind = undefined;
    this.#readable = undefined;
  }

  get #document(): Document {
    return (this.#container.ownerDocument ?? this.#container) as Document;
  }

  #insert(node: Node): void {
    const parent = (this.#end ? this.#end.parentNode : this.#container) as Node;
    parent.insertBefore(node, this.#end);
  }

  #committed(): void {
    this.#options.onCommit?.();
  }

  #clear(): void {
    switch (this.#content) {
      case 'text':
        this.#text?.remove();
        this.#text = undefined;
        break;
      case 'node':
        (this.#node as ChildNode | undefined)?.remove();
        this.#node = undefined;
        break;
      case 'template':
        this.#instance?.remove();
        this.#instance = undefined;
        break;
      case 'list':
      case 'repeat':
        for (const item of this.#items) item.remove();
        this.#items = [];
        this.#keys = [];
        break;
      case 'empty':
        return;
    }
    this.#content = 'empty';
    this.#committed();
  }

  #commit(value: unknown): void {
    if (value === null || value === undefined || value === false) {
      this.#clear();
    } else if (isTemplateResult(value)) {
      this.#commitTemplate(value);
    } else if (isRepeat(value)) {
      this.#commitRepeat(value);
    } else if (typeof value === 'object' && 'nodeType' in value) {
      this.#commitNode(value as Node);
    } else if (isReadable(value)) {
      this.#commitList([value]);
    } else if (typeof value === 'object' && Symbol.iterator in value) {
      this.#commitList(value as Iterable<unknown>);
    } else if (typeof value === 'function') {
      reportMoteError(
        new MoteError(
          'template.value.function',
          'A function was interpolated in a child position. Functions are never called automatically; call it, pass a computed(), or bind it as an event (@event=${fn}).',
        ),
        { code: 'template.value.function' },
      );
      this.#clear();
    } else {
      this.#commitText(String(value));
    }
  }

  #commitText(text: string): void {
    if (this.#content === 'text' && this.#text) {
      if (this.#text.data !== text) {
        this.#text.data = text;
        this.#committed();
      }
      return;
    }
    this.#clear();
    this.#text = this.#document.createTextNode(text);
    this.#insert(this.#text);
    this.#content = 'text';
    this.#committed();
  }

  #commitNode(node: Node): void {
    if (this.#content === 'node' && this.#node === node) return;
    this.#clear();
    this.#node = node;
    this.#insert(node);
    this.#content = 'node';
    this.#committed();
  }

  #commitTemplate(result: TemplateResult): void {
    const prepared = prepareTemplate(result.strings, result.kind);
    if (this.#content === 'template' && this.#instance?.template === prepared) {
      this.#instance.update(result.values);
      return;
    }
    this.#clear();
    const instance = new TemplateInstance(prepared, this.#document, this.#options);
    instance.update(result.values);
    this.#insert(instance.takeFragment());
    this.#instance = instance;
    this.#content = 'template';
    this.#committed();
  }

  #createItem(before: Node | null): ChildPart {
    const doc = this.#document;
    const start = doc.createComment('');
    const end = doc.createComment('');
    const parent = (
      before ? before.parentNode : this.#end ? this.#end.parentNode : this.#container
    ) as Node;
    const ref = before ?? this.#end;
    parent.insertBefore(start, ref);
    parent.insertBefore(end, ref);
    return new ChildPart(parent, end, start, this.#options);
  }

  #commitList(values: Iterable<unknown>): void {
    if (this.#content !== 'list') this.#clear();
    this.#content = 'list';
    let i = 0;
    for (const value of values) {
      const item = (this.#items[i] ??= this.#createItem(null));
      item.setValue(value);
      i++;
    }
    if (i < this.#items.length) {
      for (const item of this.#items.splice(i)) item.remove();
      this.#committed();
    }
  }

  #commitRepeat(directive: RepeatDirective): void {
    if (this.#content !== 'repeat') this.#clear();
    this.#content = 'repeat';
    const old = new Map<unknown, ChildPart>();
    this.#keys.forEach((key, i) => old.set(key, this.#items[i] as ChildPart));

    const items: ChildPart[] = [];
    const keys: unknown[] = [];
    const seen = new Set<unknown>();
    let index = 0;
    let changedStructure = false;
    for (const item of directive.items) {
      let key = directive.key(item, index);
      if (seen.has(key)) {
        reportMoteError(
          new MoteError(
            'template.repeat.duplicateKey',
            `repeat() received the key ${String(key)} more than once; later duplicates are rendered without DOM reuse. Keys must be unique and stable.`,
          ),
          { code: 'template.repeat.duplicateKey' },
        );
        key = { duplicate: key, index };
      }
      seen.add(key);
      let part = old.get(key);
      if (part) old.delete(key);
      else {
        part = this.#createItem(null);
        changedStructure = true;
      }
      part.setValue(directive.template(item, index));
      items.push(part);
      keys.push(key);
      index++;
    }
    for (const part of old.values()) {
      part.remove();
      changedStructure = true;
    }
    // Position from the end, moving only parts that are out of place.
    let ref: Node | null = this.#end;
    for (let i = items.length - 1; i >= 0; i--) {
      const part = items[i] as ChildPart;
      const start = part.startNode as Comment;
      const end = part.endNode as Node;
      if (end.nextSibling !== ref) {
        moveRange(start, end, ref);
        changedStructure = true;
      }
      ref = start;
    }
    this.#items = items;
    this.#keys = keys;
    if (changedStructure) this.#committed();
  }
}

// ---------------------------------------------------------------------------
// Attribute-position parts

const URL_ATTRIBUTES = new Set([
  'href',
  'src',
  'action',
  'formaction',
  'xlink:href',
  'poster',
  'cite',
  'data',
  'ping',
  'background',
  'codebase',
  'manifest',
]);
const URL_PROPERTIES = new Set(['href', 'src', 'action', 'formAction', 'poster', 'cite', 'data']);
const UNSAFE_URL =
  /^[\u0000-\u0020]*(?:j[\s]*a[\s]*v[\s]*a[\s]*s[\s]*c[\s]*r[\s]*i[\s]*p[\s]*t|v[\s]*b[\s]*s[\s]*c[\s]*r[\s]*i[\s]*p[\s]*t)[\s]*:/i;
export const BLOCKED_URL = 'about:invalid#mote-unsafe-url';

function safeUrl(value: unknown, name: string): unknown {
  if (typeof value === 'string' && UNSAFE_URL.test(value)) {
    reportMoteError(
      new MoteError(
        'template.url.unsafe',
        `Blocked a script URL bound to "${name}". Mote does not allow javascript: or vbscript: URLs in URL bindings.`,
      ),
      { code: 'template.url.unsafe' },
    );
    return BLOCKED_URL;
  }
  return value;
}

abstract class ValuePart implements Part {
  protected readonly element: Element;
  protected readonly descriptor: AttributeDescriptor;
  protected readonly options: RenderOptions;
  #values: readonly unknown[] = [];
  #bound: readonly unknown[] | undefined;
  #unbind: (() => void) | undefined;
  #last: unknown = UNSET;

  constructor(element: Element, descriptor: AttributeDescriptor, options: RenderOptions) {
    this.element = element;
    this.descriptor = descriptor;
    this.options = options;
  }

  setValue(values: readonly unknown[]): void {
    this.#values = values;
    const readables = values.filter(isReadable);
    if (readables.length === 0) {
      this.#release();
      this.#apply(this.#compute());
      return;
    }
    const same =
      this.#unbind &&
      this.#bound?.length === values.length &&
      values.every((v, i) => !isReadable(v) || v === this.#bound?.[i]);
    if (same) {
      untracked(() => this.#apply(this.#compute()));
      return;
    }
    this.#release();
    this.#bound = values;
    this.#unbind = effect(
      () => {
        const next = this.#compute();
        untracked(() => this.#apply(next));
      },
      {
        phase: 'commit',
        name: `template ${this.descriptor.type} binding "${this.descriptor.name}"`,
      },
    );
  }

  pause(): void {
    this.#release();
  }

  dispose(): void {
    this.#release();
  }

  #release(): void {
    this.#unbind?.();
    this.#unbind = undefined;
    this.#bound = undefined;
  }

  #compute(): unknown {
    const read = (v: unknown) => (isReadable(v) ? v.value : v);
    const { strings } = this.descriptor;
    if (strings.length === 2 && strings[0] === '' && strings[1] === '')
      return read(this.#values[0]);
    let text = strings[0] ?? '';
    for (let i = 1; i < strings.length; i++)
      text += String(read(this.#values[i - 1]) ?? '') + strings[i];
    return text;
  }

  #apply(value: unknown): void {
    if (this.#last !== UNSET && Object.is(value, this.#last)) return;
    this.#last = value;
    this.write(value);
    this.options.onCommit?.();
  }

  protected abstract write(value: unknown): void;
}

const UNSET = Symbol('unset');

class AttributePart extends ValuePart {
  protected write(value: unknown): void {
    const { name } = this.descriptor;
    if (value === null || value === undefined) this.element.removeAttribute(name);
    else {
      const safe = URL_ATTRIBUTES.has(name.toLowerCase()) ? safeUrl(String(value), name) : value;
      this.element.setAttribute(name, String(safe));
    }
  }
}

class BooleanAttributePart extends ValuePart {
  protected write(value: unknown): void {
    this.element.toggleAttribute(this.descriptor.name, !!value);
  }
}

class PropertyPart extends ValuePart {
  protected write(value: unknown): void {
    const { name } = this.descriptor;
    const safe = URL_PROPERTIES.has(name) ? safeUrl(value, name) : value;
    if (/^on/.test(name) && typeof safe === 'string') {
      throw new MoteError(
        'template.property.unsafe',
        `Refusing to assign a string to the "${name}" handler property. Use @${name.slice(2)}=\${handler}.`,
      );
    }
    (this.element as unknown as Record<string, unknown>)[name] = safe;
  }
}

type Handler = ((event: Event) => unknown) | { handleEvent(event: Event): unknown };

class EventPart implements Part {
  readonly #element: Element;
  readonly #type: string;
  readonly #options: RenderOptions;
  #handler: Handler | undefined;
  #listening = false;
  readonly #listener = (event: Event) => {
    const handler = this.#handler;
    if (typeof handler === 'function') handler.call(this.#options.host ?? this.#element, event);
    else handler?.handleEvent(event);
  };

  constructor(element: Element, descriptor: AttributeDescriptor, options: RenderOptions) {
    this.#element = element;
    this.#type = descriptor.name;
    this.#options = options;
  }

  setValue(values: readonly unknown[]): void {
    const value = values[0];
    if (isReadable(value)) {
      throw new MoteError(
        'template.event.readable',
        `@${this.#type} received a readable. Pass a function; read state inside the handler.`,
      );
    }
    if (
      value !== null &&
      value !== undefined &&
      typeof value !== 'function' &&
      typeof (value as { handleEvent?: unknown }).handleEvent !== 'function'
    ) {
      throw new MoteError(
        'template.event.invalid',
        `@${this.#type} expects a function, an object with handleEvent, or null.`,
      );
    }
    this.#handler = (value ?? undefined) as Handler | undefined;
    if (this.#handler && !this.#listening) {
      this.#element.addEventListener(this.#type, this.#listener);
      this.#listening = true;
    } else if (!this.#handler && this.#listening) {
      this.#element.removeEventListener(this.#type, this.#listener);
      this.#listening = false;
    }
  }

  pause(): void {}

  dispose(): void {
    if (this.#listening) this.#element.removeEventListener(this.#type, this.#listener);
    this.#listening = false;
    this.#handler = undefined;
  }
}

// ---------------------------------------------------------------------------
// Template instances

type BoundPart =
  | { part: ChildPart; count: 1; child: true }
  | { part: ValuePart | EventPart; count: number; child: false };

export class TemplateInstance {
  readonly template: PreparedTemplate;
  /** Static top-level nodes; dynamic top-level content is removed by its own part. */
  readonly nodes: readonly Node[];
  readonly #parts: BoundPart[] = [];
  #fragment: DocumentFragment | undefined;

  constructor(template: PreparedTemplate, doc: Document, options: RenderOptions) {
    this.template = template;
    const fragment = doc.importNode(template.element.content, true);
    const walker = doc.createTreeWalker(
      fragment,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
    );
    let index = -1;
    let node: Node | null = null;
    for (const descriptor of template.parts) {
      while (index < descriptor.node) {
        node = walker.nextNode();
        index++;
      }
      if (descriptor.kind === 'child') {
        this.#parts.push({
          part: new ChildPart(fragment, node, null, options),
          count: 1,
          child: true,
        });
      } else {
        const { attribute } = descriptor;
        const el = node as Element;
        const part =
          attribute.type === 'attribute'
            ? new AttributePart(el, attribute, options)
            : attribute.type === 'boolean'
              ? new BooleanAttributePart(el, attribute, options)
              : attribute.type === 'property'
                ? new PropertyPart(el, attribute, options)
                : new EventPart(el, attribute, options);
        this.#parts.push({ part, count: attribute.strings.length - 1, child: false });
      }
    }
    this.nodes = [...fragment.childNodes];
    this.#fragment = fragment;
  }

  /** The cloned content (static and dynamic nodes), for insertion once. */
  takeFragment(): DocumentFragment {
    const fragment = this.#fragment as DocumentFragment;
    this.#fragment = undefined;
    return fragment;
  }

  update(values: readonly unknown[]): void {
    let i = 0;
    for (const bound of this.#parts) {
      if (bound.child) bound.part.setValue(values[i]);
      else bound.part.setValue(values.slice(i, i + bound.count));
      i += bound.count;
    }
  }

  pause(): void {
    for (const { part } of this.#parts) part.pause();
  }

  dispose(): void {
    for (const { part } of this.#parts) part.dispose();
  }

  /** Dispose bindings and remove this instance's top-level nodes. */
  remove(): void {
    this.dispose();
    for (const node of this.nodes) (node as ChildNode).remove();
  }
}

// ---------------------------------------------------------------------------
// Standalone rendering

const roots = new WeakMap<Node, ChildPart>();

/**
 * Render `value` into `container`, reusing DOM from the previous render into the same
 * container. Returns the root part; call `dispose()` to release its bindings.
 */
export function render(
  value: unknown,
  container: Element | DocumentFragment,
  options: RenderOptions = {},
): ChildPart {
  let root = roots.get(container);
  if (!root) {
    root = new ChildPart(container, null, null, options);
    roots.set(container, root);
  }
  root.setValue(value);
  return root;
}
