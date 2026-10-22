/**
 * DTCG Format Module 2025.10 output (https://www.designtokens.org/tr/2025.10/format/), one
 * complete document per resolution context. Every token gets an explicit `$type`; aliases stay
 * curly-brace references; Oddkin-only data lives under the `dev.oddkin` extension. Values with
 * no 2025.10 representation are omitted and listed, never approximated silently.
 * Contract: theming-and-styling.md §6.1. Format support does not imply Resolver support.
 */
import type { Mode } from '../theme/types.js';
import { parseColor } from './color.js';
import { compareNames, isModeValues, type TokenDefinition, type TokenMap } from './graph.js';
import type { ResolveContext, ResolvedTheme } from './resolve.js';

export const DTCG_FORMAT_VERSION = '2025.10';
/** Reverse-domain key of Oddkin's `$extensions` data. */
export const DTCG_EXTENSION = 'dev.oddkin';

export type DtcgMappingKind = 'lossless' | 'lossy' | 'unsupported';

export interface DtcgMapping {
  readonly token: string;
  readonly kind: DtcgMappingKind;
  /** Why the mapping is lossy or unsupported. */
  readonly reason?: string;
}

export interface DtcgResult {
  /** The DTCG document as plain JSON data. */
  readonly document: Record<string, unknown>;
  /** `JSON.stringify(document, null, 2)` plus a final newline: the canonical file bytes. */
  readonly text: string;
  /** One entry per token of the theme, in name order. */
  readonly mappings: readonly DtcgMapping[];
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Mapped =
  | { readonly kind: 'lossless' | 'lossy'; readonly value: Json; readonly reason?: string }
  | { readonly kind: 'unsupported'; readonly reason: string };

const ALIAS = /^\{([^{}]+)\}$/;
const DIMENSION = /^(-?(?:\d+\.?\d*|\.\d+))(px|rem)$/;
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/;

/** Shortest decimal text that keeps 6 significant decimals, as a JSON number. */
const round = (n: number) => Number(n.toFixed(6));

function dimension(text: string): Json | undefined {
  if (text === '0') return { value: 0, unit: 'px' };
  const match = DIMENSION.exec(text);
  return match ? { value: Number(match[1]), unit: match[2] as string } : undefined;
}

function color(text: string): Json | undefined {
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const digits = (hex[1] as string).toLowerCase();
    return {
      colorSpace: 'srgb',
      components: [0, 2, 4].map((i) => round(parseInt(digits.slice(i, i + 2), 16) / 255)),
      hex: `#${digits}`,
    };
  }
  const rgb = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(text);
  if (rgb) {
    const channels = [rgb[1], rgb[2], rgb[3]].map(Number);
    if (channels.some((c) => c > 255)) return undefined;
    const value: { [key: string]: Json } = {
      colorSpace: 'srgb',
      components: channels.map((c) => round(c / 255)),
    };
    if (rgb[4] !== undefined) value['alpha'] = Number(rgb[4]);
    return value;
  }
  if (/^oklch\(/i.test(text)) {
    const parsed = parseColor(text);
    if (parsed) return { colorSpace: 'oklch', components: [parsed.l, parsed.c, parsed.h] };
  }
  return undefined;
}

/** Split on commas outside parentheses. */
function layers(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (text[i] === ',' && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out;
}

function shadow(text: string): Json | undefined {
  const out: Json[] = [];
  for (const layer of layers(text)) {
    const colorText = /(rgb\([^)]*\)|#[0-9a-f]{6})/i.exec(layer)?.[1];
    const rest = layer
      .replace(colorText ?? '', ' ')
      .trim()
      .split(/\s+/);
    const inset = rest[0] === 'inset';
    if (inset) rest.shift();
    const lengths = rest.map(dimension);
    const shadowColor = colorText && color(colorText);
    if (!shadowColor || lengths.length < 2 || lengths.length > 4 || lengths.includes(undefined))
      return undefined;
    const zero = { value: 0, unit: 'px' };
    out.push({
      color: shadowColor,
      offsetX: lengths[0] as Json,
      offsetY: lengths[1] as Json,
      blur: (lengths[2] ?? zero) as Json,
      spread: (lengths[3] ?? zero) as Json,
      ...(inset ? { inset: true } : {}),
    });
  }
  return out.length === 1 ? (out[0] as Json) : out;
}

function cubicBezier(text: string): Json | undefined {
  const match = /^cubic-bezier\(([^)]*)\)$/.exec(text);
  const values = match?.[1]?.split(',').map((v) => Number(v.trim()));
  return values?.length === 4 && values.every(Number.isFinite) ? values : undefined;
}

/** `calc(<dimension> * n)` or `calc(<dimension> / n)`, the expressions profiles write. */
function calcDimension(text: string): Json | undefined {
  const match = /^calc\(\s*(\S+)\s*([*/])\s*(\S+)\s*\)$/.exec(text);
  if (!match) return undefined;
  const left = dimension(match[1] as string) as { value: number; unit: string } | undefined;
  const factor = Number(match[3]);
  if (!left || !Number.isFinite(factor) || factor === 0) return undefined;
  const value = match[2] === '*' ? left.value * factor : left.value / factor;
  return { value: round(value), unit: left.unit };
}

function literal(token: TokenDefinition, text: string): Mapped {
  const unsupported = (reason: string): Mapped => ({ kind: 'unsupported', reason });
  switch (token.type) {
    case 'color': {
      const value = color(text);
      return value ? { kind: 'lossless', value } : unsupported(`colour syntax "${text}"`);
    }
    case 'dimension': {
      const value = dimension(text);
      if (value) return { kind: 'lossless', value };
      if (/^-?[\d.]+em$/.test(text))
        return unsupported('2025.10 dimensions allow only px and rem; em depends on the font size');
      return unsupported(`dimension "${text}"`);
    }
    case 'number':
      return NUMBER.test(text)
        ? { kind: 'lossless', value: Number(text) }
        : unsupported(`number "${text}"`);
    case 'fontWeight': {
      const n = Number(text);
      return Number.isInteger(n) && n >= 1 && n <= 1000
        ? { kind: 'lossless', value: n }
        : unsupported(`font weight "${text}"`);
    }
    case 'fontFamily':
      return {
        kind: 'lossless',
        value: layers(text).map((name) => name.replace(/^(['"])(.*)\1$/, '$2')),
      };
    case 'duration': {
      const match = /^(\d+\.?\d*|\.\d+)(ms|s)$/.exec(text);
      if (!match) return unsupported(`duration "${text}"`);
      const value = { value: Number(match[1]), unit: match[2] as string };
      return token.reducedMotion !== undefined
        ? {
            kind: 'lossy',
            value,
            reason: `the prefers-reduced-motion value (${token.reducedMotion}) is only in $extensions`,
          }
        : { kind: 'lossless', value };
    }
    case 'cubicBezier': {
      const value = cubicBezier(text);
      return value ? { kind: 'lossless', value } : unsupported(`easing "${text}"`);
    }
    case 'shadow': {
      if (text === 'none') return unsupported('"none" has no 2025.10 shadow value');
      const value = shadow(text);
      return value ? { kind: 'lossless', value } : unsupported(`shadow "${text}"`);
    }
  }
}

/** Tokens of the theme in a context: products, densities, and profiles applied like the CSS. */
function contextTokens(theme: ResolvedTheme, context: ResolveContext): TokenMap {
  const map = new Map(theme.tokens);
  for (const scope of theme.scopes) {
    if (
      (scope.kind === 'product' && scope.name === context.product) ||
      (scope.kind === 'density' && scope.name === context.density) ||
      (scope.kind === 'profile' && (context.profiles ?? []).includes(scope.name))
    )
      for (const [name, token] of scope.tokens) map.set(name, token);
  }
  return map;
}

function mapToken(
  tokens: TokenMap,
  name: string,
  mode: Mode,
  done: Map<string, Mapped>,
  path: (name: string) => string,
): Mapped {
  const cached = done.get(name);
  if (cached) return cached;
  const token = tokens.get(name) as TokenDefinition;
  const text = (isModeValues(token.value) ? token.value[mode] : token.value).trim();
  let mapped: Mapped;
  const alias = ALIAS.exec(text)?.[1];
  if (alias !== undefined) {
    // The graph is validated (no cycles, no unknown references) before emission.
    const resolved = tokens.has(alias) ? mapToken(tokens, alias, mode, done, path) : undefined;
    mapped = !resolved
      ? { kind: 'unsupported', reason: `alias to unknown token ${alias}` }
      : resolved.kind === 'unsupported'
        ? { kind: 'unsupported', reason: `aliases ${alias}, which is unsupported` }
        : { kind: 'lossless', value: `{${path(alias)}}` };
  } else if (/\{[^{}]+\}/.test(text)) {
    // An expression over references: flattened to its literal in this context.
    let failed = false;
    const flat = text.replace(/\{([^{}]+)\}/g, (_, ref: string) => {
      const value = resolveIn(tokens, ref, mode);
      if (value === undefined) failed = true;
      return value ?? '';
    });
    const value = failed
      ? undefined
      : token.type === 'dimension'
        ? (dimension(flat) ?? calcDimension(flat))
        : undefined;
    mapped =
      value === undefined
        ? { kind: 'unsupported', reason: `expression "${text}" has no 2025.10 representation` }
        : { kind: 'lossy', value, reason: `expression "${text}" flattened to its value` };
  } else {
    mapped = literal(token, text);
  }
  done.set(name, mapped);
  return mapped;
}

function resolveIn(tokens: TokenMap, name: string, mode: Mode, depth = 0): string | undefined {
  const token = tokens.get(name);
  if (!token || depth > 32) return undefined;
  const text = isModeValues(token.value) ? token.value[mode] : token.value;
  let failed = false;
  const out = text.replace(/\{([^{}]+)\}/g, (_, ref: string) => {
    const value = resolveIn(tokens, ref, mode, depth + 1);
    if (value === undefined) failed = true;
    return value ?? '';
  });
  return failed ? undefined : out;
}

/**
 * One complete DTCG 2025.10 document for a resolution context (mode defaults to the theme's
 * first mode). Modes, products, densities, and profiles are separate documents; cross-context
 * composition is the Resolver's concern and is not emitted.
 */
export function emitDtcg(theme: ResolvedTheme, context: ResolveContext = {}): DtcgResult {
  const mode = context.mode ?? (theme.modes[0] as Mode);
  const tokens = contextTokens(theme, context);
  const names = [...tokens.keys()].sort(compareNames);
  // A token whose name is also a group prefix lives at `$root` (2025.10 §6.2).
  const groups = new Set<string>();
  for (const name of names) {
    const parts = name.split('.');
    for (let i = 1; i < parts.length; i++) groups.add(parts.slice(0, i).join('.'));
  }
  const path = (name: string) => (groups.has(name) ? `${name}.$root` : name);
  const done = new Map<string, Mapped>();
  const root: { [key: string]: Json } = {};
  const unsupported: { [key: string]: Json } = {};
  const mappings: DtcgMapping[] = [];

  for (const name of names) {
    const token = tokens.get(name) as TokenDefinition;
    const mapped = mapToken(tokens, name, mode, done, path);
    mappings.push(
      mapped.kind === 'lossless'
        ? { token: name, kind: 'lossless' }
        : { token: name, kind: mapped.kind, reason: mapped.reason as string },
    );
    const text = isModeValues(token.value) ? token.value[mode] : token.value;
    if (mapped.kind === 'unsupported') {
      unsupported[name] = { type: token.type, value: text, reason: mapped.reason };
      continue;
    }
    const extension: { [key: string]: Json } = { category: token.category, origin: token.origin };
    if (token.provenance) extension['provenance'] = token.provenance;
    if (token.density) extension['density'] = true;
    if (token.minimum) extension['minimum'] = token.minimum;
    if (token.reducedMotion !== undefined) extension['reducedMotion'] = token.reducedMotion;
    if (mapped.kind === 'lossy') extension['css'] = text;
    const node: { [key: string]: Json } = { $type: token.type, $value: mapped.value };
    if (token.description) node['$description'] = token.description;
    node['$extensions'] = { [DTCG_EXTENSION]: extension };

    const segments = name.split('.');
    let group = root;
    for (const segment of segments.slice(0, -1))
      group = (group[segment] ??= {}) as { [key: string]: Json };
    const last = segments[segments.length - 1] as string;
    if (groups.has(name)) ((group[last] ??= {}) as { [key: string]: Json })['$root'] = node;
    else group[last] = node;
  }

  const contextJson: { [key: string]: Json } = { mode };
  if (context.product) contextJson['product'] = context.product;
  if (context.density) contextJson['density'] = context.density;
  if (context.profiles?.length) contextJson['profiles'] = [...context.profiles];
  root['$extensions'] = {
    [DTCG_EXTENSION]: {
      format: DTCG_FORMAT_VERSION,
      theme: theme.name,
      context: contextJson,
      conditions: Object.fromEntries(
        [...theme.conditions.values()].map((c) => [c.name, c.atRule] as const),
      ),
      unsupported,
    },
  };
  const document = root as Record<string, unknown>;
  return { document, text: `${JSON.stringify(document, null, 2)}\n`, mappings };
}
