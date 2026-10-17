/**
 * CSS custom-property output. Each scope declares what it changes plus every alias
 * whose dependency closure includes those changes (ADR 0007). Mode-dependent roles are
 * single mode-agnostic expressions switched by two inherited toggles, so mode, product,
 * and density scopes nest in any order without cross-product selectors:
 *
 *   light: --mote-mode-light: initial;  --mote-mode-dark: ;
 *   dark:  --mote-mode-light: ;         --mote-mode-dark: initial;
 *   role:  var(--mote-mode-light, LIGHT) var(--mote-mode-dark, DARK)
 *
 * A guaranteed-invalid toggle (`initial`) selects its fallback; an empty toggle
 * contributes nothing. Contract: theming-and-styling.md §5.
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

/** Emit the theme as CSS custom properties. Deterministic: same theme, same bytes. */
export function emitCss(theme: ResolvedTheme): string {
  const { modes, tokens } = theme;
  const parts: string[] = [
    `/* @mote/tokens — theme "${theme.name}". Generated file: change the theme configuration instead of editing it. */\n`,
    block(
      [':root', `[data-mote-theme="${theme.name}"]`],
      tokenDeclarations(tokens.values(), modes),
    ),
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
      `@media (prefers-color-scheme: dark) {\n${block([':root:not([data-mote-mode])'], toggles('dark'), '  ')}}\n`,
    );
    parts.push(block(['[data-mote-mode="light"]'], [...toggles('light'), ...closureDeclarations]));
    parts.push(block(['[data-mote-mode="dark"]'], [...toggles('dark'), ...closureDeclarations]));
    parts.push(block(['[data-mote-mode="system"]'], [...toggles('light'), ...closureDeclarations]));
    parts.push(
      `@media (prefers-color-scheme: dark) {\n${block(['[data-mote-mode="system"]'], toggles('dark'), '  ')}}\n`,
    );
  }

  for (const scope of theme.scopes) {
    parts.push(
      block(
        [`[data-mote-${scope.kind}="${scope.name}"]`],
        tokenDeclarations(scope.tokens.values(), modes),
      ),
    );
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
