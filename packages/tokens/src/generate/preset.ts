/**
 * Provisional `mote-default` preset (M2). Values are validated in real components (M4,
 * M8) before being frozen. Brand and status roles are chosen by measured contrast at
 * generation time (see `ContrastRole`), not by fixed step numbers.
 */
import type { ExplicitSpacing } from '../theme/types.js';
import type { TokenCategory, TokenType, TokenValue } from './graph.js';

export interface PresetToken {
  readonly name: string;
  readonly category: TokenCategory;
  readonly type: TokenType;
  readonly value: TokenValue;
  readonly density?: boolean;
  readonly minimum?: string;
  readonly description?: string;
}

export const DEFAULT_SPACING: ExplicitSpacing = {
  strategy: 'explicit',
  steps: {
    none: '0',
    '2xs': '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
};

export const DEFAULT_STATUS = {
  danger: 'oklch(0.58 0.2 27)',
  success: 'oklch(0.6 0.15 150)',
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

export const PRESET_TOKENS: readonly PresetToken[] = [
  // Foundation
  t('radius.none', 'foundation', 'dimension', '0'),
  t('radius.sm', 'foundation', 'dimension', '0.25rem'),
  t('radius.md', 'foundation', 'dimension', '0.5rem'),
  t('radius.lg', 'foundation', 'dimension', '0.75rem'),
  t('radius.full', 'foundation', 'dimension', '9999px'),
  t('border.width.default', 'foundation', 'dimension', '1px'),
  t('border.width.strong', 'foundation', 'dimension', '2px'),
  t('focus.width', 'foundation', 'dimension', '2px'),
  t('focus.offset', 'foundation', 'dimension', '2px'),
  t(
    'font.family.sans',
    'foundation',
    'fontFamily',
    'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  ),
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
  t('font.weight.regular', 'foundation', 'fontWeight', '400'),
  t('font.weight.medium', 'foundation', 'fontWeight', '500'),
  t('font.weight.semibold', 'foundation', 'fontWeight', '600'),
  t('font.weight.bold', 'foundation', 'fontWeight', '700'),
  t('line-height.tight', 'foundation', 'number', '1.25'),
  t('line-height.normal', 'foundation', 'number', '1.5'),
  t('target.min', 'foundation', 'dimension', '1.5rem', {
    description:
      'Minimum interactive target size (WCAG 2.2 SC 2.5.8, 24 CSS px at the default root size).',
  }),

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

  // Semantic: neutral colour roles (fixed steps; checked by contrast pairs below)
  t('color.surface.default', 'semantic', 'color', mode('{ref.neutral.0}', '{ref.neutral.950}')),
  t('color.surface.raised', 'semantic', 'color', mode('{ref.neutral.0}', '{ref.neutral.900}')),
  t('color.surface.sunken', 'semantic', 'color', mode('{ref.neutral.50}', '{ref.neutral.1000}')),
  t('color.surface.hover', 'semantic', 'color', mode('{ref.neutral.100}', '{ref.neutral.800}')),
  t('color.surface.selected', 'semantic', 'color', mode('{ref.brand.50}', '{ref.brand.900}')),
  t('color.surface.danger', 'semantic', 'color', mode('{ref.danger.50}', '{ref.danger.950}')),
  t('color.surface.success', 'semantic', 'color', mode('{ref.success.50}', '{ref.success.950}')),
  t('color.text.primary', 'semantic', 'color', mode('{ref.neutral.900}', '{ref.neutral.50}')),
  t('color.text.secondary', 'semantic', 'color', mode('{ref.neutral.700}', '{ref.neutral.300}')),
  t('color.text.disabled', 'semantic', 'color', mode('{ref.neutral.400}', '{ref.neutral.600}'), {
    description:
      'Disabled text is exempt from contrast minimums (WCAG 1.4.3) but must still be distinguishable.',
  }),
  t('color.text.inverse', 'semantic', 'color', mode('{ref.neutral.0}', '{ref.neutral.950}')),
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

/** A role chosen from a ramp by measured WCAG contrast against another role. */
export interface ContrastRole {
  readonly name: string;
  readonly ramp: 'brand' | 'danger' | 'success';
  /** Roles the chosen colour must contrast with, all of them (resolved per mode). */
  readonly against: readonly string[];
  readonly minimum: number;
  /** Steps darker (light mode) or lighter (dark mode) than the chosen base step. */
  readonly shift?: number;
  /** Role whose chosen step this one shifts from (defaults to its own choice). */
  readonly from?: string;
}

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
    name: 'color.action.active',
    ramp: 'brand',
    against: ['color.text.on-action'],
    minimum: 4.5,
    from: 'color.action.default',
    shift: 2,
  },
  { name: 'color.text.link', ramp: 'brand', against: ['color.surface.default'], minimum: 4.5 },
  { name: 'color.focus.ring', ramp: 'brand', against: ['color.surface.default'], minimum: 3 },
  {
    name: 'color.text.danger',
    ramp: 'danger',
    against: ['color.surface.default', 'color.surface.danger'],
    minimum: 4.5,
  },
  { name: 'color.border.danger', ramp: 'danger', against: ['color.surface.default'], minimum: 3 },
  {
    name: 'color.text.success',
    ramp: 'success',
    against: ['color.surface.default', 'color.surface.success'],
    minimum: 4.5,
  },
];

/** Role pairs checked against WCAG 2.x after resolution (foreground, background, minimum). */
export const CONTRAST_PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ['color.text.primary', 'color.surface.default', 4.5],
  ['color.text.primary', 'color.surface.raised', 4.5],
  ['color.text.primary', 'color.surface.sunken', 4.5],
  ['color.text.primary', 'color.surface.hover', 4.5],
  ['color.text.primary', 'color.surface.selected', 4.5],
  ['color.text.secondary', 'color.surface.default', 4.5],
  ['color.text.on-action', 'color.action.default', 4.5],
  ['color.text.on-action', 'color.action.hover', 4.5],
  ['color.text.on-action', 'color.action.active', 4.5],
  ['color.text.link', 'color.surface.default', 4.5],
  ['color.focus.ring', 'color.surface.default', 3],
  ['color.border.strong', 'color.surface.default', 3],
  ['color.text.danger', 'color.surface.default', 4.5],
  ['color.text.danger', 'color.surface.danger', 4.5],
  ['color.border.danger', 'color.surface.default', 3],
  ['color.text.success', 'color.surface.default', 4.5],
  ['color.text.success', 'color.surface.success', 4.5],
];
