/**
 * Spacing strategies: `multiples`, `ratio`, `explicit` (exactly one; discriminated by
 * `strategy`). Names are stable: adding steps never renames or revalues existing ones.
 * Contract: theming-and-styling.md §4.
 */
import type { SpacingConfig } from '../theme/types.js';
import { closest, type DiagnosticList } from './diagnostics.js';
import { formatDimension, formatNumber, parseDimension, round4, type Dimension } from './units.js';

export interface SpacingStep {
  readonly name: string;
  readonly value: Dimension;
  /** Human-readable derivation, recorded as provenance. */
  readonly formula: string;
}

const KEYS = {
  multiples: ['strategy', 'unit', 'steps', 'snap'],
  ratio: ['strategy', 'base', 'ratio', 'stepsBelow', 'stepsAbove', 'names', 'snap'],
  explicit: ['strategy', 'steps', 'snap'],
} as const;
type Strategy = keyof typeof KEYS;
const STRATEGIES = Object.keys(KEYS) as Strategy[];
const MAX_STEPS_PER_SIDE = 12;

export const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Positional names around `md`: …, 3xs, 2xs, xs, sm, md, lg, xl, 2xl, 3xl, … */
export function ratioName(offset: number): string {
  const named: Record<number, string> = { [-2]: 'xs', [-1]: 'sm', 0: 'md', 1: 'lg', 2: 'xl' };
  const known = named[offset];
  if (known) return known;
  return offset < 0 ? `${-offset - 1}xs` : `${offset - 1}xl`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkLength(
  value: unknown,
  path: string,
  diagnostics: DiagnosticList,
  allowZero = true,
): Dimension | undefined {
  const parsed = parseDimension(value);
  if (!parsed || (!allowZero && parsed.value === 0)) {
    diagnostics.error(
      'unit.invalid',
      path,
      `${JSON.stringify(value)} is not a ${allowZero ? '' : 'non-zero '}length with a unit.`,
      'Use rem for spacing (e.g. "0.25rem"); px and em are also accepted.',
    );
    return undefined;
  }
  if (parsed.unit === 'px') {
    diagnostics.warn(
      'unit.discouraged',
      path,
      'px spacing ignores the reader’s font-size preference.',
      'Prefer rem for spacing.',
    );
  }
  return parsed;
}

function checkFinite(
  value: unknown,
  path: string,
  diagnostics: DiagnosticList,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    diagnostics.error('number.nonFinite', path, `${JSON.stringify(value)} is not a finite number.`);
    return undefined;
  }
  return value;
}

function applySnap(step: SpacingStep, snap: Dimension | undefined): SpacingStep {
  if (!snap || snap.value === 0 || step.value.value === 0) return step;
  const value = round4(Math.round(step.value.value / snap.value) * snap.value);
  return {
    name: step.name,
    value: { value, unit: step.value.unit },
    formula: `${step.formula}, snapped to ${formatDimension(snap)}`,
  };
}

/** Generate the spacing scale or report diagnostics (returns undefined on errors). */
export function generateSpacing(
  config: unknown,
  diagnostics: DiagnosticList,
  path = '/spacing',
): SpacingStep[] | undefined {
  if (!isRecord(config)) {
    diagnostics.error('config.type', path, 'spacing must be an object with a "strategy".');
    return undefined;
  }
  const strategy = config['strategy'];
  if (typeof strategy !== 'string' || !STRATEGIES.includes(strategy as Strategy)) {
    diagnostics.error(
      'strategy.unknown',
      `${path}/strategy`,
      `Unknown spacing strategy ${JSON.stringify(strategy)}.`,
      `Use one of: ${STRATEGIES.join(', ')}.`,
    );
    return undefined;
  }
  const before = diagnostics.items.length;
  const allowed = new Set<string>(KEYS[strategy as Strategy]);
  for (const key of Object.keys(config)) {
    if (allowed.has(key)) continue;
    const owner = STRATEGIES.find((s) => (KEYS[s] as readonly string[]).includes(key));
    if (owner) {
      diagnostics.error(
        'strategy.conflict',
        `${path}/${key}`,
        `"${key}" belongs to the "${owner}" strategy, but this spacing uses "${strategy}".`,
        `Remove "${key}" or switch to strategy "${owner}".`,
      );
    } else {
      const suggestion = closest(key, allowed);
      diagnostics.error(
        'config.unknownKey',
        `${path}/${key}`,
        `Unknown spacing option "${key}".`,
        suggestion ? `Did you mean "${suggestion}"?` : undefined,
      );
    }
  }

  const snap =
    config['snap'] === undefined
      ? undefined
      : checkLength(config['snap'], `${path}/snap`, diagnostics, false);
  let steps: SpacingStep[] = [];
  const typed = config as unknown as SpacingConfig;

  if (typed.strategy === 'multiples') {
    const unit = checkLength(config['unit'], `${path}/unit`, diagnostics, false);
    const entries = isRecord(config['steps']) ? Object.entries(config['steps']) : undefined;
    if (!entries || entries.length === 0)
      diagnostics.error('scale.empty', `${path}/steps`, 'steps must name at least one multiplier.');
    for (const [name, raw] of entries ?? []) {
      const at = `${path}/steps/${name}`;
      if (!SEGMENT.test(name))
        diagnostics.error(
          'token.name.invalid',
          at,
          `"${name}" is not a valid step name.`,
          'Use lowercase letters, digits, and hyphens.',
        );
      const multiplier = checkFinite(raw, at, diagnostics);
      if (multiplier !== undefined && multiplier < 0) {
        diagnostics.error(
          'scale.invalidParameter',
          at,
          'Multipliers must be zero or positive.',
          'Express negative spacing explicitly where it is used.',
        );
      }
      if (unit && multiplier !== undefined) {
        steps.push({
          name,
          value: { value: round4(unit.value * multiplier), unit: unit.unit },
          formula: `${formatDimension(unit)} × ${formatNumber(multiplier)}`,
        });
      }
    }
  } else if (typed.strategy === 'ratio') {
    const base = checkLength(config['base'], `${path}/base`, diagnostics, false);
    const ratio = checkFinite(config['ratio'], `${path}/ratio`, diagnostics);
    if (ratio !== undefined && (ratio <= 0 || ratio === 1)) {
      diagnostics.error(
        'scale.invalidParameter',
        `${path}/ratio`,
        'ratio must be positive and not 1.',
      );
    }
    const counts = (['stepsBelow', 'stepsAbove'] as const).map((key) => {
      const value = config[key];
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > MAX_STEPS_PER_SIDE
      ) {
        diagnostics.error(
          'scale.invalidParameter',
          `${path}/${key}`,
          `${key} must be an integer from 0 to ${MAX_STEPS_PER_SIDE}.`,
        );
        return undefined;
      }
      return value;
    });
    const [below, above] = counts;
    const names = config['names'];
    if (names !== undefined) {
      if (!Array.isArray(names) || names.some((n) => typeof n !== 'string' || !SEGMENT.test(n))) {
        diagnostics.error(
          'token.name.invalid',
          `${path}/names`,
          'names must be lowercase step names.',
        );
      } else if (below !== undefined && above !== undefined && names.length !== below + above + 1) {
        diagnostics.error(
          'scale.namesMismatch',
          `${path}/names`,
          `names has ${names.length} entries but the scale has ${below + above + 1} steps.`,
        );
      }
    }
    if (
      base &&
      ratio !== undefined &&
      ratio > 0 &&
      ratio !== 1 &&
      below !== undefined &&
      above !== undefined
    ) {
      for (let offset = -below; offset <= above; offset++) {
        const name =
          Array.isArray(names) && names.length === below + above + 1
            ? String(names[offset + below])
            : ratioName(offset);
        steps.push({
          name,
          value: { value: round4(base.value * ratio ** offset), unit: base.unit },
          formula: `${formatDimension(base)} × ${formatNumber(ratio)}^${offset}`,
        });
      }
    }
  } else {
    const entries = isRecord(config['steps']) ? Object.entries(config['steps']) : undefined;
    if (!entries || entries.length === 0)
      diagnostics.error('scale.empty', `${path}/steps`, 'steps must name at least one length.');
    for (const [name, raw] of entries ?? []) {
      const at = `${path}/steps/${name}`;
      if (!SEGMENT.test(name))
        diagnostics.error(
          'token.name.invalid',
          at,
          `"${name}" is not a valid step name.`,
          'Use lowercase letters, digits, and hyphens.',
        );
      const value = checkLength(raw, at, diagnostics);
      if (value) steps.push({ name, value, formula: 'explicit' });
    }
  }

  if (snap) {
    for (const step of steps) {
      if (step.value.value !== 0 && step.value.unit !== snap.unit) {
        diagnostics.error(
          'unit.mismatch',
          `${path}/snap`,
          `snap is in ${snap.unit} but step "${step.name}" is in ${step.value.unit}.`,
        );
      }
    }
    steps = steps.map((s) => applySnap(s, snap));
  }

  const names = new Set<string>();
  for (const step of steps) {
    if (names.has(step.name))
      diagnostics.error('token.duplicate', path, `Spacing step "${step.name}" is defined twice.`);
    names.add(step.name);
  }
  return diagnostics.items.slice(before).some((d) => d.severity === 'error') ? undefined : steps;
}
