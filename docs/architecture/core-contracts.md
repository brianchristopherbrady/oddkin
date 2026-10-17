# Core, state, and application contracts

Status: §1–§6 are **implemented** in `@mote/core` (M3) and verified in Chromium, Firefox, and WebKit ([verification.md](../verification.md)); §7–§9 are **proposals**. Behaviors settled during implementation are listed in §6.1. Reference IDs (`[Rnn]`) resolve to the register in [../research/synthesis.md](../research/synthesis.md).

## 1. Smallest useful component

```ts
import { MoteElement, html, signal, define } from '@mote/core';

class DemoCounter extends MoteElement {
  private count = signal(0);
  private increment = () => this.count.update(value => value + 1);

  render() {
    return html`
      <button type="button" @click=${this.increment}>
        Count: ${this.count}
      </button>
    `;
  }
}

define('demo-counter', DemoCounter);
```

- `count` is local state. Interpolating the readable binds that part directly; incrementing it does **not** re-run `render()`.

**Binding rule (settled):**

```ts
// Tracks count as a dependency of render(). Changing count schedules render() again.
render() { return html`<span>${this.count.value}</span>`; }

// Subscribes the text binding directly to count. Changing count updates that binding without rerunning render().
render() { return html`<span>${this.count}</span>`; }
```

- `render()` executes synchronously within a reactive tracking context. Readable `.value` accesses during that execution — including synchronous helper calls — register render-level dependencies. Changes schedule a deduplicated render.
- Readables passed directly into template bindings subscribe at the binding level and update without rerunning the enclosing render.
- Primitive values are snapshots. A `.value` read returns a snapshot; inside tracked evaluation it also registers a dependency, outside it creates no subscription. Deferred event handlers and asynchronous callbacks do not inherit the render's tracking context.
- Internal reads used to initialize direct bindings must not register render-level dependencies.
- When a dependency participates in both paths, scheduling coalesces the work and avoids duplicate DOM writes. Both paths use the same reactive engine.
- Arbitrary interpolated functions are never invoked automatically. Readables are identified by a defined protocol. Use `computed()` for derived readables and named helpers for dynamic structure.

### 1.1 Composed definitions (proposal, M4)

Not implemented yet. Colocated authoring (above) stays supported. The public composition API lets the class, template, and styles live in separate modules. Mote's own components use it with one folder per component ([IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) §3.3).

```ts
// card/card.template.ts
import type { Card } from './card.js';
import { html } from '@mote/core/template';
export const cardTemplate = (card: Card) => html`<article part="base"><slot></slot></article>`;

// card/card.definition.ts
import { compose } from '@mote/core/element';
import { Card } from './card.js';
import { cardTemplate } from './card.template.js';
import { cardStyles } from './card.styles.js';
export const cardDefinition = compose({ name: 'mote-card', element: Card, template: cardTemplate, styles: cardStyles });

// card/card.define.ts — explicit registration
import { define } from '@mote/core/element';
import { cardDefinition } from './card.definition.js';
define(cardDefinition);
```

Requirements before acceptance (ADR in M4):

- An external template runs in the same tracked render context as `render()`. The binding rule, lifecycle order, `Scope` cleanup, and DOM identity are unchanged.
- Definitions are side-effect free and statically analyzable. Dependencies are registered only by `define(definition)`.
- The size budgets in ADR 0031 still pass.
- **Name clash resolved (2026-10-17):** `compose()` from `@mote/core/element` is the component-definition composer. The optional data-composition schema renderer is `renderComposition()` from `@mote/components/composition` (previously sketched as `@mote/components/compose`, never implemented). Prose, imports, examples, and dependency checks use these names; minimal-consumer checks exclude the renderer entry, not `compose()`.

**Recomposition (proposal, [multi-product.md](./multi-product.md) §5, ADR 0033).** `compose({ ...cardDefinition, name, element, styles })` creates a new frozen definition with its own identity and a traceable link to its foundation; it never mutates the source definition or class and never copies registration state or caches. An element resolves its definition by exact constructor, not through inheritance, so behavior classes stay safely subclassable. Definition `styles` are a complete ordered list (structural first by convention) and a definition `template` takes precedence over `render()`; sheets remain shared per document. Existing registration rules apply (`registry.collision`, `registry.constructorReused`), plus a proposed `registry.definitionConflict`.

### 1.2 Interpretable public APIs (design rule)

Public APIs are designed to be understood from their declarations by people and coding assistants alike ([agent-tooling.md](./agent-tooling.md)):

- explicit definitions and dependencies; consistent terminology;
- strongly typed inputs and outputs in ordinary TypeScript, JavaScript, HTML, and CSS;
- clear lifecycle and `Scope` ownership;
- one recommended approach for each common task, with alternatives documented alongside concrete reasons to choose them;
- precise errors for ambiguous or unsupported usage.

Class-based colocated authoring and the proposed `compose()` model (§1.1) both stay supported. The settled binding, registration, styling, lifecycle, and remount contracts are what agent tooling explains; it never redefines them.

## 2. Public properties without decorators

Preferred declaration (to prototype):

```ts
import { MoteElement, html, prop } from '@mote/core';

class DemoGreeting extends MoteElement.with({
  name: prop.string({ default: 'world', attribute: 'name' }),
  quiet: prop.boolean({ default: false, attribute: 'quiet', reflect: true }),
}) {
  render() {
    return html`<p>${this.quiet ? 'Hello' : 'Hello!'} ${this.name}</p>`;
  }
}
```

- One definition infers instance types, installs normal DOM accessors, validates attribute conversion, and supplies runtime metadata. Consumers write `element.name = 'Ada'`; no signal wrapper leaks into the public DOM API.
- The prototype must prove: declaration emission, subclassing, factory defaults for objects (no shared mutable defaults), pre-upgrade property replay, reserved-name diagnostics, native class-field compatibility, and rejection of fields that shadow reactive accessors.
- If `MoteElement.with()` fails these tests, record why and pick a static-definition alternative **before M4**. Never ship two competing primary styles or a mandatory compiler to hide the problem.
- Reflection is opt-in; booleans use presence semantics; arrays/objects travel through properties, not implicit JSON attributes. Invalid values get precise dev diagnostics and a documented fallback.
- Events have typed `detail` and explicit `bubbles` / `composed` / `cancelable` in their definitions. Preserve native `input`/`change` semantics; never re-emit across a shadow boundary twice or treat a programmatic assignment as a user edit. Event contracts appear in generated metadata.

## 3. Lifecycle

The base class owns native callbacks; authors use these hooks without `super.connectedCallback()` boilerplate. Raw native overrides are an advanced escape hatch.

| Hook | Contract |
| --- | --- |
| constructor | Local data and definitions only. No requests, global listeners, layout reads, or assumptions about parsed children. |
| `connected(scope)` | Synchronous setup on every real connection, with a fresh `Scope`. Runs before `mounted`. |
| `mounted(scope)` | Once per connection after the element's current DOM is committed or resumed. For refs and owned observers. Not a signal that descendants, slotted parser content, fonts, or paint are done. |
| `updated(changes)` | Once per owned DOM commit batch, including direct-part updates. Distinguishes public property changes from binding-only work. Cause tracing is dev-only. |
| `disconnected()` | Optional notification after connection work is disposed. Instance data and retained DOM survive. |
| `adopted(oldDoc, newDoc)` | Reacquire document-specific resources and styles. Never reuse a constructed sheet from the previous document. |
| `moved()` | Optional; for supported state-preserving native moves. Context re-resolves when ancestry changes. |
| `updateComplete` | Promise for this element's scheduled commits and synchronous lifecycle work through a defined flush. Does not await descendants, resources, or paint. Detached updates have a documented paused/resume outcome. |

- Disconnect disposes connection work immediately. Reconnect creates new ownership and resumes retained bindings without resetting local state or replacing stable nodes.
- Native `moveBefore()` / `connectedMoveCallback` may preserve a connection where supported (feature-detected). Ordinary remove/insert follows normal disconnect/reconnect; no global delayed-cleanup heuristic. [R21]
- Queued callbacks recheck the connection generation before committing. Slot-dependent setup uses `slotchange` or an explicit parser-ready strategy.
- Browser page suspension (back/forward cache) is **not** a disconnect: elements stay connected, their scopes stay alive, and paused timers and promises resume on restore. Components never listen to page-lifecycle events themselves; application-level policy lives in §9.1.
- *(Proposed, development builds only.)* Commit causes (render-level vs direct binding), dependencies, and scope ownership can be recorded by the opt-in `@mote/core/inspect` entry for explanations ([change-impact-and-verification.md](./change-impact-and-verification.md) §4.2). It is absent from production builds.

## 4. Scope — ownership and cleanup

```ts
import { MoteElement, signal, type Scope } from '@mote/core';

class DemoClock extends MoteElement {
  private now = signal(Date.now());

  connected(scope: Scope) {
    scope.interval(() => { this.now.value = Date.now(); }, 1000);
    scope.listen(this.ownerDocument, 'visibilitychange', () => {
      this.now.value = Date.now();
    });
  }
}
```

No controller field, teardown array, or matching `removeEventListener()` in the normal path. The browser already accepts an abort signal for listeners; Mote adds consistent ownership around it. [R22]

| API | Purpose |
| --- | --- |
| `scope.signal` | Native `AbortSignal` (controller allocated lazily) |
| `scope.listen(target, type, handler, options?)` | Typed listener; removed on dispose or early release; preserves capture/passive/once |
| `scope.timeout(fn, ms)` / `scope.interval(fn, ms)` | Owned timers with early cancellation |
| `scope.add(cleanup)` | Idempotent cleanup; returns a release function that runs it at most once |
| `scope.child()` | Child lifetime, disposed with the parent or earlier |
| `scope.effect(run)` | Owned synchronous tracked effect; each run gets a fresh child scope; previous run disposed before rerun |
| `scope.use(controller)` | Activate a controller (`connect(scope): void`) that registers its own cleanup |
| `scope.dispose(reason?)` | Idempotent; aborts signal, disposes children, runs cleanups deterministically |

Required semantics:
- Run all cleanups even if one throws; report errors with origin; reverse-registration order.
- Setup on a disposed scope starts nothing. Early release drops retained closures.
- Effects track synchronous reads only; async callbacks are not effects — use resources.
- Compose parent cancellation, caller signals, supersession, and timeouts; keep the real reason; release bridging listeners and timers when work settles. `AbortSignal.any()` / `timeout()` help but do not replace Mote's own bookkeeping. [R23]
- Cancellation is cooperative. Guard results at the commit boundary even when a task ignores its signal. Expected cancellation is distinct from real failure.
- Unowned standalone effects return an explicit disposer. Dev mode surfaces likely leaks; production needs no stack capture.
- `scopeStats()` (public, both builds) returns live counts of scopes, listeners, timers, and effects owned through scopes, for leak tests: counts return to baseline after mount/remove cycles (`research/benchmarks`: 100 cycles × 100 counters in three engines).

| Lifetime | Starts | Ends |
| --- | --- | --- |
| Component connection | Each native connection | That disconnection (except supported moves) |
| Template branch / list item | Enters retained DOM | Branch replaced / item removed; paused while detached |
| Effect run | Initial run or rerun | Next invalidation or parent disposal |
| Request | Resource starts a load | Supersession, cancellation, settlement, or owner disposal |
| Application | `start()` | `stop()`; other app roots unaffected |

## 5. Reactivity (`@mote/core/reactive`, DOM-free)

```ts
import { signal, computed, batch } from '@mote/core/reactive';

const quantity = signal(1);
const price = signal(12);
const total = computed(() => quantity.value * price.value);

batch(() => {
  quantity.value = 2;
  price.value = 15;
});

console.log(total.value); // 30, immediately
```

- One `Readable<T>` protocol: `.value` and `subscribe(onChange)` (returns a disposer). Writable signals add assignment and `.update(fn)`. Stable snapshots and subscribe functions support external-store integrations. [R11]
- Reads and writes are synchronous. `computed` is pure, lazy, memoized, tracks dynamic dependencies, and is glitch-free through diamonds.
- Default equality `Object.is`; custom equality when justified. No deep proxies or nested mutation tracking in v1.
- External subscribers notify synchronously outside a batch and once at the outer batch boundary. UI effects and DOM commits are deduplicated into a microtask.
- Flush order: derivation → DOM commits → owned post-commit effects. No default animation-frame delay for typing.
- Mutations inside effects or `updated` schedule a defined next pass. Detect cycles and runaway flushes; isolate errors.
- A manual flush helper exists for tests. Components never need `requestUpdate()` after changing a signal or declared property.

## 6. Templates and rendering (`@mote/core/template`)

Tagged `html` templates, cached static `<template>` structure, explicit binding parts. No virtual DOM, no compulsory compiler, no `innerHTML` update path.

| Syntax / value | Meaning |
| --- | --- |
| `${primitive}` | Text/node part; never parsed as HTML |
| `${readable}` | Owned live binding of that part |
| `title=${v}` | Attribute |
| `?disabled=${v}` | Boolean attribute presence |
| `.value=${v}` | DOM property |
| `@input=${fn}` | Native event, stable listener management |
| Nested template / DOM node | Defined ownership and replacement |
| Named helper | Dynamic structure, refs, classes, styles |

- Structural helpers: `when(cond, yes, no)`, `repeat(items, key, itemTemplate)`, exhaustive `match(value, cases)`. Inactive branches dispose their subscriptions; branch caching is explicit.
- Keyed lists need stable unique keys; reorder reuses DOM and item state; removal releases the item scope; duplicate/unstable keys get dev diagnostics. [R24]
- Optional helper subpaths: `classMap`, `styleMap`, refs, live-input handling (cursor, IME composition, autofill), event options.
- Deterministic cleanup for replaced templates, removed items, detached roots, and failed renders. Cache by template identity, document, and parsing context; handle SVG. Dynamic tag/attribute names are not v1.
- **Security:** no `eval`, no string-to-HTML. Define unsafe sinks, URL policy, and event/property restrictions. Test strict CSP and document Trusted Types integration. Any trusted-markup escape hatch is a separate explicit API. Mote is not a general sanitizer.
- **Diagnostics:** component, template location/part, property, phase, likely fix; dev-only tracing; one error-reporting path; defined recovery after a failed commit.
- **Collections and data models:** keyed `repeat` is fed by `@mote/core/collections` for components with structured content; item templates track external reactive reads, so output never goes stale when only a dependency changes. Model definitions (`@mote/core/model`) generate types, validators, and schemas. See [data-composition.md](./data-composition.md).
- **Behavior tools** (built when catalog components need them): resize/intersection observers, refs/slot observation, form association, roving tabindex, focus return, `Intl` formatting. Prefer native CSS, `<dialog>`, popover/top layer, logical properties. Portals, advanced overlays, transitions, and virtualization follow concrete requirements and measurement.

### 6.1 Behaviors settled in the M3 implementation

- **Child values:** `null`, `undefined`, and `false` render nothing; other primitives render as text; iterables render unkeyed items; a readable inside a list binds like any readable. Functions are never called (`template.value.function`).
- **Attribute values:** `null` and `undefined` remove the attribute; `false` renders `"false"` (so `aria-*` values work). Use `?name=` for presence.
- **Event bindings:** one listener per part; swapping handlers never re-adds it. Handlers run with the component as `this`. A listener object (`{ handleEvent, capture, passive, once }`) supplies listener options; the listener is re-added only when its options change.
- **Attribute directives:** objects carrying `ATTRIBUTE_DIRECTIVE` manage an element through a binding position instead of writing a string. They must be the whole binding value (`template.directive.position`) in an accepted binding (`template.directive.binding`), and are cleared when the binding is disposed or switches to a plain value. Other libraries can author directives with the exported protocol.
- **Helpers** (separate subpaths, not in the root entry): `helpers/class-map` toggles only its own classes through `classList`; `helpers/style-map` writes through the CSSOM (works under strict `style-src`); `helpers/ref` provides `createRef()` (reactive `value`) and callback `ref()`, bound as `ref=${…}` and never written as an attribute; `helpers/live` compares with the element's current property, defers writes during IME composition, and keeps the caret of a focused field. Autofill is handled by the same current-value comparison.
- **Light-DOM styles:** components with `shadowRootOptions = null` add their `styles` once to the nearest root (document or shadow root), reference-counted across instances and removed with the last one; selectors must scope themselves, and `:host` in such styles reports `element.styles.lightDomHost`.
- **`css` interpolation:** `css` results, finite numbers, and `var(--name[, fallback])` strings whose fallback has balanced parentheses and no declaration, block, string, comment, `!`, `url()`/`image()`, or at-rule syntax (`isCSSVariableReference`).
- **Keyed `repeat`:** a longest run of items already in order stays in place and only the others move. With `moveBefore()` each item moves with its state preserved. Without it (WebKit), moved ranges are detached from the end of the list and each run is inserted before its stable anchor as one fragment, because per-item `insertBefore` is quadratic for `<li>` in WebKit: reversing 1,000 items took 319 ms before batching and 9 ms after. Focus and text selection are then restored once. Duplicate keys report `template.repeat.duplicateKey` and render without DOM reuse. The reconciler ships only with `repeat()`.
- **First render** is synchronous during connection, so `mounted(scope)` sees committed DOM. Later renders and direct bindings commit in the microtask flush.
- **`updated(changes)`** runs in the post phase after each commit batch, including the first; `changes` maps changed public properties to previous values and is empty for binding-only work.
- **`updateComplete`** resolves when the shared flush settles; a disconnected element has no pending work for it.
- **Declarative shadow DOM** content is replaced on first render; hydration is not supported.
- **Invalid values** (`element.attribute.invalid`, `element.prop.invalid`) fall back to the property default.
- **Shadowing class fields** report `element.prop.shadowed`; the field value is applied through the reactive accessor so the element still works.
- **TypeScript:** subclasses use `override` on hooks (`noImplicitOverride`), and hooks are `protected`.
- **Development and production builds** (ADR 0031): the `development` export condition selects `dist/` (full explanations, development-only checks); the default selects `dist/prod/`, where errors keep their stable `[code]` and every behavior and security check is unchanged. Development-only checks: the light-DOM `:host` scan and the recipe-defined-during-render warning. Size budgets are enforced by `npm run size`.

### 6.2 Failure ownership (verified in `packages/core/test/failure-paths.browser.test.ts`)

Errors that cannot be thrown to a caller go to the handler set with `setErrorHandler` (default: `reportError`), with a stable code and the owner's name in `origin`. Errors thrown synchronously by an API call (invalid template binding, `define` collision, writing a signal inside a computed) throw to the caller.

| Failure | Code | Owner (`origin`) | What keeps working | Recovery |
| --- | --- | --- | --- | --- |
| Invalid attribute value | `element.attribute.invalid` | element | Property falls back to its default | Next valid value applies |
| Derivation or `render()` throws | `reactive.effect.error` | `<tag> render` | Last committed DOM stays; other elements and bindings update | Re-runs when a dependency read before the throw changes |
| Direct binding's readable throws | `reactive.effect.error` | template binding | Sibling bindings in the same template; no re-render | Re-runs when its dependencies change |
| Effect throws | `reactive.effect.error` | effect name | Other effects in the same flush | Re-runs on its next dependency change |
| Commit or property setter throws | `reactive.effect.error` | the effect or binding | Sibling bindings | Next value is written again |
| Cleanup throws | `scope.cleanup.error` | scope name | Every other cleanup in the scope runs, in reverse order | — |
| Lifecycle hook throws | `element.<hook>.error` | element | Rendering and bindings | Next connection calls the hook again |

Disposal during callbacks is safe: a handler that removes its own host leaves no subscriptions or owned resources, and an effect that disconnects another element prevents that element's queued effect from running. Each connection gets a fresh scope. The previous scope is aborted, and listeners do not accumulate. Direct binding updates do not re-render the host or read layout (layout getters, `getBoundingClientRect`, and `getComputedStyle` were spied during updates). Production builds report the same codes and owners with short messages (ADR 0031).

## 7. Optional shared stores (`@mote/state`)

```ts
import { createStore } from '@mote/state/store';

const cart = createStore({ items: [] as CartItem[] });
const count = cart.select(state => state.items.length);

function addItem(item: CartItem) {
  cart.update(state => ({ ...state, items: [...state.items, item] }));
}
```

- `cart.state` is a read-only readable snapshot; selectors are memoized readables with equality control; components can interpolate `count` directly. No action registry, reducer, provider, or DI container required.
- Optional named-action instrumentation improves inspection without changing the update model. Defined batching, nested actions, reset, disposal, exceptions. Batching is not a rollback transaction. Dev-only freezing catches snapshot mutation.
- **Context:** typed, event-based nearest-provider protocol across composed trees; explicit subscription ownership; nested overrides; independent roots; reparenting; provider replacement cleanup.
- **Persistence** (separate import): schema versions, migrations, storage adapters, restore ordering, quota/parse errors. **Inspection** (separate import): live subscriptions, action causes, disposal counts.
- Reusable components never create or require an application store. Framework adapters, if ever needed, are optional integrations with peer dependencies.

## 8. Resources (`@mote/app/resource`)

```ts
import { MoteElement, signal, type Scope } from '@mote/core';
import { resource } from '@mote/app/resource';

class DemoSearch extends MoteElement {
  query = signal('');

  results = resource({
    source: () => this.query.value.trim() || undefined,
    load: async (query, { signal }) => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      return response.json(); // validate in real examples
    },
  });

  connected(scope: Scope) {
    scope.use(this.results);
  }
}
```

- Construction is inert. Connecting observes the source; `undefined` → idle. A source change cancels the previous generation and starts a new one; disconnect cancels the active one. [R03, R15]
- State is one discriminated `Readable<ResourceState<T>>`: `idle | pending | success | error`. Pending/error may carry explicitly named previous data. Latest success survives detachment; reconnect reloads the current key by default.
- Invalidation revokes the previous generation's right to commit before its continuation can run (abort **and** generation guard). Stale completions from non-cooperative work are ignored. Expected aborts never surface as unhandled rejections; real failures stay visible; timeout and user cancellation have distinct reasons.
- Explicit `refresh`, `cancel`, `retry`, `dispose`. Retries, debounce, caching, dedupe, stale-while-revalidate, and optimistic state are opt-in policies.
- Resources are for reads. Mutations are explicit commands; cancelling a fetch does not roll back a server operation.
- *(Proposed, §9.1.)* Restore policy: by default a resource keeps its state across page suspension. An opt-in `revalidateOnRestore` policy starts a new generation after a persisted `pageshow`, with the usual abort and generation guards. Failed revalidation surfaces as the resource's `error` state. Mutations are never retried automatically.

## 9. Application root and router (`@mote/app`)

- `createApp({ root, setup })` owns a root scope and explicit services; `start()` / `stop()` idempotent with defined restart. No global singleton; multiple apps can coexist.
- Router on `URL`, `URLSearchParams`, History API, native anchors, dynamic `import()`. Nested routes, typed params/search parsing, not-found, route errors, lazy modules, navigation cancellation. The active route owns its resources and subscriptions.
- Preserve modified clicks, external links, downloads, `target`, fragments, history. Explicit title, focus, announcements, scroll restoration. URL is authoritative for navigable state (precedence over persistence documented). Base-path support. Hash-router option for static hosts without rewrites.
- SSR, streaming, hydration, a compiler, and preemptive scheduling are later, separate projects — not implied v1 capabilities.

### 9.1 Page suspension and restoration (proposal, M7; [ADR 0035](./decisions/0035-page-suspension-and-restoration.md))

| Lifecycle | Trigger | What happens |
| --- | --- | --- |
| Element disconnect/reconnect | DOM removal/insertion | Connection scope disposed; fresh scope on reconnect (§3, §4) |
| Application stop/restart | Explicit `stop()` / `start()` | Root scope disposed; restart creates fresh scopes and services |
| Temporary page suspension | `pagehide` with `persisted: true` (intent only; the browser may still discard the page) | Nothing is disposed; declared services may suspend external connections |
| Back/forward cache restoration | `pageshow` with `persisted: true` | Same JS heap and DOM resume; declared services resume; resources with a restore policy revalidate |
| Permanent disposal | Page discarded, or explicit `stop()` | Disposal only through explicit stop; the browser discarding a page runs no Mote code |

- Navigation is never assumed to disconnect elements or rebuild the application. `pagehide` never disposes the application. A genuinely disposed `Scope` is still replaced by a fresh one and never reuses an aborted signal.
- Lifecycle listeners are activated only by an explicit, owned application service (e.g. `app.use(pageLifecycle())`, name proposed). It registers `pagehide`, `pageshow`, and `visibilitychange` once in the app root scope; importing a module never adds listeners. No `unload` or `beforeunload` listeners. `freeze`/`resume` are verified enhancements where supported, never required.
- Services declare `suspend()`/`resume()` behavior: which observations or external connections (sockets, event sources, polling) pause, how they resume without duplicate listeners (listeners registered once and never re-added), and how failed reconnections surface. Revalidation is limited to declared resource policies and respects stale-result guards. Mutations are not retried, and cancellation implies no rollback. Anything else requires an explicit consumer policy.
- Core components inside other frameworks never take ownership of the host page lifecycle.
- Tests prove an actual persisted restoration (`pageshow.persisted === true`) and separate it from reloads and ordinary history navigation. They cover repeated restoration, state preservation, listener counts, resource freshness, and explicit shutdown. When a browser or test environment prevents a real cache restoration, the scenario is recorded as not verified; a test that only calls "go back" proves nothing about the cache.
