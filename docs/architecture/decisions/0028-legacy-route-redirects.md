# 0028. Legacy route redirects

- **Status:** Proposed
- **Date:** 2026-10-17
- **Area:** Workbench
- **Detailed contract:** [workbench-pages.md §2](../workbench-pages.md)

## Context
Removing the Playground destination and moving Theme Studio change URLs that may be bookmarked or shared.

## Decision
Page registry `legacyRoutes` generate redirects: static redirect stubs (meta refresh + canonical link) in history mode, in-app redirects in hash mode. Defaults: `/playground` → `/components` (or `/components/<tag>` with valid share state), `/foundations/theme-studio` → `/theme-studio`, `/foundations/products` → products route or a "not enabled" notice.

## Alternatives considered
- No redirects — broken links.

## Consequences
Static builds emit extra stub files.

## Evidence
Pending: M7 base-path and redirect tests.

## Revisit when
Hosts support configured server redirects that we can emit instead.