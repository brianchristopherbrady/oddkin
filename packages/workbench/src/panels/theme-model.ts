/**
 * Theme Studio's editor model (workbench.md §6.3), DOM-free: the form fields a draft offers, in
 * groups that follow the design file's variable collections (theme inputs, then role overrides
 * with one column per mode), and immutable edits by configuration path. The form and the JSON
 * editor change the same draft; nothing here generates tokens.
 */

export type ConfigPath = readonly string[];
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** How a value enters the theme (workbench.md §6.3). */
export type ValueOrigin = 'foundation input' | 'explicit override';

export interface ThemeField {
  readonly path: ConfigPath;
  readonly label: string;
  readonly kind: 'color' | 'length' | 'number' | 'integer' | 'text';
  readonly origin: ValueOrigin;
  readonly value: string | number | undefined;
}

export interface OverrideRow {
  readonly token: string;
  /** One cell per mode; a single value applies to every mode. */
  readonly cells: readonly ThemeField[];
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

/** The form over a draft: only fields that apply to it (e.g. the chosen spacing strategy). */
export function themeFields(config: unknown): ThemeFieldGroup[] {
  const groups: ThemeFieldGroup[] = [
    {
      id: 'inputs',
      title: 'Theme inputs',
      note: 'Foundation inputs: ramps and roles are generated from them.',
      fields: BRAND.map(([group, key, label]) => ({
        path: [group, key],
        label,
        kind: 'color',
        origin: 'foundation input',
        value: scalar(getPath(config, [group, key])),
      })),
    },
  ];
  const spacing = getPath(config, ['spacing']);
  const strategy = isRecord(spacing) ? spacing['strategy'] : undefined;
  groups.push({
    id: 'spacing',
    title: 'Spacing',
    note:
      typeof strategy === 'string' && SPACING[strategy]
        ? `Strategy: ${strategy}. Change the strategy or its steps in the JSON editor.`
        : 'No spacing strategy configured: the generator default applies. Add `spacing` in the JSON editor.',
    fields: (typeof strategy === 'string' ? (SPACING[strategy] ?? []) : []).map(
      ([key, label, kind]) => ({
        path: ['spacing', key],
        label,
        kind,
        origin: 'foundation input' as const,
        value: scalar(getPath(config, ['spacing', key])),
      }),
    ),
  });
  const overrides = getPath(config, ['overrides']);
  const entries = isRecord(overrides) ? Object.entries(overrides) : [];
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
    rows: entries.map(([token, value]) => ({
      token,
      cells: isRecord(value)
        ? modes.map((mode) => ({
            path: ['overrides', token, mode],
            label: `${token} (${mode})`,
            kind: 'text' as const,
            origin: 'explicit override' as const,
            value: scalar(value[mode]),
          }))
        : [
            {
              path: ['overrides', token],
              label: token,
              kind: 'text' as const,
              origin: 'explicit override' as const,
              value: scalar(value),
            },
          ],
    })),
  });
  return groups;
}

/** A form entry as the configuration value it writes; empty clears the key. */
export function fieldValue(field: ThemeField, input: string): string | number | undefined {
  const text = input.trim();
  if (text === '') return undefined;
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
