import type { ResolvedTheme, TokenType } from '../../src/generate/index.js';
import { literal } from '../../src/generate/ts.js';

/** The property each token type is checked through in a browser. */
export const PROPERTY: Readonly<Record<TokenType, string>> = {
  color: 'color',
  dimension: 'margin-left',
  number: 'line-height',
  fontWeight: 'font-weight',
  fontFamily: 'font-family',
  shadow: 'box-shadow',
  duration: 'transition-duration',
  cubicBezier: 'transition-timing-function',
};

export interface Probe {
  readonly name: string;
  readonly property: string;
  /** Set where the token's value differs by mode. */
  readonly mode?: 'light' | 'dark';
}

/** One probe per token, and one per mode where its value differs by mode, in name order. */
export function probes(theme: ResolvedTheme): Probe[] {
  return [...theme.tokens.values()].flatMap((token) => {
    const property = PROPERTY[token.type];
    return typeof literal(theme, token.name) === 'string'
      ? [{ name: token.name, property }]
      : (['light', 'dark'] as const).map((mode) => ({ name: token.name, property, mode }));
  });
}

/**
 * A stylesheet that consumes every token through the Sass modules: `.value-<i>` through
 * `value()`, `.ref-<i>` through `token()`, and `.when-<j>` through each condition's `when()`.
 */
export function consumerScss(theme: ResolvedTheme): string {
  const lines = ["@use 'refs' as oddkin;", "@use 'values';", ''];
  probes(theme).forEach(({ name, property, mode }, i) => {
    lines.push(
      `.value-${i} { ${property}: values.value('${name}'${mode ? `, $mode: ${mode}` : ''}); }`,
      `.ref-${i} { ${property}: oddkin.token('${name}'); }`,
    );
  });
  [...theme.conditions.keys()].forEach((name, j) =>
    lines.push(`.when-${j} { @include oddkin.when('${name}') { --matched: 1; } }`),
  );
  return `${lines.join('\n')}\n`;
}
