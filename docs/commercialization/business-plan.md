# Oddkin business plan

Status: hypothesis to validate  
Last reviewed: 2026-10-29

## 1. Executive summary

Oddkin is a browser-native component and design-system platform with a differentiated assurance layer. Its repository already connects component definitions, design tokens, metadata, documentation, examples, Figma mappings, generated agent guidance, change-impact analysis, and verification evidence.

The proposed business is not primarily the sale of UI components. It is a hybrid open-source and commercial business:

- permissive runtime and local tooling drive adoption;
- paid implementation services generate early revenue and customer evidence;
- a hosted assurance product provides recurring revenue;
- enterprise support, maintenance, security, and governance increase contract value.

Working category:

> Verified design-system infrastructure for humans and coding agents.

## 2. Customer problem

Design-system teams commonly distribute truth across source code, Figma, Storybook, documentation, token repositories, tests, and tribal knowledge. A change to a shared component or token creates expensive uncertainty:

- teams cannot quickly determine which products are affected;
- full test suites are slow, while partial suites risk missing regressions;
- design and code drift;
- component documentation becomes stale;
- coding agents invent unsupported APIs or ignore approved patterns;
- visual-baseline acceptance lacks durable reasoning;
- release evidence is fragmented across CI tools;
- enterprise buyers need support, compatibility, accessibility, and maintenance evidence.

Existing documentation platforms are good at publishing knowledge. Visual-testing platforms are good at pixel review. Component explorers are good at examples. AI-context platforms are emerging. Oddkin's opportunity is to connect those concerns through one versioned contract and impact graph.

## 3. Proposed solution

### Open-source Oddkin

- browser-native authoring core;
- tokens and theme generation;
- standard and AI interaction components;
- static analyzer and standard CEM output;
- local Workbench, examples, and agent kits;
- local change-impact and verification artifacts.

### Oddkin Assurance Cloud

- pull-request contract and token diffs;
- affected-product and affected-check analysis;
- selected verification and visual review;
- approved baselines and release evidence;
- hosted previews and history;
- governed agent-context releases;
- Figma/code consistency reporting;
- organization controls, audit history, and support.

### Services

- design-system assessment;
- Oddkin adoption or migration;
- token and theme implementation;
- custom component development;
- AI-interface implementation;
- assurance-pipeline integration;
- accessibility and compatibility remediation;
- long-term support.

## 4. Ideal customer profile

Primary ICP:

- 50–2,000 software employees;
- a central design-system or frontend-platform team;
- multiple products, brands, themes, or frameworks;
- an existing component library and token system;
- active use of coding agents;
- expensive regression review or slow shared-component releases;
- enough governance need to purchase tooling, but not enough internal capacity to build it all.

Strong early signals:

- Web Components or a cross-framework component strategy;
- a monorepo with many consumers;
- Figma and code frequently diverge;
- Storybook exists but does not answer impact questions;
- releases require manual evidence gathering;
- full visual or browser suites are too slow to run on every change;
- the team has experienced an agent hallucinating a component API.

Poor initial fit:

- a single application with no shared UI system;
- very small teams without a design-system owner;
- organizations demanding on-premises deployment before a pilot;
- teams seeking only a free component library;
- buyers whose primary requirement is native mobile UI.

## 5. Buyer and user

Economic buyers:

- VP or Director of Engineering;
- Head of Design Systems;
- Frontend Platform lead;
- Developer Experience lead;
- enterprise architecture or engineering productivity leader.

Daily users:

- design-system engineers;
- designers and design technologists;
- application engineers;
- release managers;
- accessibility specialists;
- coding agents operating through IDEs or CI.

The sales message must address the economic buyer's risk and delivery concerns while remaining technically credible to the design-system team.

## 6. Differentiation

Oddkin should not claim that any one constituent idea is novel. Its differentiation is the integrated, evidence-backed chain:

1. Static component and token contracts.
2. Standard and enriched machine-readable metadata.
3. Examples and documentation generated from the contracts.
4. Agent guidance generated for the exact package version.
5. Change comparison with dependency provenance.
6. Conservative verification selection.
7. Human-readable release evidence.

Potential moat, if executed:

- accumulated compatibility and verification evidence;
- customer-specific dependency graphs and approved baselines;
- trusted integration into release workflows;
- high-quality agent evaluations and failure data;
- migration and support expertise;
- a reputation for honest compatibility and accessibility claims.

The source code alone is not a durable moat.

## 7. Competitive context

Relevant categories and current examples:

- Component development and agent context: [Storybook AI](https://storybook.js.org/ai)
- Hosted visual review: [Chromatic visual testing](https://www.chromatic.com/docs/visual/)
- Design-system management and MCP: [Supernova](https://www.supernova.io/pricing), [zeroheight](https://zeroheight.com/pricing/)
- Open-source framework plus commercial tooling and assurance: [Vaadin Enterprise](https://vaadin.com/enterprise)
- AI interface components: [Vercel AI Elements](https://vercel.com/changelog/introducing-ai-elements)

Oddkin should integrate with or ingest from existing tools where possible. Replacing every system of record would lengthen sales cycles and increase migration risk.

## 8. Business model

### Revenue stream A — Paid pilots and implementation

Purpose: finance development, learn the market, and produce proof.

Suggested offers:

- Design-system assurance assessment: $7,500–$15,000.
- Six-week paid pilot: $15,000–$30,000.
- Design-system launch or migration: $25,000–$100,000+.
- Custom AI-interface implementation: $20,000–$75,000+.
- Ongoing expert support: $2,000–$8,000 per month.

These are pricing hypotheses. Test willingness to pay rather than discounting automatically.

### Revenue stream B — Hosted subscription

Suggested initial packaging:

- Community: free local and public-project usage.
- Team: $299–$799 per workspace per month.
- Business: $1,000–$3,000 per workspace per month with more repositories, history, and approvals.
- Enterprise: $25,000–$100,000+ annually with SSO, audit, private networking, support, and negotiated retention.

Prefer workspace, repository, or verification-volume pricing over editor-seat pricing. Agents and CI create value without corresponding human seats.

### Revenue stream C — Enterprise assurance

- long-term supported releases;
- prioritized fixes;
- migration tooling;
- accessibility and compatibility evidence;
- restricted-environment support;
- legal and procurement accommodations;
- optional commercial components or adapters developed after validated demand.

## 9. Distribution strategy

Open-source packages create technical trust and a low-friction evaluation path. The primary acquisition loop should be:

1. Developer encounters a useful package, impact report, or AI component.
2. Local tooling demonstrates value in one repository.
3. The team wants history, collaboration, approvals, hosted verification, or private agent context.
4. The organization buys a workspace or paid pilot.

Acquisition channels:

- GitHub and npm;
- design-system and Web Components communities;
- technical demonstrations and benchmark repositories;
- Figma and coding-agent workflows;
- targeted outreach to design-system leads;
- partnerships with frontend consultancies;
- migration guides from Storybook-only or hand-maintained systems;
- public incident write-ups showing a regression caught by the impact graph.

## 10. Sales motion

Start founder-led and technical.

1. Qualify the team and its release pain.
2. Analyze one real historical change.
3. Show what Oddkin would have selected and why.
4. Propose a paid pilot with measurable outcomes.
5. Integrate into one repository and one release path.
6. Review results with engineering and design-system leadership.
7. Convert to annual hosted and support agreement.

Avoid long unpaid proofs of concept. A small paid assessment can precede the full pilot.

## 11. Unit-economics assumptions

Track these from the first customer:

- customer acquisition hours and cash cost;
- onboarding engineering hours;
- monthly support hours;
- verification compute and storage cost;
- gross margin by plan;
- pilot-to-subscription conversion;
- annual contract value;
- retention and expansion;
- time to first useful report;
- number of repositories and products per customer.

Do not offer unlimited high-cost browser execution until real usage distributions are known.

## 12. Illustrative first-year scenarios

These are planning scenarios, not forecasts.

### Validation scenario

- 4 paid pilots at $15,000 = $60,000 services revenue.
- 2 convert to $25,000 annual contracts = $50,000 ending ARR.
- Objective: prove repeatable value, not maximize revenue.

### Base scenario

- 6 paid pilots at $20,000 = $120,000 services revenue.
- 3 enterprise conversions averaging $35,000 = $105,000 ending ARR.
- 8 Team workspaces averaging $500/month = $48,000 annualized subscription value.

### Strong-signal scenario

- 8 paid pilots at $25,000 = $200,000 services revenue.
- 5 enterprise conversions averaging $50,000 = $250,000 ending ARR.
- Evidence supports hiring for product engineering and customer success.

## 13. Major risks

### Product breadth

Risk: Oddkin appears to be many products without a clear reason to buy.  
Mitigation: market Assurance first; describe the runtime as the reference and adoption layer.

### Mature competition

Risk: Storybook, Chromatic, Supernova, zeroheight, Vaadin, and AI UI libraries have distribution and brand recognition.  
Mitigation: integrate where useful and focus on provenance, impact, and verification rather than generic docs.

### Open-source monetization

Risk: permissive packages can be used without paying.  
Mitigation: charge for collaboration, history, hosted execution, enterprise controls, support, and maintenance.

### Support burden

Risk: a broad framework and component catalog creates high maintenance costs.  
Mitigation: freeze scope, publish support tiers, and measure support cost per customer.

### Assurance credibility

Risk: incomplete screen-reader, Safari-hardware, or reliability evidence undermines the product promise.  
Mitigation: label limitations, finish the highest-value evidence before general availability, and never turn missing evidence into a pass.

### Enterprise sales cycle

Risk: SSO, security review, and procurement delay revenue.  
Mitigation: begin with paid repository-level pilots that can run through customer CI.

## 14. Business milestones

### Validation gate

- 15 qualified interviews;
- 5 teams agree to evaluate;
- 2 paid pilots;
- one repeated problem across at least three teams.

### Product gate

- external install succeeds without repository knowledge;
- time to first report under one working session;
- impact report changes a review or test decision;
- one agent evaluation shows fewer unsupported API uses.

### Repeatability gate

- 3 paying customers;
- at least 50% pilot conversion;
- onboarding can be followed from a written playbook;
- monthly support load is understood;
- hosted gross margin can be estimated credibly.

### Scale gate

- 10 paying organizations;
- referenceable case studies;
- defined security and support program;
- clear expansion path across repositories or products;
- enough recurring revenue to justify dedicated commercial infrastructure.

## 15. Recommended decision

Proceed with a services-assisted paid-pilot strategy while stabilizing the open packages and building only the smallest hosted review loop. Do not invest in a broad SaaS platform until customers pay for the impact and assurance workflow.

