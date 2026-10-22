/**
 * `@oddkin/core/helpers/style-map` — set inline styles through the CSSOM
 * (`style.setProperty`), which strict `style-src` policies allow, unlike parsed
 * `style="…"` attributes.
 */
import { DEV } from '../internal/dev.js';
import { computed, isReadable, type Readable } from '../reactive/index.js';
import { checkForeignReadable } from '../reactive/graph.js';
import {
  ATTRIBUTE_DIRECTIVE,
  type AttributeDirective,
  type DirectiveHandler,
} from '../template/directive.js';

export type StyleValue = string | number | null | undefined | false;
export type StyleInput = Readonly<Record<string, StyleValue | Readable<StyleValue>>>;

interface StyleMapDirective extends AttributeDirective {
  readonly styles: ReadonlyMap<string, string | null>;
}

/** `backgroundColor` → `background-color`; `WebkitAppearance` → `-webkit-appearance`; `--x` unchanged. */
function propertyName(key: string): string {
  if (key.startsWith('--') || key.includes('-')) return key;
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

const IMPORTANT = /\s*!important\s*$/i;

const handler: DirectiveHandler<StyleMapDirective, Map<string, string>> = {
  name: 'styleMap',
  parts: ['attribute'],
  bindingName: 'style',
  apply(directive, element, _binding, previous) {
    const style = (element as HTMLElement | SVGElement).style;
    const applied = new Map<string, string>();
    let changed = false;
    for (const [property, value] of directive.styles) {
      if (value === null) continue;
      applied.set(property, value);
      if (previous?.get(property) === value && style.getPropertyValue(property) !== '') continue;
      const important = IMPORTANT.test(value);
      style.setProperty(property, value.replace(IMPORTANT, ''), important ? 'important' : '');
      changed = true;
    }
    for (const property of previous?.keys() ?? []) {
      if (!applied.has(property)) {
        style.removeProperty(property);
        changed = true;
      }
    }
    return { state: applied, changed };
  },
  clear(element, state) {
    const style = (element as HTMLElement | SVGElement).style;
    for (const property of state.keys()) style.removeProperty(property);
  },
};

function resolve(styles: StyleInput): StyleMapDirective {
  const map = new Map<string, string | null>();
  for (const [key, raw] of Object.entries(styles)) {
    const value = isReadable(raw) ? raw.value : raw;
    map.set(
      propertyName(key),
      value === null || value === undefined || value === false || value === ''
        ? null
        : String(value),
    );
  }
  return { [ATTRIBUTE_DIRECTIVE]: handler, styles: map };
}

/**
 * `style=${styleMap({ '--accent': color, inlineSize: '12rem' })}`. Numbers are not
 * given units; `null`, `undefined`, `false`, and `''` remove the property. Values may be
 * readables. Prefer classes and custom properties over many inline declarations.
 */
export function styleMap(styles: StyleInput): AttributeDirective | Readable<AttributeDirective> {
  if (DEV)
    for (const value of Object.values(styles)) if (isReadable(value)) checkForeignReadable(value);
  return Object.values(styles).some(isReadable) ? computed(() => resolve(styles)) : resolve(styles);
}
