/**
 * `@oddkin/core/helpers/class-map` — toggle classes through `classList`.
 * Classes the directive did not add (static template classes, classes added by other
 * code) are left alone.
 */
import { DEV } from '../internal/dev.js';
import { computed, isReadable, type Readable } from '../reactive/index.js';
import { checkForeignReadable } from '../reactive/graph.js';
import {
  ATTRIBUTE_DIRECTIVE,
  type AttributeDirective,
  type DirectiveHandler,
} from '../template/directive.js';

export type ClassInput = Readonly<Record<string, unknown>>;

interface ClassMapDirective extends AttributeDirective {
  readonly classes: ReadonlyMap<string, boolean>;
}

const handler: DirectiveHandler<ClassMapDirective, Set<string>> = {
  name: 'classMap',
  parts: ['attribute'],
  bindingName: 'class',
  apply(directive, element, _binding, previous) {
    const applied = new Set<string>();
    let changed = false;
    for (const [name, on] of directive.classes) {
      if (!on) continue;
      applied.add(name);
      if (!element.classList.contains(name)) {
        element.classList.add(name);
        changed = true;
      }
    }
    for (const name of previous ?? []) {
      if (!applied.has(name) && element.classList.contains(name)) {
        element.classList.remove(name);
        changed = true;
      }
    }
    return { state: applied, changed };
  },
  clear(element, state) {
    for (const name of state) element.classList.remove(name);
  },
};

function resolve(classes: ClassInput): ClassMapDirective {
  const map = new Map<string, boolean>();
  for (const [key, value] of Object.entries(classes)) {
    const on = !!(isReadable(value) ? value.value : value);
    for (const name of key.split(/\s+/)) if (name) map.set(name, (map.get(name) ?? false) || on);
  }
  return { [ATTRIBUTE_DIRECTIVE]: handler, classes: map };
}

/**
 * `class=${classMap({ active: isActive, 'is-large': size === 'lg' })}`. Values may be
 * readables; then the binding updates without re-running render.
 */
export function classMap(classes: ClassInput): AttributeDirective | Readable<AttributeDirective> {
  if (DEV) Object.values(classes).filter(isReadable).forEach(checkForeignReadable);
  return Object.values(classes).some(isReadable)
    ? computed(() => resolve(classes))
    : resolve(classes);
}
