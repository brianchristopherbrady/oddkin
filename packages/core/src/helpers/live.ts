/**
 * `@oddkin/core/helpers/live` — write a property only when the element's *current* value
 * differs (the user may have typed or autofill may have run since the last render),
 * without clobbering IME composition or the caret.
 */
import { DEV } from '../internal/dev.js';
import { computed, isReadable, type Readable } from '../reactive/index.js';
import { checkForeignReadable } from '../reactive/graph.js';
import {
  ATTRIBUTE_DIRECTIVE,
  type AttributeDirective,
  type DirectiveHandler,
} from '../template/directive.js';

interface LiveDirective extends AttributeDirective {
  readonly value: unknown;
}

interface LiveState {
  composing: boolean;
  pending: { value: unknown } | undefined;
  name: string;
  readonly start: () => void;
  readonly end: () => void;
}

type Selectable = {
  selectionStart: number | null;
  selectionEnd: number | null;
  setSelectionRange(a: number, b: number): void;
};

function write(element: Element, name: string, value: unknown): boolean {
  const target = element as unknown as Record<string, unknown>;
  if (Object.is(target[name], value)) return false;
  const focused = element.matches(':focus');
  let start: number | null = null;
  let end: number | null = null;
  if (focused && name === 'value') {
    try {
      ({ selectionStart: start, selectionEnd: end } = element as unknown as Selectable);
    } catch {
      // Input types without selection support (e.g. number, email in some engines).
    }
  }
  target[name] = value;
  if (start !== null && end !== null) {
    const length = String(value ?? '').length;
    try {
      (element as unknown as Selectable).setSelectionRange(
        Math.min(start, length),
        Math.min(end, length),
      );
    } catch {
      // Selection unsupported for this input type.
    }
  }
  return true;
}

const handler: DirectiveHandler<LiveDirective, LiveState> = {
  name: 'live',
  parts: ['property'],
  apply(directive, element, binding, previous) {
    let state = previous;
    if (!state) {
      const created: LiveState = {
        composing: false,
        pending: undefined,
        name: binding.name,
        start: () => {
          created.composing = true;
        },
        end: () => {
          created.composing = false;
          const pending = created.pending;
          created.pending = undefined;
          if (pending) write(element, created.name, pending.value);
        },
      };
      element.addEventListener('compositionstart', created.start);
      element.addEventListener('compositionend', created.end);
      state = created;
    }
    if (state.composing) {
      state.pending = { value: directive.value };
      return { state, changed: false };
    }
    return { state, changed: write(element, binding.name, directive.value) };
  },
  clear(element, state) {
    element.removeEventListener('compositionstart', state.start);
    element.removeEventListener('compositionend', state.end);
  },
};

/**
 * `.value=${live(model)}`: compares against the element's current property, so a model
 * value equal to the last render still restores an edited field. Writes wait for IME
 * composition to end, and the caret is kept when a focused field is updated.
 */
export function live<T>(value: T | Readable<T>): AttributeDirective | Readable<AttributeDirective> {
  if (isReadable(value)) {
    if (DEV) checkForeignReadable(value);
    const source: Readable<T> = value;
    return computed((): AttributeDirective => {
      const directive: LiveDirective = { [ATTRIBUTE_DIRECTIVE]: handler, value: source.value };
      return directive;
    });
  }
  const directive: LiveDirective = { [ATTRIBUTE_DIRECTIVE]: handler, value };
  return directive;
}
