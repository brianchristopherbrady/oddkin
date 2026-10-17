# Core, state, and application contracts

Status: **proposal**. These are the contracts to prototype and test; none are implemented yet. Exact TypeScript signatures are stabilized in M3 before catalog work. Reference IDs (`[Rnn]`) resolve to the register in [../research/synthesis.md](../research/synthesis.md).

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

## 9. Application root and router (`@mote/app`)

- `createApp({ root, setup })` owns a root scope and explicit services; `start()` / `stop()` idempotent with defined restart. No global singleton; multiple apps can coexist.
- Router on `URL`, `URLSearchParams`, History API, native anchors, dynamic `import()`. Nested routes, typed params/search parsing, not-found, route errors, lazy modules, navigation cancellation. The active route owns its resources and subscriptions.
- Preserve modified clicks, external links, downloads, `target`, fragments, history. Explicit title, focus, announcements, scroll restoration. URL is authoritative for navigable state (precedence over persistence documented). Base-path support. Hash-router option for static hosts without rewrites.
- SSR, streaming, hydration, a compiler, and preemptive scheduling are later, separate projects — not implied v1 capabilities.
