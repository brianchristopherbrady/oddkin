/**
 * Colours as `<input type="color">` handles them (HTML §4.10.5.1.14): parsing any CSS colour,
 * serializing to `#rrggbb`, or to `color(srgb r g b / a)` when the alpha component applies, both
 * limited to 8 bits per channel; the hex text a field takes; and HSV for the picker's area and hue.
 */

/** Red, green, and blue from 0 to 255; alpha from 0 to 1. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** Hue in degrees (0 to 360); saturation, value (brightness), and alpha from 0 to 1. */
export interface Hsva {
  readonly h: number;
  readonly s: number;
  readonly v: number;
  readonly a: number;
}

export const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

const HEX = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const SRGB = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/i;
const RGB = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/;

const channel = (fraction: number) => Math.min(255, Math.max(0, Math.round(fraction * 255)));
const unit = (n: number) => Math.min(1, Math.max(0, n));

/** `#rgb`, `#rgba`, `#rrggbb`, or `#rrggbbaa`, the `#` optional; `undefined` for anything else. */
export function parseHex(text: string): Rgba | undefined {
  const digits = HEX.exec(text.trim())?.[1];
  if (!digits) return undefined;
  const full = digits.length > 4 ? digits : [...digits].map((d) => d + d).join('');
  const at = (i: number) => parseInt(full.slice(i, i + 2), 16);
  return { r: at(0), g: at(2), b: at(4), a: full.length === 8 ? at(6) / 255 : 1 };
}

let context: CanvasRenderingContext2D | null | undefined;

/** Any CSS colour the engine parses, in sRGB; `undefined` when it does not parse. */
export function parseColor(text: string): Rgba | undefined {
  const hex = parseHex(text);
  if (hex && text.trim().startsWith('#')) return hex;
  const srgb = SRGB.exec(text.trim());
  if (srgb) {
    const [, r, g, b, a] = srgb.map(Number);
    return { r: channel(r!), g: channel(g!), b: channel(b!), a: srgb[4] ? unit(a!) : 1 };
  }
  // The engine's colour parser: a canvas keeps its previous fill for text that is not a colour.
  context ??= document.createElement('canvas').getContext('2d');
  if (!context) return undefined;
  const read = (sentinel: string) => {
    context!.fillStyle = sentinel;
    context!.fillStyle = text;
    return String(context!.fillStyle);
  };
  const parsed = read('#000000');
  if (parsed !== read('#ffffff')) return undefined;
  const opaque = parseHex(parsed);
  if (opaque) return opaque;
  const rgb = RGB.exec(parsed);
  if (!rgb) return undefined;
  return { r: +rgb[1]!, g: +rgb[2]!, b: +rgb[3]!, a: rgb[4] ? +rgb[4] : 1 };
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');
const decimal = (n: number) => String(Number(n.toFixed(6)));

/**
 * The value a native colour input gives: `#rrggbb` (the alpha dropped), or with `alpha`,
 * `color(srgb r g b)` with ` / a` while not opaque.
 */
export function serializeColor(color: Rgba, alpha: boolean): string {
  if (!alpha) return `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`;
  const rgb = [color.r, color.g, color.b].map((c) => decimal(c / 255)).join(' ');
  return `color(srgb ${rgb}${color.a < 1 ? ` / ${decimal(color.a)}` : ''})`;
}

/** The colour as a field shows it: `#RRGGBB`, with the alpha byte while not opaque. */
export function hexText(color: Rgba): string {
  const alpha = color.a < 1 ? hex2(channel(color.a)) : '';
  return `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}${alpha}`.toUpperCase();
}

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** White on the colour falls below WCAG's 3:1 for graphics, so a mark on it is drawn black. */
export function isLight({ r, g, b }: Rgba): boolean {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) > 0.3;
}

export function toHsva({ r, g, b, a }: Rgba): Hsva {
  const [red, green, blue] = [r / 255, g / 255, b / 255] as const;
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  let h = 0;
  if (delta) {
    if (max === red) h = ((green - blue) / delta + 6) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
  }
  return { h: h * 60, s: max ? delta / max : 0, v: max, a };
}

export function toRgba({ h, s, v, a }: Hsva): Rgba {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return channel(v - v * s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return { r: f(5), g: f(3), b: f(1), a };
}
