/**
 * Layout helpers: small, explicit declaration sets using logical properties. Defaults come
 * from the factory — core's are neutral lengths; a design system binds them to its roles.
 * Contract: docs/architecture/layout-recipes.md §3.
 */
import { DEV } from '../internal/dev.js';
import { MoteError } from '../diagnostics/index.js';

export type Declarations = ReadonlyArray<readonly [property: string, value: string]>;

const HELPER: unique symbol = Symbol.for('mote.layoutHelper') as never;

/** One helper application to a region. `regions` adds rules for other named regions (e.g. `split`). */
export interface LayoutHelper {
  readonly [HELPER]: true;
  readonly helper: 'stack' | 'row' | 'grid' | 'autoGrid' | 'split' | 'custom';
  readonly options: Readonly<Record<string, unknown>>;
  readonly declarations: Declarations;
  readonly regions?: Readonly<Record<string, Declarations>>;
}

export function isLayoutHelper(value: unknown): value is LayoutHelper {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[HELPER] === true
  );
}

export interface LayoutDefaults {
  /** Default gap for every helper. Neutral: `1rem`. */
  readonly gap: string;
  /** Minimum item size for `autoGrid`. Neutral: `16rem`. */
  readonly itemMin: string;
  /** Preferred side width for `split`. Neutral: `16rem`. */
  readonly sideWidth: string;
  /** Minimum main width for `split` before it wraps. Neutral: `50%`. */
  readonly mainMin: string;
}

export const NEUTRAL_DEFAULTS: LayoutDefaults = {
  gap: '1rem',
  itemMin: '16rem',
  sideWidth: '16rem',
  mainMin: '50%',
};

const UNSAFE = /[;{}<>\\]|\/\*/;

/** Validate a CSS value supplied to a helper or recipe. Values come from trusted module code. */
export function cssValue(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '' || UNSAFE.test(value)) {
    throw new MoteError(
      'recipe.value.invalid',
      DEV
        ? `${where}: ${JSON.stringify(value)} is not a CSS value (no ;, braces, angle brackets, backslashes, or comments).`
        : '',
    );
  }
  return value.trim();
}

type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type Justify = 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';

export interface StackOptions {
  readonly gap?: string;
  readonly align?: Align;
}
export interface RowOptions {
  readonly gap?: string;
  readonly align?: Align;
  readonly justify?: Justify;
  readonly wrap?: boolean;
}
export interface GridOptions {
  readonly columns?: number;
  readonly gap?: string;
  readonly rowGap?: string;
  readonly align?: Align;
}
export interface AutoGridOptions {
  readonly min?: string;
  readonly fill?: 'auto-fill' | 'auto-fit';
  readonly gap?: string;
}
export interface SplitOptions {
  /** Region placed first in DOM order; it takes `sideWidth` and grows little. */
  readonly side: string;
  /** Region that takes the remaining space and wraps below `mainMin`. */
  readonly main: string;
  readonly sideWidth?: string;
  readonly mainMin?: string;
  readonly gap?: string;
}

export interface LayoutHelpers {
  stack(options?: StackOptions): LayoutHelper;
  row(options?: RowOptions): LayoutHelper;
  grid(options?: GridOptions): LayoutHelper;
  autoGrid(options?: AutoGridOptions): LayoutHelper;
  /** Intrinsic wrapping sidebar layout; visual order always follows DOM order. */
  split(options: SplitOptions): LayoutHelper;
  /** Ordinary declarations for anything the helpers do not cover. */
  css(declarations: Readonly<Record<string, string>>): LayoutHelper;
}

const make = (
  helper: LayoutHelper['helper'],
  options: object,
  declarations: Declarations,
  regions?: Readonly<Record<string, Declarations>>,
): LayoutHelper =>
  Object.freeze({
    [HELPER]: true as const,
    helper,
    options: Object.freeze({ ...options }),
    declarations,
    ...(regions ? { regions } : {}),
  });

const ALIGN = new Set(['start', 'center', 'end', 'stretch', 'baseline']);
const JUSTIFY = new Set([
  'start',
  'center',
  'end',
  'space-between',
  'space-around',
  'space-evenly',
]);

function keyword(
  value: string | undefined,
  allowed: Set<string>,
  where: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (!allowed.has(value))
    throw new MoteError(
      'recipe.value.invalid',
      DEV ? `${where}: "${value}" is not one of ${[...allowed].join(', ')}.` : '',
    );
  return value;
}

/** Create helpers bound to defaults (e.g. a design system's layout roles). */
export function createLayoutHelpers(overrides: Partial<LayoutDefaults> = {}): LayoutHelpers {
  const defaults: LayoutDefaults = { ...NEUTRAL_DEFAULTS, ...overrides };
  for (const [key, value] of Object.entries(defaults)) cssValue(value, `layout default "${key}"`);

  return {
    stack(options = {}) {
      const align = keyword(options.align, ALIGN, 'stack align');
      return make('stack', options, [
        ['display', 'flex'],
        ['flex-direction', 'column'],
        ['gap', cssValue(options.gap ?? defaults.gap, 'stack gap')],
        ['min-inline-size', '0'],
        ...(align ? ([['align-items', align]] as const) : []),
      ]);
    },
    row(options = {}) {
      const justify = keyword(options.justify, JUSTIFY, 'row justify');
      return make('row', options, [
        ['display', 'flex'],
        ['flex-direction', 'row'],
        ['align-items', keyword(options.align, ALIGN, 'row align') ?? 'center'],
        ['gap', cssValue(options.gap ?? defaults.gap, 'row gap')],
        ['flex-wrap', options.wrap ? 'wrap' : 'nowrap'],
        ['min-inline-size', '0'],
        ...(justify ? ([['justify-content', justify]] as const) : []),
      ]);
    },
    grid(options = {}) {
      const columns = options.columns ?? 1;
      if (!Number.isInteger(columns) || columns < 1 || columns > 24) {
        throw new MoteError(
          'recipe.value.invalid',
          DEV ? `grid columns: ${JSON.stringify(columns)} must be an integer from 1 to 24.` : '',
        );
      }
      const align = keyword(options.align, ALIGN, 'grid align');
      return make('grid', options, [
        ['display', 'grid'],
        ['grid-template-columns', `repeat(${columns}, minmax(0, 1fr))`],
        ['gap', cssValue(options.gap ?? defaults.gap, 'grid gap')],
        ...(options.rowGap
          ? ([['row-gap', cssValue(options.rowGap, 'grid rowGap')]] as const)
          : []),
        ...(align ? ([['align-items', align]] as const) : []),
      ]);
    },
    autoGrid(options = {}) {
      const fill = options.fill ?? 'auto-fill';
      if (fill !== 'auto-fill' && fill !== 'auto-fit')
        throw new MoteError(
          'recipe.value.invalid',
          DEV ? `autoGrid fill: "${String(fill)}" must be auto-fill or auto-fit.` : '',
        );
      const min = cssValue(options.min ?? defaults.itemMin, 'autoGrid min');
      return make('autoGrid', options, [
        ['display', 'grid'],
        ['grid-template-columns', `repeat(${fill}, minmax(min(${min}, 100%), 1fr))`],
        ['gap', cssValue(options.gap ?? defaults.gap, 'autoGrid gap')],
      ]);
    },
    split(options) {
      if (
        !options ||
        typeof options.side !== 'string' ||
        typeof options.main !== 'string' ||
        options.side === options.main
      ) {
        throw new MoteError(
          'recipe.value.invalid',
          DEV ? 'split needs distinct "side" and "main" region names.' : '',
        );
      }
      return make(
        'split',
        options,
        [
          ['display', 'flex'],
          ['flex-wrap', 'wrap'],
          ['gap', cssValue(options.gap ?? defaults.gap, 'split gap')],
        ],
        {
          [options.side]: [
            ['flex-basis', cssValue(options.sideWidth ?? defaults.sideWidth, 'split sideWidth')],
            ['flex-grow', '1'],
          ],
          [options.main]: [
            ['flex-basis', '0'],
            ['flex-grow', '999'],
            ['min-inline-size', cssValue(options.mainMin ?? defaults.mainMin, 'split mainMin')],
          ],
        },
      );
    },
    css(declarations) {
      return make(
        'custom',
        declarations,
        Object.entries(declarations).map(([property, value]) => {
          if (!/^(--)?[a-z][a-z0-9-]*$/.test(property))
            throw new MoteError(
              'recipe.value.invalid',
              DEV ? `"${property}" is not a CSS property name.` : '',
            );
          return [property, cssValue(value, `css ${property}`)] as const;
        }),
      );
    },
  };
}
