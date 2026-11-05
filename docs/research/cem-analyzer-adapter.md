# The community CEM analyzer: adapter or plugin? (P1.6, 2026-11-05)

IMPLEMENTATION_PLAN.md §5c asks for an evaluation of "a thin adapter/plugin for the existing CEM Analyzer ecosystem after the Oddkin vertical slice", reusing its interchange format without making that analyzer a requirement, and §12 lists it as an M8/M11 go/no-go. This note records one experiment and the decision. Agent 2, round 11, row 8.

## What was run

`@custom-elements-manifest/analyzer` 0.11.0, the npm `latest` on 2026-11-05 (it depends on TypeScript `~5.4.2` and writes `schemaVersion` `1.0.0`), installed in a temporary folder outside the repository. No plugin, no configuration.

1. **Oddkin components.** `cem analyze --globs src/**/*.ts` on copies of `packages/components/src/button/` and `src/card/` (examples left out), compared with the manifest `@oddkin/analyzer` publishes for the same elements (`packages/components/custom-elements.json`, schema 2.1.0).
2. **A library not built with Oddkin.** `cem analyze --globs chip.js index.js` on `tests/consumers/workbench/plain-widgets` (plain custom elements; its tracked manifest is written by hand), then `oddkin-analyze --manifest custom-elements.json` and `oddkin-impact snapshot` on the result.

## What it found

**Oddkin components, without a plugin:**

| Fact | `odd-button`: community analyzer | `odd-button`: Oddkin | `odd-card`: community analyzer | `odd-card`: Oddkin |
| --- | --- | --- | --- | --- |
| Tag name, custom element, registration | none | `odd-button`, `define()` entry | none | `odd-card`, `define()` entry |
| Superclass | none | `OddkinElement` | none | `OddkinElement` |
| Public fields | 1 (`form`, a getter) | 17 | 0 | 3 |
| Attributes | 0 | 16 | 0 | 3 |
| Events | 0 | 2 | 0 | 0 |
| Slots, parts, CSS properties | 3, 2, 6 (the JSDoc tags) | 3, 2, 6 | 3, 4, 6 (the JSDoc tags) | 3, 4, 6 |

It reads JSDoc tags and plain class members. Everything Oddkin defines in code it does not see: the properties and attributes of `OddkinElement.with({ … prop.* … })`, `static events`, and the registration that `define(definition)` makes in another module from a `compose()` definition.

**A plain library:** the community analyzer finds `<plain-chip>`, its registration (`custom-element-definition` in `chip.js`), its three observed attributes, and its four properties. It also lists, as fields of the element, four assignments to other objects in its constructor (`adoptedStyleSheets`, `name`, `textContent`, `type`), and it finds no event, slot, part, or CSS custom property, since the fixture creates them in code without JSDoc tags. Oddkin's tools read that 1.0.0 manifest unchanged: `oddkin-analyze --manifest` wrote the examples-only metadata, and the snapshot has the component, its registration, its attributes and properties (the four stray ones too), and its three examples, with nothing unresolved and no metadata diagnostic. `tests/libraries-without-oddkin/examples.test.ts` keeps that manifest (`plain-chip.cem-analyzer.json`) and checks that Workbench, change impact, and the kits read it.

## Decision

- **No plugin.** For the community analyzer to describe an Oddkin component, a plugin would have to repeat what `@oddkin/analyzer`'s extraction does (`extract.ts`, about 2,100 lines: `prop.*` kinds, types, attributes, reflection, and defaults; events; definitions, templates, and styles across modules; registrations), on TypeScript 5.4 instead of 5.9, and its 1.0.0 manifests would drop 2.x facts such as custom states. An Oddkin library runs `oddkin-analyze`, which writes the same interchange format at 2.1.0, and the community's consumers read it: `verify:packs` runs `custom-element-vs-code-integration` on Oddkin's manifests.
- **No adapter.** The other direction already works without one: a library whose manifest comes from the community analyzer goes through the standard-CEM path (ADR 0048) as it is.
- **What such a library should know:** the manifest is only as accurate as its source. Elements that create slots, parts, events, and CSS custom properties in code should declare them with the JSDoc tags the community analyzer reads (`@slot`, `@csspart`, `@fires`, `@cssprop`); otherwise Workbench, change impact, and the kits cannot know them, and stray fields appear as properties.
- **Revisit** when a pilot team keeps the community analyzer for a library that mixes in Oddkin components, or when its next major release changes the plugin API or the schema version it writes.
