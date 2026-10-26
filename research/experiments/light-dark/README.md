# `light-dark()` for colour tokens (ADR 0046 D2)

[ADR 0046](../../../docs/architecture/decisions/0046-plan-audit-2026-10-26.md) D2 asks whether the token generator should write each colour that differs by mode once, as `light-dark(LIGHT, DARK)`, with mode scopes setting only `color-scheme`, instead of today's inherited mode toggles (`var(--odd-mode-light, LIGHT) var(--odd-mode-dark, DARK)`, re-declared in every mode scope with their aliases; [theming-and-styling.md](../../../docs/architecture/theming-and-styling.md) §5.1). The rule: adopt it for colours if it is smaller and equivalent. Values that are not colours keep the toggles either way.

The measurement goes through the canonical generator: `generate(config, { css: { modeColors: 'light-dark' } })`. The option is experimental, and the default (`'toggles'`) output is unchanged byte for byte (`packages/tokens/test/mode-colors.test.ts`, 5 tests; 9 of 9 mutants of the option killed).

```sh
npx tsc -b packages/tokens
node research/experiments/light-dark/measure.mjs [--engines chromium,firefox,webkit] [--json out.json]
```

## Result (2026-10-26): smaller, not equivalent. Not adopted

### Bytes

gzip level 9, as `research/benchmarks/size/measure.mjs` measures `tokens:default.css`:

| Theme | Toggles (raw / gzip) | `light-dark()` (raw / gzip) | gzip change | Mode-scope declarations |
| --- | --- | --- | --- | --- |
| Default (`packages/tokens/themes/default.theme.json`) | 28,155 / 3,067 | 16,775 / 2,899 | −168 (−5.5%) | 40 → 4 |
| `products-density` test case (two products, two densities, profiles) | 39,194 / 3,416 | 24,072 / 3,214 | −202 | 40 → 4 |
| `examples/tokens-css-only` (harbor) | 34,988 / 3,206 | 20,442 / 3,011 | −195 | 40 → 4 |

The default theme has 29 colours that differ by mode and 4 shadows. With `light-dark()`, only the 4 shadows stay in the mode scopes. The 7 colour aliases (`color.focus.ring`, `color.link`, …) leave the mode scopes because they resolve where they are used, as their targets do. `generate()` takes 6.4 ms instead of 6.1 ms per call for the default theme in Node.

### Equivalence in a real cascade

The script builds 22 probes per theme:
- root default;
- light, dark, and system mode scopes, nested both ways;
- products and densities inside modes;
- a profile;
- a nested `data-odd-theme`;
- several axes on one element;
- shadow roots without the CSS (scopes inside them do nothing), with it adopted (scopes inside them apply), and two levels deep;
- slotted content under a scope around the slot.

On each probe it reads every colour token through `color` and every shadow token through `box-shadow`, under each output, then compares. Probes set `forced-color-adjust: none` so that token values stay observable in forced colours.

| Engine | Light and dark preference | Forced colours (Playwright emulation), light and dark preference |
| --- | --- | --- |
| Chromium 156 | Identical on 21 probes × 3 themes | Identical on 21 probes |
| Firefox 157 | Identical on 21 probes × 3 themes | **Differs** on the light-DOM probes in dark scopes: 8 probes with a light preference, 10 with a dark preference (the root and `system` probes too), × 36 colours, for each theme. The probes inside shadow roots matched |
| WebKit 27.2 | Identical on 21 probes × 3 themes | Identical, but WebKit's emulation forces no colours (only the media query matches), so this says nothing |

The 22nd probe (an author `color-scheme: dark` without `data-odd-mode`) differs in every engine by design; see below.

`resolveToken` and the DTCG output are identical: neither reads the CSS output.

### Where it is not equivalent

1. **Forced colours in Firefox.** On elements whose colours are forced, Firefox computes `color-scheme` as `normal`, and descendants inherit that. Content that opts out with `forced-color-adjust: none` inside a dark scope therefore gets the light value of every `light-dark()` colour. The toggles keep the scope's mode. Chromium computes `light dark` there but still resolves the author's scheme, so it matches. Checked separately with a bare `light-dark(rgb(1, 1, 1), rgb(2, 2, 2))` in each engine. Oddkin's own components do not opt out, but applications may, for example for colour swatches or charts.
2. **An author `color-scheme` without `data-odd-mode`.** A subtree with `color-scheme: dark` inside a light scope flips every `light-dark()` colour, while the toggled values (shadows) stay light. The result is a mixed state. With the toggles, only `data-odd-mode` switches modes, and it switches everything together.
3. **Script-visible values.** `getComputedStyle(el).getPropertyValue('--odd-color-action-default')` returns `light-dark(#6250e8, #b4a8ff)` instead of the resolved `#b4a8ff`. Code that reads token colours from computed style, such as canvas charts or colour pickers seeded from a theme, would have to resolve them itself.
4. **Inspection.** `emitInspectJson` still reports the toggled `css` expression and the 40-token mode closure. Adoption would have to move the compile and closure rules into the token graph, so that the inspection, `cssStats`, and the CSS agree. This is not a behaviour difference, but it is a cost.

Theme Studio regenerates through `generate()` in a module Worker. The option changes only `emitCss`, so regeneration would follow without other changes. Nothing in Theme Studio reads computed custom properties.

## Decision

Not adopted (ADR 0046 D2's trigger: "the measurement shows … an inequivalence"). The toggles stay the output for every mode-dependent value. `light-dark-function` returns to declined in [features.json](../../../docs/compatibility/features.json), with this evidence. The option stays as an experiment for re-measuring.

Revisit if both of these change:
- Firefox resolves `light-dark()` with the author's scheme in forced colours (as Chromium does);
- the 168 B gzip matters against the `tokens:default.css` budget (3,072 B).
