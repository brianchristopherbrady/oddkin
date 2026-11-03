/**
 * Foundation inputs beside spacing: `radius.scale`, `motion.scale`, and `typography.scale`. Each
 * generates its preset steps from one or two numbers; unset, nothing changes. Contract:
 * theming-and-styling.md §10.3.
 */
import { closest, type DiagnosticList } from './diagnostics.js';
import type { TokenDefinition } from './graph.js';
import { ratioName } from './spacing.js';
import { formatDimension, formatNumber, parseDimension, round4, type Dimension } from './units.js';

export interface FoundationInputs {
  radius?: number;
  motion?: number;
  typography?: { readonly base: Dimension; readonly ratio: number };
}

interface Bounds {
  readonly minimum?: number;
  readonly exclusiveMinimum?: number;
  readonly maximum: number;
}

/** The bounds the schema states too, so a form draws each control from the schema alone. */
export const INPUT_BOUNDS: Readonly<Record<'radius' | 'motion' | 'ratio', Bounds>> = {
  radius: { minimum: 0, maximum: 3 },
  motion: { exclusiveMinimum: 0, maximum: 2 },
  ratio: { exclusiveMinimum: 1, maximum: 2 },
};

/** The radius steps a scale multiplies; `radius.none` and `radius.full` stay. */
const RADIUS_STEPS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'].map((step) => `radius.${step}`);
/** `font.size.xs` to `font.size.4xl`, as offsets from `md`. */
const FONT_OFFSETS = [-2, -1, 0, 1, 2, 3, 4, 5];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function options(
  value: unknown,
  path: string,
  keys: readonly string[],
  d: DiagnosticList,
): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    d.error('config.type', path, `${path.slice(1).replaceAll('/', '.')} must be an object.`);
    return undefined;
  }
  for (const key of Object.keys(value)) {
    if (keys.includes(key)) continue;
    const suggestion = closest(key, keys);
    d.error(
      'config.unknownKey',
      `${path}/${key}`,
      `Unknown option "${key}".`,
      suggestion ? `Did you mean "${suggestion}"?` : `Use ${keys.join(' and ')}.`,
    );
  }
  return value;
}

function bounded(value: unknown, path: string, bounds: Bounds, d: DiagnosticList) {
  const above =
    bounds.minimum !== undefined
      ? (n: number) => n >= (bounds.minimum as number)
      : (n: number) => n > (bounds.exclusiveMinimum as number);
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    above(value) &&
    value <= bounds.maximum
  )
    return value;
  const range =
    bounds.minimum !== undefined
      ? `from ${bounds.minimum} to ${bounds.maximum}`
      : `greater than ${bounds.exclusiveMinimum} and at most ${bounds.maximum}`;
  d.error(
    'scale.invalidParameter',
    path,
    `${path.slice(1).replaceAll('/', '.')} must be a number ${range}; ${JSON.stringify(value)} is not.`,
  );
  return undefined;
}

function fontBase(value: unknown, d: DiagnosticList): Dimension | undefined {
  const path = '/typography/scale/base';
  if (value === undefined) {
    d.error(
      'config.required',
      path,
      'typography.scale.base is required: the size of font.size.md.',
    );
    return undefined;
  }
  const base = parseDimension(value);
  if (!base || base.value <= 0) {
    d.error(
      'unit.invalid',
      path,
      `${JSON.stringify(value)} is not a positive length with a unit.`,
      'Use rem, e.g. "1rem"; px and em are also accepted.',
    );
    return undefined;
  }
  if (base.unit === 'px')
    d.warn(
      'unit.discouraged',
      path,
      'px font sizes ignore the reader’s font-size preference.',
      'Prefer rem.',
    );
  return base;
}

/** Validate the inputs; each problem is reported at its own pointer. */
export function foundationInputs(
  config: Readonly<Record<string, unknown>>,
  d: DiagnosticList,
): FoundationInputs {
  const inputs: FoundationInputs = {};
  const radius = options(config['radius'], '/radius', ['scale'], d);
  const radiusScale =
    radius?.['scale'] === undefined
      ? undefined
      : bounded(radius['scale'], '/radius/scale', INPUT_BOUNDS.radius, d);
  if (radiusScale !== undefined) inputs.radius = radiusScale;
  const motion = options(config['motion'], '/motion', ['scale'], d);
  const motionScale =
    motion?.['scale'] === undefined
      ? undefined
      : bounded(motion['scale'], '/motion/scale', INPUT_BOUNDS.motion, d);
  if (motionScale !== undefined) inputs.motion = motionScale;
  const typography = options(config['typography'], '/typography', ['scale'], d);
  const scale = options(typography?.['scale'], '/typography/scale', ['base', 'ratio'], d);
  if (scale) {
    const base = fontBase(scale['base'], d);
    let ratio: number | undefined;
    if (scale['ratio'] === undefined)
      d.error('config.required', '/typography/scale/ratio', 'typography.scale.ratio is required.');
    else ratio = bounded(scale['ratio'], '/typography/scale/ratio', INPUT_BOUNDS.ratio, d);
    if (base && ratio !== undefined) inputs.typography = { base, ratio };
  }
  return inputs;
}

/** Replace the preset steps the inputs generate, recording the input as their provenance. */
export function applyFoundationInputs(
  tokens: Map<string, TokenDefinition>,
  inputs: FoundationInputs,
): void {
  const generated = (name: string, value: string, provenance: string) => {
    const token = tokens.get(name);
    if (token) tokens.set(name, { ...token, value, origin: 'generated', provenance });
  };
  const { radius, motion, typography } = inputs;
  if (radius !== undefined)
    for (const name of RADIUS_STEPS) {
      const preset = parseDimension(tokens.get(name)?.value);
      if (preset)
        generated(
          name,
          formatDimension({ value: round4(preset.value * radius), unit: preset.unit }),
          `${formatDimension(preset)} × ${formatNumber(radius)} (radius.scale)`,
        );
    }
  if (motion !== undefined)
    for (const [name, token] of tokens) {
      const ms =
        name.startsWith('motion.duration.') && /^(\d+(?:\.\d+)?)ms$/.exec(String(token.value));
      if (ms)
        generated(
          name,
          `${Math.round(Number(ms[1]) * motion)}ms`,
          `${ms[0]} × ${formatNumber(motion)}, in whole milliseconds (motion.scale)`,
        );
    }
  if (typography)
    for (const offset of FONT_OFFSETS)
      generated(
        `font.size.${ratioName(offset)}`,
        formatDimension({
          value: round4(typography.base.value * typography.ratio ** offset),
          unit: typography.base.unit,
        }),
        `${formatDimension(typography.base)} × ${formatNumber(typography.ratio)}^${offset} (typography.scale)`,
      );
}
