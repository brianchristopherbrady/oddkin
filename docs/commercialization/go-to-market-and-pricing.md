# Go-to-market and pricing plan

Status: proposed experiments  
Last reviewed: 2026-10-29

## 1. Positioning

### Primary positioning

> Oddkin helps design-system teams and coding agents ship shared UI changes with verified context: what changed, what is affected, which checks matter, and what evidence supports release.

### Short description

Oddkin Assurance connects component contracts, design tokens, examples, products, tests, Figma mappings, and agent guidance. It turns a UI-system change into an explainable impact report and a focused verification plan.

### Avoid leading with

- “a new frontend framework”;
- “a Storybook replacement”;
- “AI-powered documentation” without explaining the evidence source;
- an exhaustive list of all Oddkin packages;
- unsupported performance or accessibility superlatives.

## 2. Initial wedge

Target multi-product design-system teams that already have components and tests but lack dependable impact analysis and approved agent context.

The first demonstration should use a real change and show:

1. exact contract and token differences;
2. affected components, products, examples, and checks;
3. the reason path for every selected check;
4. browser, accessibility, visual, and package evidence;
5. the resulting reviewed agent-context change.

## 3. Messaging by audience

### Design-system lead

- Know which products a component or token change can affect.
- Keep documentation and examples attached to the real contract.
- Review visual and behavior evidence in one place.

### Engineering leader

- Reduce shared-UI release uncertainty.
- Avoid running every expensive check on every change without losing conservative coverage.
- Produce auditable evidence for releases.

### Application engineer

- Get exact component APIs and examples in the IDE.
- Stop guessing which attributes, properties, events, or tokens are supported.
- See actionable failures tied to the changed contract.

### AI/platform lead

- Publish reviewed, versioned UI context to coding agents.
- Detect unsupported API usage.
- Track when context changed and which evidence supports it.

## 4. Packaging

### Community

Price: free.

- local analysis and impact report;
- local Workbench;
- generated agent kit;
- public schemas and export;
- community support;
- limited or no hosted retention.

Purpose: adoption, trust, and evaluation.

### Team

Starting hypothesis: $299–$799/workspace/month.

- private hosted reports;
- GitHub integration;
- report and artifact history;
- pull-request status;
- baseline approval;
- a bounded amount of hosted verification;
- email or standard support.

### Business

Starting hypothesis: $1,000–$3,000/workspace/month.

- multiple repositories and products;
- longer retention;
- organization roles;
- approved agent-context releases;
- advanced impact views;
- adoption and usage reporting;
- priority support.

### Enterprise

Starting hypothesis: $25,000–$100,000+/year.

- SSO and audit logs;
- private networking or customer-run workers;
- negotiated retention and security review;
- long-term support and migration assistance;
- service-level commitments;
- procurement and legal terms;
- optional dedicated support.

## 5. Paid pilot offer

Name: **Oddkin Assurance Pilot**  
Length: six weeks  
Price hypothesis: $15,000–$30,000

Included:

- one component library;
- one to three consuming products;
- contract and token baseline;
- impact analysis on selected historical and live changes;
- customer-CI verification ingestion;
- local or hosted report;
- generated agent context;
- weekly working session;
- final findings and rollout recommendation.

Not included unless separately scoped:

- full component-library migration;
- custom identity provider integration;
- unlimited component development;
- formal accessibility certification;
- general application hosting;
- production SLA.

Conversion offer:

- credit a defined portion of the pilot fee toward the first annual subscription if signed within 30 days;
- do not credit custom engineering that cannot be reused.

## 6. Launch assets

Required before outreach:

- a five-minute recorded demo;
- a public sample impact report;
- a sample release evidence bundle;
- a before/after agent task showing unsupported API reduction;
- a security and data-flow overview;
- a clear limitations page;
- installation guide under 15 minutes;
- pricing or at least a paid-pilot page;
- one architecture page explaining local versus hosted data.

Useful technical content:

- “Why component docs are not enough context for coding agents.”
- “Selecting UI tests from contract changes without hiding uncertainty.”
- “A token change affected six products: here is the reason graph.”
- “Properties are not attributes: preventing agent-generated custom-element bugs.”
- “What release evidence should an accessible component library retain?”

## 7. Outreach plan

### Target list

Build a list of 50 organizations with evidence of:

- a public design system;
- Web Components or multiple frontend frameworks;
- dedicated design-system engineers;
- active AI-assisted development;
- multiple brands or products;
- public discussions of documentation or release pain.

### Initial message

Keep it diagnostic rather than promotional:

> I am researching how design-system teams decide which products and tests are affected by a component or token change, especially now that coding agents consume component documentation. Oddkin builds an evidence graph from component contracts, tokens, examples, and tests. I would value 30 minutes to compare it with your current release process. I am not asking you to replace your component library.

### Funnel targets for the first cycle

- 50 targeted contacts;
- 15 interviews;
- 8 qualified problems;
- 5 technical evaluations;
- 2 paid pilots;
- 1 annual conversion.

These are learning targets, not a scalable acquisition forecast.

## 8. Channel strategy

Prioritize:

1. Founder-led direct outreach.
2. Technical demonstrations on GitHub.
3. Design-system and Web Components communities.
4. Partnerships with consultancies that implement enterprise design systems.
5. Content showing real failure detection rather than generic thought leadership.
6. npm and package documentation as product-led entry points.

Defer paid advertising until the message and conversion path are proven.

## 9. Pricing experiments

Test these questions explicitly:

- Does the buyer prefer workspace, repository, product, or verification-volume pricing?
- Is hosted execution valuable, or must checks run in customer CI?
- Will teams pay more for approved agent context than for documentation hosting?
- Is impact analysis valuable without visual testing?
- Which enterprise control first blocks purchase: SSO, audit, networking, or support?
- Does a services credit improve annual conversion?

Do not offer a permanent deeply discounted plan to early customers. Use a time-bounded design-partner agreement with explicit feedback and reference rights.

## 10. Metrics

Acquisition:

- qualified interviews per month;
- evaluation starts;
- paid-pilot conversion;
- source of qualified opportunities.

Activation:

- time to first snapshot;
- time to first useful impact report;
- percentage of graph edges resolved;
- number of repositories and products connected.

Value:

- checks avoided or reused with evidence;
- regressions caught before merge;
- review time changed;
- unsupported agent API uses changed;
- releases using the evidence bundle.

Commercial:

- pilot revenue;
- annual recurring revenue;
- pilot-to-annual conversion;
- gross margin;
- support hours per workspace;
- retention and expansion.

## 11. 12-week launch sequence

### Weeks 1–2

- settle package and message scope;
- repair status documentation;
- create demo and sample report;
- define the paid pilot;
- assemble target list.

### Weeks 3–4

- conduct ten interviews;
- observe two external installations;
- revise terminology from customer language;
- publish technical demo and limitations.

### Weeks 5–8

- close the first paid pilot;
- integrate through customer CI if hosted execution is not ready;
- measure onboarding and support effort;
- document every missing adapter or contract.

### Weeks 9–12

- close a second pilot;
- extract repeatable onboarding;
- build only repeated hosted needs;
- prepare the first case study;
- make a continue, narrow, or stop decision based on paid evidence.

## 12. Continue/stop criteria

Continue investing in the hosted product when:

- at least two teams pay for the workflow;
- the same core problem appears in at least three organizations;
- onboarding can become repeatable;
- customers use the report to make release decisions;
- hosted collaboration is valued beyond consulting.

Narrow or stop when:

- teams like the technology but will not pay;
- every pilot requires unrelated custom development;
- the impact graph cannot generalize beyond Oddkin;
- existing tools solve the problem adequately after configuration;
- support and browser execution costs make the target pricing uneconomic.

