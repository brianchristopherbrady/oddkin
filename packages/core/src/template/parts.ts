/**
 * Binding parts and template instances. Each part owns exactly one binding position.
 * Readables bind through commit-phase effects on the shared reactive graph, so a value
 * reached by both a render rerun and a direct binding is written once.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError, reportOddkinError } from '../diagnostics/index.js';
import { effect, isReadable, untracked, type Readable } from '../reactive/index.js';
import { checkForeignReadable } from '../reactive/graph.js';
import {
  ATTRIBUTE_DIRECTIVE,
  isAttributeDirective,
  type AttributeDirective,
  type DirectiveHandler,
  type DirectivePartType,
} from './directive.js';
import { prepareTemplate, type AttributeDescriptor, type PreparedTemplate } from './prepare.js';
import type { REPEAT as RepeatKey, RepeatDirective } from './repeat.js';
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

const REPEAT: typeof RepeatKey = Symbol.for('oddkin.repeat') as never;

const UNSUPPORTED = {
  function:
    'Functions are never called or written as text; call it, pass a computed(), bind it as an event (@event=${fn}), or assign it as a property (.name=${fn}).',
  symbol: 'A symbol has no text; pass its description or a string.',
  object:
    'An object without its own string form would be written as "[object Object]"; pass a string, assign it as a property (.name=${obj}), or give it a toString().',
};

/**
 * Reports a value a text or attribute position has no meaning for (core-contracts.md §6.1): a
 * function, a symbol, or an object whose only string form is Object.prototype's (or none).
 */
function unsupported(value: unknown): boolean {
  const toString = (value as { toString?: unknown } | null)?.toString;
  const kind =
    typeof value === 'function'
      ? 'function'
      : typeof value === 'symbol'
        ? 'symbol'
        : typeof value === 'object' &&
            value !== null &&
            (toString === Object.prototype.toString || typeof toString !== 'function')
          ? 'object'
          : undefined;
  if (!kind) return false;
  const code = `template.value.${kind}`;
  reportOddkinError(new OddkinError(code, DEV ? UNSUPPORTED[kind] : ''), { code });
  return true;
}

function isRepeat(value: unknown): value is RepeatDirective {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<symbol, unknown>)[REPEAT] === 'function'
  );
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
      if (DEV) checkForeignReadable(value);
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

  /** The node this part's content lives in: the end marker's parent, or the container. */
  get #parent(): Node {
    return (this.#end ? this.#end.parentNode : this.#container) as Node;
  }

  #insert(node: Node): void {
    this.#parent.insertBefore(node, this.#end);
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
        // A node the page or another part has moved away is no longer this part's to remove.
        if (this.#holds(this.#node)) (this.#node as ChildNode).remove();
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
    } else if (unsupported(value)) {
      this.#clear();
    } else {
      this.#commitText(String(value));
    }
  }

  /** Whether `node` is still where this part put it: just before the end marker. */
  #holds(node: Node | undefined): node is Node {
    return !!node && node.parentNode === this.#parent && node.nextSibling === this.#end;
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
    if (this.#content === 'node' && this.#node === node && this.#holds(node)) return;
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
    // The previous content goes first, so refs see the old element released before the new one.
    this.#clear();
    const instance = new TemplateInstance(prepared, this.#document, this.#options);
    try {
      instance.update(result.values);
    } catch (error) {
      // A template that fails while committing releases what it bound; the next value renders.
      instance.dispose();
      throw error;
    }
    this.#insert(instance.takeFragment());
    this.#instance = instance;
    this.#content = 'template';
    this.#committed();
  }

  #createItem(before: Node | null): ChildPart {
    const doc = this.#document;
    const start = doc.createComment('');
    const end = doc.createComment('');
    const parent = (before ? before.parentNode : this.#parent) as Node;
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
    const next = directive[REPEAT](
      directive,
      this.#items,
      this.#keys,
      () => this.#createItem(null),
      this.#end,
    );
    this.#items = next.items;
    this.#keys = next.keys;
    if (next.changed) this.#committed();
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
export const BLOCKED_URL = 'about:invalid#oddkin-unsafe-url';

function safeUrl(value: unknown, name: string): unknown {
  if (typeof value === 'string' && UNSAFE_URL.test(value)) {
    reportOddkinError(
      new OddkinError(
        'template.url.unsafe',
        DEV
          ? `Blocked a script URL bound to "${name}". Oddkin does not allow javascript: or vbscript: URLs in URL bindings.`
          : '',
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
  #directive: DirectiveHandler<unknown, unknown> | undefined;
  #directiveState: unknown;

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
    if (DEV) readables.forEach(checkForeignReadable);
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
    this.#clearDirective();
  }

  #release(): void {
    this.#unbind?.();
    this.#unbind = undefined;
    this.#bound = undefined;
  }

  #clearDirective(): void {
    const handler = this.#directive;
    if (!handler) return;
    this.#directive = undefined;
    const state = this.#directiveState;
    this.#directiveState = undefined;
    handler.clear?.(this.element, state);
  }

  #applyDirective(directive: AttributeDirective): void {
    const handler = directive[ATTRIBUTE_DIRECTIVE];
    const { type, name, strings } = this.descriptor;
    if (type === 'event' || strings.length !== 2 || strings[0] !== '' || strings[1] !== '') {
      throw new OddkinError(
        'template.directive.position',
        DEV
          ? `${handler.name}() must be the whole value of its binding, e.g. ${type === 'property' ? '.' : type === 'boolean' ? '?' : ''}${name}=\${${handler.name}(…)}.`
          : '',
      );
    }
    if (
      !handler.parts.includes(type as DirectivePartType) ||
      (handler.bindingName && handler.bindingName !== name.toLowerCase())
    ) {
      throw new OddkinError(
        'template.directive.binding',
        DEV
          ? `${handler.name}() cannot be used in a ${type} binding named "${name}"${handler.bindingName ? `; bind it as ${handler.bindingName}=\${…}` : ''}.`
          : '',
      );
    }
    if (this.#directive && this.#directive !== handler) this.#clearDirective();
    const result = handler.apply(directive, this.element, { type, name }, this.#directiveState);
    this.#directive = handler;
    this.#directiveState = result.state;
    this.#last = UNSET;
    if (result.changed) this.options.onCommit?.();
  }

  #compute(): unknown {
    const read = (v: unknown) => (isReadable(v) ? v.value : v);
    const { strings } = this.descriptor;
    if (strings.length === 2 && strings[0] === '' && strings[1] === '')
      return read(this.#values[0]);
    let text = strings[0] ?? '';
    for (let i = 1; i < strings.length; i++) {
      const value = read(this.#values[i - 1]);
      if (isAttributeDirective(value)) {
        const directive = value[ATTRIBUTE_DIRECTIVE].name;
        throw new OddkinError(
          'template.directive.position',
          DEV
            ? `${directive}() must be the whole value of its binding, not interpolated into "${this.descriptor.name}" text.`
            : '',
        );
      }
      text += (unsupported(value) ? '' : String(value ?? '')) + strings[i];
    }
    return text;
  }

  #apply(value: unknown): void {
    if (isAttributeDirective(value)) {
      this.#applyDirective(value);
      return;
    }
    if (this.#directive) this.#clearDirective();
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
    if (value === null || value === undefined || unsupported(value))
      this.element.removeAttribute(name);
    else {
      const safe = URL_ATTRIBUTES.has(name.toLowerCase()) ? safeUrl(String(value), name) : value;
      this.element.setAttribute(name, String(safe));
    }
  }
}

class BooleanAttributePart extends ValuePart {
  protected write(value: unknown): void {
    // A function is always truthy: report it rather than guess that it means "on".
    const on = typeof value === 'function' ? !unsupported(value) : !!value;
    this.element.toggleAttribute(this.descriptor.name, on);
  }
}

class PropertyPart extends ValuePart {
  protected write(value: unknown): void {
    const { name } = this.descriptor;
    const safe = URL_PROPERTIES.has(name) ? safeUrl(value, name) : value;
    if (/^on/.test(name) && typeof safe === 'string') {
      throw new OddkinError(
        'template.property.unsafe',
        DEV
          ? `Refusing to assign a string to the "${name}" handler property. Use @${name.slice(2)}=\${handler}.`
          : '',
      );
    }
    (this.element as unknown as Record<string, unknown>)[name] = safe;
  }
}

type Handler =
  | ((event: Event) => unknown)
  | ({ handleEvent(event: Event): unknown } & Pick<
      AddEventListenerOptions,
      'capture' | 'passive' | 'once'
    >);

type ListenerOptions = { capture: boolean; passive: boolean | undefined; once: boolean };

function listenerOptions(handler: Handler): ListenerOptions {
  if (typeof handler === 'function') return { capture: false, passive: undefined, once: false };
  return { capture: !!handler.capture, passive: handler.passive, once: !!handler.once };
}

const sameOptions = (a: ListenerOptions, b: ListenerOptions) =>
  a.capture === b.capture && a.passive === b.passive && a.once === b.once;

/**
 * One listener per part. Swapping handlers keeps it; a listener object's `capture`,
 * `passive`, and `once` become listener options (re-added only when they change).
 */
class EventPart implements Part {
  readonly #element: Element;
  readonly #type: string;
  readonly #options: RenderOptions;
  #handler: Handler | undefined;
  #listening: ListenerOptions | undefined;
  readonly #listener = (event: Event) => {
    const handler = this.#handler;
    if (this.#listening?.once) this.#listening = undefined;
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
      throw new OddkinError(
        'template.event.readable',
        DEV
          ? `@${this.#type} received a readable. Pass a function; read state inside the handler.`
          : '',
      );
    }
    if (
      value !== null &&
      value !== undefined &&
      typeof value !== 'function' &&
      typeof (value as { handleEvent?: unknown }).handleEvent !== 'function'
    ) {
      throw new OddkinError(
        'template.event.invalid',
        DEV ? `@${this.#type} expects a function, an object with handleEvent, or null.` : '',
      );
    }
    this.#handler = (value ?? undefined) as Handler | undefined;
    if (!this.#handler) {
      this.#stop();
      return;
    }
    const options = listenerOptions(this.#handler);
    if (this.#listening && sameOptions(this.#listening, options)) return;
    this.#stop();
    const { capture, passive, once } = options;
    this.#element.addEventListener(
      this.#type,
      this.#listener,
      passive === undefined ? { capture, once } : { capture, passive, once },
    );
    this.#listening = options;
  }

  pause(): void {}

  dispose(): void {
    this.#stop();
    this.#handler = undefined;
  }

  #stop(): void {
    if (!this.#listening) return;
    this.#element.removeEventListener(this.#type, this.#listener, {
      capture: this.#listening.capture,
    });
    this.#listening = undefined;
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
