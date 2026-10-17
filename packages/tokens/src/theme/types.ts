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
  /** Brand inputs for this product. Roles keep the base theme's expressions; only reference tokens change. */
  readonly brand?: Partial<BrandConfig>;
}

export interface DensityConfig {
  /** Multiplier for spacing and control sizes. Never changes font sizes. */
  readonly scale: number;
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
 * `data-mote-profile="name"` (space-separated list allowed).
 */
export type ProfileConfig = Readonly<Record<string, OverrideValue>>;

export interface ThemeConfig {
  readonly $schema?: string;
  /** Theme name, used for `data-mote-theme` and file names. Defaults to `default`. */
  readonly name?: string;
  /** Token values to start from. Only `mote-default` exists today. */
  readonly preset?: 'mote-default';
  readonly brand: BrandConfig;
  readonly status?: StatusConfig;
  readonly spacing?: SpacingConfig;
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
 * Identity function that types a theme configuration. JSON configs use the same shape
 * with `"$schema"` pointing at `@mote/tokens/schema.json`.
 */
export function defineTheme<const C extends ThemeConfig>(config: C): C {
  return config;
}
