/**
 * Colour: OKLCH ramps mapped into sRGB by chroma reduction (hue and lightness kept),
 * and WCAG 2.x contrast. ADR 0006; theming-and-styling.md §10.
 *
 * OKLab conversion uses Björn Ottosson's published matrices (2020). Gamut mapping is a
 * fixed 24-step bisection on chroma, so results are deterministic across engines.
 */

export interface Oklch {
  /** Lightness 0–1. */
  readonly l: number;
  /** Chroma ≥ 0. */
  readonly c: number;
  /** Hue in degrees, 0–360. */
  readonly h: number;
}

type Rgb = readonly [number, number, number];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/i;

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function linearSrgbToOklch([r, g, b]: Rgb): Oklch {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, bb);
  const h = c < 1e-7 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

function oklchToLinearSrgb({ l: L, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const EPSILON = 1e-6;
const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -EPSILON && v <= 1 + EPSILON);

/** Parse `#rgb`, `#rrggbb`, or `oklch(L C H)`. */
export function parseColor(input: unknown): Oklch | undefined {
  if (typeof input !== 'string') return undefined;
  const text = input.trim();
  const hex = HEX.exec(text);
  if (hex) {
    const digits =
      (hex[1] as string).length === 3
        ? [...(hex[1] as string)].map((d) => d + d).join('')
        : (hex[1] as string);
    const rgb = [0, 2, 4].map((i) =>
      toLinear(parseInt(digits.slice(i, i + 2), 16) / 255),
    ) as unknown as Rgb;
    return linearSrgbToOklch(rgb);
  }
  const ok = OKLCH.exec(text);
  if (ok) {
    const l = Number(ok[1]) / (ok[2] ? 100 : 1);
    const c = Number(ok[3]);
    const h = Number(ok[4]) % 360;
    if ([l, c, h].every(Number.isFinite) && l >= 0 && l <= 1 && c >= 0) return { l, c, h };
  }
  return undefined;
}

/** Reduce chroma (keeping lightness and hue) until the colour fits sRGB. */
export function gamutMap(color: Oklch): Oklch {
  if (inGamut(oklchToLinearSrgb(color))) return color;
  let low = 0;
  let high = color.c;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToLinearSrgb({ l: color.l, c: mid, h: color.h }))) low = mid;
    else high = mid;
  }
  return { l: color.l, c: low, h: color.h };
}

/** Gamut-mapped sRGB hex (`#rrggbb`, lowercase). */
export function toHex(color: Oklch): string {
  const rgb = oklchToLinearSrgb(gamutMap(color));
  return `#${rgb
    .map((v) => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** WCAG 2.x relative luminance of an sRGB hex colour. */
export function luminance(hex: string): number {
  const digits = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => toLinear(parseInt(digits.slice(i, i + 2), 16) / 255)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Ramp steps from lightest to darkest, with fixed OKLCH lightness and a chroma envelope. */
export const RAMP: ReadonlyArray<{
  readonly step: number;
  readonly l: number;
  readonly chroma: number;
}> = [
  { step: 50, l: 0.97, chroma: 0.12 },
  { step: 100, l: 0.94, chroma: 0.22 },
  { step: 200, l: 0.88, chroma: 0.4 },
  { step: 300, l: 0.8, chroma: 0.65 },
  { step: 400, l: 0.71, chroma: 0.85 },
  { step: 500, l: 0.62, chroma: 1 },
  { step: 600, l: 0.54, chroma: 1 },
  { step: 700, l: 0.46, chroma: 0.9 },
  { step: 800, l: 0.38, chroma: 0.75 },
  { step: 900, l: 0.3, chroma: 0.6 },
  { step: 950, l: 0.22, chroma: 0.45 },
];

export interface RampColor {
  readonly step: number;
  readonly hex: string;
  /** Requested colour before gamut mapping. */
  readonly requested: Oklch;
  /** Colour actually emitted (after chroma reduction). */
  readonly mapped: Oklch;
}

/** Generate a ramp from a seed's hue and chroma, scaled by the chroma envelope. */
export function generateRamp(seed: Oklch, chroma: number = seed.c): RampColor[] {
  return RAMP.map(({ step, l, chroma: factor }) => {
    const requested = { l, c: chroma * factor, h: seed.h };
    const mapped = gamutMap(requested);
    return { step, hex: toHex(requested), requested, mapped };
  });
}

/** `oklch(…)` text for provenance and inspection (4 decimals). */
export function formatOklch(color: Oklch): string {
  const r = (n: number) => String(Math.round(n * 10_000) / 10_000);
  return `oklch(${r(color.l)} ${r(color.c)} ${r(color.h)})`;
}
