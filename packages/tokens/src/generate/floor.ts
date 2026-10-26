/**
 * Oddkin's browser floor (ADR 0009, pinned with its data versions in
 * docs/compatibility/css-features.json) and token value syntax that the floor cannot parse.
 *
 * A custom property may hold any value, but a declaration that reads it with `var()` becomes
 * invalid at computed-value time when the substituted value does not parse — the property
 * falls back to its inherited or initial value, and a `var()` fallback is not used because
 * the variable is defined (css-architecture.md §4.2). Token values therefore stay within the
 * floor; enhancements belong in stylesheets gated by `@supports`.
 *
 * Each entry is checked against @mdn/browser-compat-data by scripts/compat/check-css.mjs,
 * which fails when an entry no longer matches the pinned data.
 */
export const BROWSER_FLOOR = {
  chrome: '130',
  edge: '130',
  firefox: '132',
  safari: '18.2',
} as const;

export type FloorBrowser = keyof typeof BROWSER_FLOOR;

const LABELS: Record<FloorBrowser, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  safari: 'Safari',
};

export interface AboveFloorSyntax {
  /** The syntax as written in CSS. */
  readonly syntax: string;
  /** Detects the syntax in a token value (references removed). */
  readonly pattern: RegExp;
  /** @mdn/browser-compat-data key the entry is verified against. */
  readonly bcd: string;
  /** Desktop floor browsers that cannot parse it (their mobile counterparts match). */
  readonly unsupported: readonly FloorBrowser[];
}

const fn = (name: string) => new RegExp(`(?<![\\w-])${name}\\(`, 'i');
const ALL: readonly FloorBrowser[] = ['chrome', 'edge', 'firefox', 'safari'];

export const ABOVE_FLOOR_SYNTAX: readonly AboveFloorSyntax[] = [
  {
    syntax: 'contrast-color()',
    pattern: fn('contrast-color'),
    bcd: 'css.types.color.contrast-color',
    unsupported: ALL,
  },
  {
    syntax: 'calc-size()',
    pattern: fn('calc-size'),
    bcd: 'css.types.calc-size',
    unsupported: ['firefox', 'safari'],
  },
  {
    syntax: 'anchor()',
    pattern: fn('anchor'),
    bcd: 'css.types.anchor',
    unsupported: ['firefox', 'safari'],
  },
  {
    syntax: 'anchor-size()',
    pattern: fn('anchor-size'),
    bcd: 'css.types.anchor-size',
    unsupported: ['firefox', 'safari'],
  },
  { syntax: 'if()', pattern: fn('if'), bcd: 'css.types.if', unsupported: ALL },
  { syntax: 'abs()', pattern: fn('abs'), bcd: 'css.types.abs', unsupported: ['chrome', 'edge'] },
  { syntax: 'sign()', pattern: fn('sign'), bcd: 'css.types.sign', unsupported: ['chrome', 'edge'] },
  { syntax: 'progress()', pattern: fn('progress'), bcd: 'css.types.progress', unsupported: ALL },
  {
    syntax: 'sibling-index()',
    pattern: fn('sibling-index'),
    bcd: 'css.types.sibling-index',
    unsupported: ALL,
  },
  {
    syntax: 'sibling-count()',
    pattern: fn('sibling-count'),
    bcd: 'css.types.sibling-count',
    unsupported: ALL,
  },
  { syntax: 'random()', pattern: fn('random'), bcd: 'css.types.random', unsupported: ALL },
];

/** Readable list of floor browsers, e.g. "Firefox 132, Safari 18.2". */
export function floorLabel(browsers: readonly FloorBrowser[]): string {
  return browsers.map((b) => `${LABELS[b]} ${BROWSER_FLOOR[b]}`).join(', ');
}

/** Entries whose syntax appears in a CSS value (token references must be removed first). */
export function aboveFloorSyntax(text: string): AboveFloorSyntax[] {
  return ABOVE_FLOOR_SYNTAX.filter((entry) => entry.pattern.test(text));
}
