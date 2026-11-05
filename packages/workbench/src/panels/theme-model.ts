/**
 * Theme Studio's editor model (workbench.md §6.3), DOM-free: the form fields a draft offers, in
 * groups that follow the design file's variable collections (theme inputs, then role overrides
 * with one column per mode), and immutable edits by configuration path. The form and the JSON
 * editor change the same draft; nothing here generates tokens. A draft on base files (P1.1
 * `extends`) is one file's own layer: each field says whether it sets the value or which base does.
 */

export type ConfigPath = readonly string[];
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** How a value enters the theme (workbench.md §6.3). */
export type ValueOrigin = 'foundation input' | 'explicit override';

/** A file the draft builds on, root base first, with its own model (theming §1.1). */
export interface ThemeBase {
  readonly file: string;
  readonly config: unknown;
}

/** A value a `choice` field offers, with its label. */
export type ThemeOption = readonly [label: string, value: string | number];

export interface ThemeField {
  readonly path: ConfigPath;
  readonly label: string;
  readonly kind: 'color' | 'length' | 'number' | 'integer' | 'text' | 'choice';
  /** For `choice`: the values offered; a draft's other value is kept and shown as itself. */
  readonly options?: readonly ThemeOption[];
  readonly origin: ValueOrigin;
  /** The draft's own value; undefined when it sets none. */
  readonly value: string | number | undefined;
  /**
   * What a file sets or inherits whole, `path` or a part of it (theming §1.1): a spacing field
   * belongs to `spacing`, an override's mode to its token.
   */
  readonly unit: ConfigPath;
  /** When the draft does not set `unit`: the base that does, and its value at `path`. */
  readonly inherited?: { readonly file: string; readonly value: string | number | undefined };
}

export interface OverrideRow {
  readonly token: string;
  /** One cell per mode; a single value applies to every mode. */
  readonly cells: readonly ThemeField[];
  /** The base the token's override comes from, when the draft does not set it. */
  readonly inherited?: string;
}

export interface ThemeFieldGroup {
  readonly id: string;
  readonly title: string;
  readonly note?: string;
  readonly fields: readonly ThemeField[];
  readonly rows?: readonly OverrideRow[];
  readonly modes?: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function getPath(value: unknown, path: ConfigPath): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

/** A copy of `value` with `path` set; `undefined` removes the key. Untouched branches are shared. */
export function setPath(value: unknown, path: ConfigPath, next: unknown): unknown {
  const [key, ...rest] = path;
  if (key === undefined) return next;
  const record = isRecord(value) ? value : {};
  const child = rest.length ? setPath(record[key], rest, next) : next;
  const copy: Record<string, unknown> = { ...record };
  if (child === undefined) delete copy[key];
  else copy[key] = child;
  return copy;
}

export const pathText = (path: ConfigPath) => `/${path.join('/')}`;

const scalar = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? value : undefined;

const BRAND = [
  ['brand', 'primary', 'Brand primary'],
  ['brand', 'neutral', 'Neutral'],
  ['status', 'danger', 'Danger'],
  ['status', 'success', 'Success'],
  ['status', 'warning', 'Warning'],
  ['status', 'info', 'Info'],
] as const;

const SPACING: Readonly<
  Record<string, readonly (readonly [string, string, ThemeField['kind']])[]>
> = {
  multiples: [
    ['unit', 'Unit', 'length'],
    ['snap', 'Snap to', 'length'],
  ],
  ratio: [
    ['base', 'Base', 'length'],
    ['ratio', 'Ratio', 'number'],
    ['stepsBelow', 'Steps below', 'integer'],
    ['stepsAbove', 'Steps above', 'integer'],
    ['snap', 'Snap to', 'length'],
  ],
  explicit: [['snap', 'Snap to', 'length']],
};

/**
 * The scale inputs of theme config v1, by path: the corner shape is a choice of radius scales, and
 * pill controls an override of `control.radius`. The generator checks the schema's limits. Each
 * is merged by its first two keys (the type scale whole).
 */
const SHAPE: readonly (readonly [string, string, ThemeField['kind'], (readonly ThemeOption[])?])[] =
  [
    [
      'radius/scale',
      'Corners',
      'choice',
      [
        ['Square', 0],
        ['Subtle', 0.5],
        ['Standard', 1],
        ['Round', 2],
        ['Extra round', 3],
      ],
    ],
    ['overrides/control.radius', 'Control corners', 'choice', [['Pill', '{radius.full}']]],
    ['motion/scale', 'Motion duration scale', 'number'],
    ['typography/scale/base', 'Font size md', 'length'],
    ['typography/scale/ratio', 'Font size ratio', 'number'],
    [
      'gamut',
      'Colour gamut',
      'choice',
      [
        ['sRGB', 'srgb'],
        ['Display P3 where supported', 'p3'],
      ],
    ],
  ];

/**
 * The form over a draft: only fields that apply to it (e.g. the chosen spacing strategy). For a
 * `product` (its `products` entry, with its theme among the bases), its brand inputs and role
 * overrides, the only values a product sets (multi-product.md §9).
 */
export function themeFields(
  config: unknown,
  bases: readonly ThemeBase[] = [],
  product = false,
): ThemeFieldGroup[] {
  const field = (
    path: ConfigPath,
    unit: ConfigPath,
    label: string,
    kind: ThemeField['kind'],
    origin: ValueOrigin,
    options?: readonly ThemeOption[],
  ): ThemeField => {
    const owner = ownerOf(config, bases, unit);
    return {
      path,
      label,
      kind,
      ...(options ? { options } : {}),
      origin,
      value: scalar(getPath(config, path)),
      unit,
      ...(owner
        ? { inherited: { file: owner.file, value: scalar(getPath(owner.config, path)) } }
        : {}),
    };
  };
  const groups: ThemeFieldGroup[] = [
    {
      id: 'inputs',
      title: 'Theme inputs',
      note: 'Foundation inputs: ramps and roles are generated from them.',
      fields: BRAND.filter(([group]) => !product || group === 'brand').map(([group, key, label]) =>
        field([group, key], [group, key], label, 'color', 'foundation input'),
      ),
    },
  ];
  const spacing = getPath(ownerOf(config, bases, ['spacing'])?.config ?? config, ['spacing']);
  const strategy = isRecord(spacing) ? spacing['strategy'] : undefined;
  if (!product)
    groups.push({
      id: 'spacing',
      title: 'Spacing',
      note:
        typeof strategy === 'string' && SPACING[strategy]
          ? `Strategy: ${strategy}. Change the strategy or its steps in the JSON editor.`
          : 'No spacing strategy configured: the generator default applies. Add `spacing` in the JSON editor.',
      fields: (typeof strategy === 'string' ? (SPACING[strategy] ?? []) : []).map(
        ([key, label, kind]) =>
          field(['spacing', key], ['spacing'], label, kind, 'foundation input'),
      ),
    });
  if (!product)
    groups.push({
      id: 'shape',
      title: 'Shape, motion, and type',
      note: 'Foundation inputs: the radius, duration, and font-size steps are generated from them.',
      fields: SHAPE.map(([text, label, kind, options]) => {
        const path = text.split('/');
        return field(
          path,
          path.slice(0, 2),
          label,
          kind,
          path[0] === 'overrides' ? 'explicit override' : 'foundation input',
          options,
        );
      }),
    });
  // Overrides merge by token, each replaced whole; null removes a base's (theming §1.1).
  const tokens = new Map<string, unknown>();
  for (const layer of [...bases, { config }]) {
    const overrides = getPath(layer.config, ['overrides']);
    if (overrides !== undefined && !isRecord(overrides)) tokens.clear();
    for (const [token, value] of isRecord(overrides) ? Object.entries(overrides) : [])
      if (value === null) tokens.delete(token);
      else tokens.set(token, value);
  }
  const entries = [...tokens];
  const modes = [
    ...new Set(entries.flatMap(([, value]) => (isRecord(value) ? Object.keys(value) : []))),
  ];
  groups.push({
    id: 'overrides',
    title: 'Role overrides',
    note: entries.length
      ? 'Explicit overrides win over generated values. Values are colours, lengths, or {aliases}.'
      : 'No explicit overrides: every role is generated.',
    fields: [],
    modes,
    rows: entries.map(([token, value]) => {
      const unit = ['overrides', token];
      const owner = ownerOf(config, bases, unit);
      const cell = (path: ConfigPath, label: string) =>
        field(path, unit, label, 'text', 'explicit override');
      return {
        token,
        cells: isRecord(value)
          ? modes.map((mode) => cell([...unit, mode], `${token} (${mode})`))
          : [cell(unit, token)],
        ...(owner ? { inherited: owner.file } : {}),
      };
    }),
  });
  return groups;
}

/** Whether `value` has `path` as its own keys (a JSON model has no undefined values). */
function owns(value: unknown, path: ConfigPath): boolean {
  let current = value;
  for (const key of path) {
    if (!isRecord(current) || !Object.hasOwn(current, key)) return false;
    current = current[key];
  }
  return true;
}

/** The nearest base that sets `unit`, when the draft does not. */
const ownerOf = (draft: unknown, bases: readonly ThemeBase[], unit: ConfigPath) =>
  owns(draft, unit) ? undefined : bases.findLast((base) => owns(base.config, unit));

/**
 * The draft with a form entry set. A value merged whole that the draft inherits (spacing, an
 * override's token) is first copied from the base that sets it, so the draft keeps the rest of it
 * (theming §1.1); bases are never changed. Clearing an inherited entry changes nothing.
 */
export function setField(
  draft: unknown,
  field: ThemeField,
  value: string | number | undefined,
  bases: readonly ThemeBase[] = [],
): unknown {
  const owner = ownerOf(draft, bases, field.unit);
  if (owner && value === undefined) return draft;
  const own = owner ? setPath(draft, field.unit, getPath(owner.config, field.unit)) : draft;
  return setPath(own, field.path, value);
}

/** A form entry as the configuration value it writes; empty clears the key. */
export function fieldValue(field: ThemeField, input: string): string | number | undefined {
  const text = input.trim();
  if (text === '') return undefined;
  const option = field.options?.find(([, value]) => String(value) === text);
  if (option) return option[1];
  if (field.kind === 'number' || field.kind === 'integer') {
    const number = Number(text);
    return Number.isFinite(number) ? number : text;
  }
  return text;
}

export interface DraftParse {
  readonly ok: boolean;
  readonly value?: Json;
  readonly message?: string;
}

/** The JSON editor's text as a draft; a syntax error never replaces the current draft. */
export function parseDraft(text: string): DraftParse {
  try {
    const value = JSON.parse(text) as Json;
    return isRecord(value)
      ? { ok: true, value }
      : { ok: false, message: 'A theme configuration is a JSON object.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** Export file names for a draft loaded from `source`: `./oddkin.theme.json` → `oddkin.theme.*`. */
export function exportNames(source: string | undefined): { config: string; css: string } {
  const stem = (source?.split(/[\\/]/).pop() ?? '').replace(/\.(?:json|[cm]?[jt]s)$/i, '');
  return { config: `${stem || 'theme'}.json`, css: `${stem || 'theme'}.css` };
}

/**
 * Why the draft cannot be exported now, or '' when it can. An export is always the draft shown,
 * once the generator has accepted it: never an older draft presented as the latest.
 */
export function exportBlocked(state: {
  readonly generator: boolean;
  /** The JSON editor's text does not parse, so the draft is not what it shows. */
  readonly jsonError: boolean;
  /** Why generation is unavailable, or ''. */
  readonly unavailable: string;
  /** A newer draft than the last result is being generated. */
  readonly pending: boolean;
  /** The last result's validity; undefined before the first. */
  readonly ok: boolean | undefined;
}): string {
  if (!state.generator) return 'Export needs the theme generator (see Method and limits).';
  if (state.jsonError) return 'The JSON has an error: fix it to export the draft shown.';
  if (state.unavailable) return `Generation unavailable: ${state.unavailable}`;
  if (state.pending || state.ok === undefined) return 'Generating the latest draft…';
  return state.ok ? '' : 'This draft is invalid: fix it to export.';
}
