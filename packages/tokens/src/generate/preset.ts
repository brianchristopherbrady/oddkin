/**
 * Provisional `oddkin-default` preset (M2). Values are validated in real components (M4,
 * M8) before being frozen. Brand and status roles are chosen by measured contrast at
 * generation time (see `ContrastRole`), not by fixed step numbers.
 */
import type { ConditionConfig, ExplicitSpacing, ProfileConfig } from '../theme/types.js';
import type { TokenCategory, TokenType, TokenValue } from './graph.js';

export interface PresetToken {
  readonly name: string;
  readonly category: TokenCategory;
  readonly type: TokenType;
  readonly value: TokenValue;
  readonly density?: boolean;
  readonly minimum?: string;
  readonly reducedMotion?: string;
  readonly description?: string;
}

export const DEFAULT_SPACING: ExplicitSpacing = {
  strategy: 'explicit',
  steps: {
    none: '0',
    '3xs': '0.125rem',
    '2xs': '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
    '4xl': '6rem',
  },
};

export const DEFAULT_STATUS = {
  danger: 'oklch(0.58 0.2 27)',
  success: 'oklch(0.6 0.15 150)',
  warning: 'oklch(0.72 0.15 75)',
} as const;
export const DEFAULT_DENSITY = { compact: { scale: 0.75 } } as const;

const t = (
  name: string,
  category: TokenCategory,
  type: TokenType,
  value: TokenValue,
  extra: Partial<PresetToken> = {},
): PresetToken => ({ name, category, type, value, ...extra });
const mode = (light: string, dark: string) => ({ light, dark });

/** `type.<name>.*` roles: one text style built from the foundation scales. */
const textStyle = (
  name: string,
  family: 'sans' | 'display' | 'mono',
  size: string,
  weight: 'regular' | 'medium' | 'semibold' | 'bold',
  lineHeight: 'none' | 'tight' | 'snug' | 'normal' | 'relaxed',
  letterSpacing: 'tight' | 'normal' | 'wide' = 'normal',
): PresetToken[] => [
  t(`type.${name}.family`, 'semantic', 'fontFamily', `{font.family.${family}}`),
  t(`type.${name}.size`, 'semantic', 'dimension', `{font.size.${size}}`),
  t(`type.${name}.weight`, 'semantic', 'fontWeight', `{font.weight.${weight}}`),
  t(`type.${name}.line-height`, 'semantic', 'number', `{line-height.${lineHeight}}`),
  t(`type.${name}.letter-spacing`, 'semantic', 'dimension', `{letter-spacing.${letterSpacing}}`),
];

/** Duration that drops to 0ms under `prefers-reduced-motion: reduce`. */
const duration = (name: string, value: string) =>
  t(`motion.duration.${name}`, 'foundation', 'duration', value, { reducedMotion: '0ms' });

export const PRESET_TOKENS: readonly PresetToken[] = [
  // Foundation: radii and borders
  t('radius.none', 'foundation', 'dimension', '0'),
  t('radius.xs', 'foundation', 'dimension', '0.125rem'),
  t('radius.sm', 'foundation', 'dimension', '0.25rem'),
  t('radius.md', 'foundation', 'dimension', '0.5rem'),
  t('radius.lg', 'foundation', 'dimension', '0.75rem'),
  t('radius.xl', 'foundation', 'dimension', '1rem'),
  t('radius.2xl', 'foundation', 'dimension', '1.5rem'),
  t('radius.full', 'foundation', 'dimension', '9999px'),
  t('border.width.default', 'foundation', 'dimension', '1px'),
  t('border.width.strong', 'foundation', 'dimension', '2px'),
  t('focus.width', 'foundation', 'dimension', '2px'),
  t('focus.offset', 'foundation', 'dimension', '2px'),

  // Foundation: typography
  t(
    'font.family.sans',
    'foundation',
    'fontFamily',
    'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  ),
  t('font.family.display', 'foundation', 'fontFamily', '{font.family.sans}'),
  t(
    'font.family.mono',
    'foundation',
    'fontFamily',
    'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  ),
  t('font.size.xs', 'foundation', 'dimension', '0.75rem'),
  t('font.size.sm', 'foundation', 'dimension', '0.875rem'),
  t('font.size.md', 'foundation', 'dimension', '1rem'),
  t('font.size.lg', 'foundation', 'dimension', '1.125rem'),
  t('font.size.xl', 'foundation', 'dimension', '1.25rem'),
  t('font.size.2xl', 'foundation', 'dimension', '1.5rem'),
  t('font.size.3xl', 'foundation', 'dimension', '1.875rem'),
  t('font.size.4xl', 'foundation', 'dimension', '2.25rem'),
  t('font.weight.regular', 'foundation', 'fontWeight', '400'),
  t('font.weight.medium', 'foundation', 'fontWeight', '500'),
  t('font.weight.semibold', 'foundation', 'fontWeight', '600'),
  t('font.weight.bold', 'foundation', 'fontWeight', '700'),
  t('line-height.none', 'foundation', 'number', '1'),
  t('line-height.tight', 'foundation', 'number', '1.25'),
  t('line-height.snug', 'foundation', 'number', '1.375'),
  t('line-height.normal', 'foundation', 'number', '1.5'),
  t('line-height.relaxed', 'foundation', 'number', '1.625'),
  t('letter-spacing.tight', 'foundation', 'dimension', '-0.025em'),
  t('letter-spacing.normal', 'foundation', 'dimension', '0'),
  t('letter-spacing.wide', 'foundation', 'dimension', '0.05em'),

  // Foundation: sizes
  t('icon.size.sm', 'foundation', 'dimension', '1rem'),
  t('icon.size.md', 'foundation', 'dimension', '1.25rem'),
  t('icon.size.lg', 'foundation', 'dimension', '1.5rem'),
  t('target.min', 'foundation', 'dimension', '1.5rem', {
    description:
      'Minimum interactive target size (WCAG 2.2 SC 2.5.8, 24 CSS px at the default root size).',
  }),

  // Foundation: elevation (dark appearances need stronger shadows to read at all)
  t('elevation.none', 'foundation', 'shadow', 'none'),
  t(
    'elevation.sm',
    'foundation',
    'shadow',
    mode(
      '0 1px 2px rgb(0 0 0 / 0.08), 0 1px 3px rgb(0 0 0 / 0.08)',
      '0 1px 2px rgb(0 0 0 / 0.3), 0 1px 3px rgb(0 0 0 / 0.3)',
    ),
  ),
  t(
    'elevation.md',
    'foundation',
    'shadow',
    mode(
      '0 1px 2px rgb(0 0 0 / 0.12), 0 4px 12px rgb(0 0 0 / 0.08)',
      '0 1px 2px rgb(0 0 0 / 0.4), 0 4px 12px rgb(0 0 0 / 0.32)',
    ),
  ),
  t(
    'elevation.lg',
    'foundation',
    'shadow',
    mode(
      '0 4px 8px rgb(0 0 0 / 0.08), 0 12px 32px rgb(0 0 0 / 0.14)',
      '0 4px 8px rgb(0 0 0 / 0.32), 0 12px 32px rgb(0 0 0 / 0.48)',
    ),
  ),
  t(
    'elevation.xl',
    'foundation',
    'shadow',
    mode(
      '0 8px 16px rgb(0 0 0 / 0.1), 0 24px 64px rgb(0 0 0 / 0.2)',
      '0 8px 16px rgb(0 0 0 / 0.4), 0 24px 64px rgb(0 0 0 / 0.6)',
    ),
  ),

  // Foundation: motion
  duration('fast', '100ms'),
  duration('normal', '200ms'),
  duration('slow', '300ms'),
  duration('slower', '500ms'),
  t('motion.easing.standard', 'foundation', 'cubicBezier', 'cubic-bezier(0.4, 0, 0.2, 1)'),
  t('motion.easing.enter', 'foundation', 'cubicBezier', 'cubic-bezier(0, 0, 0.2, 1)'),
  t('motion.easing.exit', 'foundation', 'cubicBezier', 'cubic-bezier(0.4, 0, 1, 1)'),
  t('motion.easing.linear', 'foundation', 'cubicBezier', 'cubic-bezier(0, 0, 1, 1)'),

  // Foundation: in-flow stacking (top-layer overlays never use z-index)
  t('z-index.base', 'foundation', 'number', '0'),
  t('z-index.raised', 'foundation', 'number', '1'),
  t('z-index.sticky', 'foundation', 'number', '100'),
  t('z-index.overlay', 'foundation', 'number', '200'),

  // Semantic: controls (button, input)
  t('control.height.sm', 'semantic', 'dimension', '2rem', { density: true, minimum: 'target.min' }),
  t('control.height.md', 'semantic', 'dimension', '2.5rem', {
    density: true,
    minimum: 'target.min',
  }),
  t('control.height.lg', 'semantic', 'dimension', '3rem', { density: true, minimum: 'target.min' }),
  t('control.padding.inline.sm', 'semantic', 'dimension', '{space.xs}'),
  t('control.padding.inline.md', 'semantic', 'dimension', '{space.sm}'),
  t('control.padding.inline.lg', 'semantic', 'dimension', '{space.md}'),
  t('control.gap', 'semantic', 'dimension', '{space.xs}'),
  t('control.radius', 'semantic', 'dimension', '{radius.md}'),

  // Semantic: text styles (family, size, weight, line height, letter spacing)
  ...textStyle('display', 'display', '4xl', 'semibold', 'tight', 'tight'),
  ...textStyle('section', 'display', '2xl', 'semibold', 'tight'),
  ...textStyle('title', 'display', 'xl', 'semibold', 'snug'),
  ...textStyle('body', 'sans', 'md', 'regular', 'normal'),
  ...textStyle('ui', 'sans', 'sm', 'medium', 'snug'),
  ...textStyle('small', 'sans', 'xs', 'regular', 'normal'),
  ...textStyle('eyebrow', 'sans', 'xs', 'semibold', 'normal', 'wide'),
  ...textStyle('code', 'mono', 'sm', 'regular', 'normal'),

  // Semantic: neutral colour roles (fixed steps; checked by contrast pairs below)
  t('color.canvas', 'semantic', 'color', mode('{ref.neutral.50}', '{ref.neutral.1000}')),
  t('color.surface.default', 'semantic', 'color', mode('{ref.neutral.0}', '{ref.neutral.950}')),
  t('color.surface.raised', 'semantic', 'color', mode('{ref.neutral.0}', '{ref.neutral.900}')),
  t('color.surface.sunken', 'semantic', 'color', mode('{ref.neutral.50}', '{ref.neutral.1000}')),
  t('color.surface.hover', 'semantic', 'color', mode('{ref.neutral.100}', '{ref.neutral.800}')),
  t('color.surface.specimen', 'semantic', 'color', mode('{ref.brand.50}', '{ref.brand.900}'), {
    description: 'Specimen stages only (documentation previews); never a selected state.',
  }),
  t('color.selection.background', 'semantic', 'color', '{color.action.default}', {
    description: 'Selected controls; selection is also shown by a check or marker.',
  }),
  t('color.selection.foreground', 'semantic', 'color', '{color.text.on-action}'),
  t('color.danger.surface', 'semantic', 'color', mode('{ref.danger.50}', '{ref.danger.950}')),
  t('color.success.surface', 'semantic', 'color', mode('{ref.success.50}', '{ref.success.950}')),
  t('color.warning.surface', 'semantic', 'color', mode('{ref.warning.50}', '{ref.warning.950}')),
  t('color.accent.decorative', 'semantic', 'color', '#dfedaa', {
    description: 'Decoration only; never a status, text, or interactive colour.',
  }),
  t('color.text.primary', 'semantic', 'color', mode('{ref.neutral.900}', '{ref.neutral.50}')),
  t('color.text.secondary', 'semantic', 'color', mode('{ref.neutral.700}', '{ref.neutral.300}')),
  t('color.text.disabled', 'semantic', 'color', mode('{ref.neutral.400}', '{ref.neutral.600}'), {
    description:
      'Disabled text is exempt from contrast minimums (WCAG 1.4.3) but must still be distinguishable.',
  }),
  t('color.text.on-action', 'semantic', 'color', mode('{ref.neutral.0}', '{ref.neutral.950}')),
  t('color.border.default', 'semantic', 'color', mode('{ref.neutral.200}', '{ref.neutral.800}'), {
    description:
      'Decorative separators. Use color.border.strong for boundaries that identify controls.',
  }),
  t('color.border.strong', 'semantic', 'color', mode('{ref.neutral.500}', '{ref.neutral.400}')),

  // Card
  t('card.padding', 'component', 'dimension', '{layout.inset}'),
  t('card.radius', 'component', 'dimension', '{radius.lg}'),

  // Layout roles
  t('layout.gap', 'layout', 'dimension', '{space.md}'),
  t('layout.inset', 'layout', 'dimension', '{space.lg}'),
  t('layout.item-min', 'layout', 'dimension', '16rem'),
  t('layout.sidebar-width', 'layout', 'dimension', '16rem'),
  t('layout.main-min', 'layout', 'dimension', '20rem'),

  // Navigation component roles (side-nav)
  t('navigation.item.padding.inline', 'component', 'dimension', '{space.sm}'),
  t('navigation.item.padding.block', 'component', 'dimension', '{space.xs}'),
  t('navigation.item.min-height', 'component', 'dimension', '{control.height.md}', {
    minimum: 'target.min',
  }),
  t('navigation.item.gap', 'component', 'dimension', '{space.xs}'),
  t('navigation.indent', 'component', 'dimension', '{space.md}'),
];

/** What a contract protects; see theming-and-styling.md §10.4. */
export type ContrastConcern = 'text' | 'interaction' | 'focus' | 'invalid' | 'status' | 'disabled';

/**
 * A semantic colour contract: the foreground role must reach `minimum` (WCAG 2.x) against
 * every background role it is drawn on, in every mode and product. `minimum: 0` marks an
 * exemption: the pair is measured and reported but never warned about.
 */
export interface RoleContract {
  readonly concern: ContrastConcern;
  readonly foreground: string;
  readonly backgrounds: readonly string[];
  readonly minimum: number;
  /** WCAG 2.2 success criterion the minimum comes from. */
  readonly criterion: string;
  readonly use: string;
}

/** Page and component backgrounds a foreground role can be drawn on. */
const SURFACES = [
  'color.canvas',
  'color.surface.default',
  'color.surface.raised',
  'color.surface.sunken',
  'color.surface.hover',
] as const;

/**
 * Loading has no colour role: a busy control keeps its enabled colours and draws its indicator
 * in `currentColor`, so the text and interaction contracts cover it.
 */
export const ROLE_CONTRACTS: readonly RoleContract[] = [
  {
    concern: 'text',
    foreground: 'color.text.primary',
    backgrounds: [
      ...SURFACES,
      'color.surface.specimen',
      'color.danger.surface',
      'color.success.surface',
      'color.warning.surface',
    ],
    minimum: 4.5,
    criterion: '1.4.3',
    use: 'Body text and headings on every surface, including status surfaces.',
  },
  {
    concern: 'text',
    foreground: 'color.text.secondary',
    backgrounds: [...SURFACES, 'color.surface.specimen'],
    minimum: 4.5,
    criterion: '1.4.3',
    use: 'Supporting text, hints, and metadata.',
  },
  {
    concern: 'interaction',
    foreground: 'color.text.on-action',
    backgrounds: ['color.action.default', 'color.action.hover', 'color.action.pressed'],
    minimum: 4.5,
    criterion: '1.4.3',
    use: 'Labels of primary actions at rest, on hover, and pressed.',
  },
  {
    concern: 'interaction',
    foreground: 'color.selection.foreground',
    backgrounds: ['color.selection.background'],
    minimum: 4.5,
    criterion: '1.4.3',
    use: 'Labels of selected items (selection also has a non-colour marker).',
  },
  {
    concern: 'interaction',
    foreground: 'color.link',
    backgrounds: SURFACES,
    minimum: 4.5,
    criterion: '1.4.3',
    use: 'Link text on every surface.',
  },
  {
    concern: 'interaction',
    foreground: 'color.border.strong',
    backgrounds: SURFACES,
    minimum: 3,
    criterion: '1.4.11',
    use: 'Boundaries that identify controls (inputs, secondary buttons), at rest and on hover.',
  },
  {
    concern: 'focus',
    foreground: 'color.focus.ring',
    backgrounds: [...SURFACES, 'color.surface.specimen'],
    minimum: 3,
    criterion: '1.4.11',
    use: 'The focus outline, drawn at an offset over whatever surface surrounds the control.',
  },
  {
    concern: 'invalid',
    foreground: 'color.danger.foreground',
    backgrounds: [...SURFACES, 'color.danger.surface'],
    minimum: 4.5,
    criterion: '1.4.3',
    use: 'Error text and the border of invalid controls (text minimum, so borders exceed 3:1).',
  },
  {
    concern: 'status',
    foreground: 'color.success.foreground',
    backgrounds: [
      'color.canvas',
      'color.surface.default',
      'color.surface.raised',
      'color.success.surface',
    ],
    minimum: 4.5,
    criterion: '1.4.3',
    use: 'Success text and icons.',
  },
  {
    concern: 'status',
    foreground: 'color.warning.foreground',
    backgrounds: [
      'color.canvas',
      'color.surface.default',
      'color.surface.raised',
      'color.warning.surface',
    ],
    minimum: 4.5,
    criterion: '1.4.3',
    use: 'Warning text and icons.',
  },
  {
    concern: 'disabled',
    foreground: 'color.text.disabled',
    backgrounds: ['color.surface.sunken', 'color.surface.default', 'color.canvas'],
    minimum: 0,
    criterion: '1.4.3 (exception for inactive components)',
    use: 'Disabled labels; exempt from minimums, reported so they stay distinguishable.',
  },
];

/** Every background a role is contracted against (the union of its contracts). */
export function contractBackgrounds(foreground: string): readonly string[] {
  return [
    ...new Set(
      ROLE_CONTRACTS.filter((c) => c.foreground === foreground).flatMap((c) => c.backgrounds),
    ),
  ];
}

/** A role chosen from a ramp by measured WCAG contrast against another role. */
export interface ContrastRole {
  readonly name: string;
  readonly ramp: 'brand' | 'danger' | 'success' | 'warning';
  /** Roles the chosen colour must contrast with, all of them (resolved per mode). */
  readonly against: readonly string[];
  readonly minimum: number;
  /** Steps darker (light mode) or lighter (dark mode) than the chosen base step. */
  readonly shift?: number;
  /** Role whose chosen step this one shifts from (defaults to its own choice). */
  readonly from?: string;
}

/** A role chosen against every background its contracts name. */
const contracted = (name: string, ramp: ContrastRole['ramp'], minimum: number): ContrastRole => ({
  name,
  ramp,
  against: contractBackgrounds(name),
  minimum,
});

export const CONTRAST_ROLES: readonly ContrastRole[] = [
  { name: 'color.action.default', ramp: 'brand', against: ['color.text.on-action'], minimum: 4.5 },
  {
    name: 'color.action.hover',
    ramp: 'brand',
    against: ['color.text.on-action'],
    minimum: 4.5,
    from: 'color.action.default',
    shift: 1,
  },
  {
    name: 'color.action.pressed',
    ramp: 'brand',
    against: ['color.text.on-action'],
    minimum: 4.5,
    from: 'color.action.default',
    shift: 2,
  },
  contracted('color.link', 'brand', 4.5),
  contracted('color.focus.ring', 'brand', 3),
  contracted('color.danger.foreground', 'danger', 4.5),
  contracted('color.success.foreground', 'success', 4.5),
  contracted('color.warning.foreground', 'warning', 4.5),
];

/** Provisional named conditions. `shell` is the container the application shell declares. */
export const PRESET_CONDITIONS: Readonly<Record<string, ConditionConfig>> = {
  'page.medium': { media: { minWidth: '40rem' } },
  'page.wide': { media: { minWidth: '64rem' } },
  'navigation.expanded': { container: 'shell', minInlineSize: '48rem' },
  'motion.reduced': { media: { prefersReducedMotion: 'reduce' } },
};

/**
 * Provisional profiles: coordinated role overrides for denser regions. They reference only
 * the spacing steps every scale must define (xs, sm, md, lg).
 */
export const PRESET_PROFILES: Readonly<Record<string, ProfileConfig>> = {
  'navigation.compact': {
    'navigation.item.padding.inline': '{space.xs}',
    'navigation.item.padding.block': 'calc({space.xs} / 2)',
    'navigation.item.gap': 'calc({space.xs} / 2)',
    'navigation.indent': '{space.sm}',
  },
  'layout.compact': {
    'layout.gap': '{space.sm}',
    'layout.inset': '{space.md}',
  },
};
