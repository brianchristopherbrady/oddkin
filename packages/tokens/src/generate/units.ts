/**
 * Lengths and numbers. Source units are preserved (never converted between `rem` and
 * `px`); numbers round to 4 decimal places with trailing zeros trimmed.
 */

export type LengthUnit = 'rem' | 'px' | 'em';

export interface Dimension {
  readonly value: number;
  /** Empty only for zero. */
  readonly unit: LengthUnit | '';
}

const DIMENSION = /^(-?(?:\d+\.?\d*|\.\d+))(rem|px|em)?$/;

/** Parse `0.25rem`, `1px`, `1.5em`, or `0`. Unitless non-zero values are rejected. */
export function parseDimension(input: unknown): Dimension | undefined {
  if (typeof input !== 'string') return undefined;
  const match = DIMENSION.exec(input.trim());
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  const unit = (match[2] ?? '') as LengthUnit | '';
  if (unit === '' && value !== 0) return undefined;
  return { value, unit };
}

/** Round to 4 decimal places, symmetric for negatives, without `-0`. */
export function round4(n: number): number {
  const rounded = (Math.sign(n) * Math.round(Math.abs(n) * 10_000)) / 10_000;
  return rounded === 0 ? 0 : rounded;
}

export function formatNumber(n: number): string {
  return String(round4(n));
}

export function formatDimension(d: Dimension): string {
  const value = round4(d.value);
  return value === 0 ? '0' : `${value}${d.unit}`;
}

/** Scale a dimension, keeping its unit. */
export function scaleDimension(d: Dimension, factor: number): Dimension {
  return { value: round4(d.value * factor), unit: d.unit };
}
