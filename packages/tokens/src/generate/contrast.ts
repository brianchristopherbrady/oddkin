/**
 * Semantic colour contracts (theming-and-styling.md §10.4): WCAG 2.x checks of every contracted
 * role pair, explicit corrections for failures, and a full report for tools. Never changes a
 * value: corrections are suggestions the user applies as overrides.
 */
import type { Mode } from '../theme/types.js';
import { contrastRatio, parseColor, RAMP, toHex } from './color.js';
import { pointer, type ContrastCorrection, type DiagnosticList } from './diagnostics.js';
import { resolveLiteral, type TokenMap } from './graph.js';
import { CONTRAST_ROLES, PRESET_TOKENS, ROLE_CONTRACTS, type ContrastConcern } from './preset.js';
import type { ResolvedTheme } from './resolve.js';

/** One measured contract pair. */
export interface ContrastEntry {
  readonly concern: ContrastConcern;
  readonly foreground: string;
  readonly background: string;
  readonly mode: Mode;
  /** The product whose brand ramps were used; absent for the base theme. */
  readonly product?: string;
  readonly foregroundHex: string;
  readonly backgroundHex: string;
  /** Rounded down to two decimals, so a reported pass is never a rounding artefact. */
  readonly ratio: number;
  readonly minimum: number;
  readonly criterion: string;
  readonly status: 'pass' | 'fail' | 'exempt';
}

export function hexOf(tokens: TokenMap, name: string, mode: Mode): string | undefined {
  const literal = resolveLiteral(tokens, name, mode);
  if (literal === undefined) return undefined;
  if (/^#[0-9a-f]{6}$/i.test(literal.trim())) return literal.trim().toLowerCase();
  const parsed = parseColor(literal);
  return parsed ? toHex(parsed) : undefined;
}

const floor2 = (ratio: number) => Math.floor(ratio * 100) / 100;

/** Every contract pair present in `tokens`, measured in each mode. */
function measure(tokens: TokenMap, modes: readonly Mode[], product?: string): ContrastEntry[] {
  const out: ContrastEntry[] = [];
  for (const mode of modes) {
    for (const contract of ROLE_CONTRACTS) {
      if (!tokens.has(contract.foreground)) continue;
      const fg = hexOf(tokens, contract.foreground, mode);
      if (!fg) continue;
      for (const background of contract.backgrounds) {
        if (!tokens.has(background)) continue;
        const bg = hexOf(tokens, background, mode);
        if (!bg) continue;
        const ratio = contrastRatio(fg, bg);
        out.push({
          concern: contract.concern,
          foreground: contract.foreground,
          background,
          mode,
          ...(product === undefined ? {} : { product }),
          foregroundHex: fg,
          backgroundHex: bg,
          ratio: floor2(ratio),
          minimum: contract.minimum,
          criterion: contract.criterion,
          status: contract.minimum === 0 ? 'exempt' : ratio >= contract.minimum ? 'pass' : 'fail',
        });
      }
    }
  }
  return out;
}

/** Report every contract pair of a resolved theme, for the base theme and each product. */
export function contrastReport(theme: ResolvedTheme): ContrastEntry[] {
  const out = measure(theme.tokens, theme.modes);
  for (const scope of theme.scopes) {
    if (scope.kind !== 'product') continue;
    out.push(...measure(new Map([...theme.tokens, ...scope.tokens]), theme.modes, scope.name));
  }
  return out;
}

/** One measured pair in the emitted report, keyed by `foreground|background|mode[|product]`. */
export interface ContrastPair extends ContrastEntry {
  readonly id: string;
}

/** The role-pair contrast report the build writes as `<name>.contrast.json`. */
export interface ContrastReportFile {
  readonly version: 1;
  readonly theme: string;
  readonly method: string;
  readonly modes: readonly Mode[];
  readonly products: readonly string[];
  readonly summary: { readonly pass: number; readonly fail: number; readonly exempt: number };
  readonly pairs: readonly ContrastPair[];
}

/**
 * The report tools read (Theme Studio's contrast view): the declared role pairs only, measured
 * in every mode and product. A pair no contract declares is not in it; it is not certification.
 */
export function emitContrastReport(theme: ResolvedTheme): string {
  const pairs: ContrastPair[] = contrastReport(theme).map((entry) => ({
    id: [entry.foreground, entry.background, entry.mode, entry.product]
      .filter((part) => part !== undefined)
      .join('|'),
    ...entry,
  }));
  const count = (status: ContrastEntry['status']) =>
    pairs.filter((pair) => pair.status === status).length;
  const report: ContrastReportFile = {
    version: 1,
    theme: theme.name,
    method:
      'WCAG 2.2 contrast ratio of the resolved sRGB colours, rounded down to two decimals, for each declared role pair (theming-and-styling.md §10.4)',
    modes: theme.modes,
    products: theme.scopes.filter((scope) => scope.kind === 'product').map((scope) => scope.name),
    summary: { pass: count('pass'), fail: count('fail'), exempt: count('exempt') },
    pairs,
  };
  return `${JSON.stringify(report, null, 2)}\n`;
}

/** The reference ramp a role's preset value comes from, following aliases between roles. */
const RAMP_OF: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>(CONTRAST_ROLES.map((role) => [role.name, role.ramp]));
  const values = new Map(
    PRESET_TOKENS.map((t) => [t.name, typeof t.value === 'string' ? t.value : t.value.light]),
  );
  for (const name of values.keys()) {
    let value: string | undefined = values.get(name);
    for (let hops = 0; value && hops < 8; hops++) {
      const ref = /^\{ref\.([a-z]+)\.\d+\}$/.exec(value);
      if (ref) {
        if (!map.has(name)) map.set(name, ref[1] as string);
        break;
      }
      const alias = /^\{([^}]+)\}$/.exec(value)?.[1];
      if (alias && map.has(alias)) {
        if (!map.has(name)) map.set(name, map.get(alias) as string);
        break;
      }
      value = alias ? values.get(alias) : undefined;
    }
  }
  return map;
})();

/**
 * The reference step of the role's ramp closest in lightness to its current colour that meets
 * the minimum on every contracted background (failing and passing), or undefined when none does.
 */
function correction(
  tokens: TokenMap,
  entries: readonly ContrastEntry[],
): ContrastCorrection | undefined {
  const first = entries[0] as ContrastEntry;
  const ramp = RAMP_OF.get(first.foreground);
  if (!ramp) return undefined;
  const current = parseColor(first.foregroundHex)?.l ?? 0;
  const steps = RAMP.map((s) => s.step);
  if (ramp === 'neutral') steps.push(0, 1000);
  let best: { value: string; hex: string; ratio: number; distance: number } | undefined;
  for (const step of steps) {
    const name = `ref.${ramp}.${step}`;
    const hex = tokens.has(name) ? hexOf(tokens, name, first.mode) : undefined;
    if (!hex) continue;
    const ratios = entries.map((e) => contrastRatio(hex, e.backgroundHex));
    if (ratios.some((r, i) => r < (entries[i] as ContrastEntry).minimum)) continue;
    const distance = Math.abs((parseColor(hex)?.l ?? 0) - current);
    if (!best || distance < best.distance)
      best = { value: `{${name}}`, hex, ratio: floor2(Math.min(...ratios)), distance };
  }
  return (
    best && {
      token: first.foreground,
      mode: first.mode,
      value: best.value,
      hex: best.hex,
      ratio: best.ratio,
    }
  );
}

/**
 * One `contrast.fail` warning per foreground role and mode, naming every background it fails
 * on, with an explicit correction when a reference step of the role's ramp passes them all.
 */
export function checkContrast(
  tokens: TokenMap,
  modes: readonly Mode[],
  label: string,
  d: DiagnosticList,
): void {
  const measured = new Map<string, ContrastEntry[]>();
  for (const entry of measure(tokens, modes)) {
    if (entry.status === 'exempt') continue;
    const key = `${entry.mode}\u0000${entry.foreground}`;
    measured.set(key, [...(measured.get(key) ?? []), entry]);
  }
  const failingHexes = new Map<string, Set<string>>();
  for (const [key, entries] of measured)
    failingHexes.set(
      key,
      new Set(entries.filter((e) => e.status === 'fail').map((e) => e.backgroundHex)),
    );
  for (const entries of measured.values()) {
    const failing = entries.filter((e) => e.status === 'fail');
    if (!failing.length) continue;
    const { foreground, foregroundHex, mode } = failing[0] as ContrastEntry;
    // A role that aliases another contracted role (neutral.foreground → text.secondary) fails
    // with it; one warning, on the role to fix, is enough.
    const value = tokens.get(foreground)?.value;
    const alias = /^\{([^{}]+)\}$/.exec(
      (typeof value === 'string' ? value : value?.[mode]) ?? '',
    )?.[1];
    const aliased = alias ? failingHexes.get(`${mode}\u0000${alias}`) : undefined;
    if (aliased && failing.every((e) => aliased.has(e.backgroundHex))) continue;
    const overridden = failing.some(
      (e) =>
        tokens.get(e.foreground)?.origin === 'overridden' ||
        tokens.get(e.background)?.origin === 'overridden',
    );
    const pairs = failing
      .map(
        (e) => `on ${e.background} (${e.backgroundHex}) ${e.ratio.toFixed(2)}:1 < ${e.minimum}:1`,
      )
      .join('; ');
    const fix = correction(tokens, entries);
    const target =
      modes.length > 1 ? `overrides["${foreground}"].${mode}` : `overrides["${foreground}"]`;
    const suggestion = fix
      ? `Set ${target} to "${fix.value}" (${fix.hex}, at least ${fix.ratio.toFixed(2)}:1 on each), the closest step that passes, or change the background. Brand inputs are never changed automatically.`
      : 'No reference step of this role passes; choose another value or change the background. Brand inputs are never changed automatically.';
    d.items.push({
      code: 'contrast.fail',
      severity: 'warning',
      path: pointer('tokens', foreground),
      message: `${foreground} (${foregroundHex}) is below its contrast minimum in ${mode} mode${label}: ${pairs}${overridden ? ' (an override is involved)' : ''}.`,
      suggestion,
      ...(fix ? { correction: fix } : {}),
    });
  }
}
