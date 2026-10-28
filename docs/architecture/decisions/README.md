# Architecture decision records

Each ADR records one decision: context, decision, consequences, the evidence it rests on, and what would make us revisit it. Detailed contracts stay in the architecture documents; ADRs record *why* and *when to reopen*.

**Statuses**
- **Proposed** — direction chosen; awaits the named experiment or evidence before it is relied on.
- **Accepted** — settled for v1 candidate contracts; changing it after M8 requires a superseding ADR, affected-consumer analysis, a migration plan, and renewed verification.
- **Superseded by NNNN** — replaced; kept for history.

Create a new ADR by copying [0000-template.md](./0000-template.md) to the next number. Never renumber or delete ADRs.

## Log

| # | Title | Status | Area |
| --- | --- | --- | --- |
| [0001](./0001-adr-process.md) | ADR process and change control | Accepted | Process |
| [0002](./0002-reactivity-and-binding-rule.md) | One reactive graph, scheduling, and the binding rule | Accepted | Core |
| [0003](./0003-property-definitions.md) | Typed property definitions via `OddkinElement.with()` | Accepted | Core |
| [0004](./0004-scope-and-reconnection.md) | `Scope` ownership and reconnection | Accepted | Core |
| [0005](./0005-rendering-and-template-security.md) | Tagged-template rendering and security model | Accepted | Core |
| [0006](./0006-colour-generation.md) | OKLCH colour generation, gamut mapping, contrast | Proposed | Tokens |
| [0007](./0007-alias-scope-redeclaration.md) | Alias-closure re-declaration in scopes | Accepted | Tokens |
| [0008](./0008-style-delivery-and-csp.md) | Style delivery and CSP | Accepted | Core |
| [0009](./0009-browser-support-baseline.md) | Browser support baseline | Accepted | Platform |
| [0010](./0010-layout-recipes-and-cascade-layers.md) | Layout recipe model and cascade layering | Proposed | Layout |
| [0011](./0011-container-query-baseline.md) | Container/media query compatibility baseline | Accepted | Layout |
| [0012](./0012-token-categories-conditions-profiles.md) | Token categories, conditions, and profiles | Proposed | Tokens |
| [0013](./0013-component-data-models.md) | Component data models and region sources | Proposed | Data |
| [0014](./0014-collections-and-invalidation.md) | Shared collections and keyed invalidation | Proposed | Data |
| [0015](./0015-model-builder-source-of-truth.md) | Model builder as source of truth | Proposed | Data |
| [0016](./0016-normalized-metadata-model.md) | Normalized metadata model, stable ids, provenance | Accepted | Metadata |
| [0017](./0017-cem-and-enrichment.md) | Standard CEM plus separate Oddkin enrichment | Accepted | Metadata |
| [0018](./0018-analyzer-front-end.md) | Analyzer front end and no-execution rule | Accepted | Metadata |
| [0019](./0019-preview-isolation.md) | Workbench preview isolation and frame protocol | Proposed | Workbench |
| [0020](./0020-specimen-roles-and-adapters.md) | Theme Studio specimen roles and adapters | Accepted | Workbench |
| [0021](./0021-define-examples.md) | `defineExamples` format | Accepted | Workbench |
| [0022](./0022-agent-boundaries.md) | `@oddkin/agent` boundaries and MCP adapter | Proposed | Agent |
| [0023](./0023-page-registry.md) | Page registry as single navigation source | Accepted | Workbench |
| [0024](./0024-content-layers.md) | Content layers and precedence | Accepted | Workbench |
| [0025](./0025-baseline-vs-draft.md) | Baseline vs draft on foundation pages | Accepted | Workbench |
| [0026](./0026-products-and-modes.md) | Products and modes sources and discovery | Accepted | Workbench |
| [0027](./0027-updated-date-provenance.md) | Updated-date provenance | Accepted | Metadata |
| [0028](./0028-legacy-route-redirects.md) | Legacy route redirects | Proposed | Workbench |
| [0029](./0029-versioning-checkpoints.md) | M8 compatibility checkpoint and M12 final freeze | Accepted | Process |
| [0030](./0030-workbench-remount-policy.md) | Workbench preview remount policy | Accepted | Workbench |
| [0031](./0031-dev-prod-builds-and-size-budget.md) | Development/production builds and core size budget | Accepted | Core |
| [0032](./0032-generated-agent-kits.md) | Generated agent kits and project context | Proposed | Agent |
| [0033](./0033-multi-product-foundations.md) | Multi-product foundations, recomposition, and product scale | Proposed | Components / Theming / Tooling |
| [0034](./0034-change-impact-and-conformance.md) | Change impact, portable conformance, explanations, and reproductions | Proposed | Tooling / Verification |
| [0035](./0035-page-suspension-and-restoration.md) | Page suspension and back/forward cache restoration | Accepted | Core / App |
| [0036](./0036-component-composition-api.md) | Component composition API: `compose()` and `define(definition)` | Accepted | Core |
| [0037](./0037-naming-contract.md) | Naming contract: Oddkin, `odd-`, and `oddkin` | Accepted | Process / Distribution |
| [0038](./0038-css-compatibility-and-progressive-enhancement.md) | CSS compatibility policy and progressive enhancement | Accepted | Platform |
| [0039](./0039-cascade-layer-order.md) | Cascade layer order for document-level styles | Accepted | Platform |
| [0040](./0040-ai-interaction-package.md) | AI interaction package: records, controllers, adapters, and elements | Accepted | Components / AI |
| [0041](./0041-approved-default-palette-and-roles.md) | Approved default palette, role vocabulary, and text-style roles | Accepted | Tokens |
| [0042](./0042-complete-foundation-scales.md) | Complete foundation scales: radius, elevation, motion, stacking, and type | Accepted | Tokens |
| [0043](./0043-composite-dependency-mechanism.md) | Composite dependency mechanism: element-reference parts and definition roles | Accepted | Core / Components |
| [0044](./0044-overlay-positioning-and-top-layer.md) | Overlay positioning and the top layer | Accepted | Components / Core / Platform |
| [0045](./0045-api-vocabulary.md) | API vocabulary for elements: names, values, events, form behavior | Accepted | Components / AI / Metadata |
| [0046](./0046-plan-audit-2026-10-26.md) | Plan audit (2026-10-26): revised decisions | Accepted | Platform / Components / Agent / Process |
| [0047](./0047-m8-checkpoint-candidate-v1-contracts.md) | M8 checkpoint: candidate v1 contracts, assurance and comprehension reviews | Proposed | Process / Contracts |
