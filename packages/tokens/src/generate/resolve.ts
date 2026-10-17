/**
 * Resolve a `ThemeConfig` into a validated token graph plus product and density scopes.
 * Precedence: Mote defaults → preset → user configuration → explicit overrides.
 * Pure and deterministic; no I/O. Contract: theming-and-styling.md §1–§5, §10, §11.4.
 */
import type { Mode, ModeValues, ThemeConfig } from '../theme/types.js';
import {
  contrastRatio,
  formatOklch,
  generateRamp,
  parseColor,
  RAMP,
  toHex,
  type Oklch,
} from './color.js';
import { closest, DiagnosticList, pointer, type Diagnostic } from './diagnostics.js';
import {
  compareNames,
  dependents,
  isModeValues,
  resolveLiteral,
  validateGraph,
  type TokenDefinition,
  type TokenMap,
  type TokenValue,
} from './graph.js';
import {
  CONTRAST_PAIRS,
  CONTRAST_ROLES,
  DEFAULT_DENSITY,
  DEFAULT_SPACING,
  DEFAULT_STATUS,
  PRESET_TOKENS,
  type ContrastRole,
} from './preset.js';
import { generateSpacing, SEGMENT } from './spacing.js';
import { formatDimension, parseDimension, scaleDimension } from './units.js';

export interface ScopeTokens {
  readonly kind: 'product' | 'density';
  readonly name: string;
  /** Tokens declared in the scope: changed tokens plus their alias closure. */
  readonly tokens: TokenMap;
  /** Names that actually changed (the rest is re-declared alias closure). */
  readonly changed: readonly string[];
}

export interface ResolvedTheme {
  readonly name: string;
  readonly modes: readonly Mode[];
  readonly tokens: TokenMap;
  readonly scopes: readonly ScopeTokens[];
}

export interface ResolveResult {
  readonly theme: ResolvedTheme | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

type Ramps = Record<'brand' | 'neutral' | 'danger' | 'success', ReturnType<typeof generateRamp>>;

const TOP_LEVEL = [
  '$schema',
  'name',
  'preset',
  'brand',
  'status',
  'spacing',
  'modes',
  'products',
  'density',
  'overrides',
];
const MODES: readonly Mode[] = ['light', 'dark'];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function unknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  d: DiagnosticList,
): void {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    const suggestion = closest(key, allowed);
    d.error(
      'config.unknownKey',
      `${path}/${key}`,
      `Unknown option "${key}".`,
      suggestion ? `Did you mean "${suggestion}"?` : undefined,
    );
  }
}

function color(value: unknown, path: string, d: DiagnosticList): Oklch | undefined {
  const parsed = parseColor(value);
  if (!parsed)
    d.error(
      'color.invalid',
      path,
      `${JSON.stringify(value)} is not a supported colour.`,
      'Use #rrggbb, #rgb, or oklch(L C H).',
    );
  return parsed;
}

function buildRamps(
  primary: Oklch,
  neutral: Oklch | undefined,
  danger: Oklch,
  success: Oklch,
): Ramps {
  const neutralSeed = neutral ?? {
    l: primary.l,
    c: Math.min(primary.c * 0.1, 0.015),
    h: primary.h,
  };
  return {
    brand: generateRamp(primary),
    neutral: generateRamp(neutralSeed, neutral ? Math.min(neutral.c, 0.04) : neutralSeed.c),
    danger: generateRamp(danger),
    success: generateRamp(success),
  };
}

function refTokens(ramps: Ramps): TokenDefinition[] {
  const out: TokenDefinition[] = [];
  for (const [ramp, colors] of Object.entries(ramps)) {
    for (const c of colors) {
      const reduced = c.mapped.c < c.requested.c - 1e-6;
      out.push({
        name: `ref.${ramp}.${c.step}`,
        category: 'reference',
        type: 'color',
        value: c.hex,
        origin: 'generated',
        provenance: `${formatOklch(c.requested)}${reduced ? `, chroma reduced to ${formatOklch(c.mapped)} to fit sRGB` : ''}`,
      });
    }
  }
  out.push(
    {
      name: 'ref.neutral.0',
      category: 'reference',
      type: 'color',
      value: '#ffffff',
      origin: 'preset',
    },
    {
      name: 'ref.neutral.1000',
      category: 'reference',
      type: 'color',
      value: '#000000',
      origin: 'preset',
    },
  );
  return out;
}

function withRefs(base: TokenMap, refs: readonly TokenDefinition[]): Map<string, TokenDefinition> {
  const map = new Map(base);
  for (const ref of refs) map.set(ref.name, ref);
  return map;
}

function hexOf(tokens: TokenMap, name: string, mode: Mode): string | undefined {
  const literal = resolveLiteral(tokens, name, mode);
  if (literal === undefined) return undefined;
  if (/^#[0-9a-f]{6}$/i.test(literal.trim())) return literal.trim().toLowerCase();
  const parsed = parseColor(literal);
  return parsed ? toHex(parsed) : undefined;
}

/** Choose role steps that pass for every brand variant (base and products). */
function contrastRoles(
  variants: readonly Map<string, TokenDefinition>[],
  ramps: readonly Ramps[],
  modes: readonly Mode[],
): TokenDefinition[] {
  const chosen = new Map<string, Record<Mode, number>>();
  const out: TokenDefinition[] = [];
  for (const role of CONTRAST_ROLES) {
    const indices = {} as Record<Mode, number>;
    for (const mode of MODES) {
      if (role.from) {
        const base = (chosen.get(role.from) as Record<Mode, number>)[mode];
        const shift = role.shift ?? 0;
        indices[mode] = Math.min(
          RAMP.length - 1,
          Math.max(0, mode === 'light' ? base + shift : base - shift),
        );
        continue;
      }
      let index = mode === 'light' ? 0 : RAMP.length - 1;
      variants.forEach((tokens, v) => {
        const against = role.against
          .map((name) => hexOf(tokens, name, mode))
          .filter((hex): hex is string => !!hex);
        const colors = (ramps[v] as Ramps)[role.ramp];
        const order =
          mode === 'light' ? colors.map((_, i) => i) : colors.map((_, i) => colors.length - 1 - i);
        const pass = order.find((i) =>
          against.every(
            (hex) => contrastRatio((colors[i] as { hex: string }).hex, hex) >= role.minimum,
          ),
        );
        const pick = pass ?? (mode === 'light' ? colors.length - 1 : 0);
        index = mode === 'light' ? Math.max(index, pick) : Math.min(index, pick);
      });
      indices[mode] = index;
    }
    chosen.set(role.name, indices);
    const step = (mode: Mode) =>
      `{ref.${role.ramp}.${(RAMP[indices[mode]] as { step: number }).step}}`;
    const value: TokenValue =
      modes.length === 1 ? step(modes[0] as Mode) : { light: step('light'), dark: step('dark') };
    out.push({
      name: role.name,
      category: 'semantic',
      type: 'color',
      value,
      origin: 'generated',
      provenance: describeRole(role),
    });
  }
  return out;
}

function describeRole(role: ContrastRole): string {
  if (role.from) return `${role.shift} step(s) further from the page than ${role.from}`;
  return `${role.ramp} step nearest the page tone with at least ${role.minimum}:1 against ${role.against.join(' and ')} in every product (light: lightest passing; dark: darkest passing)`;
}

function asTokenValue(value: unknown): TokenValue | undefined {
  if (typeof value === 'string') return value;
  if (
    isRecord(value) &&
    typeof value['light'] === 'string' &&
    typeof value['dark'] === 'string' &&
    Object.keys(value).length === 2
  ) {
    return { light: value['light'], dark: value['dark'] } satisfies ModeValues;
  }
  return undefined;
}

function checkTargets(tokens: TokenMap, path: (name: string) => string, d: DiagnosticList): void {
  for (const token of tokens.values()) {
    if (!token.minimum) continue;
    const value = parseDimension(resolveLiteral(tokens, token.name, 'light'));
    const minimum = parseDimension(resolveLiteral(tokens, token.minimum, 'light'));
    if (!value || !minimum) continue;
    if (value.unit !== minimum.unit && value.value !== 0) {
      d.warn(
        'target.unitMismatch',
        path(token.name),
        `Cannot compare ${token.name} (${value.unit}) with ${token.minimum} (${minimum.unit}) without assuming a root font size.`,
      );
    } else if (value.value < minimum.value) {
      d.error(
        'target.belowMinimum',
        path(token.name),
        `${token.name} resolves to ${formatDimension(value)}, below ${token.minimum} (${formatDimension(minimum)}).`,
        'Interactive targets must not shrink below the minimum in any density or profile.',
      );
    }
  }
}

function checkContrast(
  tokens: TokenMap,
  modes: readonly Mode[],
  label: string,
  d: DiagnosticList,
): void {
  for (const mode of modes) {
    for (const [fg, bg, minimum] of CONTRAST_PAIRS) {
      if (!tokens.has(fg) || !tokens.has(bg)) continue;
      const a = hexOf(tokens, fg, mode);
      const b = hexOf(tokens, bg, mode);
      if (!a || !b) continue;
      const ratio = contrastRatio(a, b);
      if (ratio < minimum) {
        const origin =
          tokens.get(fg)?.origin === 'overridden' || tokens.get(bg)?.origin === 'overridden'
            ? ' (an override is involved)'
            : '';
        d.warn(
          'contrast.fail',
          pointer('tokens', fg),
          `${fg} (${a}) on ${bg} (${b}) is ${ratio.toFixed(2)}:1 in ${mode} mode${label}, below ${minimum}:1${origin}.`,
          'Choose a reference step with enough contrast, or remove the override. Brand inputs are never changed automatically.',
        );
      }
    }
  }
}

/** Resolve and validate a theme configuration (JSON or `defineTheme` object). */
export function resolveTheme(input: unknown): ResolveResult {
  const d = new DiagnosticList();
  if (!isRecord(input)) {
    d.error('config.type', '', 'A theme configuration must be an object.');
    return { theme: undefined, diagnostics: d.items };
  }
  unknownKeys(input, TOP_LEVEL, '', d);
  const config = input as unknown as ThemeConfig;

  const name = config.name ?? 'default';
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name)) {
    d.error(
      'config.name.invalid',
      '/name',
      `${JSON.stringify(name)} is not a valid theme name.`,
      'Use lowercase letters, digits, and hyphens.',
    );
  }
  if (config.preset !== undefined && config.preset !== 'mote-default') {
    d.error(
      'preset.unknown',
      '/preset',
      `Unknown preset ${JSON.stringify(config.preset)}.`,
      'Use "mote-default" or omit preset.',
    );
  }

  let primary: Oklch | undefined;
  let neutral: Oklch | undefined;
  if (!isRecord(config.brand)) {
    d.error(
      'config.required',
      '/brand',
      'brand is required.',
      'Add brand: { primary: "#5b46e8" }.',
    );
  } else {
    unknownKeys(config.brand, ['primary', 'neutral'], '/brand', d);
    if (config.brand.primary === undefined)
      d.error('config.required', '/brand/primary', 'brand.primary is required.');
    else primary = color(config.brand.primary, '/brand/primary', d);
    if (config.brand.neutral !== undefined)
      neutral = color(config.brand.neutral, '/brand/neutral', d);
  }

  const status = config.status ?? {};
  if (!isRecord(status)) d.error('config.type', '/status', 'status must be an object.');
  else unknownKeys(status, ['danger', 'success'], '/status', d);
  const danger = color(status.danger ?? DEFAULT_STATUS.danger, '/status/danger', d);
  const success = color(status.success ?? DEFAULT_STATUS.success, '/status/success', d);

  const modes = config.modes ?? MODES;
  if (
    !Array.isArray(modes) ||
    modes.length === 0 ||
    new Set(modes).size !== modes.length ||
    modes.some((m) => !MODES.includes(m))
  ) {
    d.error(
      'modes.invalid',
      '/modes',
      'modes must be a non-empty list of distinct "light" and "dark".',
    );
  }

  const spacing = generateSpacing(config.spacing ?? DEFAULT_SPACING, d, '/spacing');

  const products = config.products ?? {};
  const productInputs: Array<{ name: string; primary: Oklch; neutral: Oklch | undefined }> = [];
  if (!isRecord(products)) d.error('config.type', '/products', 'products must be an object.');
  else {
    for (const [productName, product] of Object.entries(products)) {
      const path = pointer('products', productName);
      if (!SEGMENT.test(productName))
        d.error('product.name.invalid', path, `"${productName}" is not a valid product name.`);
      if (!isRecord(product)) {
        d.error('config.type', path, 'A product must be an object.');
        continue;
      }
      unknownKeys(product, ['brand'], path, d);
      const brand = product['brand'];
      if (brand !== undefined && !isRecord(brand))
        d.error('config.type', `${path}/brand`, 'brand must be an object.');
      const b = isRecord(brand) ? brand : {};
      unknownKeys(b, ['primary', 'neutral'], `${path}/brand`, d);
      const p =
        b['primary'] === undefined ? primary : color(b['primary'], `${path}/brand/primary`, d);
      const n =
        b['neutral'] === undefined ? neutral : color(b['neutral'], `${path}/brand/neutral`, d);
      if (p) productInputs.push({ name: productName, primary: p, neutral: n });
    }
  }

  const density = config.density ?? DEFAULT_DENSITY;
  const densityInputs: Array<{ name: string; scale: number }> = [];
  if (!isRecord(density)) d.error('config.type', '/density', 'density must be an object.');
  else {
    for (const [densityName, entry] of Object.entries(density)) {
      const path = pointer('density', densityName);
      if (!SEGMENT.test(densityName))
        d.error('density.name.invalid', path, `"${densityName}" is not a valid density name.`);
      const scale = isRecord(entry) ? entry['scale'] : undefined;
      if (isRecord(entry)) unknownKeys(entry, ['scale'], path, d);
      if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0 || scale > 2) {
        d.error(
          'density.invalidScale',
          `${path}/scale`,
          'scale must be a number greater than 0 and at most 2.',
        );
      } else densityInputs.push({ name: densityName, scale });
    }
  }

  const overrides = config.overrides ?? {};
  if (!isRecord(overrides))
    d.error('config.type', '/overrides', 'overrides must be an object of token names to values.');

  if (d.hasErrors || !primary || !danger || !success || !spacing)
    return { theme: undefined, diagnostics: d.items };

  // Base graph: generated references, spacing, preset tokens.
  const ramps = buildRamps(primary, neutral, danger, success);
  const tokens = new Map<string, TokenDefinition>();
  for (const ref of refTokens(ramps)) tokens.set(ref.name, ref);
  const spacingOrigin = config.spacing ? 'generated' : 'preset';
  for (const step of spacing) {
    tokens.set(`space.${step.name}`, {
      name: `space.${step.name}`,
      category: 'foundation',
      type: 'dimension',
      value: formatDimension(step.value),
      origin: spacingOrigin,
      provenance: step.formula,
      density: true,
    });
  }
  for (const token of PRESET_TOKENS) {
    const value =
      isModeValues(token.value) && modes.length === 1 ? token.value[modes[0] as Mode] : token.value;
    tokens.set(token.name, { ...token, value, origin: 'preset' });
  }

  // Contrast-selected roles, valid for the base brand and every product brand.
  const productRamps = productInputs.map((p) => buildRamps(p.primary, p.neutral, danger, success));
  const variantRamps = [ramps, ...productRamps];
  const variants = variantRamps.map((r) => withRefs(tokens, refTokens(r)));
  for (const role of contrastRoles(variants, variantRamps, modes)) tokens.set(role.name, role);

  // Explicit overrides by stable name.
  if (isRecord(overrides)) {
    for (const [tokenName, raw] of Object.entries(overrides)) {
      const path = pointer('overrides', tokenName);
      const existing = tokens.get(tokenName);
      if (!existing) {
        const suggestion = closest(tokenName, tokens.keys());
        d.error(
          'override.unknown',
          path,
          `No token named "${tokenName}".`,
          suggestion
            ? `Did you mean "${suggestion}"?`
            : 'Overrides replace existing tokens; they do not create new ones.',
        );
        continue;
      }
      const value = asTokenValue(raw);
      if (value === undefined) {
        d.error('override.invalid', path, 'An override is a string or { "light": …, "dark": … }.');
        continue;
      }
      const effective = isModeValues(value) && modes.length === 1 ? value[modes[0] as Mode] : value;
      if (existing.type === 'color') {
        for (const text of isModeValues(effective)
          ? [effective.light, effective.dark]
          : [effective]) {
          if (!/\{[^{}]+\}/.test(text) && !parseColor(text))
            d.error(
              'color.invalid',
              path,
              `${JSON.stringify(text)} is not a supported colour.`,
              'Use #rrggbb, #rgb, oklch(L C H), or a {token} reference.',
            );
        }
      } else if (existing.type === 'dimension') {
        for (const text of isModeValues(effective)
          ? [effective.light, effective.dark]
          : [effective]) {
          if (!/\{[^{}]+\}/.test(text) && !parseDimension(text))
            d.error('unit.invalid', path, `${JSON.stringify(text)} is not a length with a unit.`);
        }
      }
      tokens.set(tokenName, {
        ...existing,
        value: effective,
        origin: 'overridden',
        provenance: path,
      });
    }
  }

  validateGraph(tokens, d);
  if (d.hasErrors) return { theme: undefined, diagnostics: d.items };

  const sorted: TokenMap = new Map([...tokens.entries()].sort(([a], [b]) => compareNames(a, b)));
  checkTargets(sorted, (n) => pointer('tokens', n), d);
  checkContrast(sorted, modes, '', d);

  const scopes: ScopeTokens[] = [];
  productInputs.forEach((product, i) => {
    const refs = refTokens(productRamps[i] as Ramps);
    const changed = refs.filter((r) => (sorted.get(r.name) as TokenDefinition).value !== r.value);
    const variant = withRefs(sorted, changed);
    checkContrast(variant, modes, ` for product "${product.name}"`, d);
    scopes.push(scope('product', product.name, sorted, changed, modes));
  });
  for (const entry of densityInputs) {
    const changed: TokenDefinition[] = [];
    for (const token of sorted.values()) {
      if (!token.density || typeof token.value !== 'string') continue;
      const dimension = parseDimension(token.value);
      if (!dimension || dimension.value === 0) continue;
      const scaled = formatDimension(scaleDimension(dimension, entry.scale));
      if (scaled !== token.value) {
        changed.push({
          ...token,
          value: scaled,
          provenance: `${token.value} × ${entry.scale} (density "${entry.name}")`,
        });
      }
    }
    checkTargets(
      withRefs(sorted, changed),
      (n) => `${pointer('density', entry.name)}${pointer('tokens', n)}`,
      d,
    );
    scopes.push(scope('density', entry.name, sorted, changed, modes));
  }

  return { theme: { name, modes, tokens: sorted, scopes }, diagnostics: d.items };
}

function scope(
  kind: ScopeTokens['kind'],
  name: string,
  base: TokenMap,
  changed: readonly TokenDefinition[],
  modes: readonly Mode[],
): ScopeTokens {
  const names = new Set(changed.map((t) => t.name));
  const closure = dependents(base, names, modes);
  const tokens = new Map<string, TokenDefinition>();
  for (const token of changed) tokens.set(token.name, token);
  for (const dependent of closure) tokens.set(dependent, base.get(dependent) as TokenDefinition);
  return {
    kind,
    name,
    tokens: new Map([...tokens.entries()].sort(([a], [b]) => compareNames(a, b))),
    changed: [...names].sort(compareNames),
  };
}

export interface ResolveContext {
  readonly mode?: Mode;
  readonly product?: string;
  readonly density?: string;
}

/** Literal value of a token in a context (e.g. for docs, tests, and inspection). */
export function resolveToken(
  theme: ResolvedTheme,
  name: string,
  context: ResolveContext = {},
): string | undefined {
  const map = new Map(theme.tokens);
  for (const s of theme.scopes) {
    if (
      (s.kind === 'product' && s.name === context.product) ||
      (s.kind === 'density' && s.name === context.density)
    ) {
      for (const [k, v] of s.tokens) map.set(k, v);
    }
  }
  return resolveLiteral(map, name, context.mode ?? theme.modes[0] ?? 'light');
}
