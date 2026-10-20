# 0035. Page suspension and back/forward cache restoration

- **Status:** Accepted (2026-10-20; implemented in M7 — a real restoration verified in Chromium, not verified in Firefox or WebKit under Playwright)
- **Date:** 2026-10-17
- **Area:** Core / App
- **Detailed contract:** [core-contracts.md](../core-contracts.md) §9.1
- **Builds on:** 0004 (Scope and reconnection), 0009 (browser baseline)

## Context
Browsers may freeze a page and restore it from the back/forward cache without disconnecting elements or rerunning modules. Timers and promises pause and resume. Treating `pagehide` as disposal breaks restoration, while ignoring suspension can leave external connections stale or duplicated. Oddkin's lifecycle contracts cover element disconnect/reconnect and explicit application stop/restart, but not page suspension.

## Decision
- Distinguish five lifecycles: element disconnect/reconnect, explicit application stop/restart, temporary page suspension, back/forward cache restoration, and permanent disposal. Navigation is never assumed to disconnect elements or rebuild the application.
- `pagehide` never disposes the application or its scopes. Suspension is not disposal; a genuinely disposed `Scope` is still replaced by a fresh one and never reuses an aborted signal.
- Lifecycle listeners are activated only by an explicit, owned application service (`@oddkin/app`). Importing a module never adds one. Core components never take ownership of the host page lifecycle.
- The required behavior uses baseline `pageshow`/`pagehide` and their `persisted` flags, plus `visibilitychange`. `freeze`/`resume` are verified enhancements only. No `unload` listeners.
- Services declare suspend and resume behavior. Resources revalidate on restore only under a declared policy; stale-result guards apply. Mutations are never retried automatically, and cancellation never implies rollback.

## Alternatives considered
- **Dispose on `pagehide`, rebuild on `pageshow`** — loses state and defeats the cache.
- **Automatic suspension inside components** — couples components to host lifecycle and breaks framework embedding.
- **`unload`/`beforeunload` cleanup** — makes pages ineligible for the cache in some browsers and is unreliable.

## Consequences
Resource and service contracts gain restore policies. Browser fixtures must prove an actual persisted restoration (`pageshow.persisted === true`); when the test environment prevents a real cache restoration, the scenario is recorded as not verified.

## Evidence
Implemented (M7, [core-contracts.md](../core-contracts.md) §9.1): `pageLifecycle(app)` in `@oddkin/app/lifecycle`, `app.suspend()`/`app.resume()`, and the resource option `revalidateOnRestore`. Verified 2026-10-20 ([verification.md](../../verification.md)): in Chromium, `e2e/lifecycle.spec.ts` proves real restorations (`pageshow.persisted` true, the same JavaScript heap) twice in a row, with the state kept, one suspension and resumption per stay, no listener, scope, or timer registered twice, only the resource with a restore policy loading again, and nothing resumed after an explicit stop; reloads, history navigation inside the page, and stop/restart are separated in all three engines; real `PageTransitionEvent`s in all three engines show the same service behavior and that importing every package entry and connecting components registers no lifecycle listener. Not verified: a real restoration in Playwright's Firefox (its driver disables the cache) and WebKit (never restored in our probes), and freezing outside the cache (not triggerable headless). Source: R54 ([web.dev bfcache](https://web.dev/articles/bfcache)).

## Revisit when
The browser baseline changes, or Page Lifecycle APIs become baseline-supported.
