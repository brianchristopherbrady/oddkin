/**
 * `@oddkin/tokens/generate` — the only token engine. Pure, deterministic, DOM-free, and
 * free of Node APIs, so the CLI, a browser, and a Worker produce identical bytes.
 */
import { emitCss, type CssOptions } from './css.js';
import type { Diagnostic } from './diagnostics.js';
import { resolveTheme, type ResolvedTheme } from './resolve.js';

export interface GenerateResult {
  /** False when any error diagnostic was reported; outputs are then omitted. */
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly theme?: ResolvedTheme;
  readonly css?: string;
}

export interface GenerateOptions {
  /** CSS emission options (cascade layer). */
  readonly css?: CssOptions;
}

/** Validate a configuration and produce the resolved theme and its CSS. */
export function generate(config: unknown, options: GenerateOptions = {}): GenerateResult {
  const { theme, diagnostics } = resolveTheme(config);
  const ok = theme !== undefined && !diagnostics.some((d) => d.severity === 'error');
  if (!ok || !theme) return { ok: false, diagnostics };
  return { ok, diagnostics, theme, css: emitCss(theme, options.css) };
}

export { emitCss, cssStats, DEFAULT_TOKEN_LAYER, isLayerName, LAYER_ORDER } from './css.js';
export type { CssOptions } from './css.js';
export {
  emitConditionsModule,
  emitInspectJson,
  emitRefsModule,
  emitTokenNameType,
  emitValuesModule,
  valuesTree,
} from './ts.js';
export { resolveTheme, resolveToken } from './resolve.js';
export type { ResolveContext, ResolvedTheme, ResolveResult, ScopeTokens } from './resolve.js';
export type { ContrastCorrection, Diagnostic, DiagnosticSeverity } from './diagnostics.js';
export { contrastReport, emitContrastReport } from './contrast.js';
export { DTCG_EXTENSION, DTCG_FORMAT_VERSION, emitDtcg } from './dtcg.js';
export type { DtcgMapping, DtcgMappingKind, DtcgResult } from './dtcg.js';
export type { ContrastEntry, ContrastPair, ContrastReportFile } from './contrast.js';
export { ROLE_CONTRACTS } from './preset.js';
export type { ContrastConcern, RoleContract } from './preset.js';
export { generateSpacing, ratioName } from './spacing.js';
export type { SpacingStep } from './spacing.js';
export { contrastRatio, gamutMap, generateRamp, parseColor, toHex, RAMP } from './color.js';
export type { Oklch, RampColor } from './color.js';
export { compileValue, cssVariable } from './graph.js';
export { ABOVE_FLOOR_SYNTAX, aboveFloorSyntax, BROWSER_FLOOR, floorLabel } from './floor.js';
export type { AboveFloorSyntax, FloorBrowser } from './floor.js';
export type {
  TokenCategory,
  TokenDefinition,
  TokenMap,
  TokenOrigin,
  TokenType,
  TokenValue,
} from './graph.js';
export { formatDimension, parseDimension } from './units.js';
export { parseCondition } from './conditions.js';
export type { Condition } from './conditions.js';
export type { Dimension, LengthUnit } from './units.js';
