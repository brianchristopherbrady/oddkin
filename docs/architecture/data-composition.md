# Data-driven composition, collections, and models

Status: §3 (collections) and §5 (models) are **implemented** in `@oddkin/core` (M3; settled behaviors in §11). Component data APIs, region sources, the `props()` experiment, and composition remain **proposals** for M4+. These APIs reach candidate v1 status at the M8 compatibility checkpoint. Catalog expansion depends on passing the relevant foundation acceptance criteria. Breaking changes after M8 require an ADR, migration plan, and renewed verification. Final v1 contracts freeze at M12 after the shipped feature set passes release verification. Related: [core-contracts.md](./core-contracts.md), [layout-recipes.md](./layout-recipes.md), [agent-tooling.md](./agent-tooling.md).

## 1. Direction

Data-driven composition is first-class **for structured content**: navigation, menus, tabs, action groups, lists, tables, trees, form descriptions, and reusable dashboard/application compositions. Ordinary HTML, tagged templates, slots, and direct property assignment remain equally supported.

- **Component models, not DOM-as-JSON.** A navigation model describes links, groups, and actions. The component owns rendering, semantics, keyboard behavior, and responsive layout (via its recipe).
- **One renderer.** Data-driven components render with the existing template parts, signals, batching, keyed `repeat`, and `Scope`. No second rendering or reactivity engine.
- **Separation of concerns.** Data describes content and intent. Recipes provide arrangement and responsive behavior. Tokens provide design values and roles. Data objects reference named recipes, variants, conditions, profiles, and tokens; they never carry raw CSS.
- **A general schema-driven page renderer is a later, optional capability** (§8), gated on concrete use cases after the navigation and editable-collection slices pass.

## 2. Component data APIs

```ts
import type { NavigationItem } from '@oddkin/components/side-nav';

const navigation = [
  { id: 'overview', kind: 'link', label: 'Overview', href: '/overview' },
  { id: 'components', kind: 'link', label: 'Components', href: '/components' },
  {
    id: 'guides', kind: 'group', label: 'Guides',
    items: [{ id: 'theming', kind: 'link', label: 'Theming', href: '/guides/theming' }],
  },
  { id: 'create-project', kind: 'action', label: 'Create project', action: 'project.create' },
] satisfies readonly NavigationItem[];

html`
  <odd-side-nav
    label="Primary"
    .items=${navigation}
    .current=${currentId}
    @odd-action=${(e: OddkinActionEvent) => run(e.detail.action, e.detail.id)}
  >
    <span slot="header">My application</span>
  </odd-side-nav>
`;
```

### Discriminated models

```ts
type NavigationItem =
  | { id: string; kind: 'link'; label: string; href: string; target?: '_blank' | '_self'; rel?: string; disabled?: boolean; icon?: IconName; badge?: string }
  | { id: string; kind: 'action'; label: string; action: string; disabled?: boolean; icon?: IconName }
  | { id: string; kind: 'group'; label: string; items: readonly NavigationItem[]; expanded?: boolean };
```

A link without `href`, an action without `action`, or a group without `items` is a type error locally and a validation error for external data.

### Rules

| Rule | Contract |
| --- | --- |
| Transport | Complex objects via JS properties (`.items`). Never JSON in attributes. |
| Ownership | Components never mutate caller objects. Internal derived state (e.g. flattened index) is private. |
| Updates | Immutable replacement, same as other properties. Replacing `items` re-reconciles by key; mutating in place is unsupported (dev diagnostic when detectable via dev-only freezing). |
| Events | Typed user-intent events (`odd-action`, `odd-toggle`, `odd-select`) with `detail: { id, … }`; `bubbles: true, composed: true`; documented `cancelable`. No store or router required. |
| Links | Rendered as native `<a href>`; modified clicks, middle click, `target`, downloads, and context menus behave natively. Routers intercept at the document level as usual. |
| Defaults | Small and visible: e.g. groups default to collapsed unless they contain `current`; `aria-current="page"` on the current link. Nothing consequential (navigation, actions) happens implicitly. |

### Content vs options vs interaction state

| Kind | Example | Owner |
| --- | --- | --- |
| Structured content | `items` | Caller |
| Visual options | `variant`, `profile` (attributes/properties) | Caller |
| Interaction state | `current` (active id), `expanded` ids | **Either** controlled by the caller **or** uncontrolled inside the component — never both |

Controlled mode: set `.current` (and optionally `.expanded`); the component emits intent events and does not change them itself. Uncontrolled mode: omit them; the component tracks expansion locally (initialised from item `expanded`) and still emits events. Setting `expanded` on an item **and** the `.expanded` property is a `model.state.conflict` diagnostic; the property wins.

### Optional property-binding helper (experiment)

Ordinary bindings stay sufficient. A helper is prototyped only to test whether it improves local configuration-object ergonomics:

```ts
html`<odd-side-nav ${props({ label: 'Primary', items: navigation, current })}></odd-side-nav>`;
```

| Aspect | Proposed contract |
| --- | --- |
| Supported keys | Declared public properties of the target element (from its `OddkinElement.with()` definition); unknown keys → dev diagnostic. Events are **not** accepted (use `@event`). |
| Precedence | Explicit `.prop` / attribute bindings on the same element win over `props()`; within `props()` last write wins. |
| Removal/reset | A key removed between renders resets that property to its declared default. |
| Cleanup | No listeners are created; nothing to dispose. Owned by the template part. |
| Upgrade | Values set before definition are replayed through the normal pre-upgrade path. |

Decision at M8: keep, rename, or drop based on the ergonomics study.

**M3 assessment** ([research/experiments/props](../../research/experiments/props/README.md)): a prototype on the public directive protocol meets the key, reset, cleanup, upgrade, and readable rows. It cannot use an element position: there is no element part, so it binds as `.props=${…}`. It cannot enforce precedence over explicit bindings: the last change wins. It costs 662 B gzip. Recommendation: not in core for M4–M7. If kept at M8, use the named binding, replace the precedence rule with "do not bind a key both ways", and add a typed `props<typeof Element>()` signature.

## 3. Shared collection infrastructure (`@oddkin/core/collections`)

DOM-free models plus template integration, shared by navigation, menus, tabs, listboxes, trees, tables, and forms.

```ts
import { collection } from '@oddkin/core/collections';

const nav = collection<NavigationItem>({
  key: item => item.id,                              // configurable key extraction
  children: item => (item.kind === 'group' ? item.items : undefined),
  disabled: item => 'disabled' in item && !!item.disabled,
});

nav.set(items);           // reconcile by key; diagnostics for duplicate/missing keys
nav.flat;                 // Readable<readonly Entry<T>[]> in document order (depth, parentKey, index)
nav.byKey('theming');     // Entry | undefined
```

| Capability | Contract |
| --- | --- |
| Identity | Key extraction; `collection.key.duplicate` and `collection.key.missing` diagnostics with paths |
| Reconciliation | Keyed insert/remove/reorder/update; entries reused by key; feeds `repeat` so DOM and local item state survive |
| Nesting | Optional `children` accessor; parent/depth metadata |
| Ownership | Each rendered entry gets a child `Scope`; removed entries dispose subscriptions and owned resources |
| State models | Optional, separately importable: `selectionModel` (none/single/multiple), `expansionModel`, `disabledModel`, `activeModel` (roving focus target) — controlled or uncontrolled |
| Keyboard | **Not** in the collection. Separate controllers per pattern in `@oddkin/core/controllers/*` (`RovingFocus` and `FocusRecovery` implemented, core-contracts.md §4.1; typeahead planned), composed by each component according to WAI-ARIA APG: navigation links use Tab order; menus, tabs, listboxes, and trees each use their own model |

### Cache invalidation
- An item's rendered output depends on **(key, item object, renderer, and any reactive values read while rendering)**. Item templates are ordinary template parts, so reads of external signals (locale, `current`, a store selector) are tracked and re-run that item's parts when they change, even if the item object is unchanged.
- No cache keyed solely by item identity. Memoization, if added, includes the renderer identity and is invalidated by the item's tracked dependencies.
- Tests cover: same item object + changed external signal → updated output; changed renderer → re-render; reorder keeps focus and input state.

### Measurement
Update work, allocations, and retained memory for insert/remove/reorder/replace at 10/100/1,000 items, compared with an equivalent handwritten `repeat` template. No claim that data objects are inherently faster.

## 4. Hybrid composition and customization

This ladder applies within levels 2 and 4 of the multi-product customization ladder ([multi-product.md](./multi-product.md) §6). A data-driven composite that renders child components (e.g. editable-list rows) selects product-specific children through the component-family mechanism in multi-product.md §8, not through tag-name substitution.


### Region sources
Each content region declares exactly one authoritative source:

| `odd-side-nav` region | Source | If both supplied |
| --- | --- | --- |
| `header`, `footer` | Named slots | n/a (slot only) |
| main list | `items` property **or** declarative children (`<odd-nav-item>` / native `<a>` in the default slot) | `items` wins when it is set (including `[]`); slotted list children are not rendered and a `collection.source.conflict` dev diagnostic is emitted. No merging. |

Every collection component documents its regions the same way in metadata.

### Customization ladder
1. **Options** — documented properties, recipe variants, profiles, tokens.
2. **Slots and parts** — named slots for adjacent regions; selected `::part`s for styling.
3. **Local render functions** — e.g. `.renderLabel=${(item) => html`…`}`; receives the item and a context, returns a template result; runs inside the item's `Scope`. The component still renders the semantic wrapper (`<a>`, `<button>`, `role`, ARIA), so custom content cannot drop required semantics.
4. **Project item kinds** — explicit registration of new `kind`s with a model fragment and renderer:

```ts
import { navigationKinds } from '@oddkin/components/side-nav';

const kinds = navigationKinds.extend({
  'badge-link': {
    model: m.object({ id: m.string(), kind: m.literal('badge-link'), label: m.string(), href: m.url(), count: m.number() }),
    semantics: 'link',                          // reuse the built-in link wrapper and keyboard behavior
    render: (item) => html`${item.label} <odd-badge>${item.count}</odd-badge>`,
  },
});

html`<odd-side-nav .kinds=${kinds} .items=${items}></odd-side-nav>`;
```

Registration is per instance (`.kinds`), never a hidden global mutation. Unknown kinds → `model.kind.unknown`.

Framework-specific render adapters (React/Vue/Angular components as item renderers) are optional integrations outside the shipped packages.

### Local vs portable
Functions, DOM nodes, signals, template results, and kind registries are **local JavaScript customization** and are not serializable. Portable configuration (JSON) contains only data allowed by the model's portable schema and references registered behavior by name (`kind`, `action`, recipe/profile/token names).

## 5. Model definitions → types, validation, schema, metadata (`@oddkin/core/model`)

A small, original, DOM-free model builder is the single source for each data contract.

```ts
import { m, defineModel } from '@oddkin/core/model';

export const NavigationItemModel = defineModel('oddkin.navigation-item', {
  version: 1,
  schema: m.recursive(self =>
    m.union('kind', {
      link: m.object({ id: m.id(), label: m.label(), href: m.url(), target: m.optional(m.enum(['_blank', '_self'])), disabled: m.optional(m.boolean()) }),
      action: m.object({ id: m.id(), label: m.label(), action: m.actionRef(), disabled: m.optional(m.boolean()) }),
      group: m.object({ id: m.id(), label: m.label(), items: m.array(self), expanded: m.optional(m.boolean()) }),
    }),
  ),
  rules: [m.uniqueIds('id')],
  migrations: { /* 0 → 1 */ },
});

export type NavigationItem = Infer<typeof NavigationItemModel>;
```

| Output | Use |
| --- | --- |
| `Infer<T>` TypeScript types | Editor completion; `satisfies readonly NavigationItem[]` |
| `model.validate(data)` → `{ ok, value, diagnostics }` | Runtime validation of **external** data (TS types do not validate JSON) |
| `model.toJSONSchema()` | JSON Schema (2020-12) for the portable subset; non-portable fields (functions) are excluded and documented |
| `model.migrate(data, fromVersion)` | Versioned migrations with diagnostics for unmigratable data |
| Model metadata | Docs tables, Workbench data editors, `oddkin.metadata.json` (extracted by `@oddkin/analyzer`), agent input contracts, deprecations |

- **Diagnostics:** JSON-pointer path, code (`model.type.mismatch`, `model.required.missing`, `model.kind.unknown`, `model.variant.unsupported`, `model.ref.invalid`, `model.id.duplicate`, `model.label.empty`, `model.option.incompatible`, `model.version.unsupported`, `model.state.conflict`), message, suggestion.
- **Component rules** (labels required, incompatible options) live in the model. Schema validity is not proof of accessibility or behavior; browser and accessibility verification still apply.
- **Validation cost:** components do not validate trusted local data by default in production; development mode validates property assignments; external data is validated explicitly by the application (`model.validate`) or by an opt-in `validate` attribute/property.
- **Boundaries:** `@oddkin/core/model` is generic and unbranded. Component models live in `@oddkin/components/models` (and per-component entries). `@oddkin/tokens` keeps its own config validator and stays independent. Model metadata is extracted statically by `@oddkin/analyzer` (the single metadata generator, see [metadata-and-analyzer.md](./metadata-and-analyzer.md)), which calls the DOM-free `@oddkin/core/model/schema` emitter to publish JSON Schemas — no separate internal generator and no runtime coupling.

## 6. Connection to recipes and tokens

- Collection components use recipes for arrangement; data can select **named** options only: `variant`, `profile`, recipe names for registered patterns, and token references (`{ "gap": "layout.gap" }` where a model explicitly allows a role reference).
- Authors do not configure every internal region. CSS, SCSS, and CSS-in-TS customization (roles, component variables, parts) remain available.
- Validation rejects raw CSS strings in models (`model.style.raw`), unknown recipe/profile/token names (`model.ref.invalid`).

## 7. Packaging

| Entry | Contents | In minimal consumers? |
| --- | --- | --- |
| `@oddkin/core/collections` | `collection`, state models | Only if a component uses it |
| `@oddkin/core/model` | `m`, `defineModel`, `Infer` | Types only, unless the app validates at runtime |
| `@oddkin/core/model/schema` | JSON Schema emitter | No (tooling) |
| `@oddkin/components/side-nav` | Element class, `NavigationItem` type, `navigationKinds` | Yes for side-nav users |
| `@oddkin/components/models` | Runtime validators and migrations for all component models | No, unless imported |
| `@oddkin/components/schemas/*.json` | Generated JSON Schemas | Data |
| `@oddkin/components/composition` | Data-composition schema renderer `renderComposition()` (§8, experimental); unrelated to the component-definition composer `compose()` | **Never** unless imported |

Boundary checks assert that a button-only or side-nav-only consumer contains no `models` validators, JSON Schema emitter, `components/composition` renderer, or `@oddkin/agent`.

## 8. Composition schema (later, optional)

Only after the side-nav and editable-collection slices pass M8 and at least two concrete use cases (e.g. a configurable dashboard and a settings form) justify it.

Bounded initial contract:

```json
{
  "$schema": "https://…/oddkin-composition/v1.json",
  "version": 1,
  "root": {
    "id": "dashboard",
    "type": "pattern.dashboard",
    "recipe": "page-shell",
    "profile": "navigation.compact",
    "regions": {
      "nav": [{ "id": "primary-nav", "type": "odd-side-nav", "props": { "label": "Primary", "items": { "$ref": "#/data/nav" } } }],
      "main": [{ "id": "stats", "type": "pattern.stat-grid", "props": { "source": { "$binding": "stats" } } }]
    }
  },
  "data": { "nav": [] }
}
```

- **Registered types only** (components or patterns registered with their model, regions, and allowed bindings).
- **Typed properties** validated by each type's model; **named regions** only.
- **Stable `id`s** for keyed reconciliation and migrations.
- **References**, not code: `recipe`, `profile`, token names, `$ref` to data, `$binding` / `$action` names resolved by the host application. No executable strings, arbitrary HTML, event-handler attributes, or unrestricted DOM property assignment.
- **Versioned** with migrations and diagnostics.
- Rendered with the existing template renderer via `renderComposition(doc, { registry, bindings, actions })`; separately importable from `@oddkin/components/composition`.

AI support never makes this schema mandatory: agent tooling recommends templates, data models, or hybrids by the §9 criteria and works without the composition schema ([agent-tooling.md](./agent-tooling.md) §8).

## 9. When to use which

| Situation | Prefer |
| --- | --- |
| Repeated structured items with shared semantics (nav, menu, tabs, tree, table rows) | Data model |
| Content arriving from a CMS/API/config | Data model + `validate` |
| One-off or highly custom structure | Template / HTML |
| Standard list plus custom header/footer | Hybrid (data + slots) |
| Item needs extra visuals but same semantics | Local `render*` function or registered kind |
| Whole page assembled from configuration | Composition schema (later), only for justified use cases |

## 10. Acceptance fixtures

**`odd-side-nav` (navigation collection)** — extends the side-nav fixture in [layout-recipes.md §10](./layout-recipes.md):
- [ ] Typed local objects compile; invalid combinations fail typecheck; external JSON validated with path-precise diagnostics
- [ ] Data-driven, declarative children, and hybrid (data + header/footer slots) versions render equivalently; conflict diagnostic when both sources supplied
- [ ] Controlled and uncontrolled `current`/expansion; `odd-action` events; native link behavior
- [ ] Insert/remove/reorder keeps focus and DOM identity; external signal change updates items whose object is unchanged
- [ ] Removed items dispose their scopes; 1,000 mount/unmount cycles return to baseline
- [ ] Narrow/wide containers, nested themes, profiles
- [ ] Plain JS and React/Vue/Angular/Svelte consumers without Oddkin state

**Editable collection** (`examples/editable-list/`): a reorderable list of items with `odd-input` fields and add/remove, driven by a model and a keyed collection:
- [ ] Typing in one row survives insertions, removals, and reorder elsewhere; selection/caret preserved
- [ ] Validation diagnostics map to the right row and field; form submission data is correct
- [ ] Undo of a removal restores the row with a new scope (no stale subscriptions)

## 11. Behaviors settled in the M3 implementation

`@oddkin/core/collections`, `@oddkin/core/model`, and `@oddkin/core/model/schema` are implemented (unbranded, DOM-free) and verified; component models, the `props()` helper, and composition remain later work.

- **Collections.** `collection({ key, children?, disabled?, owner?, childrenPath? })` exposes `items`, `flat` (document order with `depth`, `parentKey`, `index`, `position`, `hasChildren`, `disabled`, and a JSON-pointer `path`), `diagnostics`, `byKey`, `childrenOf`, and `ancestorsOf`. Entries keep their identity when key, item, and position are unchanged. Missing and duplicate keys are reported (`collection.key.missing`, `collection.key.duplicate`) with paths, and those items are skipped.
- **Per-entry ownership.** `scopeFor(key, init?)` returns the entry's scope, disposed when the key leaves or the owner ends. Item templates re-run whenever their entry changes, so one-time setup belongs in `init`, which runs only when the scope is created.
- **State models.** `selectionModel` (none/single/multiple), `expansionModel` (+ `visibleEntries`), `disabledModel`, and `activeModel` (roving focus target that skips disabled and hidden entries and recovers when its entry disappears). Each is controlled (`{ value, onChange }`: the model only reports intent) or uncontrolled. Keyboard behavior is not included.
- **Keyed reordering.** `repeat()` keeps a longest increasing subsequence of reused items in place and moves only the rest. Where `moveBefore()` is unavailable, a moved range containing the focused element has its focus and text selection restored after the move.
- **Models.** `m` provides `string`, `id`, `label`, `url` (script URLs rejected), `actionRef`, `number`, `boolean`, `enum`, `optional`, `array`, `object`, `union(discriminator, variants)`, `recursive(self => …, name?)`, and the `uniqueIds(property)` rule. `defineModel(name, { version, schema, rules?, migrations?, description? })` returns `validate` (no copying or coercion; unknown properties are warnings) and `migrate(data, fromVersion)` (stepwise `migrations[n]`, `model.version.unsupported`, `model.migration.failed`). `Infer<typeof Model>` infers recursive discriminated types; optional fields are `?: T | undefined`, matching validation.
- **JSON Schema.** `toJSONSchema(model)` (in `./model/schema`, never in component bundles) emits draft 2020-12 with `$defs` for recursion and lists unportable rules in `$comment`. Ajv and `validate()` agree on portable cases in tests. The method form `model.toJSONSchema()` sketched in §5 is a separate function, so validators do not pull in the emitter.