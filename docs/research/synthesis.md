# Research synthesis: existing approaches and what Mote should learn

Desk research reviewed 17 October 2026. Observations come from official documentation or upstream source. The Mote column is design judgment, not an upstream claim. Reference IDs resolve to the source register below.

Executable comparisons (equivalent samples, benchmarks, usability walkthroughs) are implementation tasks tracked in [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) §8, M3, and M8; direct research links are in §12. Mutable docs and `main` branches must be pinned again before reproducible comparisons are published.

## Comparison

| System | Existing approach and useful lesson | Proposed Mote response and trade-off |
| --- | --- | --- |
| Lit | LitElement builds on ReactiveElement; cached templates, batched updates, controllers, and optional tasks provide a small authoring model. Tasks already combine request cancellation with ignoring superseded results. [R01–R03] | Retain familiar HTML bindings and composable behavior. Unify connection, effect, and request ownership through `Scope`; add direct readable bindings. Extra subscriptions and ownership bookkeeping must justify their cost. |
| Microsoft FAST | FASTElement adds observed properties and template bindings to `HTMLElement`; directives and composition support reusable behavior. [R04] | Learn from targeted bindings and explicit property conversion. Offer a plain JS/TS path without mandatory decorators. Do not claim fine-grained binding is a Mote invention. |
| Web Awesome / Shoelace lineage | A component suite demonstrates discoverable property/event/slot contracts, CSS custom properties, parts, editor support, and adoption guides. [R05] | Make consuming components as important as authoring them. Generate docs and controls from verified metadata, and ship explicit registration entries. A custom framework alone does not provide this product quality. |
| Spectrum Web Components | SpectrumElement combines LitElement with SpectrumMixin. Direction styling uses native `:dir()` and logical CSS instead of a JS observer per element. [R06] | Prefer browser inheritance and CSS when they solve the problem. Keep locale services and advanced overlays optional. |
| Material Web | Buttons combine Lit with form, ARIA, focus, and interaction behaviors. README reports maintenance mode pending new maintainers. [R07] | Study concrete behavior contracts independently of project status. Give forms and accessible naming their own validation milestone; inheriting a base class does not make either automatic. |
| SAP UI5 Web Components | UI5Element extends `HTMLElement` with state/runtime context and distinct enter, before-render, after-render, and exit hooks. Enterprise density, i18n/RTL, and scoping for version collisions. [R08] | Make lifecycle names and timing explicit. Separate cheap authoring mechanics from optional localization and application context. Keep rich metadata out of minimal runtime imports. |
| Stencil / Ionic | Stencil compiles TS/JSX/CSS into custom elements; Ionic distributes Stencil-built components. Stencil distinguishes repeated connection from one-time loading. [R09] | Ship a runtime authoring path first. Any compiler or hydration system is a later, measured enhancement. Preserve reconnect semantics without a mandatory build transform. |
| React | Effects have setup/cleanup semantics; external stores need stable subscriptions and snapshots. React Compiler can automate memoization. [R10–R12] | Prefer owned reactive effects without dependency arrays. Expose a usable external-store contract. Compare optimized production applications fairly. |
| Angular | Signals and lazy computed values coexist with `DestroyRef`, `takeUntilDestroyed`, and resources that receive an abort signal. Zoneless operation is supported. [R13–R16] | Combine these ownership lessons in one explicit scope API, without DI or RxJS. Do not compare against older change detection. |
| Vue | Watcher invalidation can clean up a previous request; flush timing is explicit. [R17] | Define exactly when an effect cleans up and runs. Make resources the normal asynchronous path. |
| Svelte | Effects have teardown; `getAbortSignal()` follows an effect or derived lifetime. [R18–R19] | Offer comparable cancellation ease without a compiler, using an explicit callback scope. |
| Solid | Fine-grained signals, derivations, and targeted reactions avoid broad work. [R20] | One signal graph across local state, templates, and optional stores. Measure allocation and subscription overhead too. |

## Conclusions

1. **Ownership is the central abstraction.** One `Scope` owns listeners, timers, effects, observers, subscriptions, and child work. A connection, an effect run, and a request have different lifetimes and must not share one permanently reused controller.
2. **One reactive model.** Local signals, public reactive properties, store selectors, context readables, and resources feed the same graph.
3. **Targeted updates are ordinary.** Cache static template structure, update concrete binding parts, preserve node identity. Derived state is pure; effects are for side effects.
4. **The default authoring path is small.** A counter needs a base class, a signal, a template, and registration — no provider, reducer, app root, decorator transform, compiler, or theme generator.
5. **A complete system through optional modules.** Routing, resources, persistence, forms, focus, observers, and inspection compose through the same ownership protocol. Consumers can keep React, Angular, Vue, or plain DOM code as the state owner.
6. **Delivery and documentation are framework features.** Public exports, no-build examples, useful errors, metadata, migration guides, and a theme pipeline matter as much as syntax.
7. **Prove improvements.** Browser standards improve interoperability; they do not guarantee lower CPU cost, smaller bundles, simpler accessibility, or faster startup.

**Differentiation thesis:** a coherent combination of an understandable browser-based authoring core, explicit automatic cleanup, binding-level reactivity, first-class token tooling, and optional application services with compatible semantics. The constituent ideas exist elsewhere; implementation and evidence must establish the value of the combination.

## Source register

Authoritative for source identities. IDs are stable. **Status:** *mapped* = direct primary-source URL whose identity clearly matches the entry; *unresolved* = no URL confirmed yet (see note). A mapped citation does not by itself complete an experiment or substantiate every claim about the source. Record the version/commit and access date in the ADR or experiment that relies on an entry. Direct links for further research: [IMPLEMENTATION_PLAN.md §12](../../IMPLEMENTATION_PLAN.md).

| ID | Primary source | URL | Status | Relevant evidence |
| --- | --- | --- | --- | --- |
| R01 | Lit lifecycle | https://lit.dev/docs/components/lifecycle/ | mapped | Reactive updates, microtasks, native callbacks, completion boundaries |
| R02 | Lit reactive controllers | https://lit.dev/docs/composition/controllers/ | mapped | Composable host lifecycle behavior |
| R03 | Lit async tasks | https://lit.dev/docs/data/task/ | mapped | Task states, superseded results, forwarding abort signals |
| R04 | FASTElement | https://fast.design/docs/3.x/getting-started/fast-element/ | mapped (pin release before comparison) | Base class, observability, property/attribute behavior, templates |
| R05 | Web Awesome usage, customizing and theming | https://webawesome.com/docs/ | mapped (landing; exact usage/theming pages to pin) | Public component API, editor metadata, parts/custom properties, framework guides |
| R06 | Spectrum base | https://opensource.adobe.com/spectrum-web-components/ | unresolved — docs root only; exact `SpectrumElement` base page not confirmed | SpectrumElement/LitElement relationship, direction inheritance and logical CSS |
| R07 | Material Web repository, button source | https://github.com/material-components/material-web | mapped (repo; pin button source path + commit) | Maintenance notice and Lit/form/ARIA composition |
| R08 | UI5 development model | https://ui5.github.io/webcomponents/ | unresolved — docs root only; development-model page not confirmed | UI5Element, runtime context, property/decorator/lifecycle API |
| R09 | Stencil introduction, lifecycle, Ionic core | https://stenciljs.com/docs/introduction · https://stenciljs.com/docs/component-lifecycle · https://github.com/ionic-team/ionic-framework | mapped (lifecycle and Ionic core paths to verify) | Compiler model, reconnection vs one-time loading, distribution |
| R10 | React effects | https://react.dev/reference/react/useEffect | mapped | Setup/cleanup and asynchronous synchronization |
| R11 | React `useSyncExternalStore` | https://react.dev/reference/react/useSyncExternalStore | mapped | Stable subscriptions and cached snapshots |
| R12 | React Compiler introduction | https://react.dev/learn/react-compiler | mapped | Build-time memoization and contemporary comparison configuration |
| R13 | Angular signals | https://angular.dev/guide/signals | mapped | Lazy memoized computed state and dependency tracking |
| R14 | Angular lifecycle, `takeUntilDestroyed` | https://angular.dev/guide/components/lifecycle · https://angular.dev/api/core/rxjs-interop/takeUntilDestroyed | mapped | Scoped teardown through `DestroyRef` |
| R15 | Angular resources, resource API | https://angular.dev/guide/signals/resource | mapped (API reference page to pin) | Abort signal, source changes, loading state, read/mutation distinction |
| R16 | Angular zoneless | https://angular.dev/guide/zoneless | mapped | Signal/listener-driven notifications without ZoneJS |
| R17 | Vue watchers | https://vuejs.org/guide/essentials/watchers.html | mapped | Invalidation cleanup, async caveats, flush timing |
| R18 | Svelte effects | https://svelte.dev/docs/svelte/$effect | mapped | Tracking and teardown |
| R19 | Svelte `getAbortSignal` | https://svelte.dev/docs/svelte/svelte#getAbortSignal | mapped | Native signal tied to effect/derived lifetime |
| R20 | Solid fine-grained reactivity | https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity | mapped | Signals, derived computations, targeted subscriptions |
| R21 | MDN custom elements | https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements | mapped (normative: HTML custom elements spec, §12.3) | Native lifecycle, parser timing, connection-preserving moves |
| R22 | MDN `addEventListener` | https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener | mapped | Listener options and AbortSignal-based removal |
| R23 | MDN `AbortSignal`, `timeout` | https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal · https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static | mapped | Cancellation reasons, composition, timeout caveats |
| R24 | js-framework-benchmark source and method | https://github.com/krausest/js-framework-benchmark | mapped (pin commit) | Keyed/non-keyed identity distinction |
| R25 | MDN `adoptedStyleSheets` | https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets | mapped | Constructed sheet reuse and owning-document restrictions |
| R26 | CSS Custom Properties specification | https://www.w3.org/TR/css-variables-1/ | mapped | Computed-value substitution before inheritance |
| R27 | Sass variables | https://sass-lang.com/documentation/variables/ | mapped | Build-time Sass variables vs CSS custom properties |
| R28 | Node TypeScript support | https://nodejs.org/api/typescript.html | mapped (pin Node version) | Erasable syntax, type stripping, tsconfig and package limitations |
| R29 | DTCG Format Module 2025.10 | https://www.designtokens.org/tr/2025.10/format/ | mapped | Token exchange format, types, aliases |
| R30 | WAI-ARIA APG, WCAG contrast guidance | https://www.w3.org/WAI/ARIA/apg/ · https://www.w3.org/TR/WCAG22/ | mapped | Keyboard patterns and contrast requirements |
| R31 | MDN `requestSubmit`, `ElementInternals` | https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/requestSubmit · https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals | mapped (normative: HTML form submission, §12.3) | Submitter requirements, form values, validation |
| R32 | React custom HTML elements | https://react.dev/reference/react-dom/components#custom-html-elements | mapped | Attribute/property distinctions, property availability during construction |
| R33 | Custom Elements Manifest schema and specification | https://github.com/webcomponents/custom-elements-manifest | mapped (pinned `custom-elements-manifest@2.1.0`) | Interoperable component metadata; what standard CEM can and cannot express |
| R34 | Custom Elements Manifest analyzer | https://custom-elements-manifest.open-wc.org/analyzer/getting-started/ | mapped | Existing extraction and plugin model; adapter feasibility |
| R35 | Agent Skills specification | https://agentskills.io/specification | mapped | `SKILL.md` front matter (`name`, `description`), `references/` loaded on demand; packaging target for generated kits |
| R36 | AGENTS.md | https://agents.md/ | mapped | Repository guidance for coding agents: setup commands, conventions, verification |
| R37 | llms.txt proposal | https://llmstxt.org/ | mapped | Small discovery index plus clean Markdown page versions; client loading is not guaranteed |
| R38 | MCP tools specification (revision 2026-07-28) | https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx | mapped (pin revision in the M11 adapter ADR) | `inputSchema`/`outputSchema`, `structuredContent`, tool execution errors (`isError`), deterministic tool listing |
| R39 | Web Awesome Agent Skills | https://webawesome.com/docs/ai/agent-skills | mapped (labelled experimental by the source) | Component skill generated from CEM per build; hand-authored design skill whose API references are checked on every build; progressive disclosure |
| R40 | Angular CLI MCP server | https://angular.dev/ai/mcp | mapped | CLI-hosted MCP tools for generation, workspace analysis, builds and tests, paired with agent skills |
| R41 | shadcn registry MCP | https://ui.shadcn.com/docs/registry/mcp | mapped (page resolves; content not yet reviewed) | Registry-backed component discovery and installation through MCP |
| R42 | FAST 1.x: creating a component library | https://fast.design/docs/1.x/design-systems/creating-a-component-library/ | mapped (historical, version-specific; current FAST is 3.x, R04) | `FoundationElement`: tag names, templates, styles, and configuration supplied at registration |
| R43 | FAST source repository | https://github.com/microsoft/fast | mapped (pin a commit when used) | Current foundation/element architecture and how 1.x composition evolved |
| R44 | Lit styles | https://lit.dev/docs/components/styles/ | mapped | Composed `static styles` arrays, inheritance, shared static styles, `css` interpolation limits |
| R45 | Spectrum Web Components theme API | https://opensource.adobe.com/spectrum-web-components/tools/theme/api/ | mapped | Independently scoped system, colour, and scale variants on `sp-theme` |
| R46 | HTML custom element registration algorithm | https://html.spec.whatwg.org/multipage/custom-elements.html#dom-customelementregistry-define | mapped (normative) | One name per constructor, name collisions, registry semantics |

**Note on mappings:** URLs were assigned from each entry's stated identity and checked to resolve (HTTP 200) on 2026-10-17. R33–R41 were added for the agent-kit planning pass and resolved on the same date; for R35, R37, R38, R39 and R40 the relevant sections were also read, and R41 only resolved. R42–R46 were added for the multi-product planning pass and resolved on the same date (opening sections read). Resolving or reading a source does not complete any experiment that relies on it. Resolution confirms the page exists, not that its current content still supports every claim above; verify content and pin versions when an experiment relies on an entry. If a URL later breaks, correct it here (identity unchanged) and mark the entry unresolved until fixed. R06 and R08 remain unresolved because only documentation roots were confirmed, not the specific base-class/development-model pages.
