/**
 * `ThemeConfig` — the one authoritative theme model used by TypeScript files, JSON
 * files, the CLI, and Theme Studio. Contract: docs/architecture/theming-and-styling.md §1.
 */

/** A colour as `#rgb`, `#rrggbb`, or `oklch(L C H)` (L as 0–1 or a percentage). */
export type ColorInput = string;

/** A length with a unit, e.g. `0.25rem`, `1px`, or `0`. */
export type DimensionInput = string;

export interface BrandConfig {
  /** The only required input. Drives the brand ramp and action, link, and focus roles. */
  readonly primary: ColorInput;
  /** Hue and chroma for the neutral ramp. Defaults to a near-grey tinted by `primary`. */
  readonly neutral?: ColorInput;
}

export interface StatusConfig {
  readonly danger?: ColorInput;
  readonly success?: ColorInput;
  readonly warning?: ColorInput;
  /** Seeds the `ref.info.*` ramp of the `info` tone. */
  readonly info?: ColorInput;
}

interface SpacingBase {
  /** Round every step to a multiple of this length (same unit). Explicit only; never implied. */
  readonly snap?: DimensionInput;
}

/** `value = unit × multiplier` for each named step. */
export interface MultiplesSpacing extends SpacingBase {
  readonly strategy: 'multiples';
  readonly unit: DimensionInput;
  readonly steps: Readonly<Record<string, number>>;
}

/** `value(offset) = base × ratio^offset` for offsets `-stepsBelow … +stepsAbove`. */
export interface RatioSpacing extends SpacingBase {
  readonly strategy: 'ratio';
  readonly base: DimensionInput;
  readonly ratio: number;
  readonly stepsBelow: number;
  readonly stepsAbove: number;
  /** Names from the smallest to the largest step; length must equal the step count. */
  readonly names?: readonly string[];
}

/** Named lengths, each with a unit. */
export interface ExplicitSpacing extends SpacingBase {
  readonly strategy: 'explicit';
  readonly steps: Readonly<Record<string, DimensionInput>>;
}

export type SpacingConfig = MultiplesSpacing | RatioSpacing | ExplicitSpacing;

export type Mode = 'light' | 'dark';

/** A value per mode, for overrides of mode-dependent roles. */
export interface ModeValues {
  readonly light: string;
  readonly dark: string;
}

/** Override value: a literal, a `{token.name}` reference, or per-mode values. */
export type OverrideValue = string | ModeValues;

export interface ProductConfig {
  /** Brand inputs for this product: its reference ramps. Roles keep the base theme's expressions unless `overrides` sets them. */
  readonly brand?: Partial<BrandConfig>;
  /**
   * Semantic and component roles for this product only, by stable name, e.g.
   * `{ "color.action.default": "{ref.brand.600}" }`. Its scope re-declares them and the roles that
   * read them; contrast is checked in the product.
   */
  readonly overrides?: Readonly<Record<string, OverrideValue>>;
}

export interface DensityConfig {
  /** Multiplier for spacing and control sizes. Never changes font sizes. */
  readonly scale: number;
}

export interface RadiusConfig {
  /** Multiplies `radius.xs` to `radius.2xl`; `radius.none` and `radius.full` stay. 0 to 3; unset, 1. */
  readonly scale?: number;
}

export interface MotionConfig {
  /** Multiplies the `motion.duration.*` steps; reduced motion stays `0ms`. Above 0, at most 2; unset, 1. */
  readonly scale?: number;
}

export interface TypographyConfig {
  /** Generates `font.size.xs` to `font.size.4xl`: `md` is `base`, each step `ratio` times the one below. */
  readonly scale?: { readonly base: DimensionInput; readonly ratio: number };
}

/** Literal thresholds; `rem` recommended. Logical sizes apply to container queries only. */
export interface ContainerCondition {
  /** Container name, or `true` for the nearest size container. */
  readonly container: string | true;
  readonly minInlineSize?: DimensionInput;
  readonly maxInlineSize?: DimensionInput;
  readonly minWidth?: DimensionInput;
  readonly maxWidth?: DimensionInput;
}

export interface MediaCondition {
  readonly media: {
    readonly minWidth?: DimensionInput;
    readonly maxWidth?: DimensionInput;
    readonly prefersReducedMotion?: 'reduce' | 'no-preference';
    readonly prefersColorScheme?: 'light' | 'dark';
    readonly prefersContrast?: 'more' | 'less' | 'no-preference' | 'custom';
    readonly forcedColors?: 'active' | 'none';
  };
}

/** A named query condition, serialized to a literal container or media query. */
export type ConditionConfig = ContainerCondition | MediaCondition;

/**
 * A profile: explicit overrides of layout and component roles, applied with
 * `data-odd-profile="name"` (space-separated list allowed).
 */
export type ProfileConfig = Readonly<Record<string, OverrideValue>>;

export interface ThemeConfig {
  readonly $schema?: string;
  /** Theme name, used for `data-odd-theme` and file names. Defaults to `default`. */
  readonly name?: string;
  /** Token values to start from. Only `oddkin-default` exists today. */
  readonly preset?: 'oddkin-default';
  readonly brand: BrandConfig;
  readonly status?: StatusConfig;
  readonly spacing?: SpacingConfig;
  readonly radius?: RadiusConfig;
  readonly motion?: MotionConfig;
  readonly typography?: TypographyConfig;
  /** Modes to generate. Defaults to `['light', 'dark']`. */
  readonly modes?: readonly Mode[];
  readonly products?: Readonly<Record<string, ProductConfig>>;
  readonly density?: Readonly<Record<string, DensityConfig>>;
  /** Named container and media conditions; replace preset conditions with the same name. */
  readonly conditions?: Readonly<Record<string, ConditionConfig>>;
  /** Named role-override sets; replace preset profiles with the same name. Later profiles win where they overlap. */
  readonly profiles?: Readonly<Record<string, ProfileConfig>>;
  /** Replace resolved tokens by stable name. The token must exist. */
  readonly overrides?: Readonly<Record<string, OverrideValue>>;
}

/**
 * A theme that builds on a base file and sets only what differs; it may omit `brand`. The loader
 * (`loadConfig` in `@oddkin/tokens/node`, or `mergeThemes`) merges the base under it before
 * generation (theming-and-styling.md §1.1).
 */
export interface ThemeExtension extends Omit<ThemeConfig, 'brand'> {
  /** The base theme file: a path relative to this file, or a package export. */
  readonly extends: string;
  readonly brand?: Partial<BrandConfig>;
}

/**
 * Identity function that types a theme configuration. JSON configs use the same shape
 * with `"$schema"` pointing at `@oddkin/tokens/schema.json`.
 */
export function defineTheme<const C extends ThemeConfig | ThemeExtension>(config: C): C {
  return config;
}
