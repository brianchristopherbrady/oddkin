# Oddkin commercialization dossier

Status: working strategy, not a commitment  
Last reviewed: 2026-10-29; checked against the repository on 2026-11-01

This folder turns Oddkin's existing repository evidence into a testable path toward revenue. It intentionally separates the open-source runtime from the proposed commercial product and distinguishes implemented capabilities from planned work. [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) stays the single source of truth for what is scheduled; its tier CF comes from these documents.

## Recommended direction

Use the Oddkin runtime, component catalog, AI elements, token generator, analyzer, and local Workbench as the open adoption layer. Build a paid product around the expensive organizational problem they expose:

> Help design-system teams and coding agents understand what changed, what is allowed, what is affected, which checks are required, and what evidence supports a release.

The working commercial name in these documents is **Oddkin Assurance**. It is a placeholder until customer interviews establish the language buyers use (technical plan O-6); no package or command uses it.

## Where Oddkin stands (2026-11-01)

- All eight `@oddkin` packages are public on npm at `1.0.0-beta.1` under the MIT license: `core`, `tokens`, `components` (54 elements), `ai` (24 elements), `state`, `app`, `analyzer`, and `workbench`. Their commands are `oddkin-tokens`, `oddkin-analyze`, `oddkin-impact`, `oddkin-kit`, and `oddkin` (Workbench).
- Change impact (`oddkin-impact`) is a prototype. This repository's CI publishes its report on every run, and [docs/impact-demo](../impact-demo/README.md) records a scripted change that the docs site presents at https://www.oddkin.dev/change-impact.
- Workbench, change impact, and the agent kits also read a library not built with Oddkin from its Custom Elements Manifest ([libraries-without-oddkin.md](../architecture/libraries-without-oddkin.md)). No repository outside this one has run them yet.
- The support policy is [docs/support.md](../support.md) (on the site at https://www.oddkin.dev/support/policy); [SECURITY.md](../../SECURITY.md) covers vulnerability reports.
- There is no hosted service of any kind, and no customer is recorded.

The [technical plan](./technical-commercialization-plan.md) §3 has the evidence for each capability, and the [scorecard](./commercial-readiness-scorecard.md) tracks each gate's lines.

## Documents

Business:

1. [Business plan](./business-plan.md)  
   Customer, problem, product, business model, economics, risks, and milestones.
2. [Go-to-market and pricing plan](./go-to-market-and-pricing.md)  
   Positioning, launch motion, packaging, pricing hypotheses, and sales funnel.
3. [Customer discovery and paid pilot playbook](./customer-discovery-and-pilot-playbook.md)  
   Interview script, qualification rubric, pilot scope, proposal structure, and success metrics.

Technical:

4. [Technical commercialization plan](./technical-commercialization-plan.md)  
   What to stabilize, expand, build, defer, and verify: the current foundation with its evidence, workstreams A–G, milestones, and owner decisions O-1 to O-8.
5. [Release foundation plan](./release-foundation-plan.md)  
   Workstream A and Gate A as tasks RF-01 to RF-19, with owner decisions D-1 to D-11.
6. [Product patterns and flow contracts](../architecture/product-patterns-and-flows.md)  
   Technical plan for encoding product intent, states, recovery, implementations, and verification above the component layer; parked behind tier CF (O-8).

Both:

7. [Commercial readiness scorecard](./commercial-readiness-scorecard.md)  
   Gates that must be met before preview, paid pilot, and general availability, with the state of each line.

## Current thesis

Oddkin is not most defensible as another frontend framework. Its strongest differentiated assets are:

- a versioned contract chain from component definitions and tokens through metadata, documentation, examples, agent guidance, and tests, with Figma Code Connect mappings published to Figma by the owner on 2026-10-27 (their source in the repository);
- graph-based change-impact analysis with reason paths and conservative check selection (a prototype, `oddkin-impact`);
- generated, package-version-matched agent kits rather than generic AI instructions (`oddkin-kit`; shipped in `@oddkin/components` and `@oddkin/ai`);
- a framework-neutral AI interaction library covering agent workflows beyond chat (`@oddkin/ai`);
- unusually explicit verification evidence: three-engine tests, packed consumers, mutation probes, size budgets, compatibility data, recorded limitations, and a release evidence bundle from every CI run.

The commercial thesis is unproven until teams outside this repository pay to use those capabilities on their own systems.

## Operating principles

- Sell reduced risk and faster review, not framework novelty.
- Keep local evaluation useful without a sales call.
- Do not claim performance, accessibility, compatibility, or savings without evidence.
- Prefer paid pilots over free bespoke integrations.
- Build hosted features only after the same need appears in multiple customer interviews.
- Price by workspace, repository, project, or verification volume before pricing by human seat.
- Keep source contracts portable. Customers should be able to export their metadata, reports, and verification evidence.
- Avoid expanding the component catalog during the initial commercialization window unless a paying pilot requires it (owner decision O-4, 2026-10-29).

## Owner decisions

| Decision | State | Recorded in |
| --- | --- | --- |
| Whether the existing runtime remains MIT | Decided 2026-10-30: yes; a proprietary capability would ship in separate packages, never by relicensing these | Technical plan O-1; release plan D-9 |
| Which new capabilities, if any, will be proprietary | Deferred 2026-10-30, to be decided before any hosted code. Working direction: what runs locally (analyzer, change impact, Workbench, kits) stays open | Technical plan O-2 |
| Whether the first business is services-led, hosted-product-led, or intentionally hybrid | Open. The business plan recommends a services-assisted paid-pilot strategy (§15); when hosted work starts is deferred | Business plan §15; technical plan O-7 |

The technical plan §10 lists the other owner decisions (O-3 to O-8), and the release plan §19 lists D-1 to D-11.
4. Whether `Oddkin Assurance` is the product name or only the category description.
5. Which packages enter the first public preview and which remain private or `0.x`.

