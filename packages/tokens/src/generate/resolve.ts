/**
 * Resolve a `ThemeConfig` into a validated token graph plus product and density scopes.
 * Precedence: Oddkin defaults → preset → user configuration → explicit overrides.
 * Pure and deterministic; no I/O. Contract: theming-and-styling.md §1–§5, §10, §11.4.
 */
import type { Mode, ModeValues, ThemeConfig } from '../theme/types.js';
import { contrastRatio, formatOklch, generateRamp, parseColor, RAMP, type Oklch } from './color.js';
import { resolveConditions, type Condition } from './conditions.js';
import { checkContrast, hexOf } from './contrast.js';
import { closest, DiagnosticList, pointer, type Diagnostic } from './diagnostics.js';
import { aboveFloorSyntax, floorLabel } from './floor.js';
import {
  compareNames,
  compileValue,
  dependents,
  isModeValues,
  resolveLiteral,
  validateGraph,
  type TokenDefinition,
  type TokenMap,
  type TokenValue,
  TOKEN_NAME,
} from './graph.js';
import {
  CONTRAST_ROLES,
  DEFAULT_DENSITY,
  DEFAULT_SPACING,
  DEFAULT_STATUS,
  PRESET_CONDITIONS,
  PRESET_PROFILES,
  PRESET_TOKENS,
  type ContrastRole,
} from './preset.js';
import { generateSpacing, SEGMENT } from './spacing.js';
import { formatDimension, parseDimension, scaleDimension } from './units.js';

export interface ScopeTokens {
  readonly kind: 'product' | 'density' | 'profile';
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
  /** Products, densities, then profiles, in emission (and therefore precedence) order. */
  readonly scopes: readonly ScopeTokens[];
  readonly conditions: ReadonlyMap<string, Condition>;
}

export interface ResolveResult {
  readonly theme: ResolvedTheme | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

type Ramps = Record<
  'brand' | 'neutral' | 'danger' | 'success' | 'warning',
  ReturnType<typeof generateRamp>
>;
interface StatusSeeds {
  readonly danger: Oklch;
  readonly success: Oklch;
  readonly warning: Oklch;
}

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
  'conditions',
  'profiles',
  'overrides',
];
const MODES: readonly Mode[] = ['light', 'dark'];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** An absent key takes its default; an explicit `null` is validated (and rejected) like the schema does. */
const given = <T>(value: T | undefined, fallback: T): T => (value === undefined ? fallback : value);

/** `/tokens/<name>` → the configuration path the token's value came from (an override), if any. */
function configPath(tokens: TokenMap, path: string): string {
  const match = /^\/tokens\/([^/]+)$/.exec(path);
  if (!match) return path;
  const token = tokens.get((match[1] as string).replace(/~1/g, '/').replace(/~0/g, '~'));
  // Generated tokens record a formula as provenance; only configuration paths are pointers.
  return token?.provenance?.startsWith('/') ? token.provenance : path;
}

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

function buildRamps(primary: Oklch, neutral: Oklch | undefined, status: StatusSeeds): Ramps {
  const neutralSeed = neutral ?? {
    l: primary.l,
    c: Math.min(primary.c * 0.1, 0.015),
    h: primary.h,
  };
  return {
    brand: generateRamp(primary),
    neutral: generateRamp(neutralSeed, neutral ? Math.min(neutral.c, 0.04) : neutralSeed.c),
    danger: generateRamp(status.danger),
    success: generateRamp(status.success),
    warning: generateRamp(status.warning),
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

function checkTargets(
  tokens: TokenMap,
  path: (name: string) => string,
  d: DiagnosticList,
  only?: ReadonlySet<string>,
  reportUnitMismatch = true,
): void {
  for (const token of tokens.values()) {
    if (!token.minimum || (only && !only.has(token.name))) continue;
    const value = parseDimension(resolveLiteral(tokens, token.name, 'light'));
    const minimum = parseDimension(resolveLiteral(tokens, token.minimum, 'light'));
    if (!value || !minimum) continue;
    if (value.unit !== minimum.unit && value.value !== 0) {
      if (!reportUnitMismatch) continue;
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

/** Resolve and validate a theme configuration (JSON or `defineTheme` object). */
export function resolveTheme(input: unknown): ResolveResult {
  const d = new DiagnosticList();
  if (!isRecord(input)) {
    d.error('config.type', '', 'A theme configuration must be an object.');
    return { theme: undefined, diagnostics: d.items };
  }
  unknownKeys(input, TOP_LEVEL, '', d);
  if (input['$schema'] !== undefined && typeof input['$schema'] !== 'string')
    d.error('config.type', '/$schema', '$schema must be a string: the JSON Schema URL or path.');
  const config = input as unknown as ThemeConfig;

  const name = given(config.name, 'default');
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name)) {
    d.error(
      'config.name.invalid',
      '/name',
      `${JSON.stringify(name)} is not a valid theme name.`,
      'Use lowercase letters, digits, and hyphens.',
    );
  }
  if (config.preset !== undefined && config.preset !== 'oddkin-default') {
    d.error(
      'preset.unknown',
      '/preset',
      `Unknown preset ${JSON.stringify(config.preset)}.`,
      'Use "oddkin-default" or omit preset.',
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

  const status: unknown = given<unknown>(config.status, {});
  const statusInput: Record<string, unknown> = isRecord(status) ? status : {};
  if (!isRecord(status)) d.error('config.type', '/status', 'status must be an object.');
  else unknownKeys(status, ['danger', 'success', 'warning'], '/status', d);
  const danger = color(given(statusInput['danger'], DEFAULT_STATUS.danger), '/status/danger', d);
  const success = color(
    given(statusInput['success'], DEFAULT_STATUS.success),
    '/status/success',
    d,
  );
  const warning = color(
    given(statusInput['warning'], DEFAULT_STATUS.warning),
    '/status/warning',
    d,
  );

  const modes = given(config.modes, MODES);
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

  const spacing = generateSpacing(given(config.spacing, DEFAULT_SPACING), d, '/spacing');

  const products = given(config.products, {});
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

  const density = given(config.density, DEFAULT_DENSITY);
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

  const conditions = resolveConditions(PRESET_CONDITIONS, config.conditions, d);
  if (config.profiles !== undefined && !isRecord(config.profiles)) {
    d.error('config.type', '/profiles', 'profiles must be an object of named role-override sets.');
  }

  const overrides = given(config.overrides, {});
  if (!isRecord(overrides))
    d.error('config.type', '/overrides', 'overrides must be an object of token names to values.');

  if (d.hasErrors || !primary || !danger || !success || !warning || !spacing)
    return { theme: undefined, diagnostics: d.items };

  // Base graph: generated references, spacing, preset tokens.
  const seeds: StatusSeeds = { danger, success, warning };
  const ramps = buildRamps(primary, neutral, seeds);
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
  const productRamps = productInputs.map((p) => buildRamps(p.primary, p.neutral, seeds));
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
      const effective = checkValue(existing, value, modes, path, d);
      if (compileValue(effective, modes) === compileValue(existing.value, modes))
        d.warn(
          'override.redundant',
          path,
          `"${tokenName}" already has this value (${existing.origin}${existing.provenance ? `: ${existing.provenance}` : ''}).`,
          'Remove the override; it changes no output.',
        );
      tokens.set(tokenName, {
        ...existing,
        value: effective,
        origin: 'overridden',
        provenance: path,
      });
    }
  }

  // Errors in a value the user wrote point at that override, as profile values point at the profile.
  const graph = new DiagnosticList();
  validateGraph(tokens, graph);
  for (const item of graph.items) d.items.push({ ...item, path: configPath(tokens, item.path) });
  if (d.hasErrors) return { theme: undefined, diagnostics: d.items };

  const sorted: TokenMap = new Map([...tokens.entries()].sort(([a], [b]) => compareNames(a, b)));
  checkTargets(sorted, (n) => configPath(sorted, pointer('tokens', n)), d);
  checkContrast(sorted, modes, '', d);

  const scopes: ScopeTokens[] = [];
  productInputs.forEach((product, i) => {
    const refs = refTokens(productRamps[i] as Ramps);
    const changed = refs.filter((r) => (sorted.get(r.name) as TokenDefinition).value !== r.value);
    if (changed.length === 0)
      d.warn(
        'product.redundant',
        pointer('products', product.name),
        `Product "${product.name}" has the base brand colours, so its scope changes nothing.`,
        'Give it its own brand colours, or remove it.',
      );
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
    if (changed.length === 0)
      d.warn(
        'density.redundant',
        pointer('density', entry.name),
        `Density "${entry.name}" (scale ${entry.scale}) changes no token.`,
        'Use a scale other than 1, or remove it.',
      );
    checkTargets(
      withRefs(sorted, changed),
      (n) => `${pointer('density', entry.name)}${pointer('tokens', n)}`,
      d,
      undefined,
      false,
    );
    scopes.push(scope('density', entry.name, sorted, changed, modes));
  }

  // Profiles, after products and densities so they win where they apply to the same element.
  const profileInputs = {
    ...PRESET_PROFILES,
    ...(isRecord(config.profiles) ? config.profiles : {}),
  };
  const roleOwners = new Map<string, string>();
  for (const [profileName, input] of Object.entries(profileInputs)) {
    const path = pointer('profiles', profileName);
    const origin =
      isRecord(config.profiles) && profileName in config.profiles ? 'configured' : 'preset';
    if (!TOKEN_NAME.test(profileName)) {
      d.error(
        'profile.name.invalid',
        path,
        `"${profileName}" is not a valid profile name.`,
        'Use dot-separated lowercase segments, e.g. "navigation.compact".',
      );
    }
    if (!isRecord(input)) {
      d.error('config.type', path, 'A profile is an object of role names to values.');
      continue;
    }
    const changed: TokenDefinition[] = [];
    for (const [tokenName, raw] of Object.entries(input)) {
      const at = `${path}${pointer(tokenName)}`;
      const target = sorted.get(tokenName);
      if (!target) {
        const suggestion = closest(tokenName, sorted.keys());
        d.error(
          'profile.unknown',
          at,
          `No token named "${tokenName}".`,
          suggestion ? `Did you mean "${suggestion}"?` : undefined,
        );
        continue;
      }
      if (target.category !== 'layout' && target.category !== 'component') {
        d.error(
          'profile.category',
          at,
          `Profiles may override layout and component roles only; "${tokenName}" is a ${target.category} token.`,
          'Override foundation and colour values with overrides, products, or modes instead.',
        );
        continue;
      }
      const value = asTokenValue(raw);
      if (value === undefined) {
        d.error(
          'override.invalid',
          at,
          'A profile value is a string or { "light": …, "dark": … }.',
        );
        continue;
      }
      const owner = roleOwners.get(tokenName);
      if (owner) {
        d.warn(
          'profile.overlap',
          at,
          `"${tokenName}" is also set by profile "${owner}" (${pointer('profiles', owner)}${pointer(tokenName)}).`,
          `Where both apply to one element, "${profileName}" wins because it comes later in the configuration; data-odd-profile list order does not change this.`,
        );
      } else roleOwners.set(tokenName, profileName);
      const profileValue = checkValue(target, value, modes, at, d);
      if (compileValue(profileValue, modes) === compileValue(target.value, modes))
        d.warn(
          'profile.redundant',
          at,
          `"${tokenName}" already has this value outside the profile.`,
          'Remove it from the profile; it changes no output.',
        );
      changed.push({
        ...target,
        value: profileValue,
        origin,
        provenance: at,
      });
    }
    const variant = withRefs(sorted, changed);
    const names = new Set(changed.map((c) => c.name));
    const graph = new DiagnosticList();
    validateGraph(variant, graph);
    for (const item of graph.items) {
      const token = item.path
        .replace(/^\/tokens\//, '')
        .replace(/~1/g, '/')
        .replace(/~0/g, '~');
      if (!names.has(token) && item.code !== 'alias.cycle') continue;
      const at = `${path}${pointer(token)}`;
      if (item.severity === 'error') d.error(item.code, at, item.message, item.suggestion);
      else d.warn(item.code, at, item.message, item.suggestion);
    }
    if (graph.hasErrors) continue;
    // Only roles the profile changes, directly or through references, can newly fall below a minimum.
    const affected = new Set([...names, ...dependents(sorted, names, modes)]);
    checkTargets(variant, (n) => `${path}${pointer(n)}`, d, affected, false);
    for (const s of scopes) {
      if (s.kind !== 'density') continue;
      const combined = withRefs(
        withRefs(
          sorted,
          [...s.tokens.values()].filter((x) => s.changed.includes(x.name)),
        ),
        changed,
      );
      checkTargets(
        combined,
        (n) => `${path}${pointer('density', s.name)}${pointer(n)}`,
        d,
        affected,
        false,
      );
    }
    scopes.push(scope('profile', profileName, sorted, changed, modes));
  }

  if (d.hasErrors) return { theme: undefined, diagnostics: d.items };
  return { theme: { name, modes, tokens: sorted, scopes, conditions }, diagnostics: d.items };
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
  /** Profiles applied, in any order (precedence follows the configuration). */
  readonly profiles?: readonly string[];
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
      (s.kind === 'density' && s.name === context.density) ||
      (s.kind === 'profile' && (context.profiles ?? []).includes(s.name))
    ) {
      for (const [k, v] of s.tokens) map.set(k, v);
    }
  }
  return resolveLiteral(map, name, context.mode ?? theme.modes[0] ?? 'light');
}

const LITERAL_OR_EXPRESSION = /\{[^{}]+\}|calc\(|min\(|max\(|clamp\(/;

/**
 * Validate an override or profile colour for the target token; returns the effective value.
 * Dimensions, numbers, and font weights are checked by the graph's unit policy.
 */
function checkValue(
  target: TokenDefinition,
  value: TokenValue,
  modes: readonly Mode[],
  path: string,
  d: DiagnosticList,
): TokenValue {
  const effective = isModeValues(value) && modes.length === 1 ? value[modes[0] as Mode] : value;
  for (const text of isModeValues(effective) ? [effective.light, effective.dark] : [effective]) {
    if (LITERAL_OR_EXPRESSION.test(text)) continue;
    if (target.type === 'color' && !parseColor(text)) {
      const outside = aboveFloorSyntax(text)
        .map((e) => ` ${e.syntax} is not parsed by ${floorLabel(e.unsupported)}.`)
        .join('');
      d.error(
        'color.invalid',
        path,
        `${JSON.stringify(text)} is not a supported colour.`,
        `Use #rrggbb, #rgb, oklch(L C H), or a {token} reference; mode-dependent colours use { "light": …, "dark": … }.${outside}`,
      );
    }
  }
  return effective;
}
