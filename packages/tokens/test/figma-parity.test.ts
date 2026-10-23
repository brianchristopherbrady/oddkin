import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generate, parseColor, resolveToken, toHex, type ResolvedTheme } from '../src/index.js';

// Figma parity: every variable, text style, and effect style in the committed Figma snapshot
// (design/figma/variables.json, a read-only export) equals a token of the default theme, light and
// dark. Reads only the snapshot, never Figma. px compare with rem at 16 px; colours as lower-case hex.

type Mode = 'light' | 'dark';
type Literal = { value: string | number | boolean; alpha?: number };
type Value = Literal | { alias: string };
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
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: UnitValue;
  letterSpacing: UnitValue;
  boundVariables?: Record<string, string>;
}
interface Effect {
  type: string;
  visible: boolean;
  color?: string;
  alpha?: number;
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
  boundVariables?: Record<string, string>;
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

const REPOSITORY_COLLECTION = 'Oddkin · Repository tokens';
const COMPONENT_ROLES = 'Oddkin · Component roles';
const REPOSITORY = `${REPOSITORY_COLLECTION}/repo/`;

/** Figma cannot use CSS font stacks; these two explicit adapters retain the chosen fallbacks. */
const FONT_ADAPTERS: Record<string, { family: string; sources: string[] }> = {
  [`${REPOSITORY_COLLECTION}/figma/font/family/sans`]: {
    family: 'Roboto',
    sources: ['font.family.sans', 'font.family.display'],
  },
  [`${REPOSITORY_COLLECTION}/figma/font/family/mono`]: {
    family: 'Roboto Mono',
    sources: ['font.family.mono'],
  },
};

/** A CSS shadow is an effect style; its two color adapters supply the per-mode alpha. */
const SHADOW_ADAPTERS: Record<string, { token: string; layer: number }> = {
  [`${COMPONENT_ROLES}/figma/elevation/md/key`]: { token: 'elevation.md', layer: 0 },
  [`${COMPONENT_ROLES}/figma/elevation/md/ambient`]: { token: 'elevation.md', layer: 1 },
};

/** The mapping table: Figma variable → token pairs, per collection. */
function pairs(collection: Collection, variable: Variable): Pair[] | undefined {
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
  'Oddkin/Component/Field/small': foundation('sm', 'regular', 'normal'),
  'Oddkin/Component/Navigation/current': foundation('sm', 'semibold', 'snug'),
  'Oddkin/Component/Status': foundation('xs', 'medium', 'normal'),
  'Oddkin/Display': 'display',
  'Oddkin/Eyebrow': 'eyebrow',
  'Oddkin/Section': 'section',
  'Oddkin/Small': 'small',
  'Oddkin/UI': 'ui',
};
const FONT_STYLES: Record<string, number> = { Regular: 400, Medium: 500, SemiBold: 600, Bold: 700 };

const byPath = new Map<string, { collection: Collection; variable: Variable }>();
for (const collection of snapshot.collections) {
  for (const variable of collection.variables) {
    byPath.set(`${collection.name}/${variable.name}`, { collection, variable });
  }
}

/** Follow aliases; an alias into another collection reads the same mode name, else its default. */
function figmaLiteral(variable: Variable, figmaMode: string, seen = new Set<string>()): Literal {
  const value = variable.valuesByMode[figmaMode] as Value;
  if ('value' in value) return value;
  if (seen.has(value.alias)) throw new Error(`alias cycle at ${value.alias}`);
  seen.add(value.alias);
  const target = byPath.get(value.alias);
  if (!target) throw new Error(`unresolved alias ${value.alias}`);
  const { collection, variable: next } = target;
  const mode =
    figmaMode in next.valuesByMode
      ? figmaMode
      : (collection.modes.find((m) => m.id === collection.defaultModeId)?.name as string);
  return figmaLiteral(next, mode, seen);
}

function figmaValue(variable: Variable, mode: string): Literal['value'] {
  return figmaLiteral(variable, mode).value;
}

function boundLiteral(path: string, mode: string): Literal {
  const target = byPath.get(path);
  if (!target) throw new Error(`unresolved binding ${path}`);
  const { collection, variable } = target;
  const figmaMode =
    mode in variable.valuesByMode
      ? mode
      : (collection.modes.find((m) => m.id === collection.defaultModeId)?.name as string);
  return figmaLiteral(variable, figmaMode);
}

/** The separate alpha keeps shadow precision that 8-bit hex cannot represent. */
function colorSignature(entry: Literal): string {
  const value = String(entry.value);
  const alpha = entry.alpha ?? (value.length === 9 ? Number.parseInt(value.slice(7), 16) / 255 : 1);
  return `${value.slice(0, 7)}/${round(alpha)}`;
}

function repositoryPath(token: string, mode: Mode): string {
  const path = `${REPOSITORY}${token.replaceAll('.', '/')}`;
  return byPath.has(`${path}/${mode}`) ? `${path}/${mode}` : path;
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
      const font = FONT_ADAPTERS[id];
      if (font) {
        for (const source of font.sources) cover(covered, source);
        for (const mode of BOTH) {
          const raw = figmaValue(variable, Object.keys(variable.valuesByMode)[0] as string);
          if (variable.type === 'STRING' && raw === font.family) report.matches += 1;
          else report.mismatches.push(`${id} (${mode}): figma ${raw}, fallback ${font.family}`);
        }
        continue;
      }
      const shadow = SHADOW_ADAPTERS[id];
      if (shadow) {
        cover(covered, shadow.token);
        for (const [figmaMode, mode] of Object.entries(MODE_NAMES)) {
          const actual = colorSignature(figmaLiteral(variable, figmaMode));
          const expected = shadowLayers(repo(shadow.token, mode) ?? '')
            [shadow.layer]?.split(' ')
            .at(-1);
          if (variable.type === 'COLOR' && actual === expected) report.matches += 1;
          else report.mismatches.push(`${id} (${mode}): figma ${actual}, repo ${expected}`);
        }
        continue;
      }
      const list = pairs(collection, variable);
      if (list === undefined) {
        report.figmaOnly.push(`${id}: not in the mapping table`);
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
        const expectedAlias =
          collection.name === COMPONENT_ROLES
            ? repositoryPath(token, mode)
            : alias === undefined
              ? undefined
              : repositoryPath(alias, mode);
        const stored = variable.valuesByMode[figmaMode] as Value;
        if (expectedAlias && ('value' in stored || stored.alias !== expectedAlias)) {
          gaps.add(`${id} [${figmaMode}] → ${expectedAlias}`);
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
    if (typeof target === 'string') cover(covered, `type.${target}.family`);
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
    const mappings: { token: string; mode: Mode }[] =
      style.name === 'Oddkin/Overlay'
        ? BOTH.map((mode) => ({ token: 'elevation.md', mode }))
        : match
          ? [{ token: `elevation.${match[1]}`, mode: match[2] as Mode }]
          : [];
    if (!mappings.length) {
      report.figmaOnly.push(`effect style ${style.name}: not in the mapping table`);
      continue;
    }
    for (const { token, mode } of mappings) {
      const literal = repo(token, mode);
      if (literal === undefined) {
        report.figmaOnly.push(`effect style ${style.name}: no token ${token}`);
        continue;
      }
      cover(covered, token);
      const figmaMode = mode === 'light' ? 'Light' : 'Dark';
      const figma = style.effects
        .filter((e) => e.visible && e.type === 'DROP_SHADOW')
        .map((e) => {
          const binding = e.boundVariables?.color;
          const color = binding
            ? colorSignature(boundLiteral(binding, figmaMode))
            : `${e.color}/${e.alpha}`;
          const number = (field: string, fallback: number | undefined) => {
            const path = e.boundVariables?.[field];
            return path ? Number(boundLiteral(path, figmaMode).value) : fallback;
          };
          return `${number('offsetX', e.offset?.x)} ${number('offsetY', e.offset?.y)} ${number('radius', e.radius)} ${number('spread', e.spread)} ${color}`;
        });
      const ours = shadowLayers(literal);
      if (JSON.stringify(figma) === JSON.stringify(ours)) report.matches += 1;
      else
        report.mismatches.push(
          `effect style ${style.name} vs ${token} (${mode}): figma ${figma.join(', ')}; repo ${ours.join(', ')}`,
        );
    }
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

/**
 * Remaining coverage gaps: unused foundation steps, motion, stacking, info tones, the non-neutral
 * tone borders, and scrim. Font stacks are represented by the explicit Figma fallback adapters.
 */
const REPO_ONLY = [
  'font.weight.bold',
  'line-height.none',
  'line-height.relaxed',
  ...['fast', 'normal', 'slow', 'slower'].map((name) => `motion.duration.${name}`),
  ...['enter', 'exit', 'linear', 'standard'].map((name) => `motion.easing.${name}`),
  ...['base', 'overlay', 'raised', 'sticky'].map((name) => `z-index.${name}`),
  ...['info', 'success', 'warning', 'danger'].map((tone) => `color.${tone}.border`),
  ...['foreground', 'surface'].map((part) => `color.info.${part}`),
  ...[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => `ref.info.${step}`),
  'color.scrim',
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
    expect(report.figmaOnly).toEqual([]);
    // Web code syntax in Figma names the token the variable maps to.
    expect(report.codeSyntax).toEqual([]);
  });

  it('has equal values in light and dark with no known mismatches', () => {
    expect(report.mismatches).toEqual([]);
    // 470 token pairs, 8 adapter checks, 52 type metrics, 10 static and 2 themed effect checks.
    expect(report.matches).toBe(542);
  });

  it('preserves repository alias chains, including their exact targets', () => {
    expect(report.aliasGaps).toEqual([]);
  });

  it('keeps retired collections, selection variables, and duplicate text styles out of the snapshot', () => {
    expect(snapshot.collections.map((c) => c.name)).toEqual([
      COMPONENT_ROLES,
      REPOSITORY_COLLECTION,
    ]);
    const repository = snapshot.collections.find(
      (c) => c.name === REPOSITORY_COLLECTION,
    ) as Collection;
    for (const name of ['repo/color/selection/background', 'repo/color/selection/foreground']) {
      expect(repository.variables.map((v) => v.name)).not.toContain(name);
    }
    expect(snapshot.textStyles.map((s) => s.name).sort()).toEqual(Object.keys(TEXT_STYLES).sort());
  });

  it('binds text styles to canonical variables while preserving proportional metrics', () => {
    for (const style of snapshot.textStyles) {
      const target = TEXT_STYLES[style.name] as TextTarget;
      const size = typeof target === 'string' ? `type.${target}.size` : target.size;
      const weight = typeof target === 'string' ? `type.${target}.weight` : target.weight;
      const letter =
        typeof target === 'string' ? `type.${target}.letter-spacing` : target.letterSpacing;
      const family = `${REPOSITORY_COLLECTION}/figma/font/family/${target === 'code' ? 'mono' : 'sans'}`;
      expect(style.boundVariables?.fontSize, style.name).toBe(repositoryPath(size, 'light'));
      expect(style.boundVariables?.fontWeight, style.name).toBe(repositoryPath(weight, 'light'));
      expect(style.boundVariables?.fontFamily, style.name).toBe(family);
      expect(style.fontFamily, style.name).toBe(FONT_ADAPTERS[family]?.family);
      // Binding these relative CSS metrics would convert them to fixed pixels in Figma.
      expect(style.lineHeight.unit, style.name).toBe('PERCENT');
      if (style.letterSpacing.value === 0) {
        expect(style.boundVariables?.letterSpacing, style.name).toBe(
          repositoryPath(letter, 'light'),
        );
      } else expect(style.letterSpacing.unit, style.name).toBe('PERCENT');
    }
  });

  it('reports the tokens Figma does not define', () => {
    expect(report.repoOnly).toEqual([...REPO_ONLY].sort());
  });
});
