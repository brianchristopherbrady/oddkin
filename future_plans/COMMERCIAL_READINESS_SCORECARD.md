# Commercial readiness scorecard

Status: proposed gates  
Last reviewed: 2026-10-29

Use this scorecard to prevent technical completeness from being mistaken for commercial readiness. A gate passes only with recorded evidence.

## Gate A — Public technical preview

### Product and release

- [ ] Public package cut is decided.
- [ ] Preview versions replace `0.0.0`.
- [ ] Package privacy flags match the release decision.
- [ ] README status matches the generated catalog.
- [ ] Changelogs and release notes exist.
- [ ] License and ownership decisions are recorded.
- [ ] Export, declaration, files, side-effect, and `customElements` checks pass from tarballs.
- [ ] Clean external installation completes the quick start.
- [ ] Browser and Node support policy is published.
- [ ] Known limitations are visible.

### Verification

- [ ] Serial Chromium, Firefox, and WebKit evidence is current.
- [ ] Parallel-run limitation is documented.
- [ ] Packed-consumer matrix passes.
- [ ] Metadata and generated agent kits are current.
- [ ] Size budgets pass.
- [ ] Compatibility matrix is current.
- [ ] No accessibility claim exceeds recorded evidence.
- [ ] Release evidence bundle is downloadable.

### Product experience

- [ ] Installation guide takes less than 15 minutes in observation.
- [ ] A sample project produces a useful impact report.
- [ ] Error messages identify the corrective action.
- [ ] The docs distinguish local, hosted, implemented, and planned capabilities.
- [ ] The primary message does not require understanding every Oddkin package.

## Gate B — Paid pilot readiness

### Commercial

- [ ] Pilot offer, scope, exclusions, and price exist.
- [ ] Proposal and statement-of-work templates have been reviewed appropriately.
- [ ] Payment and invoicing process exists.
- [ ] Data handling and confidentiality terms exist.
- [ ] Support hours and response expectations are explicit.
- [ ] A target-account list contains at least 50 organizations.
- [ ] At least 10 discovery interviews are complete.
- [ ] At least one economic buyer has reviewed the offer.

### Technical

- [ ] One non-Oddkin repository has completed local analysis.
- [ ] Customer CI can upload or export agreed artifacts.
- [ ] Snapshots and reports contain source and tool provenance.
- [ ] Unresolved edges widen verification conservatively.
- [ ] Reports never imply a pass when execution is missing.
- [ ] Customer data can be exported and deleted.
- [ ] Secrets are excluded from artifacts by default.
- [ ] The integration can be removed cleanly.

### Measurement

- [ ] Baseline release time and verification behavior can be recorded.
- [ ] Pilot success metrics are selected before implementation.
- [ ] Support and onboarding hours are tracked.
- [ ] Product usage is measured without collecting unnecessary source data.
- [ ] A final buy/extend/stop review is scheduled.

## Gate C — Repeatable paid beta

- [ ] At least two organizations have paid.
- [ ] The same core problem appeared in at least three organizations.
- [ ] At least one pilot converted or entered procurement.
- [ ] Onboarding follows a written playbook.
- [ ] Common integrations no longer require repository-author intervention.
- [ ] Pricing covers expected compute and support cost.
- [ ] GitHub integration is idempotent and observable.
- [ ] Artifact retention and deletion are configurable.
- [ ] Baseline approval history is durable.
- [ ] Agent-context releases are versioned and reviewable.
- [ ] Service incidents have an owner and response process.
- [ ] Customer-requested features are separated into repeated versus bespoke needs.

## Gate D — General availability

### Service

- [ ] Availability and support objectives are published.
- [ ] Backups and restoration are tested.
- [ ] Tenant isolation is reviewed.
- [ ] Authentication and authorization are reviewed.
- [ ] Audit logging covers sensitive actions.
- [ ] Data retention and deletion are tested.
- [ ] Subprocessors and hosting regions are documented.
- [ ] Vulnerability reporting and incident response exist.
- [ ] Billing, cancellation, and export paths work.

### Product

- [ ] Stable artifact compatibility policy exists.
- [ ] Upgrade and deprecation policy exists.
- [ ] At least five customers are referenceable, or the private-enterprise strategy is intentional.
- [ ] The product has a clear boundary with Storybook, Chromatic, documentation platforms, and CI.
- [ ] Hosted value is demonstrated independently of consulting.
- [ ] At least one case study quantifies a customer outcome.
- [ ] The roadmap is based on repeated demand.

### Enterprise

- [ ] SSO and role requirements are validated by paying customers.
- [ ] Security review materials exist.
- [ ] Private execution or customer-CI architecture is documented.
- [ ] Support escalation and maintenance terms are defined.
- [ ] Contractual claims match the verification evidence.

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

## Current high-level status

Based on repository evidence as of 2026-10-29:

- Technical foundation: strong.
- Public preview readiness: incomplete.
- External installation evidence: limited to repository fixtures and packed consumers.
- Paid-pilot readiness: not yet established.
- Hosted product readiness: not started as a commercial service.
- Market validation: no recorded paying customers.

The next meaningful milestone is not another component. It is one external repository producing a useful, trusted impact report followed by a paid pilot.

