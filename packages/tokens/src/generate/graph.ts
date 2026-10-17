/**
 * Token graph: definitions, references, validation, dependency closure, and literal
 * resolution. Contract: theming-and-styling.md §2, §5, §11.1; ADR 0007, ADR 0012.
 */
import type { Mode, ModeValues } from '../theme/types.js';
import { closest, pointer, type DiagnosticList } from './diagnostics.js';
import { parseDimension } from './units.js';

/** Ordered tiers: a token may reference tokens of its own tier or lower. */
export type TokenCategory = 'reference' | 'foundation' | 'semantic' | 'layout' | 'component';
const TIER: Record<TokenCategory, number> = {
  reference: 0,
  foundation: 1,
  semantic: 2,
  layout: 2,
  component: 3,
};

export type TokenType = 'color' | 'dimension' | 'number' | 'fontFamily' | 'fontWeight';
export type TokenOrigin = 'preset' | 'generated' | 'configured' | 'overridden';
export type TokenValue = string | ModeValues;

export interface TokenDefinition {
  readonly name: string;
  readonly category: TokenCategory;
  readonly type: TokenType;
  /** Literal CSS value, `{token.name}` references (possibly inside an expression), or per-mode values. */
  readonly value: TokenValue;
  readonly origin: TokenOrigin;
  /** How the value was derived (formula, contrast rule, config path). */
  readonly provenance?: string;
  /** Scaled by density scopes (spacing and control sizes). */
  readonly density?: boolean;
  /** Name of the token this one must never fall below (target-size minimum). */
  readonly minimum?: string;
  readonly description?: string;
}

export type TokenMap = ReadonlyMap<string, TokenDefinition>;

export const TOKEN_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const REFERENCE = /\{([^{}]+)\}/g;
const FORBIDDEN_LITERAL = /[;{}<>\\]|\/\*|!important/i;

export const MODE_TOGGLE: Record<Mode, string> = {
  light: '--mote-mode-light',
  dark: '--mote-mode-dark',
};

export function cssVariable(name: string): string {
  return `--mote-${name.replace(/\./g, '-')}`;
}

export function isModeValues(value: TokenValue): value is ModeValues {
  return typeof value === 'object';
}

/** References in a value (all modes). */
export function references(value: TokenValue): string[] {
  const texts = isModeValues(value) ? [value.light, value.dark] : [value];
  const out: string[] = [];
  for (const text of texts)
    for (const match of text.matchAll(REFERENCE)) out.push(match[1] as string);
  return out;
}

function compileText(text: string): string {
  return text.replace(REFERENCE, (_, name: string) => `var(${cssVariable(name)})`);
}

/**
 * CSS for a value. Per-mode values become one mode-agnostic expression switched by the
 * inherited mode toggles, so the same declaration is correct in every scope:
 * `var(--mote-mode-light, LIGHT) var(--mote-mode-dark, DARK)`.
 */
export function compileValue(value: TokenValue, modes: readonly Mode[]): string {
  if (!isModeValues(value)) return compileText(value);
  if (modes.length === 1 || value.light === value.dark)
    return compileText(value[modes[0] ?? 'light']);
  return `var(${MODE_TOGGLE.light}, ${compileText(value.light)}) var(${MODE_TOGGLE.dark}, ${compileText(value.dark)})`;
}

/** True if a token's emitted expression depends on the mode toggles. */
export function isModeDependent(value: TokenValue, modes: readonly Mode[]): boolean {
  return isModeValues(value) && modes.length > 1 && value.light !== value.dark;
}

/** Validate names, collisions, literals, references, cycles, and tiers. */
export function validateGraph(tokens: TokenMap, diagnostics: DiagnosticList): void {
  const variables = new Map<string, string>();
  for (const token of tokens.values()) {
    const path = pointer('tokens', token.name);
    if (!TOKEN_NAME.test(token.name)) {
      diagnostics.error(
        'token.name.invalid',
        path,
        `"${token.name}" is not a valid token name.`,
        'Use dot-separated lowercase segments, e.g. "color.text.primary".',
      );
    }
    const variable = cssVariable(token.name);
    const clash = variables.get(variable);
    if (clash)
      diagnostics.error(
        'token.duplicate',
        path,
        `"${token.name}" and "${clash}" both emit ${variable}.`,
      );
    variables.set(variable, token.name);

    const texts = isModeValues(token.value) ? [token.value.light, token.value.dark] : [token.value];
    for (const text of texts) {
      if (
        typeof text !== 'string' ||
        text.trim() === '' ||
        FORBIDDEN_LITERAL.test(text.replace(REFERENCE, ''))
      ) {
        diagnostics.error(
          'value.invalidCss',
          path,
          `${JSON.stringify(text)} cannot be serialized as a custom property value.`,
        );
      }
    }
    for (const text of texts) checkUnits(token, text, path, diagnostics);
    for (const ref of references(token.value)) {
      const target = tokens.get(ref);
      if (!target) {
        const near = closest(ref, tokens.keys());
        const suggestion = ref.startsWith('space.')
          ? `Custom spacing must define every step the preset's roles use (xs, sm, md, lg), or override the roles that reference "${ref}".`
          : near
            ? `Did you mean "{${near}}"?`
            : undefined;
        diagnostics.error(
          'alias.missing',
          path,
          `"${token.name}" references unknown token "${ref}".`,
          suggestion,
        );
      } else if (TIER[target.category] > TIER[token.category]) {
        diagnostics.error(
          'tier.violation',
          path,
          `${token.category} token "${token.name}" may not reference ${target.category} token "${ref}".`,
          'Reference tokens of the same or a lower tier: reference → foundation → semantic/layout → component.',
        );
      }
    }
  }

  // Cycles (iterative DFS with colouring).
  const state = new Map<string, 1 | 2>();
  for (const start of tokens.keys()) {
    if (state.has(start)) continue;
    const stack: Array<{ name: string; refs: string[]; index: number }> = [];
    const push = (name: string) => {
      state.set(name, 1);
      stack.push({ name, refs: references(tokens.get(name)?.value ?? ''), index: 0 });
    };
    push(start);
    while (stack.length) {
      const frame = stack[stack.length - 1] as (typeof stack)[number];
      if (frame.index >= frame.refs.length) {
        state.set(frame.name, 2);
        stack.pop();
        continue;
      }
      const next = frame.refs[frame.index++] as string;
      if (!tokens.has(next)) continue;
      const seen = state.get(next);
      if (seen === 1) {
        const cycle = [
          ...stack.slice(stack.findIndex((f) => f.name === next)).map((f) => f.name),
          next,
        ];
        diagnostics.error(
          'alias.cycle',
          pointer('tokens', next),
          `Reference cycle: ${cycle.join(' → ')}.`,
        );
      } else if (seen === undefined) push(next);
    }
  }
}

/** Tokens whose values depend (directly or transitively) on any of `changed`, including mode toggles via `'$mode'`. */
export function dependents(
  tokens: TokenMap,
  changed: ReadonlySet<string>,
  modes: readonly Mode[],
): Set<string> {
  const reverse = new Map<string, string[]>();
  for (const token of tokens.values()) {
    const sources = references(token.value);
    if (isModeDependent(token.value, modes)) sources.push('$mode');
    for (const source of sources) {
      const list = reverse.get(source) ?? [];
      list.push(token.name);
      reverse.set(source, list);
    }
  }
  const out = new Set<string>();
  const queue = [...changed];
  while (queue.length) {
    const name = queue.pop() as string;
    for (const dependent of reverse.get(name) ?? []) {
      if (!out.has(dependent) && !changed.has(dependent)) {
        out.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return out;
}

/** Resolve a token to a literal value for one mode (references substituted). */
export function resolveLiteral(
  tokens: TokenMap,
  name: string,
  mode: Mode,
  seen: Set<string> = new Set(),
): string | undefined {
  const token = tokens.get(name);
  if (!token || seen.has(name)) return undefined;
  seen.add(name);
  const text = isModeValues(token.value) ? token.value[mode] : token.value;
  let failed = false;
  const out = text.replace(REFERENCE, (_, ref: string) => {
    const value = resolveLiteral(tokens, ref, mode, new Set(seen));
    if (value === undefined) failed = true;
    return value ?? '';
  });
  return failed ? undefined : out;
}

/** Stable natural ordering of token names (numeric segments compare numerically). */
export function compareNames(a: string, b: string): number {
  const as = a.split('.');
  const bs = b.split('.');
  for (let i = 0; i < Math.min(as.length, bs.length); i++) {
    const x = as[i] as string;
    const y = bs[i] as string;
    if (x === y) continue;
    const nx = /^\d+$/.test(x) ? Number(x) : Number.NaN;
    const ny = /^\d+$/.test(y) ? Number(y) : Number.NaN;
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) return nx - ny;
    return x < y ? -1 : 1;
  }
  return as.length - bs.length;
}

const EXPRESSION = /\{[^{}]+\}|calc\(|min\(|max\(|clamp\(/;
const RELATIVE_SIZES = /^(font\.size|control|layout|navigation|card)\./;

/**
 * Unit policy: unitless numbers (line heights), integer font weights 1–1000, lengths with
 * units, and a warning for px where sizes should follow the reader's font size.
 */
function checkUnits(
  token: TokenDefinition,
  text: string,
  path: string,
  diagnostics: DiagnosticList,
): void {
  if (typeof text !== 'string' || EXPRESSION.test(text)) return;
  const value = text.trim();
  if (token.type === 'number' && !/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) {
    diagnostics.error(
      'unit.invalid',
      path,
      `${token.name} must be a unitless number, not ${JSON.stringify(text)}.`,
      'Line heights are unitless so they scale with the element’s font size.',
    );
  } else if (
    token.type === 'fontWeight' &&
    !(/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 1000)
  ) {
    diagnostics.error(
      'unit.invalid',
      path,
      `${token.name} must be a font weight from 1 to 1000, not ${JSON.stringify(text)}.`,
    );
  } else if (token.type === 'dimension') {
    const dimension = parseDimension(value);
    if (!dimension)
      diagnostics.error(
        'unit.invalid',
        path,
        `${token.name} must be a length with a unit, not ${JSON.stringify(text)}.`,
      );
    else if (dimension.unit === 'px' && RELATIVE_SIZES.test(token.name)) {
      diagnostics.warn(
        'unit.discouraged',
        path,
        `${token.name} uses px, which ignores the reader’s font-size preference.`,
        'Use rem for type, control, and layout sizes; keep px for borders and optical adjustments.',
      );
    }
  }
}
