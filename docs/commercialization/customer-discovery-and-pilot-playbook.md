# Customer discovery and paid pilot playbook

Status: ready to use  
Last reviewed: 2026-10-29

## 1. Purpose

Use customer conversations to test whether Oddkin solves an expensive, repeated problem. Do not use interviews to seek compliments about the technology.

The primary hypotheses are:

1. Teams cannot reliably determine the downstream impact of shared UI changes.
2. Design-system verification is either too broad and slow or too narrow and risky.
3. Coding agents lack reviewed, version-specific component context.
4. Teams will pay for an evidence-backed workflow that connects those problems.

## 2. Interview recruitment

Seek participants who directly own or consume a design system:

- design-system lead;
- frontend platform engineer;
- staff frontend engineer;
- design technologist;
- accessibility lead;
- developer-experience or AI-tooling lead.

Ask for 30–45 minutes. Do not start with a product demonstration.

## 3. Interview script

### Context

1. How many products, brands, frameworks, and component packages does your design system support?
2. Who owns components, tokens, documentation, Figma libraries, and releases?
3. Which tools are involved today?

### Recent behavior

4. Tell me about the last shared component or token change that was difficult to release.
5. How did you decide which products could be affected?
6. Which tests ran, and why those tests?
7. What was reviewed manually?
8. Did anything escape into production or require rework?
9. How much time did the change consume across teams?

### Documentation and agents

10. How do engineers discover the correct component and API?
11. What becomes stale first: code examples, Figma, docs, tokens, or tests?
12. Are coding agents allowed to build UI with the design system?
13. What mistakes do they make?
14. How is design-system context published or approved for agents?

### Buying process

15. Which team owns budget for this problem?
16. Have you purchased visual testing, design-system documentation, governance, or developer-productivity tools?
17. What security or deployment requirement would block a pilot?
18. What measurable result would justify paying for a solution?

### Closing

19. Would you provide one historical change for a no-code analysis?
20. If the analysis is useful, would you consider a paid six-week pilot?

Avoid hypothetical questions such as “Would you use this?” Prefer evidence from recent behavior, budget, and existing workarounds.

## 4. Qualification rubric

Score each category 0–2.

| Category | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Shared-system scale | one app | a few consumers | many products/brands/frameworks |
| Release pain | negligible | occasional | repeated, expensive, or risky |
| Verification cost | fast and clear | some manual work | slow, flaky, or uncertain |
| Agent-context pain | no agent use | experimental | active use with real mistakes |
| Buyer | unknown | interested lead | budget owner involved |
| Pilot readiness | no repository/change | possible later | real change and team available |
| Security fit | impossible | questions | customer CI or SaaS acceptable |

Interpretation:

- 0–5: learn, do not pursue.
- 6–9: nurture or offer a small assessment.
- 10–14: strong paid-pilot candidate.

## 5. Historical-change assessment

Before proposing integration, ask the team for:

- the base and changed revisions;
- component and token metadata if available;
- affected products they discovered manually;
- tests they ran;
- any incident or review notes;
- time spent.

Run Oddkin locally or model the graph manually. Present:

- what Oddkin could resolve;
- what remained unknown;
- selected checks and reason paths;
- differences from the team's actual process;
- false positives and any possible false negatives;
- the minimum integration required for a live pilot.

Never imply that a historical analysis proves future prevention.

## 6. Paid pilot scope

### Pilot objective

Determine whether Oddkin can reduce release uncertainty and improve agent context for one real design-system workflow.

### Inputs

- one component library;
- one token source;
- one to three products;
- existing examples or stories;
- existing CI checks;
- one or more historical changes;
- access to live pull requests during the pilot.

### Deliverables

- baseline contract snapshot;
- impact graph and report;
- verification mapping;
- CI or GitHub integration;
- generated agent context;
- weekly findings;
- final measured assessment;
- production rollout proposal or explicit recommendation not to proceed.

### Customer responsibilities

- identify an executive sponsor and technical owner;
- provide repository access or execute the local tooling;
- provide existing verification commands;
- attend weekly review;
- permit collection of agreed, non-sensitive usage metrics;
- review findings promptly.

### Oddkin responsibilities

- protect customer information;
- document what data leaves the environment;
- label unresolved or unverified results;
- avoid blocking production work;
- respond within the pilot support window;
- export all customer artifacts at the end.

## 7. Pilot success metrics

Choose three to five before starting:

- first useful report produced within one working day after setup;
- at least 80% of relevant graph edges resolved;
- zero known false negatives;
- selected verification is materially smaller than the full suite;
- one meaningful issue or missing review is identified before merge;
- review preparation time decreases;
- unsupported component API use decreases in controlled agent tasks;
- agent-context publication becomes versioned and reviewable;
- the team chooses to use the report on additional changes;
- economic buyer agrees that the result supports an annual purchase.

Do not use lines of code, report count, or raw test count as primary value metrics.

## 8. Pilot proposal outline

1. Customer situation and recent evidence.
2. Problem being tested.
3. Repository and product scope.
4. Six-week schedule.
5. Deliverables.
6. Success metrics.
7. Customer and Oddkin responsibilities.
8. Security and data handling.
9. Exclusions and change control.
10. Fee and payment schedule.
11. Subscription conversion option.
12. Case-study and reference rights, if any.

Suggested payment: 50% at start, 50% at midpoint or delivery. Adjust only with appropriate legal and accounting advice.

## 9. Weekly pilot cadence

### Week 1 — Baseline

- install tooling;
- capture contracts and existing checks;
- agree on limitations;
- measure current release process.

### Week 2 — Historical changes

- compare known changes;
- inspect false positives and unresolved edges;
- tune only generalizable mappings.

### Week 3 — Live pull request

- generate a report in the normal workflow;
- observe developer behavior;
- record support burden.

### Week 4 — Agent context

- publish a reviewed context bundle;
- run controlled component-selection and API-use tasks;
- compare failure types.

### Week 5 — Verification and approvals

- connect selected checks;
- review evidence and baseline acceptance;
- evaluate security and retention needs.

### Week 6 — Decision

- present outcomes against pre-agreed metrics;
- document gaps and costs;
- propose annual scope and price;
- ask for a clear buy, extend, or stop decision.

## 10. Questions the pilot must answer for Oddkin

- Which report section changed a decision?
- Which graph edges were unavailable in a real customer system?
- What integration consumed the most time?
- Did the customer trust selected verification?
- Did agent context produce measurable improvement?
- Which feature was requested by more than one customer?
- What did the buyer believe they were purchasing?
- Could onboarding be repeated without the repository author?
- What monthly support load should pricing cover?

## 11. Common objections

### “We already use Storybook or Chromatic.”

Response: Oddkin should ingest or complement existing examples and visual tests. The pilot tests whether contract provenance, downstream impact, and governed agent context add value beyond the existing setup.

### “We cannot upload source code.”

Response: begin with local analysis and customer-CI execution. Upload only agreed metadata, hashes, reports, and selected artifacts. Treat private workers or on-premises deployment as enterprise requirements only after the workflow is validated.

### “Our test suite already runs on every change.”

Response: investigate review preparation, product impact, agent context, and release evidence. Do not force test selection as the value proposition if the full suite is fast and reliable.

### “Web Components are not our stack.”

Response: evaluate the standard-CEM and adapter path. If Oddkin cannot model the customer's components honestly, do not sell the pilot as supported.

### “We can build this ourselves.”

Response: compare the cost of maintaining analyzers, schemas, dependency graphs, browser infrastructure, agent context, approvals, and evidence history. Accept that some large platform teams may still rationally build internally.

## 12. Post-pilot decision record

For every pilot, record:

- customer profile;
- initial pain and evidence;
- scope and fee;
- setup and support hours;
- technical gaps;
- measured results;
- customer decision;
- subscription value discussed;
- reusable product changes;
- custom changes that should not enter the product;
- permission for public or anonymized use.

