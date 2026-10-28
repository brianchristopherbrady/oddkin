# Core, state, and application contracts

Status: §1–§6 are **implemented** in `@oddkin/core` (M3) and verified in Chromium, Firefox, and WebKit ([verification.md](../verification.md)); in §7, stores, inspection, context, and persistence (§7.1–§7.3, `@oddkin/state`) and in §9 application ownership (`createApp`, `@oddkin/app`) are **implemented** (M6); §8 resources, with the restore policy, and §8.1 commands are **implemented** (M7); in §9 the router and page suspension and restoration (§9.1) are **implemented** (M7). Behaviors settled during implementation are listed in §6.1. Sections between contract markers (HTML comments naming `contract:core/<name>`) are published in `@oddkin/core` as `CONTRACTS.md` under stable ids; regenerate with `npm run contracts` after editing them. Reference IDs (`[Rnn]`) resolve to the register in [../research/synthesis.md](../research/synthesis.md).

## 1. Smallest useful component

```ts
import { OddkinElement, html, signal, define } from '@oddkin/core';

class DemoCounter extends OddkinElement {
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

<!-- contract:core/binding-rule "Binding rule" -->

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

<!-- /contract:core/binding-rule -->

<!-- contract:core/composition "Composed definitions" -->

### 1.1 Composed definitions (implemented, M4; [ADR 0036](./decisions/0036-component-composition-api.md))

`compose()` and `define(definition)` are implemented in `@oddkin/core/element` and verified in three engines (`packages/core/test/definition.browser.test.ts`); the analyzer extracts them (metadata-and-analyzer.md §8). Colocated authoring (above) stays supported. The public composition API lets the class, template, and styles live in separate modules. Oddkin's own components use it with one folder per component ([IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) §3.3).

```ts
// card/card.template.ts
import type { Card } from './card.js';
import { html } from '@oddkin/core/template';
export const cardTemplate = (card: Card) => html`<article part="base"><slot></slot></article>`;

// card/card.definition.ts
import { compose } from '@oddkin/core/element';
import { Card } from './card.js';
import { cardTemplate } from './card.template.js';
import { cardStyles } from './card.styles.js';
export const cardDefinition = compose({ name: 'odd-card', element: Card, template: cardTemplate, styles: cardStyles });

// card/card.define.ts — explicit registration
import { define } from '@oddkin/core/element';
import { cardDefinition } from './card.definition.js';
define(cardDefinition);
```

Settled behavior:

- An external template runs in the same tracked render context as `render()`. The binding rule, lifecycle order, `Scope` cleanup, and DOM identity are unchanged. Templates reach only the host's public members; members that exist for a template only use a leading `_` or `@internal`.
- Definitions are frozen and side-effect free. `define(definition)` registers dependencies first, then binds the definition to its exact constructor (a private `WeakMap`) before registering, so upgrades see it. Classes and definitions are never mutated.
- A definition's `styles` is the complete, ordered style list and replaces the class's `static styles`; without `styles`, the class's styles apply. A definition's `template` replaces `render()`; development builds report `definition.render.ignored` when both exist.
- Codes: `registry.definitionConflict`, `registry.constructorReused`, `registry.collision`, `registry.definition.invalid`, `definition.element.invalid`, `definition.template.invalid`, `definition.dependency.invalid`. A failed registration leaves no binding.
- Size budgets (ADR 0031) still pass; the counter fixture is 9,521 B gzip of 9,728 B.
- **Name clash resolved (2026-10-17):** `compose()` from `@oddkin/core/element` is the component-definition composer. The optional data-composition schema renderer is `renderComposition()` from `@oddkin/components/composition` (previously sketched as `@oddkin/components/compose`, never implemented). Prose, imports, examples, and dependency checks use these names; minimal-consumer checks exclude the renderer entry, not `compose()`.

**Recomposition (implemented in the runtime; [multi-product.md](./multi-product.md) §5, ADR 0033, ADR 0036).** Every definition carries `source` (itself); a spread copies it and `compose()` records it as `extends`. `compose({ ...cardDefinition, name, element, styles })` creates a new frozen definition with its own identity and a traceable link to its foundation; it never mutates the source definition or class and never copies registration state or caches. An element resolves its definition by exact constructor, not through inheritance, so behavior classes stay safely subclassable. Definition `styles` are a complete ordered list (structural first by convention) and a definition `template` takes precedence over `render()`; sheets remain shared per document. Registration rules: `registry.collision`, `registry.constructorReused`, and `registry.definitionConflict`.

<!-- /contract:core/composition -->

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

<!-- contract:core/properties "Public properties" -->

```ts
import { OddkinElement, html, prop } from '@oddkin/core';

class DemoGreeting extends OddkinElement.with({
  name: prop.string({ default: 'world', attribute: 'name' }),
  quiet: prop.boolean({ default: false, attribute: 'quiet', reflect: true }),
}) {
  render() {
    return html`<p>${this.quiet ? 'Hello' : 'Hello!'} ${this.name}</p>`;
  }
}
```

- One definition infers instance types, installs normal DOM accessors, validates attribute conversion, and supplies runtime metadata. Consumers write `element.name = 'Ada'`; no signal wrapper leaks into the public DOM API.

<!-- /contract:core/properties -->

- The prototype must prove: declaration emission, subclassing, factory defaults for objects (no shared mutable defaults), pre-upgrade property replay, reserved-name diagnostics, native class-field compatibility, and rejection of fields that shadow reactive accessors.
- If `OddkinElement.with()` fails these tests, record why and pick a static-definition alternative **before M4**. Never ship two competing primary styles or a mandatory compiler to hide the problem.

<!-- contract:core/properties "Public properties" -->

- Reflection is opt-in; booleans use presence semantics; arrays/objects travel through properties, not implicit JSON attributes. Invalid values get precise dev diagnostics and a documented fallback. An enumerated property may declare `empty`, the value of the bare attribute (`<odd-question announce>` means `important`), as HTML's enumerated attributes do (ADR 0045).

<!-- /contract:core/properties -->
<!-- contract:core/events "Events" -->

- Events have typed `detail` and explicit `bubbles` / `composed` / `cancelable` in their definitions. Preserve native `input`/`change` semantics; never re-emit across a shadow boundary twice or treat a programmatic assignment as a user edit. Event contracts appear in generated metadata.
- An event definition may declare `intent`, for tooling only (no runtime cost): `'user'` events report user interaction and are never emitted by property writes; `'notification'` events report a state change from any source. Without it, metadata records the intent as unknown. The contract suite checks every `'user'` event: setting each scalar property, and every property of the correct authored examples while connected, emits none (`event:<tag>#<name>/not-programmatic`).
- **Typed listeners:** `static events` is keyed by event name, and the element declares `declare readonly _events?: ElementEvents<typeof Self>` (type-only, no runtime cost). Its `addEventListener` and `removeEventListener` then receive `CustomEvent<Detail>`, or the native event type for a re-dispatched DOM event. Custom event names carry the `odd-` prefix (ADR 0045), so packages also add them to `GlobalEventHandlersEventMap` and document-level listeners are typed too. Once `_events` is declared, the analyzer reports a key that differs from its event name (`analyzer.event.key`).
- **Targets, propagation, and cancellation** (verified in `packages/core/test/authoring-semantics.browser.test.ts`, three engines). A template listener (`@click=${fn}`) runs with the host as `this`; inside the shadow tree `event.target` and `event.currentTarget` are what the DOM gives (the bound element is `currentTarget`). Outside the shadow root the browser retargets the event to the host, and `composedPath()` lists the inner nodes only for an open root. `emit()` dispatches with the definition's `bubbles`, `composed`, and `cancelable` and returns `false` when a listener called `preventDefault()`; an element applies the change a cancelable event announces only after `emit()` returns `true`. An event that is not composed stays inside its shadow tree. Listener options: §6.1.
- **No feedback loops.** Property writes never emit events, so a listener that writes the reported value back (a controlled framework binding) cannot loop; writing the value a property already has is no change (`Object.is`) and runs no `updated()`.

<!-- /contract:core/events -->

<!-- contract:core/lifecycle "Lifecycle" -->

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
- **Constructors** (verified in `authoring-semantics.browser.test.ts`). `OddkinElement`'s constructor only replays properties assigned before the upgrade. A constructed element (`document.createElement`, `new`, or the parser) has no attributes, children, or shadow root and owns no scope, listener, timer, or effect until it connects; reflected attributes and the first render come with the connection. Public properties are accessors on the prototype, so `'name' in element` holds from construction (framework property detection) and values set before connection apply when it connects. An author's constructor initializes local fields only; work that needs the document, the connection, or the network belongs in `connected(scope)`.
- Native `moveBefore()` / `connectedMoveCallback` may preserve a connection where supported (feature-detected). Ordinary remove/insert follows normal disconnect/reconnect; no global delayed-cleanup heuristic. [R21]
- Queued callbacks recheck the connection generation before committing. Slot-dependent setup uses `slotchange` or an explicit parser-ready strategy.
- Browser page suspension (back/forward cache) is **not** a disconnect: elements stay connected, their scopes stay alive, and paused timers and promises resume on restore. Components never listen to page-lifecycle events themselves; application-level policy lives in §9.1.
- *(Proposed, development builds only.)* Commit causes (render-level vs direct binding), dependencies, and scope ownership can be recorded by the opt-in `@oddkin/core/inspect` entry for explanations ([change-impact-and-verification.md](./change-impact-and-verification.md) §4.2). It is absent from production builds.

<!-- /contract:core/lifecycle -->

<!-- contract:core/scope "Scope: ownership and cleanup" -->

## 4. Scope — ownership and cleanup

```ts
import { OddkinElement, signal, type Scope } from '@oddkin/core';

class DemoClock extends OddkinElement {
  private now = signal(Date.now());

  connected(scope: Scope) {
    scope.interval(() => { this.now.value = Date.now(); }, 1000);
    scope.listen(this.ownerDocument, 'visibilitychange', () => {
      this.now.value = Date.now();
    });
  }
}
```

No controller field, teardown array, or matching `removeEventListener()` in the normal path. The browser already accepts an abort signal for listeners; Oddkin adds consistent ownership around it. [R22]

| API | Purpose |
| --- | --- |
| `scope.signal` | Native `AbortSignal` (controller allocated lazily), aborted with the disposal reason even when first read after disposal |
| `scope.listen(target, type, handler, options?)` | Typed listener; removed on dispose or early release; preserves capture/passive/once |
| `scope.timeout(fn, ms)` / `scope.interval(fn, ms)` | Owned timers with early cancellation |
| `scope.add(cleanup)` | Idempotent cleanup; returns a release function that runs it at most once |
| `scope.child()` | Child lifetime, disposed with the parent or earlier |
| `scope.effect(run)` | Owned synchronous tracked effect; each run gets a fresh child scope; previous run disposed before rerun |
| `scope.use(controller)` | Activate a controller (`connect(scope): void`) that registers its own cleanup |
| `scope.dispose(reason?)` | Idempotent (the first reason stays); aborts signal with `reason` (an `AbortError` when none is given), disposes children and effect runs with the same reason, runs cleanups deterministically |

Required semantics:
- Run all cleanups even if one throws; report errors with origin; reverse-registration order.
- Setup on a disposed scope starts nothing. Early release drops retained closures.
- Effects track synchronous reads only; async callbacks are not effects — use resources.
- Compose parent cancellation, caller signals, supersession, and timeouts; keep the real reason; release bridging listeners and timers when work settles. `AbortSignal.any()` / `timeout()` help but do not replace Oddkin's own bookkeeping. [R23]
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

**Examples** (each one runs in `packages/core/test/authoring-semantics.browser.test.ts`, "Scope examples", in three engines; `scope.test.ts` covers the API in Node):

```ts
connected(scope: Scope) {
  scope.listen(window, 'online', this.retry);                    // an external target
  const observer = new ResizeObserver(this.measure);
  observer.observe(this);
  scope.add(() => observer.disconnect(), 'resize observer');     // stopping observation
  scope.interval(this.tick, 1000);                               // a timer
  fetch(this.src, { signal: scope.signal })                      // cancellable work (resource(), §8, does this for you)
    .then((response) => response.json())
    .then(
      (data) => { if (!scope.signal.aborted) this.data.value = data; },
      (error) => { if (!scope.signal.aborted) this.error.value = error; },
    );
}

// A caller's signal: join it for an API that takes one…
fetch(url, { signal: AbortSignal.any([scope.signal, options.signal]) });
// …or end a child scope with it. Already aborted, the child starts disposed and starts nothing.
const work = scope.child();
if (signal.aborted) work.dispose(signal.reason);
else work.listen(signal, 'abort', () => work.dispose(signal.reason));
```

- **Cleanup, stopping observation, and cancellation differ.** Removing a listener or disconnecting an observer stops observing; nothing is cancelled. Disposal aborts `scope.signal`, which cancels only work that takes it (`fetch`, `AbortSignal.any`, listeners added with `{ signal }`). A promise that ignores the signal keeps running: guard where it commits (`if (!scope.signal.aborted)`).
- **Abort reasons.** The reason is `scope.signal.reason`. A `fetch` rejects with an `AbortError`: Chromium and Firefox reject with the reason itself, WebKit 27.2 with its own `AbortError`, so read the reason from the signal.
- **Disposal during a callback** (a listener that disposes its own scope) stops the scope's other work at once, including later listeners for the same event.
- **Reconnection** gets a fresh scope; the previous signal stays aborted. Never keep a scope or its signal across connections (`failure-paths.browser.test.ts`).

<!-- /contract:core/scope -->

<!-- contract:core/controllers "Shared controllers" -->

### 4.1 Shared controllers (`@oddkin/core/controllers/*`, implemented, M4)

Controllers implement `connect(scope)` and are activated with `scope.use(controller)`, usually in `mounted(scope)` so the elements they read exist. They read their targets through functions at connect time, touch the DOM only after `connect`, register every listener, observer, and timer on the scope, and are unbranded (no `--odd-*` properties, no Oddkin event names; callers name events). Each lives in its own subpath, so an element pays only for the controllers it imports. Verified in `packages/core/test/controllers.browser.test.ts`, `packages/core/test/position.browser.test.ts`, and `packages/core/test/widget-controllers.browser.test.ts` in three engines, and `packages/core/test/typeahead.test.ts` in Node.

| Entry | Controller | Contract |
| --- | --- | --- |
| `./controllers/focus` | `RovingFocus` | WAI-ARIA roving tabindex: one Tab stop; arrows by `orientation` (`horizontal`, `vertical`, `both`), mirrored horizontally in right-to-left text; Home/End; `wrap` (default on); skips disabled, `aria-disabled`, and unrendered items unless `skip` says otherwise; follows focus that arrives by pointer; writes `tabindex` itself or reports `onActiveChange(index)` for templates that render it; `setActive()`, `sync()` after items change |
| `./controllers/focus` | `FocusRecovery` | While focus is inside `root`, a `MutationObserver` watches for the focused element being removed, hidden, disabled, or made inert; focus then moves to `fallback()` (made focusable with `tabindex="-1"` only if it is not focusable already). Focus the user moved elsewhere is never taken back |
| `./controllers/announce` | `LiveAnnouncer`, `createLiveRegions`, `createLiveRegion` | One polite and one assertive region that exist before content changes; each key announced once until `reset()` (500 keys remembered); messages within `delay` (120 ms) joined; optional routing of a caller-named event whose `detail` is `{ text, key?, priority? }`, cancelled and stopped by the nearest announcer; nothing is written after disposal |
| `./controllers/observe` | `ResizeController`, `IntersectionController` | Observers created on connect and disconnected on disposal; `observe()`/`unobserve()` while connected; `timing: 'immediate'` (default, before paint, for layout corrections) or `'frame'` (one call per animation frame with the latest entry per target) |
| `./controllers/position` | `PositionController` | Places a `popover` surface against an anchor from measured rectangles (ADR 0044): `side` (`block-start`, `block-end`, `inline-start`, `inline-end`) and `align` (`start`, `center`, `end`) resolve through the anchor's writing mode and direction; `offset` between them; the opposite side is used when the surface does not fit and that side has more room (`flip`, default on); the surface moves along the other axis to stay `viewportMargin` inside the visual viewport (`shift`, default on). Writes `inset`, `margin`, `left`, and `top` through the CSSOM (allowed under a strict `style-src`); reports the side used, the coordinates, and the room on each axis to `onPlace` and `placement`. Starts on `beforetoggle` to open (placing in a microtask when opened from script, and otherwise on the next animation frame, as for a native `popovertarget` invoker: shown, not yet painted) and stops on `beforetoggle` to close; while open it listens to `scroll` and `resize` on the window, the visual viewport, and every scroll container of the anchor in the composed tree, and observes the anchor's and surface's sizes. Nothing listens while closed. The surface stays where it is in the DOM. Native anchor positioning is a later backend (ADR 0044 §4), not implemented |
| `./controllers/form` | `FormValue` | Form association is opt-in: the element declares `static formAssociated = true` and passes its `ElementInternals` (otherwise `connect` throws `controller.form.notAssociated`). A post-commit tracked effect submits `value()` (and `state()`), mirrors the inner control's validity flags, message, and anchor, with `error()` as a custom error first and `badInput()` (typed text that is no value, such as a date that does not parse) as `badInput` with its message second; `anchor()` names another focusable part as the anchor, and without one a control that is not in the document gives way to the element itself, so a detached native control can supply the flags and message for an element drawn without one (`odd-listbox`); a control barred from constraint validation (disabled or read-only, including through a disabled fieldset) counts as valid, as on a native input; `form` (owner), `invalid`, and `disabled` (fieldset) readables; the element forwards `formAssociatedCallback`, `formResetCallback`, `formStateRestoreCallback`, and `formDisabledCallback`. The owner follows insertion, moves (`moveBefore` keeps the connection and the value effect), the `form` attribute, and the form it names appearing, leaving, or being renamed; only the owner submits, validates, resets, and disables the element |
| `./controllers/typeahead` | `Typeahead` | Type-to-select (APG listbox, menu, tree): one character moves to the next item whose text starts with it, after the current one, and repeating it cycles; several different characters match the whole query from the current item; case and accents are ignored (`Intl.Collator`, base sensitivity); the query restarts `timeout` ms (500, as in the APG examples) after the last key. Space joins the query only while one is in progress, so it still selects otherwise; named keys never do. Skips disabled, `aria-disabled`, and unrendered elements unless `skip` says otherwise; `text` chooses what is matched (leading white space ignored). With `target` it listens to `keydown` in the capture phase, ignoring modified keys, composition, keys already handled, and typing in a text field inside the widget, and cancels the keys it used, so the widget's own handlers see `defaultPrevented`; without it the caller feeds keys to `type()`, which is DOM-free (verified in Node). Reports `onMatch(index, item)` only when the match is not the current item. The timer belongs to the scope; `reset()` releases it |
| `./controllers/active-descendant` | `ActiveDescendant` | DOM focus stays on `target` (a listbox, tree, or combobox input) while arrow keys by `orientation` (`vertical` by default; horizontal movement mirrored in right-to-left text), Home, and End (`homeEnd: false` leaves them to a text field) move the active item, named by the target's `aria-activedescendant` (items without an `id` get one; the items must be in the target's tree) and scrolled into view (`block: 'nearest'`). No wrapping unless `wrap`; with nothing active, Down starts at the first item and Up at the last; the movement keys are cancelled even at either end. Skips disabled, `aria-disabled`, and unrendered items unless `skip` says otherwise; modified keys (except Shift) and keys already handled are ignored. The active item is followed by identity across reordering; `sync()` drops it when the items no longer include it or it becomes unusable; `setActive(index, { scroll })`, `activeItem`, `activeIndex`. `onActiveChange(index, item, event)` draws the visual focus and receives the key event, so multi-select widgets extend the selection on Shift. A stale reference on the target is cleared on connect |
| `./controllers/resize` | `ResizeHandle` | APG window splitter: the value is the start pane's size in percent of `container`. `orientation` (read on each event) `horizontal`: panes side by side, Left and Right step (mirrored in right-to-left text); `vertical`: stacked, Up and Down. Home and End go to `min` and `max` (read on each event; default 0 and 100); `step` (default 1) per arrow; each key that changes the value reports `onInput` and `onChange`. A primary-button drag focuses the handle, prevents text selection, captures the pointer, and follows the distance moved (no jump to the pointer), clamped, reporting `onInput` per change and `onChange` once on release or cancel when the value differs; `onDrag(dragging)` and `dragging` report the drag. Other pointers and buttons are ignored; a container without size starts no drag. Drag listeners live in a child scope, released on drop or disposal. Collapsing (Enter) is the widget's |

Used by: `odd-input` (`FormValue`); `@oddkin/ai` — `odd-conversation` and `createAnnouncer` (`LiveAnnouncer`, `ResizeController`), `odd-inline-assist` (`RovingFocus`), approval, change review, checkpoint, question, and feedback elements (`FocusRecovery`).

Form association is verified separately in `packages/core/test/form-association.browser.test.ts` (three engines) and, for `odd-input`, in `packages/components/test/input.browser.test.ts`. Engines differ in callback order — Firefox reports the `null` owner before `disconnectedCallback` when an element moves, Chromium and WebKit after it — so `connect` re-reads the owner instead of relying on the order. WebKit 27.2 has no `moveBefore`, so state-preserving moves are verified in Chromium and Firefox only.

<!-- /contract:core/controllers -->

<!-- contract:core/i18n "Localization helpers" -->

### 4.2 Localization helpers (`@oddkin/core/i18n`, implemented, M4)

DOM-free at import, unbranded, and stateless apart from a bounded formatter cache. Verified in `packages/core/test/i18n.test.ts` (Node) and `i18n.browser.test.ts` (three engines).

| Export | Contract |
| --- | --- |
| `strings(defaults, overrides)` | String table with typed overrides (`StringOverrides<T>`: any subset of the table's keys). Unknown keys and non-strings are ignored; without overrides the defaults object itself is returned. Components expose the overrides as a `strings` property and keep every visible and announced string in a `*_STRINGS` table |
| `format(template, values)` | `{name}` placeholders as plain text (never parsed as HTML); unknown placeholders stay as written |
| `plural(count, forms, locale, values?)` | Chooses the `Intl.PluralRules` category (`zero`, `one`, `two`, `few`, `many`, `other`), falling back to `other`, and formats `{count}` as a localized number |
| `langOf(node)`, `dirOf(element)` | Nearest `lang` attribute across shadow roots (`undefined` = user agent default); resolved direction from computed style, so it inherits through shadow roots and honours `dir="auto"` |
| `numberFormat`, `dateTimeFormat`, `relativeTimeFormat`, `listFormat` | One cached `Intl` formatter per kind, locale, and options (64 kept); an invalid locale falls back to the default instead of throwing |
| `formatNumber`, `formatDate` | Safe wrappers: invalid options fall back to `String(value)`; missing or invalid dates return `undefined` |

<!-- /contract:core/i18n -->

<!-- contract:core/reactivity "Reactivity" -->

## 5. Reactivity (`@oddkin/core/reactive`, DOM-free)

```ts
import { signal, computed, batch } from '@oddkin/core/reactive';

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

<!-- contract:core/external-store "External stores" -->

- **External stores** share one contract, `ExternalSource<T>`: `getSnapshot()` returns the same value until the state changes, and `subscribe(listener)` returns an unsubscribe function. React's `useSyncExternalStore` takes the same shape, and Redux and Zustand stores fit it. `fromExternal(source, { equals? })` reads such a store as a `Readable` without copying it into a second graph. It subscribes only while observed (an effect, a binding, an observed computed value, or `subscribe`) and unsubscribes when the last observer leaves, so a component's subscription ends with the connection scope that owns its render. Unobserved reads take a fresh snapshot. `toExternal(readable)` exposes any Oddkin readable through the same contract. Neither needs an Oddkin store; `@oddkin/ai` sources use the same type. *(Implemented, 2026-10-19: `packages/core/test/external.test.ts`, `tests/interop/external-store.browser.test.ts`; 168 B gzip when imported, nothing otherwise.)*

<!-- /contract:core/external-store -->

- Reads and writes are synchronous. `computed` is pure, lazy, memoized, tracks dynamic dependencies, and is glitch-free through diamonds.
- Default equality `Object.is`; custom equality when justified. No deep proxies or nested mutation tracking in v1.
- External subscribers notify synchronously outside a batch and once at the outer batch boundary. UI effects and DOM commits are deduplicated into a microtask.
- Flush order: derivation → DOM commits → owned post-commit effects. No default animation-frame delay for typing.
- Mutations inside effects or `updated` schedule a defined next pass. Detect cycles and runaway flushes; isolate errors.
- A manual flush helper exists for tests. Components never need `requestUpdate()` after changing a signal or declared property.

<!-- contract:core/copies "Several copies of core on one page" -->

### 5.1 Several copies of `@oddkin/core` on one page

Two independently built applications can each bundle their own `@oddkin/core`. Each copy keeps its own reactive graph, scopes, error handler, and definition bindings; no copy shares state through globals. What crosses copies:

- **DOM protocols:** elements, attributes, properties, events, slots, parts, and CSS custom properties work whichever copy defined the element.
- **Readables do not cross copies.** Reading `.value` registers a dependency only in the graph that owns the readable, so another copy's effects, computed values, and template bindings see its first value and no change after. Readables carry a registered brand (`Symbol.for('oddkin.readable')`), so where a template binding or helper (`classMap`, `styleMap`, `live`, `when`, `match`, `repeat`) receives one from another copy, development builds report `reactive.readable.foreign` once per readable. Bridge with `fromExternal(toExternal(readable))` (either copy's functions): the external-store contract crosses copies, and the bridge subscribes only while observed. Following foreign readables automatically was measured at 205 B gzip more for the minimal counter bundle, paid by every application for a case a deduplicated install avoids.
- **Registration:** custom element names are global per registry. A name already defined by another copy's class throws `registry.collision`, and the first registration stays. Load one copy of a component package, or isolate the other in a frame or a scoped registry; renaming tags is no way around it, because a component's internal dependencies keep their names.
- **Errors** cross copies by `code`: `instanceof OddkinError` holds only for the copy that threw.
- **Context keys** from two copies of `@oddkin/state` differ (§7.2).

Different versions of core follow the same rules; nothing compares versions at runtime. *(Verified 2026-10-21 with two esbuild bundles on one page, `examples/duplicate-core` and `e2e/duplicate-core.spec.ts`, and `packages/core/test/foreign-readables.browser.test.ts`. Released artifacts installed at different versions: plan §2.5.)*

<!-- /contract:core/copies -->

<!-- /contract:core/reactivity -->

<!-- contract:core/templates "Templates and rendering" -->

## 6. Templates and rendering (`@oddkin/core/template`)

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
- **Security:** no `eval`, no string-to-HTML. Define unsafe sinks, URL policy, and event/property restrictions. Test strict CSP and document Trusted Types integration. Any trusted-markup escape hatch is a separate explicit API. Oddkin is not a general sanitizer.
- **Diagnostics:** component, template location/part, property, phase, likely fix; dev-only tracing; one error-reporting path; defined recovery after a failed commit.
- **Collections and data models:** keyed `repeat` is fed by `@oddkin/core/collections` for components with structured content; item templates track external reactive reads, so output never goes stale when only a dependency changes. Model definitions (`@oddkin/core/model`) generate types, validators, and schemas. See [data-composition.md](./data-composition.md).
- **Behavior tools** (built when catalog components need them): resize/intersection observers, refs/slot observation, form association, roving tabindex, focus return, `Intl` formatting. Prefer native CSS, `<dialog>`, popover/top layer, logical properties. Portals, advanced overlays, transitions, and virtualization follow concrete requirements and measurement.

<!-- /contract:core/templates -->

<!-- contract:core/rendering "Rendering behaviors" -->

### 6.1 Behaviors settled in the M3 implementation

- **Binding-value matrix** (verified in `packages/core/test/binding-values.browser.test.ts`, three engines). A value a position has no meaning for is reported through `setErrorHandler` and writes nothing; it is never guessed into text.

| Value | Child `${v}` | Attribute `name=${v}` (and each value in `name="a ${v}"`) | Boolean `?name=${v}` | Property `.name=${v}` |
| --- | --- | --- | --- | --- |
| `null`, `undefined` | Nothing | Removes the attribute (in text: empty) | Removes | Assigned as is |
| `false` | Nothing | `"false"` (so `aria-*` values work) | Removes | Assigned |
| `''` | An empty text node | `""` (present, empty) | Removes | Assigned |
| `true`, numbers (`0`, `NaN`), bigints, strings | Text, never parsed as HTML | Their text (URL attributes block `javascript:`) | By truthiness | Assigned (URL properties block `javascript:`) |
| Readable | Bound: the part updates without re-rendering | Bound | Bound | Bound |
| Template result | A nested instance, reused while the template is the same | — | — | Assigned |
| DOM node | Inserted; see node ownership | — | — | Assigned |
| Arrays and other iterables | Unkeyed items, each by this table | `String(v)` (`"a,b"`) | By truthiness | Assigned |
| Objects with their own string form (`URL`, `Date`, a class with `toString()`) | Their text | Their text | By truthiness | Assigned |
| Plain objects and objects without a string form | `template.value.object`; nothing | `template.value.object`; removes (in text: empty) | By truthiness | Assigned |
| Functions | `template.value.function`; nothing (never called) | `template.value.function`; removes | `template.value.function`; removes | Assigned (callbacks) |
| Symbols | `template.value.symbol`; nothing | `template.value.symbol`; removes | By truthiness | Assigned |
| Attribute directive (`classMap`, `styleMap`, `ref`, `live`) | `template.directive.position` | Applied when it is the whole value | Applied where it accepts the binding | Applied where it accepts the binding |
| Event `@name=${v}` | — | — | — | A function or `{ handleEvent }` listener object; `null` removes the listener; anything else throws `template.event.invalid`, a readable `template.event.readable` |

  Writes are skipped when the value is the same as the last one written (`Object.is`, so `NaN` writes once and `-0` after `0` writes again). Classes and styles have no special position: `class=${…}` and `style=${…}` write text, and `classMap`/`styleMap` manage only their own entries. SVG attributes follow the attribute column; elements are created in the SVG namespace inside `svg` templates.
- **Node ownership.** A part owns the node it inserted while that node stays where the part put it. A node bound in a second place moves there (DOM semantics) and ends in the last place committed; a part never removes a node that the page or another part has moved away. One template result rendered in two places creates two independent instances. Slot projection is the browser's: slotted children belong to the page, never to a part (§6.3 roles render child elements; they do not adopt slotted ones), and no template change or disconnection moves them.
- **Template lifecycle** (verified in `authoring-semantics.browser.test.ts` and `template.browser.test.ts`). A part creates a template instance the first time it commits a template result from a call site it does not already hold (the static strings identify the template), and updates that instance in place while the same call site comes back, keeping its nodes. A result from another call site, a value that is not a template, or the part's removal disposes the instance: its bindings are released and its nodes removed. When the host disconnects, every binding pauses (subscriptions released, instance and DOM kept); on reconnection `render()` runs again and the same nodes take the current values. Prepared templates are cached per call site in a `WeakMap`, so the cache is bounded by the code.
- **Ordering** (verified in `packages/core/test/ordering.browser.test.ts`, three engines):
  - First connection, before `append()` returns: `connected(scope)`, the effects it creates (first run), `render()` with the computed values it reads, and `mounted(scope)` with the DOM committed. `updated()` (no changes) runs in the next flush, before `updateComplete` resolves.
  - A property or attribute write applies at once (the getter returns the new value); inside `batch()` computed values read the latest writes. The DOM changes in the microtask flush: `render()` and the commit, then `updated(changes)` with the previous value of each changed public property, then the post-commit effects (`scope.effect`), then `updateComplete` resolves.
  - A write in `updated()` schedules one more pass in the same flush; `updateComplete` resolves after it.
  - Writes while detached render nothing and run no `updated()`; `updateComplete` resolves (nothing is pending). Reconnection runs `connected`, its effects, `render()` with the latest values, and `mounted` synchronously, then `updated(changes)` with what changed while detached.
  - A `render()` that throws keeps the last DOM and reports `reactive.effect.error`; `updated()` still runs for that pass, and the next good value renders.
  - `updateComplete` covers this element only: not child elements (a child defined later renders when it is defined), fonts, layout, network resources, or paint.
- **Event bindings:** one listener per part; swapping handlers never re-adds it. Handlers run with the component as `this`. A listener object (`{ handleEvent, capture, passive, once }`) supplies listener options; the listener is re-added only when its options change.
- **Attribute directives (the extension contract):** an object carrying `ATTRIBUTE_DIRECTIVE`, whose value is a `DirectiveHandler`, manages an element through a binding position instead of writing a string. `classMap`, `styleMap`, `ref`, and `live` are built on it, and other libraries author directives with the same exported types (verified in `authoring-semantics.browser.test.ts` and `helpers.browser.test.ts`).
  - *Identity:* the handler object. A binding keeps one state while the same handler comes back, and clears it before applying a different handler or a plain value.
  - *Updates:* `apply(directive, element, { type, name }, state)` runs on every commit of the binding (no equality skip: compare in `apply`) and returns `{ state, changed }`; `changed` counts as a DOM commit for `updated()`.
  - *Ownership and teardown:* the state belongs to the binding. `clear(element, state)` runs when the binding is disposed (its template removed or replaced, the root disposed) or switches to a plain value; a paused binding (detached host) keeps its state.
  - *Positions:* the whole value of an accepted binding (`parts`, and `bindingName` when set); otherwise `template.directive.position` or `template.directive.binding` is thrown to the caller.

  Controllers (`connect(scope)`, §4.1) are the other extension point. Child-position helpers (`when`, `match`, `repeat`) are core's own: there is no second use case for a public child-position extension.
- **Helpers** (separate subpaths, not in the root entry): `helpers/class-map` toggles only its own classes through `classList`; `helpers/style-map` writes through the CSSOM (works under strict `style-src`); `helpers/ref` provides `createRef()` (reactive `value`) and callback `ref()`, bound as `ref=${…}` and never written as an attribute; `helpers/live` compares with the element's current property, defers writes during IME composition, and keeps the caret of a focused field: a value set from script while the field has focus leaves the caret and selection where they were (clamped to the new length), where assigning a native field's `value` moves the caret to the end (deliberate; `packages/components/test/text-entry.browser.test.ts`, 0e6b26c). Autofill is handled by the same current-value comparison.
- **Light-DOM styles:** components with `shadowRootOptions = null` add their `styles` once to the nearest root (document or shadow root), reference-counted across instances and removed with the last one; selectors must scope themselves, and `:host` in such styles reports `element.styles.lightDomHost`.
- **`css` interpolation:** `css` results, finite numbers, and `var(--name[, fallback])` strings whose fallback has balanced parentheses and no declaration, block, string, comment, `!`, `url()`/`image()`, or at-rule syntax (`isCSSVariableReference`).
- **Keyed `repeat`:** a longest run of items already in order stays in place and only the others move. With `moveBefore()` each item moves with its state preserved. Without it (WebKit), moved ranges are detached from the end of the list and each run is inserted before its stable anchor as one fragment, because per-item `insertBefore` is quadratic for `<li>` in WebKit: reversing 1,000 items took 319 ms before batching and 9 ms after. Focus and text selection are then restored once. Duplicate keys report `template.repeat.duplicateKey` and render without DOM reuse. The reconciler ships only with `repeat()`.

<!-- contract:core/update-complete "updateComplete and commit timing" -->

- **First render** is synchronous during connection, so `mounted(scope)` sees committed DOM. Later renders and direct bindings commit in the microtask flush.
- **`updated(changes)`** runs in the post phase after each commit batch, including the first; `changes` maps changed public properties to previous values and is empty for binding-only work.
- **`updateComplete`** resolves when the shared flush settles; a disconnected element has no pending work for it.

<!-- /contract:core/update-complete -->

- **Declarative shadow DOM** content is replaced on first render; hydration is not supported.
- **Invalid values** (`element.attribute.invalid`, `element.prop.invalid`) fall back to the property default.
- **Attributes for property-only properties** (development builds): at first connection, an attribute named after a property that takes no attribute reports `element.attribute.propertyOnly` and is ignored. React 19 and Vue (without `.prop`) choose property or attribute when they render, so an element rendered before its definition loads gets `items="[object Object],…"` and no data until the framework sets it again; Angular property bindings, Vue `.prop`, and Svelte object values set the property, which survives the upgrade.
- **Shadowing class fields** report `element.prop.shadowed`; the field value is applied through the reactive accessor so the element still works.
- **TypeScript:** subclasses use `override` on hooks (`noImplicitOverride`), and hooks are `protected`.
- **Development and production builds** (ADR 0031): the `development` export condition selects `dist/` (full explanations, development-only checks); the default selects `dist/prod/`, where errors keep their stable `[code]` and every behavior and security check is unchanged. Development-only checks: the light-DOM `:host` scan, the recipe-defined-during-render warning, and attributes for property-only properties. Size budgets are enforced by `npm run size`.

<!-- /contract:core/rendering -->

<!-- contract:core/failure-ownership "Failure ownership" -->

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

**Owners outside core.** Asynchronous work has its owner in `@oddkin/app`: a resource's or a command's failure is its `error` state (§8, §8.1), and a lazy route module that fails to load is its level's `error`, loaded again by `refresh()` (§9). The autoloader reports a definition that fails to load as `autoload.import.failed` (origin: the tag) and forgets it, so `load(tag)` tries again (`e2e/autoload.spec.ts`; Chromium, Firefox, and WebKit fetch the module again). Example setup belongs to Workbench (`mountExample`, workbench.md).

**What a `Scope` cannot catch.** A scope owns what was registered on it. It does not intercept a rejected promise nobody handles (the browser's `unhandledrejection`) or an error thrown by a listener (`scope.listen` adds the handler as is, so the browser reports it as a `window` `error`); its timers report `scope.timer.error`.

**Inspection** reads the ownership records core already keeps; there is no second reactive engine. `scopeStats()` (both builds) counts live scopes, listeners, timers, and effects, and leak tests and the lifetime benchmark (`research/benchmarks/lifetime/`) compare it before and after 1,000 cycles. `@oddkin/state/inspect` keeps a bounded update log (§7.1). Caches are bounded: prepared templates per call site (`WeakMap`), 64 `Intl` formatters (§4.2), 500 announced keys (§4.1). Per-readable graph inspection and commit causes are `@oddkin/core/inspect`, proposed for development builds with Workbench's runtime explanations (plan M11); it is not built.

<!-- /contract:core/failure-ownership -->

<!-- contract:core/roles "Composite roles" -->

### 6.3 Composite roles (`@oddkin/core/template/roles`, [ADR 0043](./decisions/0043-composite-dependency-mechanism.md))

A composite (a component that renders other components) lists its children as `dependencies` and renders them through its roles, so recomposing it with another family of children changes only `dependencies`:

```ts
import { composite, rolesOf } from '@oddkin/core/template/roles';

export const rowsTemplate = (host: MemberRows) => {
  const roles = rolesOf<'field' | 'button'>(host);
  return html`<ol>
    ${repeat(host.members, (m) => m.id, (m, i) =>
      composite`<li><${roles.field} .value=${m.name}></${roles.field}>
        <${roles.button} ?disabled=${i === 0}>Up</${roles.button}></li>`)}
  </ol>`;
};
// compose({ name: 'acme-rows', element: MemberRows, template: rowsTemplate,
//           dependencies: { field: fieldDefinition, button: buttonDefinition } })
```

- `rolesOf(host)` reads the host's registered definition and returns one frozen tag reference per `dependencies` entry, the same object for every render. A host without a registered definition is `definition.role.unbound`; in development builds, reading a role the definition does not declare is `definition.role.missing`.
- `composite` is `html` that also accepts a tag reference in tag position (`<${ref}` and `</${ref}`), and only there (`template.tagRef.position`). Names are validated against the custom element name grammar without its non-ASCII ranges (`template.tagRef.invalid`), so no markup character reaches a template. The names are written into the template strings, cached per call site and names: re-renders reuse the prepared template, and children keep identity, typed text, and focus as with literal tags. Every other interpolation is an ordinary binding, with the full binding syntax.
- Trusted Types: the `oddkin-template` policy receives author-written template strings plus these validated names; no other runtime value reaches it.
- Pay for use: core's parser and the bundles of components without children are unchanged; the module adds 370 B gzip to a composite (`composite` size entry). The analyzer reads composite templates like `html` ones and knows each role's element from `dependencies`, without executing templates.
- Plain `html` still rejects a binding in tag position (`template.binding.position`); family-specific templates with literal tags remain a supported alternative for a product with one or two composites.

<!-- /contract:core/roles -->

## 7. Optional shared stores (`@oddkin/state`)

```ts
import { action, createStore } from '@oddkin/state/store';

const cart = createStore({ items: [] as readonly CartItem[] });
const count = cart.select(state => state.items.length);

const addItem = action('cart/add', (item: CartItem) => {
  cart.update(state => ({ ...state, items: [...state.items, item] }));
});
```

- `cart.state` is a read-only readable snapshot; selectors are memoized readables with equality control; components can interpolate `count` directly. No action registry, reducer, provider, or DI container required.
- **Context:** typed, event-based nearest-provider protocol across composed trees; explicit subscription ownership; nested overrides; independent roots; reparenting; provider replacement cleanup. *(Implemented, §7.2.)*
- **Persistence** (separate import): schema versions, migrations, storage adapters, restore ordering, quota/parse errors. *(Implemented, §7.3.)*
- Reusable components never create or require an application store. Framework adapters, if ever needed, are optional integrations with peer dependencies.

### 7.1 Stores (`@oddkin/state/store`, implemented, M6)

DOM-free and built on core's `signal` and `computed`, so there is no second graph. Verified in `packages/state/test/store.test.ts` (Node), `store.browser.test.ts` (Chromium, Firefox, WebKit), and `production.test.ts`.

| API | Contract |
| --- | --- |
| `createStore(initial, { name?, freeze? })` | One snapshot held in a core signal. No provider, registry, or reducer |
| `store.state` | Read-only readable of the snapshot (a computed view; assigning `.value` throws) |
| `store.getSnapshot()`, `store.subscribe(listener)` | The external-store contract (§5): bound, stable functions; the snapshot stays identical until it changes; `listener(state)` runs synchronously after a change outside a batch and once at the outermost `batch()` or `action()` boundary inside one, with the latest snapshot; returns an unsubscribe function. `useSyncExternalStore(store.subscribe, store.getSnapshot)` and `fromExternal(store)` take the store as is |
| `store.update(updater)` | `updater(current)` returns the next snapshot; returning `current` is no change. The updater runs untracked. If it throws, nothing changes and the error reaches the caller |
| `store.select(selector, { equals?, name? })` | A core computed value over the snapshot: lazy, memoized, registered with the store only while observed, and notifying only when the selected value changes (`Object.is` or `equals`). Selectors may also read other signals; derived values stay glitch-free |
| `action(name, fn)` | Runs `fn` inside `batch()` and records `name`, with any enclosing actions, on every store update it makes. Not a transaction: if `fn` throws, updates already made stay and subscribers are notified once. Synchronous work only; updates after an `await` are not part of it |
| `shallowEqual(a, b)` | Equality for selections built from several fields: identical, or arrays and plain objects whose entries are `Object.is`-equal |
| `store.reset()` | Back to the initial snapshot: one notification, none if already initial |
| `store.dispose()` | Idempotent. Releases every `subscribe` listener; reads keep the last snapshot; `update` and `reset` throw `state.store.disposed`; `subscribe` returns a no-op |

**Snapshot semantics.** The recommended update builds a new snapshot and keeps unchanged parts by reference: `cart.update(s => ({ ...s, items: [...s.items, item] }))`. Plain objects (including `Object.create(null)` dictionaries) and arrays in every snapshot are frozen at any depth, in development and production alike, so a mutation throws a `TypeError` in strict-mode code (modules and classes) instead of going unnoticed; a sloppy-mode property assignment fails silently, as for any frozen object. Freezing visits only new objects (unchanged parts were frozen with an earlier snapshot: replacing one of 1,000 items freezes three objects), runs no getters, follows no symbol keys, and handles cycles and deep nesting. Maps, sets, dates, class instances, functions, promises, and DOM nodes are held by reference and never frozen: replace them to make a change (`new Map(map).set(key, value)`), because a change made inside them in place is not a new snapshot and notifies no one. There is no deep mutation tracking or proxy; equality is identity (`Object.is`) for snapshots and the selector's `equals` for selected values. `freeze: false` turns freezing off for one store and changes nothing else. The policy is the same in both builds (ADR 0031: development builds never change behavior).

**Subscriptions and reentrancy.** A listener may update the store: the update applies at once and listeners run again after the current pass, so every listener ends with the latest snapshot and none sees an older snapshot after a newer one (intermediate snapshots may be skipped). A listener that keeps updating is stopped after 1,000 passes with `reactive.flush.runaway`. An updater must not update its own store (`state.update.reentrant`: the outer updater would overwrite the result); it may update other stores. Updating inside a computed value throws `reactive.write.inComputed`. A throwing listener or selector is reported (`reactive.subscribe.error`, `reactive.subscribe.sourceError`) and the other listeners still run. Effects and bindings that read `state` or a selector are owned by their `Scope` like any readable; `scope.add(store.subscribe(listener))` ties a raw subscription to a scope.

**Inspection** (`@oddkin/state/inspect`, a separate import). `inspect(store, { limit = 50 })` records each update (previous snapshot, next snapshot, running actions) in a bounded log, oldest first, with `recorded`, the live `subscribers` count, `stopped`, and `dispose()`. An update is recorded before subscribers react, so updates they cause follow it. `storeStats()` returns the live stores and subscriptions across all stores, for leak tests. A store carries only counters and one observer hook; nothing is logged unless it is inspected.

| Failure | Code | Outcome |
| --- | --- | --- |
| Update or reset after `dispose()` | `state.store.disposed` | Thrown to the caller |
| Update or reset inside the store's own updater | `state.update.reentrant` | Thrown; the snapshot is unchanged |
| `inspect()` on a store from another copy of `@oddkin/state` | `state.inspect.unsupported` | Thrown |
| `inspect()` limit that is not a whole number ≥ 0 | `state.inspect.limit` | Thrown |

Production builds keep these codes with short messages (ADR 0031). Size: a store with a selector and an action is 2,214 B gzip including the reactive graph (budget 2,560 B, `npm run size`); it loads no DOM module and no `Scope`.

### 7.2 Context (`@oddkin/state/context`, implemented, M6)

```ts
import { consume, createContext, provide } from '@oddkin/state/context';

export const themeContext = createContext<Theme>('theme');

class AppShell extends OddkinElement {
  readonly theme = signal(light);
  readonly #provider = provide(this, themeContext, this.theme); // a value, or a readable to follow
  protected override connected(scope: Scope) {
    scope.use(this.#provider);
  }
}

class ThemedButton extends OddkinElement {
  readonly theme = consume(this, themeContext, { fallback: light }); // a readable
  protected override connected(scope: Scope) {
    scope.use(this.theme);
  }
  protected override moved() {
    this.theme.resolve(); // after a state-preserving move
  }
}
```

Verified in `packages/state/test/context.browser.test.ts` (13 tests in Chromium, Firefox, and WebKit; the `moveBefore()` case in Chromium and Firefox, because WebKit 27.2 has none).

- **Protocol.** The Web Components Community Group context protocol (candidate status): a consumer dispatches `context-request` (bubbling, composed) with `context`, `contextTarget`, `callback`, and `subscribe: true`; the nearest provider holding the same key calls `stopImmediatePropagation()` and answers. A provider announces itself with a `context-provider` event, as Lit does, so an enclosing provider re-dispatches the requests of the consumers it serves and consumers that found no provider ask again. `ContextRequestEvent` and `ContextProviderEvent` are exported. Between Oddkin peers the provider hands over its readable itself, so consumers read through one graph and stay glitch-free; consumers of other implementations get values and one `unsubscribe` function through their callback, and other implementations' providers reach Oddkin consumers the same way.
- **Keys and types.** `createContext<T>(name)` returns a frozen key matched by identity; its type carries the protocol's phantom `__context__`. `consume()` with a `fallback` reads `T`, without one `T | undefined`.
- **Ownership.** Providers and consumers are controllers activated with `scope.use()`, usually in `connected(scope)`; a subscription ends with that scope; each follows one connection at a time.
- **Precedence.** The nearest provider in the composed tree answers: requests cross shadow roots, a provider whose host is a shadow root serves the host's slotted children, and nested providers override for their subtree. A provider ignores requests from its own host, so an element can consume a context and provide a derived value of it. Independent subtrees never reach each other's providers.
- **Consumer value.** `consumer.value` is a tracked readable: bind it directly or read it in `render()` and computed values. `provided` (also tracked) is false while no provider answers; the value is then the `fallback`.
- **Missing provider.** `required: true` reports `state.context.missing` (origin: the host's tag) when no provider answers at connection. The consumer keeps waiting: a provider that connects later, for example an element defined after its consumers, announces itself and the consumer resolves.
- **Reparenting.** Removal and insertion end and restart the connection, so the consumer resolves again where it lands and its previous provider loses it. A state-preserving move (`moveBefore()`) keeps the connection; call `resolve()` from `moved()`, which also leaves a provider that no longer encloses the consumer.
- **Provider replacement.** When a provider's scope ends while its consumers stay connected, each asks again and gets the next provider up, or the fallback while it waits for a new one. A provider that appears later between an existing provider and its consumers takes over those below it. Assigning `provider.value` (a value, or a readable to follow) updates consumers without new requests.
- **Limits.** Other implementations' subscribed callbacks are held until they unsubscribe or the provider stops (the protocol's optional `WeakRef` safeguard is not used); when an Oddkin provider stops, they are asked to re-request only while connected, and one that gets no answer keeps its last value, because the protocol has no "unprovided" signal. One-shot requests (`subscribe` false) get one value and are never retained. Two copies of `@oddkin/state` create different keys.

| Failure | Code | Outcome |
| --- | --- | --- |
| `required` consumer with no provider at connection | `state.context.missing` | Reported with the host's tag; the value stays the fallback until a provider appears |
| Another implementation's callback throws during an update | `state.context.callback` | Reported; the other consumers are still updated |

Size: a provider and a consumer are 3,699 B gzip with the reactive graph, `Scope`, and diagnostics (budget 4,096 B); context loads no rendering code and no store.

### 7.3 Persistence (`@oddkin/state/persist`, implemented, M6)

```ts
import { persist } from '@oddkin/state/persist';

const persistence = persist(settings, {
  key: 'settings',
  version: 2,
  select: (state) => state.preferences, // only what is selected is stored
  restore: (state, preferences) => ({ ...state, preferences }),
  migrate: { 2: (v1) => ({ ...(v1 as object), density: 'comfortable' }) },
  validate: (data) => preferencesModel.validate(data).ok, // stored JSON is untrusted input
});
```

A separate, DOM-free import; storage is reached only when `persist()` runs. Verified in `packages/state/test/persist.test.ts` (Node, in-memory storage that can fail) and `persist.browser.test.ts` (real Web Storage in Chromium, Firefox, and WebKit).

- **Explicit selection.** Nothing is stored unless chosen: either the whole state (`restore` defaults to replacing it) or a `select`ion with a `restore` function that puts it back into the current state. Component properties are never persisted automatically.
- **Envelope and versions.** The key holds `{ version, data }` (`serialize`/`deserialize` default to JSON; supply them for dates or other values JSON cannot keep). `version` is a whole number of 1 or more. Older stored data runs through `migrate` one step at a time, keyed by the version each step produces; newer stored data is neither applied nor overwritten (`blocked`) until `clear()`.
- **Restore ordering.** `persist()` reads, migrates, validates, and applies stored data synchronously before it returns and before it subscribes, as one store update named `persist/restore` (visible to inspection). The restored data is not written back; the next change writes in the current version.
- **Writes.** After changes, the selection is written once per microtask, and only when it differs from what was last written or restored (`equals`, default `Object.is`). `flush()` writes now; `dispose()` writes a pending change and stops; `clear()` removes the entry and allows writing again.
- **Status.** `persistence.status` is a readable: `empty`, `restored`, `rejected` (unreadable, unmigratable, or invalid data: the store keeps its state and the next change overwrites the entry), `blocked`, or `unavailable` (no usable storage: the store works in memory).
- **Failures are isolated.** Storage that cannot be reached (for example a `SecurityError` in a sandboxed page), missing storage, read failures, parse and migration failures, rejected data, serialization failures (a `BigInt` with JSON), and write failures (`QuotaExceededError`, verified with real Web Storage in all three engines) never throw into `update()`, the store's subscribers, or `persist()`'s caller. They are reported once per failing streak through `onError`, or the Oddkin error handler with the key as origin; a later change writes again.
- **Not included.** Synchronization between tabs (`storage` events), asynchronous storage such as IndexedDB, and encryption.

| Failure | Code | Outcome |
| --- | --- | --- |
| Empty key, or a version that is not a whole number ≥ 1 | `state.persist.options` | Thrown by `persist()` |
| Storage cannot be reached or does not exist | `state.persist.unavailable` | Reported; status `unavailable` |
| `getItem` throws | `state.persist.read` | Reported; status `unavailable` |
| Stored text cannot be parsed, or is not an envelope | `state.persist.parse` | Reported; status `rejected` |
| Stored version is newer than `version` | `state.persist.version` | Reported; status `blocked`, nothing written until `clear()` |
| A migration step is missing or throws | `state.persist.migrate` | Reported; status `rejected` |
| `validate` returns false or throws, or `restore` throws | `state.persist.invalid` | Reported; status `rejected` |
| The selection cannot be serialized | `state.persist.serialize` | Reported; nothing written |
| `setItem` or `removeItem` throws | `state.persist.write` | Reported; a later change or `flush()` writes again |

Size: a persisted store is 3,028 B gzip with the store, reactive graph, and diagnostics (budget 3,328 B).

## 8. Resources (`@oddkin/app/resource`)

```ts
import { OddkinElement, signal, type Scope } from '@oddkin/core';
import { resource } from '@oddkin/app/resource';

class DemoSearch extends OddkinElement {
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
- Resources are for reads. Mutations are explicit commands (§8.1); cancelling a fetch does not roll back a server operation.
- Restore policy *(implemented, M7; §9.1)*: by default a resource keeps its state across page suspension. An opt-in `revalidateOnRestore` policy starts a new generation after a persisted `pageshow`, with the usual abort and generation guards. Failed revalidation surfaces as the resource's `error` state. Mutations are never retried automatically.

**Implemented (M7)** in `@oddkin/app/resource`, also re-exported from `@oddkin/app`; DOM-free. Verified in `packages/app/test/resource.test.ts` (Node) and `resource.browser.test.ts` (the search element above in Chromium, Firefox, and WebKit); the restore policy in `lifecycle.test.ts`, `lifecycle.browser.test.ts`, and `e2e/lifecycle.spec.ts` (§9.1). Automatic retries, debounce, caching, deduplication, stale-while-revalidate, and optimistic state are not implemented.

| API | Contract |
| --- | --- |
| `resource({ source, load, equals?, timeout?, freshFor?, revalidateOnRestore?, name? })` | Inert until `scope.use(resource)`. `source()` is read in a tracked effect owned by that scope; `load(key, { signal, scope, generation })` runs untracked and may return a value or a promise |
| `resource.state` | Read-only `Readable<ResourceState<K, T>>`: `{ status: 'idle' }`, `{ status: 'pending', key, previous }`, `{ status: 'success', key, value }`, `{ status: 'error', key, error, previous }`, where `previous` is the latest success of any key as `{ key, value }` (or `undefined`) |
| `refresh()`, `retry()` | Load the current key again as a new generation, superseding a pending one, with `previous` set. No-op while disconnected or idle |
| `cancel(reason?)` | Abort the pending load (signal reason `reason`, default an `AbortError`) and return to the state before it, without an error |
| `dispose()` | Abort the pending load, stop following the source, and ignore later connections. Idempotent |

- **Generations.** Each load gets a fresh request scope (`context.scope`; everything registered on it ends with the generation) and its signal. A new key (by `equals`, default `Object.is`), `refresh()`, `cancel()`, a timeout, or disconnection revokes the generation's right to commit before its continuation runs and aborts its signal with the real reason: an `AbortError` naming the supersession, the `cancel()` reason, a `TimeoutError`, or the disconnecting scope's reason (for an element, "`<tag>` disconnected"). A superseded load that ignores its signal and resolves or fails later, even after the current one succeeded, never commits; a result arriving after its owner disconnected (for example while the body was being parsed) is discarded.
- **Outcomes.** A success sets `success` and becomes the latest success; a rejection or a synchronous throw from the current generation sets `error` with `previous`. An abort of a superseded or cancelled generation is no error: both promise handlers are attached at once, so no unhandled rejection occurs and nothing is reported. `timeout` fails the generation at once with a `TimeoutError`, whether or not the load cooperates; user cancellation is not an error.
- **Detachment.** Disconnection aborts a pending load and returns to the last settled state, so the latest success stays visible. Reconnecting reads the source again and reloads the current key, unless `freshFor` milliseconds have not passed since a success for that key (the freshness policy). An equal key keeps the current generation.
- **Restoration.** With `revalidateOnRestore`, a connected resource with a key loads it again after each back/forward cache restoration that a running `pageLifecycle()` service observes (§9.1), unless its success for that key is younger than `freshFor`; an error is always loaded again. The new generation supersedes a load still pending from before the suspension, whose late result never commits. A disconnected or idle resource, or one without the policy, keeps its state.

| Failure | Code | Outcome |
| --- | --- | --- |
| `timeout` that is not a number of milliseconds ≥ 0 | `app.resource.options` | Thrown by `resource()` |
| A load is slower than `timeout` | — | State `error` with a `TimeoutError`; the load's signal is aborted with it |

Size: a search resource with a timeout is 3,416 B gzip with `Scope`, the reactive graph, and diagnostics (budget 3,840 B); it loads no rendering code and nothing from `@oddkin/state`.

### 8.1 Commands (`@oddkin/app/command`, implemented, M7)

Resources read; commands change things. `@oddkin/app/command`, also re-exported from `@oddkin/app`; DOM-free. Verified in `packages/app/test/command.test.ts` (Node) and `command.browser.test.ts` (the cart element below in Chromium, Firefox, and WebKit).

```ts
import { OddkinElement, type Scope } from '@oddkin/core';
import { createStore } from '@oddkin/state';
import { command, resource } from '@oddkin/app';

class DemoCart extends OddkinElement {
  items = createStore<readonly Item[]>([]); // what the user sees: the server's cart, plus an optimistic item
  cart = resource({ source: () => 'cart', load: (_key, { signal }) => getCart(signal) });
  add = command({
    name: 'add to cart',
    run: (item: Item, { signal }) => postToCart(item, signal), // the server deduplicates on item.id
    // Only a 503 is retried: the server did not process the request.
    retry: {
      retries: 2,
      when: (error) => error instanceof HttpError && error.status === 503,
      delay: (attempt) => 500 * attempt,
    },
  });

  connected(scope: Scope) {
    scope.use(this.cart);
    scope.use(this.add); // the connection owns the runs
    scope.effect(() => {
      const cart = this.cart.state.value;
      if (cart.status === 'success') this.items.update(() => cart.value);
    });
  }

  async addItem(item: Item) {
    this.items.update((items) => [...items, item]); // optimistic
    const rollBack = () => this.items.update((items) => items.filter((i) => i.id !== item.id));
    const outcome = await this.add.run(item); // never rejects
    switch (outcome.status) {
      case 'success': // the server's cart, with the item
        this.items.update(() => outcome.value);
        break;
      case 'error': // an answer from the server is a refusal: roll back; no answer is unknown
        if (outcome.error instanceof HttpError) rollBack();
        else this.cart.refresh();
        break;
      case 'cancelled': // the server may have added it anyway: roll nothing back, read the cart again
        this.cart.refresh();
        break;
      case 'dropped': // never sent
        rollBack();
    }
  }
}
```

| API | Contract |
| --- | --- |
| `command({ run, retry?, timeout?, concurrency?, name? })` | Inert; runs only through `run()` while connected (`scope.use(command)`). `run(input, { signal, scope, attempt })` runs untracked and may return a value or a promise; everything registered on `scope` ends with the attempt |
| `command.state` | Read-only `Readable<CommandState<I, R>>`: `{ status: 'idle' }`, `{ status: 'pending', input, attempt, error }` (`error` is the failure being retried, `undefined` on the first attempt), `{ status: 'success', input, value }`, `{ status: 'error', input, error, attempts }`, `{ status: 'cancelled', input, reason }`. Owned by the command: it survives disconnection until `reset()` or the next run |
| `run(input)` | Starts synchronously when nothing is pending, so it keeps the caller's user activation. Resolves the run's outcome, `{ status: 'success', value }`, `{ status: 'error', error }`, `{ status: 'cancelled', reason }`, or `{ status: 'dropped' }` (never started), and never rejects |
| `cancel(reason?)` | Aborts the pending attempt's signal with `reason` (default an `AbortError`), sets `cancelled`, and drops waiting runs. No-op when nothing is pending |
| `reset()` | Returns a settled state to `idle`; no-op while a run is pending |
| `dispose()` | Cancels, disconnects, and ignores later connections. Idempotent |

- **Cancellation is not a rollback.** `cancel()`, or the end of the owner (an element disconnecting, an application stopping, another `scope.use()`), aborts the pending attempt's signal with the real reason and stops waiting; a later result or failure of that attempt is ignored. The server may still have applied the change, so the state says `cancelled` with the input, never `idle`. Undoing anything is the consumer's explicit decision; reading the server's state again is the usual answer (above).
- **Retries are an explicit policy.** Nothing is retried by default. `retry: { retries, when, delay? }` retries a failure only while `when(error, attempt)` says it is safe to repeat (for example a 503 from a server that deduplicates on an idempotency key), at most `retries` times, after `delay` milliseconds (a number, or a function of the failed attempt and its error; default 0). Each attempt gets a fresh scope and signal, and a failed attempt's signal is aborted with its failure. During the delay the state is `pending` with the next attempt's number and the failure; cancelling then starts nothing.
- **Concurrency.** `exclusive` (default): `run()` while a run is pending starts nothing and resolves `dropped`, so a double submission cannot apply a mutation twice. `queue`: runs wait their turn in call order, and a failure does not stop the queue. `latest`: like `queue`, but a new input replaces the waiting one, which resolves `dropped`. No policy aborts a running mutation to start another, because aborting does not stop the server.
- **Timeouts.** `timeout` fails an attempt with a `TimeoutError` and aborts its signal with it, whether or not `run` cooperates; a policy may retry it.
- No query cache, middleware, or action ceremony: a command is independent of stores, and updating a store stays the plain `update()` of §7.1.

| Failure | Code | Outcome |
| --- | --- | --- |
| `run()` while not connected, or after `dispose()` | `app.command.disconnected` | Thrown by `run()`; nothing starts |
| No `run` function; a `timeout` or `retry.delay` that is not a number of milliseconds ≥ 0; `retry.retries` that is not a whole number ≥ 0; a `retry` without `when`; an unknown `concurrency` | `app.command.options` | Thrown by `command()` |
| `retry.when` or `retry.delay` throws, or `delay` returns anything but a number of milliseconds ≥ 0 | `app.command.retry` | Reported; the run fails with its own error instead of retrying |
| An attempt is slower than `timeout` | — | The attempt fails with a `TimeoutError`, retried only if the policy says so |

Size: a command with a retry policy and a timeout is 3,723 B gzip with `Scope`, the reactive graph, and diagnostics (budget 4,096 B); it loads no rendering code, nothing from `@oddkin/state`, and no resource or application code.

## 9. Application root and router (`@oddkin/app`)

- `createApp({ root, setup })` owns a root scope and explicit services; `start()` / `stop()` idempotent with defined restart. No global singleton; multiple apps can coexist. *(Implemented, M6; below.)*
- Router on `URL`, `URLSearchParams`, History API, native anchors, dynamic `import()`. Nested routes, typed params/search parsing, not-found, route errors, lazy modules, navigation cancellation. The active route owns its resources and subscriptions. *(Implemented, M7; below.)*
- Preserve modified clicks, external links, downloads, `target`, fragments, history. Explicit title, focus, announcements, scroll restoration. URL is authoritative for navigable state (precedence over persistence documented). Base-path support. Hash-router option for static hosts without rewrites. *(Implemented, M7; below.)*
- SSR, streaming, hydration, a compiler, and preemptive scheduling are later, separate projects — not implied v1 capabilities.

**Application ownership (`@oddkin/app/app`, implemented, M6).** Verified in `packages/app/test/app.test.ts` (Node), `app.browser.test.ts` (Chromium, Firefox, WebKit), and `production.test.ts`.

```ts
import { createApp } from '@oddkin/app';

const shop = createApp({
  name: 'shop',
  root: document.querySelector('#shop')!,
  setup({ scope, provide, use }) {
    const cart = createStore({ items: [] as readonly CartItem[] });
    scope.add(() => cart.dispose());
    provide(cartContext, cart); // a context provider at the root, for this run
    use(new InventoryPoller()); // a service: connect(scope), optional suspend()/resume()
    return { cart }; // the run's services
  },
});
shop.start(); // returns the services
shop.stop(); // disposes everything the run registered
```

| API | Contract |
| --- | --- |
| `createApp({ name?, root?, setup })` | Creates an application; nothing runs and nothing is registered until `start()`. Importing the module registers nothing |
| `app.start()` | Creates a fresh root `Scope` and calls `setup(context)` with it; returns and keeps the services `setup` returns. Idempotent while running. If `setup` throws, the partial run is disposed, the root is released, the application stays stopped, and the error reaches the caller |
| `app.stop(reason?)` | Disposes the run's scope (cleanups in reverse order, `signal` aborted with `reason`, by default an `AbortError` `DOMException`); `services` becomes `undefined`. Idempotent; a throwing cleanup is reported (`scope.cleanup.error`) and the stop completes. A later `start()` runs `setup` again with fresh ownership |
| `app.running`, `app.services` | `running` is tracked (effects and templates follow it); `services` belong to the current run |
| `app.suspend()`, `app.resume()`, `app.suspended` | Page suspension (§9.1): suspend the run's services in reverse order of `use()`, resume them in order; nothing is disposed. `suspended` is tracked |
| `context.scope`, `context.signal` | The run's root scope and its abort signal |
| `context.provide(key, value)` | A context provider (§7.2) at the root for this run: consumers below the root resolve to it, fall back when the run stops, and resolve again to the next run's provider when it announces itself. Needs a root (`app.root.missing`) |
| `context.use(service)` | Activates a service (`connect(scope)`) for the run. A service may declare `suspend()`/`resume()`, which `app.suspend()` and `app.resume()` call (§9.1); a service used while the application is suspended is suspended at once |

- **Roots.** A root is an element, shadow root, or document. One running application per root (`app.root.claimed`); stopping releases it. Applications with different roots are independent: their scopes, services, timers, listeners, and contexts never affect each other, and an application inside another's root overrides context below its own root.
- **Reentrancy.** `start()` and `stop()` cannot run inside `setup()` or inside a cleanup of the run being stopped (`app.lifecycle.reentrant`); `stop()` during a stop is a no-op. To abandon a start, throw from `setup()`.

| Failure | Code | Outcome |
| --- | --- | --- |
| `start()` while the root belongs to another running application | `app.root.claimed` | Thrown; nothing starts |
| `context.provide()` without a root | `app.root.missing` | Thrown from `setup()`, so the start is abandoned |
| `start()`/`stop()` inside `setup()`, or `start()` inside a stopping cleanup | `app.lifecycle.reentrant` | Thrown |

Size: an application root with a store provided as context is 4,767 B gzip with `Scope`, the reactive graph, and diagnostics (budget 5,120 B); it loads no rendering code, persistence, or inspection. Component-only graphs still load nothing from `@oddkin/state` or `@oddkin/app` (`npm run size`).

**Router (`@oddkin/app/router`, implemented, M7).** Also re-exported from `@oddkin/app`; imports without DOM globals, and `matchRoutes` is DOM-free. Verified in `packages/app/test/router.test.ts` (Node: matching, definitions, options, a refused history change), `router.browser.test.ts` and `router-after.browser.test.ts` (Chromium, Firefox, WebKit: the real History API, links, back and forward, focus, announcements, scroll), and `e2e/router.spec.ts` with `examples/router` (real new tabs, downloads, other documents, browser back and forward, and reloads).

```ts
import { createApp, createRouter, route } from '@oddkin/app';

const component = route({
  path: ':tag',
  params: ({ tag }) => (tag?.startsWith('odd-') ? { tag } : undefined), // otherwise not found
  search: (query) => ({ tab: query.get('tab') ?? 'overview' }), // the level reloads for a new query
  title: ({ params }) => params.tag,
  load: ({ params, signal }) => fetchMetadata(params.tag, signal),
});
const router = createRouter({
  base: '/docs/', // the deployment base path, an explicit input; mode: 'hash' for hosts without rewrites
  routes: [
    route({ path: '', title: 'Oddkin', load: () => import('./pages/home.js') }),
    route({
      path: 'components',
      title: 'Components',
      load: () => import('./pages/components.js'),
      children: [component],
    }),
    route({ path: 'playground', redirect: '/components' }), // a legacy route (ADR 0028)
  ],
  formatTitle: (title) => (title ? `${title} · Oddkin` : 'Oddkin'),
  focus: () => document.querySelector('#docs main h1'), // after a navigation to another path
});

createApp({ root: document.querySelector('#docs')!, setup: ({ use }) => void use(router) }).start();

// The shell renders router.state; links stay native anchors:
html`<a href=${router.href('/components/odd-button?tab=api')}>Button</a>`;
```

| API | Contract |
| --- | --- |
| `route({ path, name?, params?, search?, load?, title?, redirect?, children? })` | A typed route (the same object). `path` is relative to the parent: static segments, `:name` parameters (one whole segment, decoded), a final `*` for the rest, `''` for an index. `params(raw)` types the parameters of all levels so far, or returns `undefined` to decline the match. Patterns are checked here and by `createRouter()` |
| `matchRoutes(routes, path)` | DOM-free matching of an application path: the matched levels, outermost first, or `undefined`. Siblings are tried in definition order and the first full match wins; a parent ends the match when no child matches the empty rest; trailing slashes are ignored; a path that cannot be decoded matches nothing |
| `createRouter({ routes, base?, mode?, formatTitle?, focus?, announce?, scroll?, fragment?, window?, name? })` | Inert until `use(router)` (or `scope.use(router)`); it then reads the URL, intercepts links, and follows `popstate` until that scope ends. `focus(state)` names the element to focus after a navigation to another path; `announce` is `false` or `(state) => message`; `scroll: false` turns scroll restoration off; `fragment(id)` finds a fragment's target (default `getElementById`) |
| `router.state` | Read-only `Readable<RouterState>`: `{ status: 'idle' \| 'ready' \| 'error' \| 'not-found', location, matches, error, navigating }`. A match is `{ route, params, search, status: 'ready', data }` or `{ route, params, search, status: 'error', error }`, and keeps its identity while its level is kept; `navigating` is the location being loaded while the committed one stays shown |
| `router.match(route)` | The committed match for `route`, typed by the route (tracked) |
| `router.navigate(to, { replace? })` | Navigate to an application path, resolved like a URL against the committed location. Resolves `true` when it commits and `false` when superseded or stopped |
| `router.href(to)` | The `href` for an application path: below `base` in history mode, `#/…` in hash mode |
| `router.refresh()` | Load every level of the current location again, without a history entry |

- **The URL first; commit after loading.** A navigation matches the path, keeps each leading level whose route and parameters are unchanged (and, for a level that declares `search`, whose query is unchanged), and starts the loads of the new levels in parallel. Each new level gets its own scope and signal, which live as long as the level stays matched. When every load has settled, the navigation commits: the history entry is written (`pushState`; `replaceState` for `replace`, for redirects of replaced navigations, and for links to the current URL), left levels are disposed with an `AbortError` naming them, and `state` changes once. Back and forward (`popstate`) commit the location the browser already shows. A change of fragment only reloads nothing.
- **Cancellation.** A new navigation supersedes a pending one: its new levels are aborted (`AbortError`, "navigation superseded"), their results never commit, and no history entry is written, so rapid navigation leaves one entry. Stopping the application aborts a pending navigation and disposes every level with the application's reason, and the state returns to `idle`; restarting reads the URL again.
- **Errors and not found.** A failing or throwing load (including a failed `import()`) or `search` parser fails its level; outer levels stay `ready`, and the state is `error` with the first failure. A throwing `params` parser fails the match (`matches` empty). No match, or a URL outside the base path, is `not-found`. Errors and not-found commit their URL, so reloading tries again; `refresh()` retries in place. A route with `redirect` (a path, or a function of the params and location) replaces a navigation that ends there: a pushed navigation pushes the target, others replace; more than 10 redirects in a row fail with `app.router.redirect`.
- **Links.** One `click` listener on the document intercepts a link only when nothing handled the click (`defaultPrevented`), with the primary button and no Ctrl, Meta, Shift, or Alt, on an anchor (found through `composedPath()`, so links in open shadow roots work) that has an `href`, no `download`, no `target` other than `_self`, no `rel="external"`, the page's origin, and a path inside the base path. In history mode a link to a fragment of the current page is left to the browser. Everything else (new tabs, downloads, other sites, other documents on the same origin) behaves natively; `rel="external"` marks a same-origin document the router must not handle.
- **Base path and hash mode.** `base` (default `/`) is an explicit input: application paths are below it (`/docs` and `/docs/` are both the root) and `href()` writes it. `mode: 'hash'` keeps the application path in the fragment (`#/components?tab=api#usage`) for static hosts without rewrites; an in-page fragment link (`#usage`) keeps the route and is written in full (`#/components#usage`), also when the fragment is set directly. The router reads no locale: a locale prefix is an ordinary parameter.
- **Static hosts** *(verified, M7 item 897, against emulated hosts; no real host yet)*. History mode needs the host to answer every application path with the application's document, which must therefore use base-rooted URLs (relative script and import-map URLs resolve below a deep path, and the application never starts). With rewrites, deep links answer 200, unknown paths included (the router's not-found); with GitHub Pages' `404.html` they work but answer 404; with one document per known route (a static build), `/x` is redirected to `/x/`, matching ignores the slash, and the location keeps it. On a host with no fallback, a deep link, and Back to an in-app entry once its document is gone, get the server's 404, so such hosts need `mode: 'hash'`. A lazy level whose module fails to load is the level's `error`; `refresh()` loads it again after a network error, a 404, or a 503 in all three engines, which keep no failed module fetch. A module removed by a later deploy keeps failing, also when a rewriting host answers with HTML (a MIME error). A first load with a fragment scrolls its target into view once the route renders; the browser's own fragment scrolling happens before the content exists. Superseded lazy loads never commit. *(`e2e/router-hosting.spec.ts`, Chromium, Firefox, and WebKit.)*
- **Titles.** On every commit the deepest level with a `title` (a string, or a function of its match) gives the title; `formatTitle(title, state)` composes it, including for not-found (`title` `undefined`); `undefined` leaves `document.title` alone. A throwing title is reported (`app.router.title`).
- **Precedence.** The URL is authoritative for navigable state: when a persisted store and the URL disagree (a selected tab, a filter), the URL wins; persistence restores only what the URL does not say.
- **After a navigation** the router acts once the view has rendered the new state (`settled()`), and only for navigations to another path: a new query or fragment keeps focus, and nothing happens on the first load or `refresh()`. Focus moves to `focus(state)` (made focusable with `tabindex="-1"` only if it is not, focused without scrolling); a polite live region the router adds to the document body (core's `LiveAnnouncer`, removed on stop) announces the document title or `announce(state)`, each navigation separately, in the application's own words, since the router reads no locale.
- **Scroll restoration** (unless `scroll: false`): while the router runs, `history.scrollRestoration` is `manual` (given back on stop). A new path starts at the top, a fragment (`#id`) is scrolled into view, a new query keeps the position, and back, forward, and the first load after a reload return to where the entry was left. Positions are kept per history entry, in memory and in the entry's own `history.state` (under `oddkinRouter`, keeping what others stored there), written when a pushed navigation leaves the entry and once scrolling pauses (200 ms): Chromium and Firefox drop history changes made during `pagehide` on reload. A pop records the position from before the browser's own fragment scrolling, which Firefox and WebKit do before `popstate`. A view that renders its content later than the commit (for example from its own resource) may be too short to restore into.
- **History writes are kept few**: a navigation from the top of the page writes one entry (`pushState`), and a pause in scrolling one `replaceState`, because WebKit refuses more than 100 history changes in 10 seconds (`SecurityError`). When the History API refuses a new URL, the navigation is abandoned (its new levels aborted with that error, `app.router.history` reported), so the view never disagrees with the URL.

| Failure | Code | Outcome |
| --- | --- | --- |
| An invalid pattern (`*` not last, `:` without a name), a redirecting route with children, `children` not an array | `app.router.route` | Thrown by `route()` or `createRouter()` |
| `base` not a path starting with `/` (or containing `?` or `#`), an unknown `mode`, no `routes` array | `app.router.options` | Thrown by `createRouter()` |
| `navigate()` or `refresh()` while the router is not running | `app.router.disconnected` | Thrown |
| `href()` or `navigate()` with a URL of another origin | `app.router.path` | Thrown |
| Connecting without a window (History API and document) | `app.router.environment` | Thrown by `connect`, so the application's start fails |
| More than 10 redirects in a row | `app.router.redirect` | State `error` |
| A route title or `formatTitle` throws | `app.router.title` | Reported; the title is left alone |
| `focus` or `announce` throws | `app.router.focus`, `app.router.announce` | Reported; the navigation stays committed |
| The History API refuses a new URL (WebKit's rate limit) | `app.router.history` | Reported; the navigation is abandoned and resolves `false` |

Size: a router with nested, lazy, and redirecting routes, focus, announcements, and scroll restoration is 6,974 B gzip with `Scope`, the reactive graph, and diagnostics (budget 7,680 B); core's `LiveAnnouncer` is about 0.7 KiB of it and is loaded even with `announce: false`. It loads no rendering code, nothing from `@oddkin/state`, and no resource or command code.

### 9.1 Page suspension and restoration (implemented, M7; [ADR 0035](./decisions/0035-page-suspension-and-restoration.md))

| Lifecycle | Trigger | What happens |
| --- | --- | --- |
| Element disconnect/reconnect | DOM removal/insertion | Connection scope disposed; fresh scope on reconnect (§3, §4) |
| Application stop/restart | Explicit `stop()` / `start()` | Root scope disposed; restart creates fresh scopes and services |
| Temporary page suspension | `pagehide` with `persisted: true` (intent only; the browser may still discard the page) | Nothing is disposed; declared services may suspend external connections |
| Back/forward cache restoration | `pageshow` with `persisted: true` | Same JS heap and DOM resume; declared services resume; resources with a restore policy revalidate |
| Permanent disposal | Page discarded, or explicit `stop()` | Disposal only through explicit stop; the browser discarding a page runs no Oddkin code |

- Navigation is never assumed to disconnect elements or rebuild the application. `pagehide` never disposes the application. A genuinely disposed `Scope` is still replaced by a fresh one and never reuses an aborted signal.
- Lifecycle listeners are activated only by an explicit, owned application service, `use(pageLifecycle(app))` (below). It registers `pagehide`, `pageshow`, and `visibilitychange` once in the app root scope; importing a module never adds listeners. No `unload` or `beforeunload` listeners. `freeze`/`resume` are verified enhancements where supported, never required.
- Services declare `suspend()`/`resume()` behavior: which observations or external connections (sockets, event sources, polling) pause, how they resume without duplicate listeners (listeners registered once and never re-added), and how failed reconnections surface. Revalidation is limited to declared resource policies and respects stale-result guards. Mutations are not retried, and cancellation implies no rollback. Anything else requires an explicit consumer policy.
- Core components inside other frameworks never take ownership of the host page lifecycle.
- Tests prove an actual persisted restoration (`pageshow.persisted === true`) and separate it from reloads and ordinary history navigation. They cover repeated restoration, state preservation, listener counts, resource freshness, and explicit shutdown. When a browser or test environment prevents a real cache restoration, the scenario is recorded as not verified; a test that only calls "go back" proves nothing about the cache.

**Implemented (M7)** in `@oddkin/app/lifecycle` (`pageLifecycle`), `@oddkin/app/app` (`suspend`, `resume`), and `@oddkin/app/resource` (`revalidateOnRestore`), all re-exported from `@oddkin/app`; importing them adds no listener, and they import without DOM globals.

```ts
import { createApp, pageLifecycle, resource } from '@oddkin/app';

class LiveFeed implements AppService {
  #socket: WebSocket | undefined;
  connect(scope: Scope) {
    this.#open();
    scope.add(() => this.#socket?.close()); // stop() ends it for good
  }
  suspend() {
    this.#socket?.close(); // an open socket can keep a page out of the back/forward cache
  }
  resume() {
    this.#open(); // a new connection; no listener is registered twice
  }
  #open() {
    this.#socket = new WebSocket('/feed');
  }
}

const news = resource({ source: () => 'today', load, revalidateOnRestore: true }); // loads again on restore

createApp({
  root: document.querySelector('#news')!,
  setup({ app, scope, use }) {
    use(pageLifecycle(app)); // the only page-lifecycle listeners, for this run
    use(new LiveFeed());
    scope.use(news);
  },
}).start();
```

| API | Contract |
| --- | --- |
| `pageLifecycle(app, { freeze?, window? })` | An application service. On `connect` it listens to `pagehide` and `pageshow` on the window and `visibilitychange` on the document, once, on the run's scope, and to `freeze`/`resume` on the document where the browser has them (`'onfreeze' in document`: Chromium), unless `freeze: false`. Stopping the application removes them |
| `lifecycle.state` | Read-only `Readable<{ visible, suspended, restorations }>`: `visible` follows `document.visibilityState`; `suspended` is true while the page is in the back/forward cache or frozen; `restorations` counts the restorations this service saw |
| `app.suspend()`, `app.resume()` | §9 above. The service calls them; an application or host that knows better may call them too |
| `revalidateOnRestore` | Resource option (§8): load again after a restoration, unless fresh by `freshFor` |

- **Transitions.** `pagehide` with `persisted` suspends the application (`app.suspend()`); without `persisted` the page is being unloaded for good, and nothing is suspended or disposed. `pageshow` with `persisted` resumes it and counts a restoration; without it the document is new, and nothing happens. `freeze` suspends and `resume` resumes. In Chromium's cache the events overlap (`pagehide`, `freeze`, then `resume`, `pageshow`): the application is suspended once and resumed once, at `pageshow`, since `resume` alone does not end a stay in the cache, while a `pageshow` always ends a freeze. Only these transitions call the application, so a visibility change never resumes an application that suspended itself.
- **Services.** `suspend()` calls the run's services in reverse order of `use()` and `resume()` in order, as cleanups run; each call is isolated: a throwing service is reported (`app.service.suspend`, `app.service.resume`) and the others are still called. Both are idempotent and no-ops while stopped. `stop()` during a pass ends it; `suspend()` or `resume()` from inside a pass is rejected (`app.lifecycle.reentrant`). Suspension disposes nothing: the run's scopes, listeners, timers, and effects stay registered (`scopeStats()` is unchanged), and the poller in `examples/lifecycle` ends its interval on suspension and starts one on resumption, so resuming never duplicates it. `stop()` clears the suspension; the next run starts resumed.
- **Restorations are page-wide.** A restoration is counted once per `pageshow` event however many applications use the service, and resources with `revalidateOnRestore` follow that count while connected. Without a running service nothing observes restorations, and no resource revalidates. Commands are never retried on restoration (§8.1): a pending run stays pending.

| Failure | Code | Outcome |
| --- | --- | --- |
| `pageLifecycle` connected without a window and document | `app.lifecycle.environment` | Thrown from `use()` in `setup`, so the start is abandoned |
| A service's `suspend()` or `resume()` throws | `app.service.suspend`, `app.service.resume` | Reported; the other services are still called |
| `suspend()` or `resume()` from a service's `suspend()` or `resume()` | `app.lifecycle.reentrant` | Thrown into that hook, so reported as above |

**Verification.** Real restorations from the back/forward cache are verified in Chromium only, by `e2e/lifecycle.spec.ts` on `examples/lifecycle`: Playwright launches Chromium with the cache disabled, so the test starts the full Chromium build (new headless) without that switch, where `pageshow.persisted` is `true` and the JavaScript heap is the same. It proves the same document after two restorations, the kept state, one suspension and one resumption per stay, no listener, scope, or timer registered twice, only the resource with the policy loading again, `freeze` and `resume` around the cache, and nothing resumed or reloaded after an explicit stop. Reloads, history navigation inside the page, and stop and restart are checked in Chromium, Firefox, and WebKit. **Not verified:** a real restoration in Firefox (Playwright's Firefox disables the cache in its driver; overriding its preference made the driver lose the restored page) and in WebKit (Playwright's WebKit never restored a page, headless or headed); freezing outside the cache (CDP's `Page.setWebLifecycleState` fired no `freeze` or `resume` in headless Chromium). In all three engines, `lifecycle.browser.test.ts` dispatches real `PageTransitionEvent` objects and shows that importing every core, components, state, and app entry and connecting components registers no lifecycle listener.
