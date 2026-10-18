# 0035. Page suspension and back/forward cache restoration

- **Status:** Proposed
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
Pending: M7 fixtures (repeated restoration, state preservation, listener counts, resource freshness, explicit shutdown, distinguished from reloads and ordinary history navigation). Source: R54 ([web.dev bfcache](https://web.dev/articles/bfcache)).

## Revisit when
The browser baseline changes, or Page Lifecycle APIs become baseline-supported.
