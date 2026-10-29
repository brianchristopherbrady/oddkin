# Commercial readiness scorecard: technical gates

Status: proposed gates. Rewritten on 2026-10-29 from the owner's scorecard (the original is in commit `cdad50c`) and checked against the repository (`main` at `0d08543`).

A gate passes only with recorded evidence; code that exists is not enough. This file keeps the technical lines. The owner tracks the commercial lines (offers, pricing, contracts, payment, target accounts, interviews, buyers, revenue, references, and case studies) outside the repository.

Classes, as in the [technical plan](./TECHNICAL_COMMERCIALIZATION_PLAN.md): **Verified**, **Verify**, **Partial**, **Planned** (not started), **Owner**, **Stale**, **Unknown**. Lines about a hosted service stay Planned until a service exists.

## Gate A: public technical preview

The release plan maps each line to its evidence and tasks ([RELEASE_FOUNDATION_IMPLEMENTATION_PLAN.md](./implementation/RELEASE_FOUNDATION_IMPLEMENTATION_PLAN.md) §22). On 2026-10-29, 8 of 23 lines are Verified.

| Line | Class | Next |
| --- | --- | --- |
| Public package cut is decided. | Owner | All eight are published; support tiers and Workbench's version line are D-1 and D-2 |
| Preview versions replace `0.0.0`. | Verified | All eight at `1.0.0-beta.0` since 2026-10-28 |
| Package privacy flags match the release decision. | Verified | — |
| README status matches the generated catalog. | Stale | RF-01, RF-02 |
| Changelogs and release notes exist. | Partial | RF-08: betas get release notes; changelogs start at 1.0.0 |
| License and ownership decisions are recorded. | Verify | MIT in the README, the manifests, and `LICENSE`; the owner confirms it for the preview (O-1, D-9) |
| Export, declaration, files, side-effect, and `customElements` checks pass from tarballs. | Verified | `npm run verify:packs` in CI |
| Clean external installation completes the quick start. | Partial | RF-11 |
| Browser and Node support policy is published. | Partial | RF-04, RF-05 |
| Known limitations are visible. | Partial | RF-04, RF-08 |
| Serial Chromium, Firefox, and WebKit evidence is current. | Verify | A green CI run; one Workbench browser test fails (Agent 2) |
| Parallel-run limitation is documented. | Verified | release-process.md §3 |
| Packed-consumer matrix passes. | Verified | CI e2e |
| Metadata and generated agent kits are current. | Verified | `verify:metadata`; the kit `--check` |
| Size budgets pass. | Verified | CI `npm run size` |
| Compatibility matrix is current. | Verified | `lint:css` |
| No accessibility claim exceeds recorded evidence. | Stale | RF-03 (D-7) |
| Release evidence bundle is downloadable. | Planned | RF-09, RF-10 |
| Installation guide takes less than 15 minutes in observation. | Planned | RF-18 |
| A sample project produces a useful impact report. | Partial | RF-07 |
| Error messages identify the corrective action. | Unknown | RF-19 |
| The docs distinguish local, hosted, implemented, and planned capabilities. | Unknown | RF-17 |
| The primary message does not require understanding every Oddkin package. | Owner | D-1, RF-16, RF-17 |

## Gate B: pilot readiness (technical lines)

| Line | Class | Evidence or next step |
| --- | --- | --- |
| One repository not built with Oddkin has completed local analysis. | Planned | The analyzer reads Oddkin-authored components only; Workbench reads standard CEM, and P0.3 adds a fixture for it (Workstream B) |
| Customer CI can upload or export agreed artifacts. | Partial | Reports export as JSON and Markdown files, and CI results merge with `oddkin-impact compare --results`; there is no upload path (C, D) |
| Snapshots and reports contain source and tool provenance. | Partial | Tool versions and artifact hashes are recorded; the source revision and dirty state are not (C) |
| Unresolved edges widen verification conservatively. | Verify | The impact prototype ([change-impact-and-verification.md](../docs/architecture/change-impact-and-verification.md) §2.5) and its tests; not yet run on an external library |
| Reports never imply a pass when execution is missing. | Verify | The `not-executed` state and `mergeResults` (§2.4, §2.7); not yet run on an external library |
| Customer data can be exported and deleted. | Planned | Today every artifact is a local file; this applies once a service stores data |
| Secrets are excluded from artifacts by default. | Partial | Snapshots store hashes, not sources; nothing scans for secrets; the evidence bundle's test checks for environment values (RF-09) |
| The integration can be removed cleanly. | Unknown | No integration exists yet; the local tools are development dependencies |
| Baseline release time and verification behavior can be recorded. | Partial | CI step runtimes (P0.6 records them) |
| Product usage is measured without collecting unnecessary source data. | Planned | Nothing measures usage |

## Gate C: repeatable beta (technical lines)

| Line | Class | Evidence or next step |
| --- | --- | --- |
| Common integrations no longer require repository-author intervention. | Planned | Workstreams B and D |
| GitHub integration is idempotent and observable. | Planned | Workstream D |
| Artifact retention and deletion are configurable. | Planned | Workstream E |
| Baseline approval history is durable. | Planned | Visual baselines are not implemented (P1.7); the accept command is designed in change-impact-and-verification.md §2.6 |
| Agent-context releases are versioned and reviewable. | Partial | Kits are versioned and fingerprinted; no review, approval, or diff (Workstream F) |
| Service incidents have an owner and response process. | Planned | No service exists |

## Gate D: general availability (technical lines)

### Service

| Line | Class |
| --- | --- |
| Availability objectives are published. | Planned |
| Backups and restoration are tested. | Planned |
| Tenant isolation is reviewed. | Planned |
| Authentication and authorization are reviewed. | Planned |
| Audit logging covers sensitive actions. | Planned |
| Data retention and deletion are tested. | Planned |
| Subprocessors and hosting regions are documented. | Planned |
| Vulnerability reporting and incident response exist. | Planned: there is no `SECURITY.md` (RF-13 covers the packages) |
| Billing, cancellation, and export paths work. | Planned |

### Product

| Line | Class |
| --- | --- |
| A stable artifact compatibility policy exists. | Partial: schemas carry versions, and release-process.md covers the packages; no policy for artifacts |
| An upgrade and deprecation policy exists. | Partial: release-process.md for the packages; none for a service |
| The boundary with Storybook, Chromatic, documentation platforms, and CI is documented. | Planned (technical plan §7, interoperability) |

### Enterprise

| Line | Class |
| --- | --- |
| SSO and roles are built to requirements validated by paying customers. | Planned (Workstream G) |
| Security review materials exist. | Planned |
| The private-execution or customer-CI architecture is documented. | Planned (Workstream D, step 1) |
| Published claims match the verification evidence. | Partial (RF-03, RF-04) |

## Technical status, 2026-10-29

- **Foundation:** the published beta, with CI green except one Workbench browser test.
- **Gate A:** 8 of 23 lines Verified.
- **External installation evidence:** in-repository fixtures, packed consumers, and the golden path, plus a weekly install of the published packages whose first run is pending; no external repository yet.
- **Libraries not built with Oddkin:** Workbench reads their CEM; analysis and impact do not.
- **Hosted product:** not started.

The next technical milestone is one external repository that produces a useful, trusted impact report.
