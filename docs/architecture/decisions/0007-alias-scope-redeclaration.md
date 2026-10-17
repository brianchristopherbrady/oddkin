# 0007. Alias-closure re-declaration in scopes

- **Status:** Accepted
- **Date:** 2026-10-17
- **Area:** Tokens
- **Detailed contract:** [theming-and-styling.md §5](../theming-and-styling.md)

## Context
CSS resolves `var()` at computed-value time where a property is declared, then inherits the resolved value. Overriding a reference token in a nested scope does not re-resolve aliases inherited from ancestors.

## Decision
Every generated scope (theme, product, mode, density, profile) emits its overridden tokens **and** every alias whose dependency closure includes them, re-declared with its `var()` expression. The re-declaration set is computed from the token graph and recorded in inspection metadata.

## Alternatives considered
- Override only reference tokens — nested scopes silently keep ancestor values.
- Redeclare every alias in every scope — correct but large CSS.

## Consequences
CSS size grows with scope axes; M2/M9 measure rule growth and avoid generating unnecessary cross-products.

## Evidence
R26 (CSS custom properties). Pending: M2 CSS-only fixture with nested scopes in three engines.

## Revisit when
A standard mechanism (e.g. CSS `@property`-based late resolution) removes the inheritance problem across baseline browsers.