# Oddkin commercialization dossier

Status: working strategy, not a commitment  
Last reviewed: 2026-10-29

This folder turns Oddkin's existing repository evidence into a testable path toward revenue. It intentionally separates the open-source runtime from the proposed commercial product and distinguishes implemented capabilities from planned work.

## Recommended direction

Use the Oddkin runtime, component catalog, AI elements, token generator, analyzer, and local Workbench as the open adoption layer. Build a paid product around the expensive organizational problem they expose:

> Help design-system teams and coding agents understand what changed, what is allowed, what is affected, which checks are required, and what evidence supports a release.

The working commercial name in these documents is **Oddkin Assurance**. It is a placeholder until customer interviews establish the language buyers use.

## Documents

1. [Technical commercialization plan](./TECHNICAL_COMMERCIALIZATION_PLAN.md)  
   What to stabilize, expand, build, defer, and verify.
2. [Business plan](./ODDKIN_BUSINESS_PLAN.md)  
   Customer, problem, product, business model, economics, risks, and milestones.
3. [Go-to-market and pricing plan](./GO_TO_MARKET_PRICING_PLAN.md)  
   Positioning, launch motion, packaging, pricing hypotheses, and sales funnel.
4. [Customer discovery and paid pilot playbook](./CUSTOMER_DISCOVERY_AND_PAID_PRICING_PLAN.md)  
   Interview script, qualification rubric, pilot scope, proposal structure, and success metrics.
5. [Commercial readiness scorecard](./COMMERCIAL_READINESS_SCORECARD.md)  
   Gates that must be met before preview, paid pilot, and general availability.
6. [Product patterns and flow contracts](./PRODUCT_PATTERNS_AND_FLOW_CONTRACTS_IMPLEMENTATION_PLAN.md)  
   Technical plan for encoding product intent, states, recovery, implementations, and verification above the component layer.

## Current thesis

Oddkin is not most defensible as another frontend framework. Its strongest differentiated assets are:

- a versioned contract chain from component definitions and tokens through metadata, documentation, examples, Figma mappings, agent guidance, and tests;
- graph-based change-impact analysis with reason paths and conservative check selection;
- generated, package-version-matched agent kits rather than generic AI instructions;
- a framework-neutral AI interaction library covering agent workflows beyond chat;
- unusually explicit verification evidence: three-engine tests, packed consumers, mutation probes, size budgets, compatibility data, and recorded limitations.

The commercial thesis is unproven until teams outside this repository pay to use those capabilities on their own systems.

## Operating principles

- Sell reduced risk and faster review, not framework novelty.
- Keep local evaluation useful without a sales call.
- Do not claim performance, accessibility, compatibility, or savings without evidence.
- Prefer paid pilots over free bespoke integrations.
- Build hosted features only after the same need appears in multiple customer interviews.
- Price by workspace, repository, project, or verification volume before pricing by human seat.
- Keep source contracts portable. Customers should be able to export their metadata, reports, and verification evidence.
- Avoid expanding the component catalog during the initial commercialization window unless a paying pilot requires it.

## Decision required from the owner

Before public launch, decide:

1. Whether the existing runtime remains MIT.
2. Which new capabilities, if any, will be proprietary.
3. Whether the first business is services-led, hosted-product-led, or intentionally hybrid.
4. Whether `Oddkin Assurance` is the product name or only the category description.
5. Which packages enter the first public preview and which remain private or `0.x`.

