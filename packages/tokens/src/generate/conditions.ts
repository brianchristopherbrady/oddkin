/**
 * Named conditions: literal container and media queries. Query conditions cannot read
 * custom properties, so thresholds are always literal lengths. Contract:
 * theming-and-styling.md §11.2.
 */
import type { ConditionConfig } from '../theme/types.js';
import { closest, pointer, type DiagnosticList } from './diagnostics.js';
import { TOKEN_NAME } from './graph.js';
import { formatDimension, parseDimension, type Dimension } from './units.js';

export interface Condition {
  readonly name: string;
  readonly kind: 'container' | 'media';
  /** Query prelude after the at-rule keyword, e.g. `shell (min-inline-size: 48rem)`. */
  readonly query: string;
  /** Complete at-rule prelude, e.g. `@container shell (min-inline-size: 48rem)`. */
  readonly atRule: string;
  readonly origin: 'preset' | 'configured';
}

const CONTAINER_SIZE = {
  minInlineSize: 'min-inline-size',
  maxInlineSize: 'max-inline-size',
  minWidth: 'min-width',
  maxWidth: 'max-width',
} as const;
const MEDIA_SIZE = { minWidth: 'min-width', maxWidth: 'max-width' } as const;
const MEDIA_PREFERENCES = {
  prefersReducedMotion: ['prefers-reduced-motion', ['reduce', 'no-preference']],
  prefersColorScheme: ['prefers-color-scheme', ['light', 'dark']],
  prefersContrast: ['prefers-contrast', ['more', 'less', 'no-preference', 'custom']],
  forcedColors: ['forced-colors', ['active', 'none']],
} as const;
const CONTAINER_NAME = /^[a-zA-Z_][\w-]*$/;
const RESERVED_CONTAINER_NAMES = new Set(['none', 'and', 'or', 'not']);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function length(value: unknown, path: string, d: DiagnosticList): Dimension | undefined {
  const parsed =
    typeof value === 'string' && !/var\(|%/.test(value) ? parseDimension(value) : undefined;
  if (!parsed) {
    d.error(
      'condition.unit.invalid',
      path,
      `${JSON.stringify(value)} is not a literal length.`,
      'Query thresholds must be literal lengths such as "40rem"; var(), percentages, and unitless numbers cannot be used in queries.',
    );
    return undefined;
  }
  if (parsed.unit === 'px') {
    d.warn(
      'condition.unit.px',
      path,
      'A px threshold ignores the reader’s font-size preference.',
      'Prefer rem (or em in media queries).',
    );
  }
  return parsed;
}

function range(
  source: Record<string, unknown>,
  features: Readonly<Record<string, string>>,
  path: string,
  d: DiagnosticList,
): string[] {
  const parts: string[] = [];
  const parsed: Record<string, Dimension> = {};
  for (const [key, feature] of Object.entries(features)) {
    if (source[key] === undefined) continue;
    const value = length(source[key], `${path}/${key}`, d);
    if (value) {
      parsed[key] = value;
      parts.push(`(${feature}: ${formatDimension(value)})`);
    }
  }
  for (const [min, max] of [
    ['minInlineSize', 'maxInlineSize'],
    ['minWidth', 'maxWidth'],
  ] as const) {
    const a = parsed[min];
    const b = parsed[max];
    if (a && b && a.unit === b.unit && a.value > b.value) {
      d.error(
        'condition.range.empty',
        `${path}/${min}`,
        `${min} (${formatDimension(a)}) is greater than ${max} (${formatDimension(b)}); the condition can never match.`,
      );
    }
  }
  return parts;
}

/** Validate and serialize one condition. */
export function parseCondition(
  name: string,
  input: unknown,
  origin: Condition['origin'],
  d: DiagnosticList,
): Condition | undefined {
  const path = pointer('conditions', name);
  const before = d.items.length;
  if (!TOKEN_NAME.test(name))
    d.error(
      'condition.name.invalid',
      path,
      `"${name}" is not a valid condition name.`,
      'Use dot-separated lowercase segments, e.g. "navigation.expanded".',
    );
  if (!isRecord(input)) {
    d.error('config.type', path, 'A condition is an object with "container" or "media".');
    return undefined;
  }
  const config = input as unknown as ConditionConfig;

  if ('media' in config && config.media !== undefined) {
    for (const key of Object.keys(input))
      if (key !== 'media')
        d.error(
          'config.unknownKey',
          `${path}/${key}`,
          `Unknown option "${key}" in a media condition.`,
        );
    if (!isRecord(config.media)) {
      d.error('config.type', `${path}/media`, 'media must be an object.');
      return undefined;
    }
    const media = config.media as Record<string, unknown>;
    const allowed = [...Object.keys(MEDIA_SIZE), ...Object.keys(MEDIA_PREFERENCES)];
    for (const key of Object.keys(media)) {
      if (allowed.includes(key)) continue;
      if (key === 'minInlineSize' || key === 'maxInlineSize') {
        d.error(
          'condition.feature.unsupported',
          `${path}/media/${key}`,
          `${key} is not a media feature.`,
          `Use ${key.startsWith('min') ? 'minWidth' : 'maxWidth'} for media queries, or a container condition for logical sizes.`,
        );
      } else {
        const suggestion = closest(key, allowed);
        d.error(
          'config.unknownKey',
          `${path}/media/${key}`,
          `Unknown media feature "${key}".`,
          suggestion ? `Did you mean "${suggestion}"?` : undefined,
        );
      }
    }
    const parts = range(media, MEDIA_SIZE, `${path}/media`, d);
    for (const [key, [feature, values]] of Object.entries(MEDIA_PREFERENCES)) {
      const value = media[key];
      if (value === undefined) continue;
      if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
        d.error(
          'condition.feature.invalid',
          `${path}/media/${key}`,
          `${JSON.stringify(value)} is not a ${feature} value.`,
          `Use one of: ${values.join(', ')}.`,
        );
      } else parts.push(`(${feature}: ${value})`);
    }
    if (parts.length === 0 && d.items.length === before)
      d.error('condition.empty', `${path}/media`, 'A media condition needs at least one feature.');
    if (d.items.slice(before).some((x) => x.severity === 'error')) return undefined;
    const query = parts.join(' and ');
    return { name, kind: 'media', query, atRule: `@media ${query}`, origin };
  }

  if ('container' in config) {
    const allowed = ['container', ...Object.keys(CONTAINER_SIZE)];
    for (const key of Object.keys(input)) {
      if (allowed.includes(key)) continue;
      const suggestion = closest(key, allowed);
      d.error(
        'config.unknownKey',
        `${path}/${key}`,
        `Unknown option "${key}" in a container condition.`,
        suggestion ? `Did you mean "${suggestion}"?` : undefined,
      );
    }
    const container = config.container;
    let containerName = '';
    if (typeof container === 'string') {
      if (!CONTAINER_NAME.test(container) || RESERVED_CONTAINER_NAMES.has(container)) {
        d.error(
          'condition.container.invalid',
          `${path}/container`,
          `${JSON.stringify(container)} is not a valid container name.`,
          'Use a CSS identifier such as "shell", or true for the nearest size container.',
        );
      } else containerName = `${container} `;
    } else if (container !== true) {
      d.error(
        'condition.container.invalid',
        `${path}/container`,
        'container must be a container name or true (nearest size container).',
      );
    }
    const parts = range(input, CONTAINER_SIZE, path, d);
    if (parts.length === 0 && d.items.length === before)
      d.error(
        'condition.empty',
        path,
        'A container condition needs minInlineSize, maxInlineSize, minWidth, or maxWidth.',
      );
    if (d.items.slice(before).some((x) => x.severity === 'error')) return undefined;
    const query = `${containerName}${parts.join(' and ')}`;
    return { name, kind: 'container', query, atRule: `@container ${query}`, origin };
  }

  d.error(
    'condition.kind',
    path,
    'A condition needs "container" (a container query) or "media" (a media query).',
  );
  return undefined;
}

/** Preset conditions merged with configured ones (configured names replace preset names). */
export function resolveConditions(
  preset: Readonly<Record<string, ConditionConfig>>,
  configured: unknown,
  d: DiagnosticList,
): Map<string, Condition> {
  const out = new Map<string, Condition>();
  for (const [name, input] of Object.entries(preset)) {
    const condition = parseCondition(name, input, 'preset', d);
    if (condition) out.set(name, condition);
  }
  if (configured !== undefined && !isRecord(configured)) {
    d.error('config.type', '/conditions', 'conditions must be an object of named conditions.');
  }
  for (const [name, input] of Object.entries(isRecord(configured) ? configured : {})) {
    const condition = parseCondition(name, input, 'configured', d);
    if (condition) out.set(name, condition);
  }
  return new Map([...out.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
