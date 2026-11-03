/**
 * Display P3 values (theming-and-styling.md §10.7). With `gamut: "p3"`, a generated ramp step whose
 * chroma was reduced to fit sRGB also gets its colour mapped into Display P3, which the CSS declares
 * under `@media (color-gamut: p3)`; the sRGB values stay the baseline. A P3 value is kept only while
 * every contracted role pair that passes in sRGB still passes with the P3 values, in every mode and
 * product; otherwise it is held back, and its provenance says which pair.
 */
import type { Mode } from '../theme/types.js';
import {
  contrastRatio,
  formatOklch,
  gamutMapP3,
  isDisplayP3,
  parseColor,
  toDisplayP3,
  toHex,
  type Oklch,
} from './color.js';
import { isModeValues, resolveLiteral, type TokenDefinition, type TokenMap } from './graph.js';
import { ROLE_CONTRACTS } from './preset.js';
import type { ResolvedTheme } from './resolve.js';

/**
 * The least extra chroma over the sRGB colour that gets a P3 value: 0.02, the just-noticeable
 * difference (ΔEOK) of CSS Color 4's gamut mapping. At equal lightness and hue, ΔEOK is the chroma
 * difference, so a smaller gain would declare a colour no one can tell from the sRGB one.
 */
export const P3_MIN_GAIN = 0.02;

/** A ramp step's Display P3 value and its provenance text, when P3 keeps more chroma than sRGB. */
export function p3Step(
  requested: Oklch,
  mapped: Oklch,
): { readonly value: string; readonly provenance: string } | undefined {
  if (mapped.c >= requested.c - 1e-6) return undefined;
  const wide = gamutMapP3(requested);
  if (wide.c - mapped.c < P3_MIN_GAIN) return undefined;
  return { value: toDisplayP3(wide), provenance: `; Display P3: ${formatOklch(wide)}` };
}

/** The tokens with each P3 value in place of its sRGB value. */
export function withP3(tokens: TokenMap): Map<string, TokenDefinition> {
  const out = new Map(tokens);
  for (const [name, token] of tokens)
    if (token.p3 !== undefined) out.set(name, { ...token, value: token.p3 });
  return out;
}

/** A role's colour in a mode, as `#rrggbb` or `color(display-p3 …)`. */
function colorOf(tokens: TokenMap, name: string, mode: Mode): string | undefined {
  const literal = resolveLiteral(tokens, name, mode)?.trim();
  if (literal === undefined) return undefined;
  if (/^#[0-9a-f]{6}$/i.test(literal) || isDisplayP3(literal)) return literal.toLowerCase();
  const parsed = parseColor(literal);
  return parsed ? toHex(parsed) : undefined;
}

/** The token a role's colour comes from, following plain aliases (`{a}` → `{b}` → a literal). */
function source(tokens: TokenMap, name: string, mode: Mode): string {
  let current = name;
  for (let hops = 0; hops < 32; hops++) {
    const token = tokens.get(current);
    if (!token) break;
    const text = (isModeValues(token.value) ? token.value[mode] : token.value).trim();
    const alias = /^\{([^{}]+)\}$/.exec(text)?.[1];
    if (alias === undefined) break;
    current = alias;
  }
  return current;
}

const floor2 = (ratio: number) => Math.floor(ratio * 100) / 100;

/**
 * The theme without the P3 values that would make a contracted pair fail, in the base theme or a
 * product. Both colours of such a pair go back to sRGB, so the pair measures as it does in sRGB.
 * Pairs that fail in sRGB are the contrast check's to report.
 */
export function holdBackP3(theme: ResolvedTheme): ResolvedTheme {
  const base = new Map(theme.tokens);
  const scopes = theme.scopes.map((s) => ({ ...s, tokens: new Map(s.tokens) }));
  for (;;) {
    // The map that defines each held-back token, and why.
    const held = new Map<Map<string, TokenDefinition>, Map<string, string>>();
    const contexts = [
      {
        tokens: base as TokenMap,
        own: undefined as Map<string, TokenDefinition> | undefined,
        at: '',
      },
      ...scopes
        .filter((s) => s.kind === 'product')
        .map((s) => ({
          tokens: new Map([...base, ...s.tokens]) as TokenMap,
          own: s.tokens,
          at: `, product "${s.name}"`,
        })),
    ];
    for (const context of contexts) {
      const wide = withP3(context.tokens);
      for (const mode of theme.modes)
        for (const contract of ROLE_CONTRACTS) {
          if (contract.minimum === 0 || !context.tokens.has(contract.foreground)) continue;
          for (const background of contract.backgrounds) {
            if (!context.tokens.has(background)) continue;
            const fg = colorOf(context.tokens, contract.foreground, mode);
            const bg = colorOf(context.tokens, background, mode);
            const fgWide = colorOf(wide, contract.foreground, mode);
            const bgWide = colorOf(wide, background, mode);
            if (!fg || !bg || !fgWide || !bgWide) continue;
            if (contrastRatio(fg, bg) < contract.minimum) continue;
            const ratio = contrastRatio(fgWide, bgWide);
            if (ratio >= contract.minimum) continue;
            const reason = `${contract.foreground} on ${background} would be ${floor2(ratio)}:1 (${mode}${context.at}), below ${contract.minimum}:1`;
            for (const role of [contract.foreground, background]) {
              const name = source(context.tokens, role, mode);
              if (context.tokens.get(name)?.p3 === undefined) continue;
              const owner = context.own?.has(name) ? context.own : base;
              const names = held.get(owner) ?? new Map<string, string>();
              if (!names.has(name)) names.set(name, reason);
              held.set(owner, names);
            }
          }
        }
    }
    if (held.size === 0) break;
    for (const [owner, names] of held)
      for (const [name, reason] of names) {
        const { p3: _p3, ...token } = owner.get(name) as TokenDefinition;
        owner.set(name, {
          ...token,
          provenance: `${(token.provenance ?? '').replace(/; Display P3: [^;]*$/, '')}; Display P3 held back: ${reason}`,
        });
      }
  }
  return { ...theme, tokens: base, scopes };
}
