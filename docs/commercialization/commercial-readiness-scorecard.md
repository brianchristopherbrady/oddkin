# Commercial readiness scorecard

Status: proposed gates. The owner's scorecard of 2026-10-29, with each technical line checked against the repository on 2026-10-29 and again on 2026-11-01 (`main` at `8830ef5`, CI run 41357723623). The commercial lines are the owner's and record no evidence yet.

Use this scorecard to prevent technical completeness from being mistaken for commercial readiness. A gate passes only with recorded evidence; code that exists is not enough.

Classes, as in the [technical plan](./technical-commercialization-plan.md): **Verified** (implemented and currently verified), **Verify** (implemented, verification remaining), **Partial**, **Planned** (not started), **Owner** (the owner's to do or decide), **Stale**, **Unknown** (requires investigation). Lines about a hosted service stay Planned until a service exists. The [release plan](./release-foundation-plan.md) §22 maps each Gate A line to its tasks (RF-01 to RF-19).

## Gate A: public technical preview

On 2026-11-01, 16 of 23 lines are Verified (8 on 2026-10-29).

### Product and release

| Line | Class | Evidence or next step |
| --- | --- | --- |
| Public package cut is decided. | Verified | Owner decisions D-1 and D-2 (2026-10-30); the root README lists the packages in that order |
| Preview versions replace `0.0.0`. | Verified | All eight at `1.0.0-beta.1` on npm since 2026-11-01 (`beta` and `latest`; `1.0.0-beta.0` on 2026-10-28) |
| Package privacy flags match the release decision. | Verified | No package is `private`; all eight are public under the owner's `@oddkin` scope |
| README status matches the generated catalog. | Partial | Corrected for `1.0.0-beta.1` (RF-01, 2026-10-30); the check that keeps it true is RF-02 |
| Changelogs and release notes exist. | Verified | Each beta has release notes ([1.0.0-beta.1](../releases/1.0.0-beta.1.md)); changelogs start at 1.0.0 ([release-process.md](../release-process.md) §1) |
| License and ownership decisions are recorded. | Verified | MIT in the README, the manifests, and `LICENSE`; confirmed by the owner on 2026-10-30 (O-1, D-9) |
| Export, declaration, files, side-effect, and `customElements` checks pass from tarballs. | Verified | `npm run verify:packs` in CI |
| Clean external installation completes the quick start. | Partial | Fresh projects install the published `1.0.0-beta.1` and pass in three engines (the registry smoke's specs, 2026-11-01); no installation outside this repository yet (RF-11) |
| Browser and Node support policy is published. | Verified | [docs/support.md](../support.md), on the docs site at /support/policy (RF-04); evidence for more Node versions and package managers is RF-05 |
| Known limitations are visible. | Verified | docs/support.md and the release notes' Known issues |

### Verification

| Line | Class | Evidence or next step |
| --- | --- | --- |
| Serial Chromium, Firefox, and WebKit evidence is current. | Verified | CI run 41357723623 at `8830ef5`: every step passed (Vitest: Chromium 2,856, Firefox 2,801, WebKit 2,808; node 1,560; e2e 1,134) |
| Parallel-run limitation is documented. | Verified | release-process.md §3 |
| Packed-consumer matrix passes. | Verified | CI e2e |
| Metadata and generated agent kits are current. | Verified | `verify:metadata`; the kit `--check` |
| Size budgets pass. | Verified | CI `npm run size` |
| Compatibility matrix is current. | Verified | `lint:css` |
| No accessibility claim exceeds recorded evidence. | Verified | The npm description, the READMEs, and the docs site name the keyboard and axe-core evidence and say screen readers are not yet verified (RF-03, D-7) |
| Release evidence bundle is downloadable. | Verified | The `1.0.0-beta.1` GitHub Release carries its CI run's `release-evidence-1` and the local `evidence.json` and `EVIDENCE.md` (D-11, attached by the owner 2026-11-01; downloaded and checked that day: the local files identical, the CI bundle for `35b6dcd`); every CI run keeps `release-evidence-<attempt>` (RF-09, RF-10) |

### Product experience

| Line | Class | Evidence or next step |
| --- | --- | --- |
| Installation guide takes less than 15 minutes in observation. | Planned | RF-18 |
| A sample project produces a useful impact report. | Partial | The recorded demonstration on Oddkin itself ([docs/impact-demo](../impact-demo/README.md), https://www.oddkin.dev/change-impact; CF.2); not yet on a sample project outside this repository |
| Error messages identify the corrective action. | Unknown | RF-19 |
| The docs distinguish local, hosted, implemented, and planned capabilities. | Unknown | RF-17 |
| The primary message does not require understanding every Oddkin package. | Owner | D-1, RF-16, RF-17 |

## Gate B: paid pilot readiness

### Commercial

| Line | Class | Evidence or next step |
| --- | --- | --- |
| Pilot offer, scope, exclusions, and price exist. | Partial | Drafted in [go-to-market-and-pricing.md](./go-to-market-and-pricing.md) §5 and the [playbook](./customer-discovery-and-pilot-playbook.md) §6; not yet offered |
| Proposal and statement-of-work templates have been reviewed appropriately. | Planned | The playbook §8 outlines a proposal |
| Payment and invoicing process exists. | Planned | — |
| Data handling and confidentiality terms exist. | Planned | — |
| Support hours and response expectations are explicit. | Planned | docs/support.md covers the open packages, not a pilot |
| A target-account list contains at least 50 organizations. | Owner | None recorded |
| At least 10 discovery interviews are complete. | Owner | None recorded |
| At least one economic buyer has reviewed the offer. | Owner | None recorded |

### Technical

| Line | Class | Evidence or next step |
| --- | --- | --- |
| One repository not built with Oddkin has completed local analysis. | Partial | Workbench, change impact, and the agent kits run on `@plain/widgets`, a fixture library of plain custom elements in this repository (CF.3, [libraries-without-oddkin.md](../architecture/libraries-without-oddkin.md)); no external repository yet |
| Customer CI can upload or export agreed artifacts. | Partial | Reports export as JSON and Markdown files, and CI results merge with `oddkin-impact compare --results`; this repository's CI publishes the report on every run (CF.2); there is no upload path (workstreams C, D) |
| Snapshots and reports contain source and tool provenance. | Partial | Tool versions and artifact hashes are recorded; the source revision and dirty state are not (workstream C). The release evidence bundle records both for a release |
| Unresolved edges widen verification conservatively. | Verify | The impact prototype ([change-impact-and-verification.md](../architecture/change-impact-and-verification.md) §2.5) and its tests; not yet run on an external library |
| Reports never imply a pass when execution is missing. | Verify | The `not-executed` state and `mergeResults` (§2.4, §2.7); not yet run on an external library |
| Customer data can be exported and deleted. | Planned | Today every artifact is a local file; this applies once a service stores data |
| Secrets are excluded from artifacts by default. | Partial | Snapshots store hashes, not sources; nothing scans for secrets; the evidence bundle's test checks for environment values (RF-09) |
| The integration can be removed cleanly. | Unknown | No integration exists yet; the local tools are development dependencies |

### Measurement

| Line | Class | Evidence or next step |
| --- | --- | --- |
| Baseline release time and verification behavior can be recorded. | Partial | CI records every step's runtime in the release evidence |
| Pilot success metrics are selected before implementation. | Owner | The playbook §7 lists candidates |
| Support and onboarding hours are tracked. | Planned | — |
| Product usage is measured without collecting unnecessary source data. | Planned | Nothing measures usage |
| A final buy/extend/stop review is scheduled. | Owner | Per pilot (playbook §9, week 6) |

## Gate C: repeatable paid beta

| Line | Class | Evidence or next step |
| --- | --- | --- |
| At least two organizations have paid. | Owner | None recorded |
| The same core problem appeared in at least three organizations. | Owner | None recorded |
| At least one pilot converted or entered procurement. | Owner | None recorded |
| Onboarding follows a written playbook. | Partial | The [playbook](./customer-discovery-and-pilot-playbook.md) is written; not yet followed |
| Common integrations no longer require repository-author intervention. | Planned | Workstreams B and D |
| Pricing covers expected compute and support cost. | Owner | Pricing hypotheses only ([go-to-market-and-pricing.md](./go-to-market-and-pricing.md) §4) |
| GitHub integration is idempotent and observable. | Planned | Workstream D |
| Artifact retention and deletion are configurable. | Planned | Workstream E |
| Baseline approval history is durable. | Planned | Visual baselines are not implemented (P1.7); the accept command is designed in change-impact-and-verification.md §2.6 |
| Agent-context releases are versioned and reviewable. | Partial | Kits are versioned and fingerprinted, and `scripts/impact-demo.mjs` diffs two revisions' kits; no review or approval step (workstream F) |
| Service incidents have an owner and response process. | Planned | No service exists |
| Customer-requested features are separated into repeated versus bespoke needs. | Owner | No customer requests yet |

## Gate D: general availability

### Service

| Line | Class | Evidence or next step |
| --- | --- | --- |
| Availability and support objectives are published. | Planned | docs/support.md covers the open packages; no service |
| Backups and restoration are tested. | Planned | — |
| Tenant isolation is reviewed. | Planned | — |
| Authentication and authorization are reviewed. | Planned | — |
| Audit logging covers sensitive actions. | Planned | — |
| Data retention and deletion are tested. | Planned | — |
| Subprocessors and hosting regions are documented. | Planned | — |
| Vulnerability reporting and incident response exist. | Partial | [SECURITY.md](../../SECURITY.md) covers the packages through GitHub private vulnerability reporting, enabled by the owner (checked 2026-11-01); no service incident response |
| Billing, cancellation, and export paths work. | Planned | — |

### Product

| Line | Class | Evidence or next step |
| --- | --- | --- |
| A stable artifact compatibility policy exists. | Partial | Schemas carry versions, and release-process.md covers the packages; no policy for artifacts |
| An upgrade and deprecation policy exists. | Partial | release-process.md for the packages; none for a service |
| At least five customers are referenceable, or the private-enterprise strategy is intentional. | Owner | None recorded |
| The product has a clear boundary with Storybook, Chromatic, documentation platforms, and CI. | Planned | Technical plan §7 (interoperability) |
| Hosted value is demonstrated independently of consulting. | Planned | No hosted service |
| At least one case study quantifies a customer outcome. | Owner | None recorded |
| The roadmap is based on repeated demand. | Owner | IMPLEMENTATION_PLAN.md orders the work from the owner's direction; no customer demand recorded |

### Enterprise

| Line | Class | Evidence or next step |
| --- | --- | --- |
| SSO and role requirements are validated by paying customers. | Planned | Workstream G |
| Security review materials exist. | Planned | — |
| Private execution or customer-CI architecture is documented. | Planned | Workstream D, step 1 |
| Support escalation and maintenance terms are defined. | Planned | docs/support.md covers the open packages' support tiers; no paid terms |
| Contractual and published claims match the verification evidence. | Partial | Published claims name their evidence (RF-03, RF-04); no contracts exist |

## Monthly operating review

Record:

- qualified interviews;
- active evaluations;
- paid pilots;
- pilot revenue;
- recurring revenue;
- time to first report;
- onboarding and support hours;
- compute and storage cost;
- graph resolution and unresolved rates;
- regressions caught;
- unsupported agent API rate;
- requested features by frequency;
- reasons opportunities were lost;
- continue, narrow, or stop decisions.

## Current status, 2026-11-01

- **Technical foundation:** strong. The published beta `1.0.0-beta.1` (2026-11-01), with CI green on `8830ef5`.
- **Public preview readiness (Gate A):** 16 of 23 lines Verified; the rest are the README check (RF-02), installation and a sample report outside this repository (RF-11), and the product-experience lines (RF-16 to RF-19).
- **External installation evidence:** fresh projects in this repository install the published packages and pass in three engines; no external repository yet.
- **Libraries not built with Oddkin:** Workbench, change impact, and the agent kits read their Custom Elements Manifest (CF.3); no external library has been run.
- **Paid-pilot readiness:** not yet established; the offer and playbook are drafted.
- **Hosted product readiness:** not started as a commercial service.
- **Market validation:** no recorded interviews or paying customers.

The next meaningful milestone is not another component. It is one external repository producing a useful, trusted impact report, followed by a paid pilot.
