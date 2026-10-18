/**
 * CSS custom-property output. Each scope declares what it changes plus every alias
 * whose dependency closure includes those changes (ADR 0007). Mode-dependent roles are
 * single mode-agnostic expressions switched by two inherited toggles, so mode, product,
 * and density scopes nest in any order without cross-product selectors:
 *
 *   light: --odd-mode-light: initial;  --odd-mode-dark: ;
 *   dark:  --odd-mode-light: ;         --odd-mode-dark: initial;
 *   role:  var(--odd-mode-light, LIGHT) var(--odd-mode-dark, DARK)
 *
 * A guaranteed-invalid toggle (`initial`) selects its fallback; an empty toggle
 * contributes nothing. Contract: theming-and-styling.md §5.
 *
 * Declarations are emitted into the `odd.tokens` cascade layer after the canonical Oddkin
 * layer order (ADR 0039), so unlayered application CSS overrides generated values whatever
 * the stylesheet order. Contract: css-architecture.md §5.
 */
import type { Mode } from '../theme/types.js';
import {
  compileValue,
  cssVariable,
  dependents,
  MODE_TOGGLE,
  type TokenDefinition,
  type TokenMap,
} from './graph.js';
import type { ResolvedTheme } from './resolve.js';

type Declaration = readonly [property: string, value: string];

/**
 * The canonical order of Oddkin's document-level layers (ADR 0039). Every Oddkin stylesheet
 * that declares a layer repeats this statement first, so whichever loads first establishes
 * the same order. Application CSS that is unlayered, or in layers declared after `odd`,
 * overrides all of them.
 */
export const LAYER_ORDER = [
  'odd.reset',
  'odd.tokens',
  'odd.base',
  'odd.layout',
  'odd.components',
  'odd.utilities',
] as const;

export const DEFAULT_TOKEN_LAYER = 'odd.tokens';

export interface CssOptions {
  /**
   * Cascade layer for the declarations. Default `odd.tokens`, preceded by the canonical
   * layer order statement. Another name emits only that layer block; `false` emits
   * unlayered CSS.
   */
  readonly layer?: string | false;
}

const LAYER_NAME = /^-?[A-Za-z_][\w-]*(?:\.-?[A-Za-z_][\w-]*)*$/;

/** True for a valid cascade layer name such as `odd.tokens` or `vendor.theme`. */
export function isLayerName(name: string): boolean {
  return LAYER_NAME.test(name);
}

function block(
  selectors: readonly string[],
  declarations: readonly Declaration[],
  indent = '',
): string {
  if (declarations.length === 0) return '';
  const head = selectors.map((s) => `${indent}${s}`).join(',\n');
  const body = declarations.map(([p, v]) => `${indent}  ${p}: ${v};`).join('\n');
  return `${head} {\n${body}\n${indent}}\n`;
}

const toggles = (mode: Mode): Declaration[] => [
  ['color-scheme', mode],
  [MODE_TOGGLE.light, mode === 'light' ? 'initial' : ''],
  [MODE_TOGGLE.dark, mode === 'dark' ? 'initial' : ''],
];

function tokenDeclarations(
  tokens: Iterable<TokenDefinition>,
  modes: readonly Mode[],
): Declaration[] {
  return [...tokens].map((t) => [cssVariable(t.name), compileValue(t.value, modes)] as const);
}

/** Emit the theme as CSS custom properties. Deterministic: same theme and options, same bytes. */
export function emitCss(theme: ResolvedTheme, options: CssOptions = {}): string {
  const layer = options.layer ?? DEFAULT_TOKEN_LAYER;
  if (layer !== false && !isLayerName(layer))
    throw new TypeError(`emitCss: "${layer}" is not a valid cascade layer name.`);
  const header = `/* @oddkin/tokens — theme "${theme.name}". Generated file: change the theme configuration instead of editing it. */\n`;
  const body = emitBlocks(theme);
  if (layer === false) return [header, body].join('\n');
  const order = layer === DEFAULT_TOKEN_LAYER ? `@layer ${LAYER_ORDER.join(', ')};\n\n` : '';
  const indented = body
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
  return `${header}\n${order}@layer ${layer} {\n${indented.trimEnd()}\n}\n`;
}

function emitBlocks(theme: ResolvedTheme): string {
  const { modes, tokens } = theme;
  const parts: string[] = [
    block([':root', `[data-odd-theme="${theme.name}"]`], tokenDeclarations(tokens.values(), modes)),
  ];

  if (modes.length === 1) {
    parts.push(block([':root'], [['color-scheme', modes[0] as Mode]]));
  } else {
    const closure = [...dependents(tokens, new Set(['$mode']), modes)].map(
      (n) => tokens.get(n) as TokenDefinition,
    );
    const closureDeclarations = tokenDeclarations(closure, modes);
    // The root follows the system preference unless a mode is set explicitly.
    parts.push(block([':root'], toggles('light')));
    parts.push(
      `@media (prefers-color-scheme: dark) {\n${block([':root:not([data-odd-mode])'], toggles('dark'), '  ')}}\n`,
    );
    parts.push(block(['[data-odd-mode="light"]'], [...toggles('light'), ...closureDeclarations]));
    parts.push(block(['[data-odd-mode="dark"]'], [...toggles('dark'), ...closureDeclarations]));
    parts.push(block(['[data-odd-mode="system"]'], [...toggles('light'), ...closureDeclarations]));
    parts.push(
      `@media (prefers-color-scheme: dark) {\n${block(['[data-odd-mode="system"]'], toggles('dark'), '  ')}}\n`,
    );
  }

  for (const scope of theme.scopes) {
    const selectors =
      scope.kind === 'profile'
        ? [
            `[data-odd-profile~="${scope.name}"]`,
            // Nested scopes re-declare base expressions for their closures; re-apply the
            // profile inside them so it is not lost (specificity 0,2,0 over 0,1,0).
            `[data-odd-profile~="${scope.name}"] :is([data-odd-mode], [data-odd-product], [data-odd-density], [data-odd-theme])`,
          ]
        : [`[data-odd-${scope.kind}="${scope.name}"]`];
    parts.push(block(selectors, tokenDeclarations(scope.tokens.values(), modes)));
  }
  return parts.filter(Boolean).join('\n');
}

/** Number of declarations per block, for measuring rule growth across scope axes. */
export function cssStats(theme: ResolvedTheme): {
  base: number;
  mode: number;
  scopes: Record<string, number>;
} {
  const mode =
    theme.modes.length > 1
      ? dependents(theme.tokens as TokenMap, new Set(['$mode']), theme.modes).size
      : 0;
  return {
    base: theme.tokens.size,
    mode,
    scopes: Object.fromEntries(theme.scopes.map((s) => [`${s.kind}:${s.name}`, s.tokens.size])),
  };
}
