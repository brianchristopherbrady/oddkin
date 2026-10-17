/**
 * `props()` — M3 assessment prototype (not a published API). Applies a configuration object's
 * entries to declared public properties of the bound element, written as
 * `<x-nav .props=${props({ label, items, current })}>`.
 *
 * Built only on public APIs: the attribute-directive protocol from `@mote/core` and
 * `elementProperties()` for declared properties and defaults.
 */
import {
  ATTRIBUTE_DIRECTIVE,
  computed,
  elementProperties,
  isReadable,
  type AttributeDirective,
  type DirectiveHandler,
  type ElementProperty,
  type Readable,
} from '@mote/core';
import { MoteError, reportMoteError } from '@mote/core/diagnostics';

interface PropsDirective extends AttributeDirective {
  readonly values: ReadonlyMap<string, unknown>;
}

function declaredProperties(element: Element): Map<string, ElementProperty> | undefined {
  const ctor = customElements.get(element.localName);
  return ctor ? new Map(elementProperties(ctor).map((p) => [p.name, p])) : undefined;
}

function reset(element: Element, key: string, declared: Map<string, ElementProperty> | undefined) {
  const property = declared?.get(key);
  (element as unknown as Record<string, unknown>)[key] = property
    ? property.definition.initial()
    : undefined;
}

const handler: DirectiveHandler<PropsDirective, Map<string, unknown>> = {
  name: 'props',
  parts: ['property'],
  bindingName: 'props',
  apply(directive, element, _binding, previous) {
    // Before upgrade, keys cannot be checked; values become own properties that the element's
    // constructor replays through its accessors.
    const declared = declaredProperties(element);
    const applied = new Map<string, unknown>();
    let changed = false;
    for (const [key, value] of directive.values) {
      if (declared && !declared.has(key)) {
        reportMoteError(
          new MoteError(
            'props.key.unknown',
            `props(): <${element.localName}> has no declared property "${key}"; it was not set. Events are bound with @event, attributes with name=\${…}.`,
          ),
          { code: 'props.key.unknown', origin: element.localName },
        );
        continue;
      }
      applied.set(key, value);
      if (!previous?.has(key) || !Object.is(previous.get(key), value)) {
        (element as unknown as Record<string, unknown>)[key] = value;
        changed = true;
      }
    }
    for (const key of previous?.keys() ?? []) {
      if (!applied.has(key)) {
        reset(element, key, declared);
        changed = true;
      }
    }
    return { state: applied, changed };
  },
  clear(element, state) {
    const declared = declaredProperties(element);
    for (const key of state.keys()) reset(element, key, declared);
  },
};

function resolve(values: Readonly<Record<string, unknown>>): PropsDirective {
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(values)) {
    map.set(key, isReadable(value) ? value.value : value);
  }
  return { [ATTRIBUTE_DIRECTIVE]: handler, values: map };
}

/** Values may be readables; then the binding updates without re-running render(). */
export function props(
  values: Readonly<Record<string, unknown>>,
): AttributeDirective | Readable<AttributeDirective> {
  return Object.values(values).some(isReadable) ? computed(() => resolve(values)) : resolve(values);
}
