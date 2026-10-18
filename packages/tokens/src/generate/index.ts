/**
 * `@oddkin/tokens/generate` — the only token engine. Pure, deterministic, DOM-free, and
 * free of Node APIs, so the CLI, a browser, and a Worker produce identical bytes.
 */
import { emitCss } from './css.js';
import type { Diagnostic } from './diagnostics.js';
import { resolveTheme, type ResolvedTheme } from './resolve.js';

export interface GenerateResult {
  /** False when any error diagnostic was reported; outputs are then omitted. */
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly theme?: ResolvedTheme;
  readonly css?: string;
}

/** Validate a configuration and produce the resolved theme and its CSS. */
export function generate(config: unknown): GenerateResult {
  const { theme, diagnostics } = resolveTheme(config);
  const ok = theme !== undefined && !diagnostics.some((d) => d.severity === 'error');
  if (!ok || !theme) return { ok: false, diagnostics };
  return { ok, diagnostics, theme, css: emitCss(theme) };
}

export { emitCss, cssStats } from './css.js';
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
export type { Diagnostic, DiagnosticSeverity } from './diagnostics.js';
export { generateSpacing, ratioName } from './spacing.js';
export type { SpacingStep } from './spacing.js';
export { contrastRatio, gamutMap, generateRamp, parseColor, toHex, RAMP } from './color.js';
export type { Oklch, RampColor } from './color.js';
export { compileValue, cssVariable } from './graph.js';
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
