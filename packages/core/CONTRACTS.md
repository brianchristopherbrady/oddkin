# `@oddkin/core` contracts

<!-- Generated from docs/architecture/core-contracts.md by `npm run contracts`. Edit the source, not this file. -->

What `@oddkin/core` guarantees, for people and tools reading the installed package. Each section has a stable id (`contract:core/<name>`) and an anchor with the same name; `contracts.json` maps ids to anchors.

| Id | Section |
| --- | --- |
| `contract:core/binding-rule` | [Binding rule](#binding-rule) |
| `contract:core/composition` | [Composed definitions](#composition) |
| `contract:core/properties` | [Public properties](#properties) |
| `contract:core/events` | [Events](#events) |
| `contract:core/lifecycle` | [Lifecycle](#lifecycle) |
| `contract:core/scope` | [Scope: ownership and cleanup](#scope) |
| `contract:core/controllers` | [Shared controllers](#controllers) |
| `contract:core/i18n` | [Localization helpers](#i18n) |
| `contract:core/reactivity` | [Reactivity](#reactivity) |
| `contract:core/external-store` | [External stores](#external-store) |
| `contract:core/copies` | [Several copies of core on one page](#copies) |
| `contract:core/templates` | [Templates and rendering](#templates) |
| `contract:core/rendering` | [Rendering behaviors](#rendering) |
| `contract:core/update-complete` | [updateComplete and commit timing](#update-complete) |
| `contract:core/failure-ownership` | [Failure ownership](#failure-ownership) |
| `contract:core/roles` | [Composite roles](#roles) |

<a id="binding-rule"></a>

## Binding rule

Id: `contract:core/binding-rule`

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

<a id="composition"></a>

## Composed definitions

Id: `contract:core/composition`

`compose()` and `define(definition)` are implemented in `@oddkin/core/element` and verified in three engines (`packages/core/test/definition.browser.test.ts`); the analyzer extracts them (metadata-and-analyzer.md §8). Colocated authoring (above) stays supported. The public composition API lets the class, template, and styles live in separate modules. Oddkin's own components use it with one folder per component (IMPLEMENTATION_PLAN.md §3.3).

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
/// <reference path="./card.ts" preserve="true" />
import { define } from '@oddkin/core/element';
import { cardDefinition } from './card.definition.js';
define(cardDefinition);
```

Settled behavior:

- An external template runs in the same tracked render context as `render()`. The binding rule, lifecycle order, `Scope` cleanup, and DOM identity are unchanged. Templates reach only the host's public members; members that exist for a template only use a leading `_` or `@internal`.
- Definitions are frozen and side-effect free. `define(definition)` registers dependencies first, then binds the definition to its exact constructor (a private `WeakMap`) before registering, so upgrades see it. Classes and definitions are never mutated.
- A define entry exports nothing, so its declaration file would not reach the class module's `HTMLElementTagNameMap` entry. The `/// <reference path="./card.ts" preserve="true" />` directive keeps it, so importing the entry alone (`import '<package>/define/card'`) types `document.createElement('odd-card')`. Oddkin's packages and the golden path's library (`tests/golden-path/`) do this.
- A definition's `styles` is the complete, ordered style list and replaces the class's `static styles`; without `styles`, the class's styles apply. A definition's `template` replaces `render()`; development builds report `definition.render.ignored` when both exist.
- Codes: `registry.definitionConflict`, `registry.constructorReused`, `registry.collision`, `registry.definition.invalid`, `definition.element.invalid`, `definition.template.invalid`, `definition.dependency.invalid`. A failed registration leaves no binding.
- Size budgets (ADR 0031) still pass; the counter fixture is 9,521 B gzip of 9,728 B.
- **Name clash resolved (2026-10-17):** `compose()` from `@oddkin/core/element` is the component-definition composer. The optional data-composition schema renderer is `renderComposition()` from `@oddkin/components/composition` (previously sketched as `@oddkin/components/compose`, never implemented). Prose, imports, examples, and dependency checks use these names; minimal-consumer checks exclude the renderer entry, not `compose()`.

**Recomposition (implemented in the runtime; multi-product.md §5, ADR 0033, ADR 0036).** Every definition carries `source` (itself); a spread copies it and `compose()` records it as `extends`. `compose({ ...cardDefinition, name, element, styles })` creates a new frozen definition with its own identity and a traceable link to its foundation; it never mutates the source definition or class and never copies registration state or caches. An element resolves its definition by exact constructor, not through inheritance, so behavior classes stay safely subclassable. Definition `styles` are a complete ordered list (structural first by convention) and a definition `template` takes precedence over `render()`; sheets remain shared per document. Registration rules: `registry.collision`, `registry.constructorReused`, and `registry.definitionConflict`.

<a id="properties"></a>

## Public properties

Id: `contract:core/properties`

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

- Reflection is opt-in; booleans use presence semantics; arrays/objects travel through properties, not implicit JSON attributes. Invalid values get precise dev diagnostics and a documented fallback. An enumerated property may declare `empty`, the value of the bare attribute (`<odd-question announce>` means `important`), as HTML's enumerated attributes do (ADR 0045).

<a id="events"></a>

## Events

Id: `contract:core/events`

- Events have typed `detail` and explicit `bubbles` / `composed` / `cancelable` in their definitions. Preserve native `input`/`change` semantics; never re-emit across a shadow boundary twice or treat a programmatic assignment as a user edit. Event contracts appear in generated metadata.
- An event definition may declare `intent`, for tooling only (no runtime cost): `'user'` events report user interaction and are never emitted by property writes; `'notification'` events report a state change from any source. Without it, metadata records the intent as unknown. The contract suite checks every `'user'` event: setting each scalar property, and every property of the correct authored examples while connected, emits none (`event:<tag>#<name>/not-programmatic`).
- **Typed listeners:** `static events` is keyed by event name, and the element declares `declare readonly _events?: ElementEvents<typeof Self>` (type-only, no runtime cost). Its `addEventListener` and `removeEventListener` then receive `CustomEvent<Detail>`, or the native event type for a re-dispatched DOM event. Custom event names carry the `odd-` prefix (ADR 0045), so packages also add them to `GlobalEventHandlersEventMap` and document-level listeners are typed too. Once `_events` is declared, the analyzer reports a key that differs from its event name (`analyzer.event.key`).
- **Targets, propagation, and cancellation** (verified in `packages/core/test/authoring-semantics.browser.test.ts`, three engines). A template listener (`@click=${fn}`) runs with the host as `this`; inside the shadow tree `event.target` and `event.currentTarget` are what the DOM gives (the bound element is `currentTarget`). Outside the shadow root the browser retargets the event to the host, and `composedPath()` lists the inner nodes only for an open root. `emit()` dispatches with the definition's `bubbles`, `composed`, and `cancelable` and returns `false` when a listener called `preventDefault()`; an element applies the change a cancelable event announces only after `emit()` returns `true`. An event that is not composed stays inside its shadow tree. Listener options: §6.1.
- **No feedback loops.** Property writes never emit events, so a listener that writes the reported value back (a controlled framework binding) cannot loop; writing the value a property already has is no change (`Object.is`) and runs no `updated()`.

<a id="lifecycle"></a>

## Lifecycle

Id: `contract:core/lifecycle`

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
- Native `moveBefore()` / `connectedMoveCallback` may preserve a connection where supported (feature-detected). Ordinary remove/insert follows normal disconnect/reconnect; no global delayed-cleanup heuristic.
- Queued callbacks recheck the connection generation before committing. Slot-dependent setup uses `slotchange` or an explicit parser-ready strategy.
- Browser page suspension (back/forward cache) is **not** a disconnect: elements stay connected, their scopes stay alive, and paused timers and promises resume on restore. Components never listen to page-lifecycle events themselves; application-level policy lives in §9.1.
- *(Proposed, development builds only.)* Commit causes (render-level vs direct binding), dependencies, and scope ownership can be recorded by the opt-in `@oddkin/core/inspect` entry for explanations (change-impact-and-verification.md §4.2). It is absent from production builds.

<a id="scope"></a>

## Scope: ownership and cleanup

Id: `contract:core/scope`

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

No controller field, teardown array, or matching `removeEventListener()` in the normal path. The browser already accepts an abort signal for listeners; Oddkin adds consistent ownership around it.

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
- Compose parent cancellation, caller signals, supersession, and timeouts; keep the real reason; release bridging listeners and timers when work settles. `AbortSignal.any()` / `timeout()` help but do not replace Oddkin's own bookkeeping.
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

<a id="controllers"></a>

## Shared controllers

Id: `contract:core/controllers`

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

<a id="i18n"></a>

## Localization helpers

Id: `contract:core/i18n`

DOM-free at import, unbranded, and stateless apart from a bounded formatter cache. Verified in `packages/core/test/i18n.test.ts` (Node) and `i18n.browser.test.ts` (three engines).

| Export | Contract |
| --- | --- |
| `strings(defaults, overrides)` | String table with typed overrides (`StringOverrides<T>`: any subset of the table's keys). Unknown keys and non-strings are ignored; without overrides the defaults object itself is returned. Components expose the overrides as a `strings` property and keep every visible and announced string in a `*_STRINGS` table |
| `format(template, values)` | `{name}` placeholders as plain text (never parsed as HTML); unknown placeholders stay as written |
| `plural(count, forms, locale, values?)` | Chooses the `Intl.PluralRules` category (`zero`, `one`, `two`, `few`, `many`, `other`), falling back to `other`, and formats `{count}` as a localized number |
| `langOf(node)`, `dirOf(element)` | Nearest `lang` attribute across shadow roots (`undefined` = user agent default); resolved direction from computed style, so it inherits through shadow roots and honours `dir="auto"` |
| `numberFormat`, `dateTimeFormat`, `relativeTimeFormat`, `listFormat` | One cached `Intl` formatter per kind, locale, and options (64 kept); an invalid locale falls back to the default instead of throwing |
| `formatNumber`, `formatDate` | Safe wrappers: invalid options fall back to `String(value)`; missing or invalid dates return `undefined` |

<a id="reactivity"></a>

## Reactivity

Id: `contract:core/reactivity`

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

- One `Readable<T>` protocol: `.value` and `subscribe(onChange)` (returns a disposer). Writable signals add assignment and `.update(fn)`. Stable snapshots and subscribe functions support external-store integrations.


- **External stores** share one contract, `ExternalSource<T>`: `getSnapshot()` returns the same value until the state changes, and `subscribe(listener)` returns an unsubscribe function. React's `useSyncExternalStore` takes the same shape, and Redux and Zustand stores fit it. `fromExternal(source, { equals? })` reads such a store as a `Readable` without copying it into a second graph. It subscribes only while observed (an effect, a binding, an observed computed value, or `subscribe`) and unsubscribes when the last observer leaves, so a component's subscription ends with the connection scope that owns its render. Unobserved reads take a fresh snapshot. `toExternal(readable)` exposes any Oddkin readable through the same contract. Neither needs an Oddkin store; `@oddkin/ai` sources use the same type. *(Implemented, 2026-10-19: `packages/core/test/external.test.ts`, `tests/interop/external-store.browser.test.ts`; 168 B gzip when imported, nothing otherwise.)*


- Reads and writes are synchronous. `computed` is pure, lazy, memoized, tracks dynamic dependencies, and is glitch-free through diamonds.
- Default equality `Object.is`; custom equality when justified. No deep proxies or nested mutation tracking in v1.
- External subscribers notify synchronously outside a batch and once at the outer batch boundary. UI effects and DOM commits are deduplicated into a microtask.
- Flush order: derivation → DOM commits → owned post-commit effects. No default animation-frame delay for typing.
- Mutations inside effects or `updated` schedule a defined next pass. Detect cycles and runaway flushes; isolate errors.
- A manual flush helper exists for tests. Components never need `requestUpdate()` after changing a signal or declared property.


### 5.1 Several copies of `@oddkin/core` on one page

Two independently built applications can each bundle their own `@oddkin/core`. Each copy keeps its own reactive graph, scopes, error handler, and definition bindings; no copy shares state through globals (development builds keep one global, the list of copies on the page, below). What crosses copies:

- **DOM protocols:** elements, attributes, properties, events, slots, parts, and CSS custom properties work whichever copy defined the element.
- **Readables do not cross copies.** Reading `.value` registers a dependency only in the graph that owns the readable, so another copy's effects, computed values, and template bindings see its first value and no change after. Readables carry a registered brand (`Symbol.for('oddkin.readable')`), so where a template binding or helper (`classMap`, `styleMap`, `live`, `when`, `match`, `repeat`) receives one from another copy, development builds report `reactive.readable.foreign` once per readable. Bridge with `fromExternal(toExternal(readable))` (either copy's functions): the external-store contract crosses copies, and the bridge subscribes only while observed. Following foreign readables automatically was measured at 205 B gzip more for the minimal counter bundle, paid by every application for a case a deduplicated install avoids.
- **Registration:** custom element names are global per registry. A name already defined by another copy's class throws `registry.collision`, and the first registration stays. Load one copy of a component package, or isolate the other in a frame or a scoped registry; renaming tags is no way around it, because a component's internal dependencies keep their names.
- **Errors** cross copies by `code`: `instanceof OddkinError` holds only for the copy that threw.
- **Context keys** from two copies of `@oddkin/state` differ (§7.2).

Different versions of core follow the same rules. In development builds, each copy adds its version to a list under `Symbol.for('oddkin.core.copies')` when its reactive graph loads, and the second copy warns once (`[core.copies]`), naming both versions; production builds keep no list and say nothing. Within one install there is one copy: the packages that build on core take it as a peer dependency (release-process.md §1). *(Verified 2026-10-21 with two esbuild bundles on one page, `examples/duplicate-core` and `e2e/duplicate-core.spec.ts`, and `packages/core/test/foreign-readables.browser.test.ts`; the warning, 2026-10-28: `packages/core/test/copies.browser.test.ts` and the same e2e spec. Different versions, 2026-10-29: the same checks with one consumer on the published 1.0.0-beta.0 and the other on the current packages. 1.0.0-beta.0 predates the list, so it neither lists itself nor warns.)*

**Other realms.** A same-origin frame is another realm: its own globals, its own custom element registry, and its own copy of each module it loads. Each realm defines its own elements, so the same tag in two realms is no collision. Between realms the rules between copies apply: every realm of a page shares the registered symbol that brands readables, so another realm's readable is reported and can be bridged as above, and errors cross by `code`. An element moved into another realm's document keeps its class and its realm's copy of core. It adopts its styles again for the new document, because constructed style sheets belong to one document, and its properties, events, validity, and form value keep working there. *(2026-10-29: `tests/realms/`, `e2e/realms.spec.ts`, three engines.)* A cross-origin frame shares nothing but messages.

<a id="external-store"></a>

## External stores

Id: `contract:core/external-store`

- **External stores** share one contract, `ExternalSource<T>`: `getSnapshot()` returns the same value until the state changes, and `subscribe(listener)` returns an unsubscribe function. React's `useSyncExternalStore` takes the same shape, and Redux and Zustand stores fit it. `fromExternal(source, { equals? })` reads such a store as a `Readable` without copying it into a second graph. It subscribes only while observed (an effect, a binding, an observed computed value, or `subscribe`) and unsubscribes when the last observer leaves, so a component's subscription ends with the connection scope that owns its render. Unobserved reads take a fresh snapshot. `toExternal(readable)` exposes any Oddkin readable through the same contract. Neither needs an Oddkin store; `@oddkin/ai` sources use the same type. *(Implemented, 2026-10-19: `packages/core/test/external.test.ts`, `tests/interop/external-store.browser.test.ts`; 168 B gzip when imported, nothing otherwise.)*

<a id="copies"></a>

## Several copies of core on one page

Id: `contract:core/copies`

Two independently built applications can each bundle their own `@oddkin/core`. Each copy keeps its own reactive graph, scopes, error handler, and definition bindings; no copy shares state through globals (development builds keep one global, the list of copies on the page, below). What crosses copies:

- **DOM protocols:** elements, attributes, properties, events, slots, parts, and CSS custom properties work whichever copy defined the element.
- **Readables do not cross copies.** Reading `.value` registers a dependency only in the graph that owns the readable, so another copy's effects, computed values, and template bindings see its first value and no change after. Readables carry a registered brand (`Symbol.for('oddkin.readable')`), so where a template binding or helper (`classMap`, `styleMap`, `live`, `when`, `match`, `repeat`) receives one from another copy, development builds report `reactive.readable.foreign` once per readable. Bridge with `fromExternal(toExternal(readable))` (either copy's functions): the external-store contract crosses copies, and the bridge subscribes only while observed. Following foreign readables automatically was measured at 205 B gzip more for the minimal counter bundle, paid by every application for a case a deduplicated install avoids.
- **Registration:** custom element names are global per registry. A name already defined by another copy's class throws `registry.collision`, and the first registration stays. Load one copy of a component package, or isolate the other in a frame or a scoped registry; renaming tags is no way around it, because a component's internal dependencies keep their names.
- **Errors** cross copies by `code`: `instanceof OddkinError` holds only for the copy that threw.
- **Context keys** from two copies of `@oddkin/state` differ (§7.2).

Different versions of core follow the same rules. In development builds, each copy adds its version to a list under `Symbol.for('oddkin.core.copies')` when its reactive graph loads, and the second copy warns once (`[core.copies]`), naming both versions; production builds keep no list and say nothing. Within one install there is one copy: the packages that build on core take it as a peer dependency (release-process.md §1). *(Verified 2026-10-21 with two esbuild bundles on one page, `examples/duplicate-core` and `e2e/duplicate-core.spec.ts`, and `packages/core/test/foreign-readables.browser.test.ts`; the warning, 2026-10-28: `packages/core/test/copies.browser.test.ts` and the same e2e spec. Different versions, 2026-10-29: the same checks with one consumer on the published 1.0.0-beta.0 and the other on the current packages. 1.0.0-beta.0 predates the list, so it neither lists itself nor warns.)*

**Other realms.** A same-origin frame is another realm: its own globals, its own custom element registry, and its own copy of each module it loads. Each realm defines its own elements, so the same tag in two realms is no collision. Between realms the rules between copies apply: every realm of a page shares the registered symbol that brands readables, so another realm's readable is reported and can be bridged as above, and errors cross by `code`. An element moved into another realm's document keeps its class and its realm's copy of core. It adopts its styles again for the new document, because constructed style sheets belong to one document, and its properties, events, validity, and form value keep working there. *(2026-10-29: `tests/realms/`, `e2e/realms.spec.ts`, three engines.)* A cross-origin frame shares nothing but messages.

<a id="templates"></a>

## Templates and rendering

Id: `contract:core/templates`

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
- Keyed lists need stable unique keys; reorder reuses DOM and item state; removal releases the item scope; duplicate/unstable keys get dev diagnostics.
- Optional helper subpaths: `classMap`, `styleMap`, refs, live-input handling (cursor, IME composition, autofill), event options.
- Deterministic cleanup for replaced templates, removed items, detached roots, and failed renders. Cache by template identity, document, and parsing context; handle SVG. Dynamic tag/attribute names are not v1.
- **Security:** no `eval`, no string-to-HTML. Define unsafe sinks, URL policy, and event/property restrictions. Test strict CSP and document Trusted Types integration. Any trusted-markup escape hatch is a separate explicit API. Oddkin is not a general sanitizer.
- **Diagnostics:** component, template location/part, property, phase, likely fix; dev-only tracing; one error-reporting path; defined recovery after a failed commit.
- **Collections and data models:** keyed `repeat` is fed by `@oddkin/core/collections` for components with structured content; item templates track external reactive reads, so output never goes stale when only a dependency changes. Model definitions (`@oddkin/core/model`) generate types, validators, and schemas. See data-composition.md.
- **Behavior tools** (built when catalog components need them): resize/intersection observers, refs/slot observation, form association, roving tabindex, focus return, `Intl` formatting. Prefer native CSS, `<dialog>`, popover/top layer, logical properties. Portals, advanced overlays, transitions, and virtualization follow concrete requirements and measurement.

<a id="rendering"></a>

## Rendering behaviors

Id: `contract:core/rendering`

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
  - Firefox 157's `moveBefore()` blurs a focused element inside a shadow root, so after any move that lost it, focus and the text selection, with its direction, are restored (`foundation.browser.test.ts`: a moved row in a shadow root, and a focused field inside a nested component, in three engines).
  - Keys and item templates are evaluated before the DOM changes: an item template that throws leaves the list as it was, and the next good list renders exactly.


- **First render** is synchronous during connection, so `mounted(scope)` sees committed DOM. Later renders and direct bindings commit in the microtask flush.
- **`updated(changes)`** runs in the post phase after each commit batch, including the first; `changes` maps changed public properties to previous values and is empty for binding-only work.
- **`updateComplete`** resolves when the shared flush settles; a disconnected element has no pending work for it.


- **Declarative shadow DOM** content is replaced on first render; hydration is not supported.
- **Invalid values** (`element.attribute.invalid`, `element.prop.invalid`) fall back to the property default.
- **Attributes for property-only properties** (development builds): at first connection, an attribute named after a property that takes no attribute reports `element.attribute.propertyOnly` and is ignored. React 19 and Vue (without `.prop`) choose property or attribute when they render, so an element rendered before its definition loads gets `items="[object Object],…"` and no data until the framework sets it again; Angular property bindings, Vue `.prop`, and Svelte object values set the property, which survives the upgrade.
- **Shadowing class fields** report `element.prop.shadowed`; the field value is applied through the reactive accessor so the element still works.
- **TypeScript:** subclasses use `override` on hooks (`noImplicitOverride`), and hooks are `protected`.
- **Development and production builds** (ADR 0031): the `development` export condition selects `dist/` (full explanations, development-only checks); the default selects `dist/prod/`, where errors keep their stable `[code]` and every behavior and security check is unchanged. Development-only checks: the light-DOM `:host` scan, the recipe-defined-during-render warning, and attributes for property-only properties. Size budgets are enforced by `npm run size`.

<a id="update-complete"></a>

## updateComplete and commit timing

Id: `contract:core/update-complete`

- **First render** is synchronous during connection, so `mounted(scope)` sees committed DOM. Later renders and direct bindings commit in the microtask flush.
- **`updated(changes)`** runs in the post phase after each commit batch, including the first; `changes` maps changed public properties to previous values and is empty for binding-only work.
- **`updateComplete`** resolves when the shared flush settles; a disconnected element has no pending work for it.

<a id="failure-ownership"></a>

## Failure ownership

Id: `contract:core/failure-ownership`

Errors that cannot be thrown to a caller go to the handler set with `setErrorHandler` (default: `reportError`), with a stable code and the owner's name in `origin`. Errors thrown synchronously by an API call (invalid template binding, `define` collision, writing a signal inside a computed) throw to the caller.

| Failure | Code | Owner (`origin`) | What keeps working | Recovery |
| --- | --- | --- | --- | --- |
| Invalid attribute value | `element.attribute.invalid` | element | Property falls back to its default | Next valid value applies |
| Derivation or `render()` throws | `reactive.effect.error` | `<tag> render` | Last committed DOM stays; other elements and bindings update | Re-runs when a dependency read before the throw changes |
| Direct binding's readable throws | `reactive.effect.error` | template binding | Sibling bindings in the same template; no re-render | Re-runs when its dependencies change |
| Effect throws | `reactive.effect.error` | effect name | Other effects in the same flush | Re-runs on its next dependency change |
| Commit or property setter throws | `reactive.effect.error` | the effect or binding | Sibling bindings | Next value is written again |
| A new template fails while committing (a binding rejects its value) | `reactive.effect.error` in an element; thrown by `render()` | `<tag> render` | The part's previous content is released first (so refs see the old element go before a new one arrives), then everything the failed template bound; the part is empty | The next value renders |
| A `repeat()` item template throws | `reactive.effect.error` in an element; thrown by `render()` | `<tag> render` | The list as it was | The next good list renders exactly |
| Cleanup throws | `scope.cleanup.error` | scope name | Every other cleanup in the scope runs, in reverse order | — |
| Lifecycle hook throws | `element.<hook>.error` | element | Rendering and bindings | Next connection calls the hook again |

Disposal during callbacks is safe: a handler that removes its own host leaves no subscriptions or owned resources, and an effect that disconnects another element prevents that element's queued effect from running. Each connection gets a fresh scope. The previous scope is aborted, and listeners do not accumulate. Direct binding updates do not re-render the host or read layout (layout getters, `getBoundingClientRect`, and `getComputedStyle` were spied during updates). Production builds report the same codes and owners with short messages (ADR 0031).

**Owners outside core.** Asynchronous work has its owner in `@oddkin/app`: a resource's or a command's failure is its `error` state (§8, §8.1), and a lazy route module that fails to load is its level's `error`, loaded again by `refresh()` (§9). The autoloader reports a definition that fails to load as `autoload.import.failed` (origin: the tag) and forgets it, so `load(tag)` tries again (`e2e/autoload.spec.ts`; Chromium, Firefox, and WebKit fetch the module again). Example setup belongs to Workbench (`mountExample`, workbench.md).

**What a `Scope` cannot catch.** A scope owns what was registered on it. It does not intercept a rejected promise nobody handles (the browser's `unhandledrejection`) or an error thrown by a listener (`scope.listen` adds the handler as is, so the browser reports it as a `window` `error`); its timers report `scope.timer.error`.

**Inspection** reads the ownership records core already keeps; there is no second reactive engine. `scopeStats()` (both builds) counts live scopes, listeners, timers, and effects, and leak tests and the lifetime benchmark (`research/benchmarks/lifetime/`) compare it before and after 1,000 cycles. `@oddkin/state/inspect` keeps a bounded update log (§7.1). Caches are bounded: prepared templates per call site (`WeakMap`), 64 `Intl` formatters (§4.2), 500 announced keys (§4.1). Per-readable graph inspection and commit causes are `@oddkin/core/inspect`, proposed for development builds with Workbench's runtime explanations (plan M11); it is not built.

<a id="roles"></a>

## Composite roles

Id: `contract:core/roles`

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
