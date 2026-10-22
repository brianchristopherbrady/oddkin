import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generate, parseColor, resolveToken, toHex, type ResolvedTheme } from '../src/index.js';

// Figma parity: every variable, text style, and effect style in the committed Figma snapshot
// (design/figma/variables.json, a read-only export) equals a token of the default theme, light and
// dark. Reads only the snapshot, never Figma. px compare with rem at 16 px; colours as lower-case hex.

type Mode = 'light' | 'dark';
type Value = { value: string | number | boolean } | { alias: string };
interface Variable {
  name: string;
  type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  codeSyntax?: { WEB?: string };
  valuesByMode: Record<string, Value>;
}
interface Collection {
  name: string;
  modes: { id: string; name: string }[];
  defaultModeId: string;
  variables: Variable[];
}
interface UnitValue {
  unit: 'PIXELS' | 'PERCENT' | 'AUTO';
  value?: number;
}
interface TextStyle {
  name: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: UnitValue;
  letterSpacing: UnitValue;
}
interface Effect {
  type: string;
  visible: boolean;
  color?: string;
  alpha?: number;
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}
interface Snapshot {
  collections: Collection[];
  textStyles: TextStyle[];
  effectStyles: { name: string; effects: Effect[] }[];
}

const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const snapshot = read('../../../design/figma/variables.json') as Snapshot;
const schema = read('../../../design/figma/variables.schema.json') as object;
const theme = generate(read('../themes/default.theme.json')).theme as ResolvedTheme;

/** One Figma value compared with one token in one mode. */
interface Pair {
  figmaMode: string;
  token: string;
  mode: Mode;
}

const BOTH: readonly Mode[] = ['light', 'dark'];
const MODE_NAMES: Record<string, Mode> = { Light: 'light', Dark: 'dark' };
const dots = (path: string) => path.replaceAll('/', '.');

/**
 * Shared theme names that are not `theme/<mode>/<token path>`: legacy aliases kept in Figma.
 * `null`: no token by design (reported as Figma-only).
 */
const SHARED_THEME_NAMES: Record<string, readonly [token: string, ...modes: Mode[]] | null> = {
  'color/accent': ['color.action.default', 'light'],
  'color/action-hover': ['color.action.hover', 'light'],
  'color/action-pressed': ['color.action.pressed', 'light'],
  'color/border': ['color.border.default', 'light'],
  'color/border-strong': ['color.border.strong', 'light'],
  'color/canvas': ['color.canvas', 'light'],
  'color/citron': ['color.accent.decorative', 'light', 'dark'],
  'color/dark': ['color.canvas', 'dark'],
  'color/dark-accent': ['color.action.default', 'dark'],
  'color/dark-border': ['color.border.default', 'dark'],
  'color/dark-muted': ['color.text.secondary', 'dark'],
  'color/dark-surface': ['color.surface.default', 'dark'],
  'color/dark-text': ['color.text.primary', 'dark'],
  'color/error': ['color.danger.foreground', 'light'],
  'color/error-surface': ['color.danger.surface', 'light'],
  'color/focus': ['color.focus.ring', 'light'],
  'color/muted': ['color.text.secondary', 'light'],
  'color/specimen': ['color.surface.specimen', 'light'],
  'color/success': ['color.success.foreground', 'light'],
  'color/surface': ['color.surface.default', 'light'],
  'color/text': ['color.text.primary', 'light'],
  'color/warning': ['color.warning.foreground', 'light'],
  'preview/draft/action': ['color.action.default', 'light'],
  'preview/draft/dark': ['color.surface.default', 'dark'],
  'radius/brand': ['radius.md', 'light', 'dark'],
  'radius/card': ['card.radius', 'light', 'dark'],
  'radius/control': ['control.radius', 'light', 'dark'],
  'radius/workspace': ['radius.lg', 'light', 'dark'],
  'space/4': ['space.2xs', 'light', 'dark'],
  'space/8': ['space.xs', 'light', 'dark'],
  'space/12': ['space.sm', 'light', 'dark'],
  'space/16': ['space.md', 'light', 'dark'],
  'space/24': ['space.lg', 'light', 'dark'],
  'space/32': ['space.xl', 'light', 'dark'],
  // Named 40 but aliases repo/space/xl (32 px); the spacing scale has no 40 px step.
  'space/40': null,
  'space/48': ['space.2xl', 'light', 'dark'],
  'space/64': ['space.3xl', 'light', 'dark'],
};

/** The mapping table: Figma variable → token pairs, per collection. */
function pairs(collection: Collection, variable: Variable): Pair[] | null | undefined {
  const figmaModes = Object.keys(variable.valuesByMode);
  switch (collection.name) {
    case 'Oddkin · Component roles':
      // Light/Dark modes; variable names are token paths.
      return figmaModes.map((m) => ({
        figmaMode: m,
        token: dots(variable.name),
        mode: MODE_NAMES[m] as Mode,
      }));
    case 'Oddkin · Repository tokens': {
      // One mode; `repo/<token path>[/light|/dark]`, no suffix = the same value in both modes.
      const match = /^repo\/(.+?)(?:\/(light|dark))?$/.exec(variable.name);
      if (!match) return undefined;
      const modes = match[2] ? [match[2] as Mode] : BOTH;
      return modes.map((mode) => ({
        figmaMode: figmaModes[0] as string,
        token: dots(match[1] as string),
        mode,
      }));
    }
    case 'Oddkin · Shared theme': {
      // One mode named Light; `theme/<light|dark>/<token path>`, plus legacy names.
      const match = /^theme\/(light|dark)\/(.+)$/.exec(variable.name);
      if (match) {
        return [
          {
            figmaMode: figmaModes[0] as string,
            token: dots(match[2] as string),
            mode: match[1] as Mode,
          },
        ];
      }
      const entry = SHARED_THEME_NAMES[variable.name];
      if (entry === undefined) return undefined;
      if (entry === null) return null;
      const [token, ...modes] = entry;
      return modes.map((mode) => ({ figmaMode: figmaModes[0] as string, token, mode }));
    }
    default:
      return undefined;
  }
}

/** Text styles → type role (`type.<role>.*`) or the four foundation tokens a component style uses. */
type TextTarget =
  string | { size: string; weight: string; lineHeight: string; letterSpacing: string };
const foundation = (size: string, weight: string, lineHeight: string): TextTarget => ({
  size: `font.size.${size}`,
  weight: `font.weight.${weight}`,
  lineHeight: `line-height.${lineHeight}`,
  letterSpacing: 'letter-spacing.normal',
});
const TEXT_STYLES: Record<string, TextTarget> = {
  'Oddkin/Body': 'body',
  'Oddkin/Card title': 'title',
  'Oddkin/Code': 'code',
  'Oddkin/Component/AI/title': foundation('md', 'semibold', 'normal'),
  'Oddkin/Component/Button/lg': foundation('md', 'medium', 'snug'),
  'Oddkin/Component/Button/md': 'ui',
  'Oddkin/Component/Button/sm': 'ui',
  'Oddkin/Component/Field/small': foundation('sm', 'regular', 'normal'),
  'Oddkin/Component/Navigation/current': foundation('sm', 'semibold', 'snug'),
  'Oddkin/Component/Status': foundation('xs', 'medium', 'normal'),
  'Oddkin/Display': 'display',
  'Oddkin/Eyebrow': 'eyebrow',
  'Oddkin/Home display': 'display',
  'Oddkin/Section': 'section',
  'Oddkin/Small': 'small',
  'Oddkin/UI': 'ui',
  'Oddkin/Wordmark': 'section',
};
const FONT_STYLES: Record<string, number> = { Regular: 400, Medium: 500, SemiBold: 600, Bold: 700 };

const byPath = new Map<string, { collection: Collection; variable: Variable }>();
for (const collection of snapshot.collections) {
  for (const variable of collection.variables) {
    byPath.set(`${collection.name}/${variable.name}`, { collection, variable });
  }
}

/** Follow aliases; an alias into another collection reads the same mode name, else its default. */
function figmaValue(
  variable: Variable,
  figmaMode: string,
  seen = new Set<string>(),
): string | number | boolean {
  const value = variable.valuesByMode[figmaMode] as Value;
  if ('value' in value) return value.value;
  if (seen.has(value.alias)) throw new Error(`alias cycle at ${value.alias}`);
  seen.add(value.alias);
  const target = byPath.get(value.alias);
  if (!target) throw new Error(`unresolved alias ${value.alias}`);
  const { collection, variable: next } = target;
  const mode =
    figmaMode in next.valuesByMode
      ? figmaMode
      : (collection.modes.find((m) => m.id === collection.defaultModeId)?.name as string);
  return figmaValue(next, mode, seen);
}

/** A repository length in px at a 16 px root; plain numbers stay as they are. */
function px(literal: string): number | undefined {
  const match = /^(-?[\d.]+)(rem|px|em)?$/.exec(literal.trim());
  if (!match) return undefined;
  const n = Number(match[1]);
  return match[2] === 'rem' ? n * 16 : n;
}
const round = (n: number) => Math.round(n * 1000) / 1000;
const hex = (literal: string) => {
  const parsed = parseColor(literal);
  return parsed ? toHex(parsed) : literal;
};
const repo = (token: string, mode: Mode) => resolveToken(theme, token, { mode });

/** The theme's definition of a token in a mode when it is exactly one `{reference}`. */
function aliasOf(token: string, mode: Mode): string | undefined {
  const value = theme.tokens.get(token)?.value;
  const text = typeof value === 'object' ? value[mode] : value;
  return text === undefined ? undefined : /^\{([^{}]+)\}$/.exec(text)?.[1];
}

interface Report {
  matches: number;
  mismatches: string[];
  figmaOnly: string[];
  repoOnly: string[];
  codeSyntax: string[];
  aliasGaps: string[];
}

/** A compared token and every token its value references count as present in Figma. */
function cover(covered: Set<string>, token: string) {
  if (covered.has(token)) return;
  covered.add(token);
  for (const [, name] of JSON.stringify(theme.tokens.get(token)?.value ?? '').matchAll(
    /\{([^{}]+)\}/g,
  )) {
    cover(covered, name as string);
  }
}

function compareVariables(report: Report, covered: Set<string>) {
  for (const collection of snapshot.collections) {
    for (const variable of collection.variables) {
      const id = `${collection.name}/${variable.name}`;
      const list = pairs(collection, variable);
      if (list === undefined) {
        report.figmaOnly.push(`${id}: not in the mapping table`);
        continue;
      }
      if (list === null) {
        report.figmaOnly.push(`${id}: no token by design`);
        continue;
      }
      const gaps = new Set<string>();
      for (const { figmaMode, token, mode } of list) {
        const literal = repo(token, mode);
        if (literal === undefined) {
          report.figmaOnly.push(`${id}: no token ${token}`);
          continue;
        }
        cover(covered, token);
        const alias = aliasOf(token, mode);
        if ('value' in (variable.valuesByMode[figmaMode] as Value) && alias !== undefined) {
          gaps.add(`${id} → ${alias}`);
        }
        const raw = figmaValue(variable, figmaMode);
        const [figma, ours] =
          variable.type === 'COLOR'
            ? [String(raw).toLowerCase(), hex(literal)]
            : [String(round(Number(raw))), String(round(px(literal) ?? Number.NaN))];
        if (figma === ours) report.matches += 1;
        else
          report.mismatches.push(
            `${id} [${figmaMode}] vs ${token} (${mode}): figma ${figma}, repo ${ours}`,
          );
      }
      report.aliasGaps.push(...gaps);
      const web = variable.codeSyntax?.WEB;
      if (
        web !== undefined &&
        list[0] &&
        web !== `var(--odd-${list[0].token.replaceAll('.', '-')})`
      ) {
        report.codeSyntax.push(`${id}: ${web} vs ${list[0].token}`);
      }
    }
  }
}

function compareTextStyles(report: Report, covered: Set<string>) {
  for (const style of snapshot.textStyles) {
    const target = TEXT_STYLES[style.name];
    if (target === undefined) {
      report.figmaOnly.push(`text style ${style.name}: not in the mapping table`);
      continue;
    }
    const tokens =
      typeof target === 'string'
        ? {
            size: `type.${target}.size`,
            weight: `type.${target}.weight`,
            lineHeight: `type.${target}.line-height`,
            letterSpacing: `type.${target}.letter-spacing`,
          }
        : target;
    const size = style.fontSize;
    const lineHeight =
      style.lineHeight.unit === 'PIXELS'
        ? (style.lineHeight.value as number) / size
        : style.lineHeight.unit === 'PERCENT'
          ? (style.lineHeight.value as number) / 100
          : Number.NaN;
    const letterSpacing =
      style.letterSpacing.unit === 'PERCENT'
        ? (style.letterSpacing.value as number) / 100
        : (style.letterSpacing.value as number) / size;
    const checks: [field: string, token: string, figma: number, ours: number | undefined][] = [
      ['size', tokens.size, size, px(repo(tokens.size, 'light') ?? '')],
      [
        'weight',
        tokens.weight,
        FONT_STYLES[style.fontStyle] ?? Number.NaN,
        px(repo(tokens.weight, 'light') ?? ''),
      ],
      ['line height', tokens.lineHeight, lineHeight, px(repo(tokens.lineHeight, 'light') ?? '')],
      // Letter spacing tokens are em (or 0): compare the em factor.
      [
        'letter spacing',
        tokens.letterSpacing,
        letterSpacing,
        px(repo(tokens.letterSpacing, 'light') ?? ''),
      ],
    ];
    for (const [field, token, figma, ours] of checks) {
      cover(covered, token);
      if (ours !== undefined && round(figma) === round(ours)) report.matches += 1;
      else
        report.mismatches.push(
          `text style ${style.name} ${field} vs ${token}: figma ${round(figma)}, repo ${ours}`,
        );
    }
  }
}

/** `0 1px 2px rgb(0 0 0 / 0.08), …` → comparable layers. */
function shadowLayers(literal: string): string[] {
  if (literal.trim() === 'none') return [];
  return literal.split(/,(?![^(]*\))/).map((layer) => {
    const color = /rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/.exec(layer);
    const lengths = layer
      .replace(/rgb\([^)]*\)/, '')
      .trim()
      .split(/\s+/)
      .map((l) => px(l));
    while (lengths.length < 4) lengths.push(0);
    const rgb = color
      ? `#${color
          .slice(1, 4)
          .map((c) => Number(c).toString(16).padStart(2, '0'))
          .join('')}`
      : '?';
    return `${lengths.join(' ')} ${rgb}/${color ? Number(color[4]) : '?'}`;
  });
}

function compareEffects(report: Report, covered: Set<string>) {
  for (const style of snapshot.effectStyles) {
    const match = /^Oddkin\/Elevation\/([^/]+)\/(light|dark)$/.exec(style.name);
    if (!match) {
      report.figmaOnly.push(`effect style ${style.name}: not in the mapping table`);
      continue;
    }
    const token = `elevation.${match[1]}`;
    const literal = repo(token, match[2] as Mode);
    if (literal === undefined) {
      report.figmaOnly.push(`effect style ${style.name}: no token ${token}`);
      continue;
    }
    cover(covered, token);
    const figma = style.effects
      .filter((e) => e.visible && e.type === 'DROP_SHADOW')
      .map((e) => `${e.offset?.x} ${e.offset?.y} ${e.radius} ${e.spread} ${e.color}/${e.alpha}`);
    const ours = shadowLayers(literal);
    if (JSON.stringify(figma) === JSON.stringify(ours)) report.matches += 1;
    else
      report.mismatches.push(
        `effect style ${style.name} vs ${token} (${match[2]}): figma ${figma.join(', ')}; repo ${ours.join(', ')}`,
      );
  }
}

function parity(): Report {
  const report: Report = {
    matches: 0,
    mismatches: [],
    figmaOnly: [],
    repoOnly: [],
    codeSyntax: [],
    aliasGaps: [],
  };
  const covered = new Set<string>();
  compareVariables(report, covered);
  compareTextStyles(report, covered);
  compareEffects(report, covered);
  report.repoOnly = [...theme.tokens.keys()].filter((name) => !covered.has(name)).sort();
  return report;
}

const report = parity();

// Figma-side issues for the owner. Fixing one in Figma and refreshing the snapshot fails the test
// until the entry is removed here, so the lists stay current.
const REPOSITORY = 'Oddkin · Repository tokens/repo/';
/** Unsuffixed duplicates of the light values, read as both modes: wrong in dark. */
const MISMATCHES = [
  `${REPOSITORY}color/selection/background [Mode 1] vs color.selection.background (dark): figma #6250e8, repo #b4a8ff`,
  `${REPOSITORY}color/selection/foreground [Mode 1] vs color.selection.foreground (dark): figma #ffffff, repo #23252b`,
];
const FIGMA_ONLY = ['Oddkin · Shared theme/space/40: no token by design'];
/** Figma literals where the theme aliases another token (the alias chain is flattened). */
const ALIAS_GAPS = (
  [
    ['card/padding', 'layout.inset'],
    ['card/radius', 'radius.lg'],
    ...['link', 'focus/ring'].flatMap((role) =>
      ['light', 'dark'].map((mode) => [`color/${role}/${mode}`, 'color.action.default']),
    ),
    ...['surface/default', 'surface/raised', 'text/on-action'].map((role) => [
      `color/${role}/light`,
      'ref.neutral.0',
    ]),
    ['color/selection/background', 'color.action.default'],
    ['color/selection/background/dark', 'color.action.default'],
    ['color/selection/background/light', 'color.action.default'],
    ['color/selection/foreground', 'color.text.on-action'],
    ['color/selection/foreground/dark', 'color.text.on-action'],
    ['color/selection/foreground/light', 'color.text.on-action'],
    ['control/gap', 'space.xs'],
    ['control/padding/inline/lg', 'space.md'],
    ['control/padding/inline/md', 'space.sm'],
    ['control/padding/inline/sm', 'space.xs'],
    ['control/radius', 'radius.md'],
    ['layout/gap', 'space.md'],
    ['layout/inset', 'space.lg'],
    ['navigation/indent', 'space.md'],
    ['navigation/item/gap', 'space.xs'],
    ['navigation/item/min-height', 'control.height.md'],
    ['navigation/item/padding/block', 'space.xs'],
    ['navigation/item/padding/inline', 'space.sm'],
    ...['body', 'code', 'section', 'small', 'title', 'ui'].map((role) => [
      `type/${role}/letter-spacing`,
      'letter-spacing.normal',
    ]),
    ['type/body/size', 'font.size.md'],
    ['type/code/size', 'font.size.sm'],
    ['type/display/size', 'font.size.4xl'],
    ['type/eyebrow/size', 'font.size.xs'],
    ['type/section/size', 'font.size.2xl'],
    ['type/small/size', 'font.size.xs'],
    ['type/title/size', 'font.size.xl'],
    ['type/ui/size', 'font.size.sm'],
  ] as const
).map(([name, alias]) => `${REPOSITORY}${name} → ${alias}`);
/**
 * Tokens with no Figma variable or style: font stacks (Figma substitutes Roboto and Roboto Mono, so
 * text widths are not a contract), motion, stacking, and three unused foundation steps.
 */
const REPO_ONLY = [
  ...['display', 'mono', 'sans'].map((name) => `font.family.${name}`),
  'font.weight.bold',
  'line-height.none',
  'line-height.relaxed',
  ...['fast', 'normal', 'slow', 'slower'].map((name) => `motion.duration.${name}`),
  ...['enter', 'exit', 'linear', 'standard'].map((name) => `motion.easing.${name}`),
  ...['body', 'code', 'display', 'eyebrow', 'section', 'small', 'title', 'ui'].map(
    (role) => `type.${role}.family`,
  ),
  ...['base', 'overlay', 'raised', 'sticky'].map((name) => `z-index.${name}`),
];

describe('Figma parity (design/figma/variables.json)', () => {
  it('the snapshot matches its schema and is sorted by name', () => {
    const validate = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true }).compile(
      schema,
    );
    expect(validate(snapshot), JSON.stringify(validate.errors)).toBe(true);
    const sorted = (names: string[]) => [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const names = (list: { name: string }[]) => list.map((x) => x.name);
    expect(names(snapshot.collections)).toEqual(sorted(names(snapshot.collections)));
    for (const c of snapshot.collections)
      expect(names(c.variables)).toEqual(sorted(names(c.variables)));
    expect(names(snapshot.textStyles)).toEqual(sorted(names(snapshot.textStyles)));
    expect(names(snapshot.effectStyles)).toEqual(sorted(names(snapshot.effectStyles)));
  });

  it('maps every variable, text style, and effect style to a token of the default theme', () => {
    expect(report.figmaOnly).toEqual(FIGMA_ONLY);
    // Web code syntax in Figma names the token the variable maps to.
    expect(report.codeSyntax).toEqual([]);
  });

  it('has equal values in light and dark, except the listed Figma-side issues', () => {
    expect(report.mismatches).toEqual(MISMATCHES);
    // 535 variable pairs (one per mode a variable stands for), 4 per text style, 1 per effect style.
    expect(report.matches).toBe(613);
  });

  it('reports Figma literals where the theme aliases another token', () => {
    expect([...report.aliasGaps].sort()).toEqual([...ALIAS_GAPS].sort());
  });

  it('reports the tokens Figma does not define', () => {
    expect(report.repoOnly).toEqual([...REPO_ONLY].sort());
  });
});
