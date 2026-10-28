import { repository, type Page } from './model.js';

const source = repository.replace(/\/blob\/main\/$/, '');

export const architecture: Page = {
  path: 'architecture',
  group: 'Project',
  eyebrow: 'Architecture',
  title: 'Architecture',
  summary:
    'The packages and what each one owns, the decisions behind them, and where their contracts are written down.',
  sections: [
    {
      id: 'packages',
      title: 'The package map',
      blocks: [
        {
          p: [
            'Each package depends only on the ones it needs. Tokens work without JavaScript; components work in any framework or none; state, app services, and the tooling are optional. A boundary check enforces the graph in CI.',
          ],
        },
        { fact: 'packages' },
      ],
    },
    {
      id: 'contracts',
      title: 'Contracts',
      blocks: [
        {
          cards: [
            {
              title: 'Core contracts',
              text: 'Signals, the binding rule, Scope ownership, templates, and the lifecycle every element follows.',
              href: `${repository}docs/architecture/core-contracts.md`,
              action: 'Read the core contracts',
              meta: '@oddkin/core',
            },
            {
              title: 'Component contracts',
              text: 'The rules every element follows (fields and forms, collections, overlays, tone, the definition of done) and each element family’s contract.',
              href: `${repository}docs/architecture/component-contracts.md`,
              action: 'Read the component contracts',
              meta: '@oddkin/components',
            },
            {
              title: 'Theming and styling',
              text: 'The theme configuration, the token pipeline and its outputs, scopes, colour, layout roles, and the styling contract components follow.',
              href: `${repository}docs/architecture/theming-and-styling.md`,
              action: 'Read theming and styling',
              meta: '@oddkin/tokens',
            },
          ],
        },
        {
          p: [
            'The scope-ownership case study shows one decision end to end: ',
            { link: 'Case study: scope ownership', href: '/architecture/scope-ownership' },
            '.',
          ],
        },
      ],
    },
    {
      id: 'decisions',
      title: 'Decision records',
      blocks: [
        {
          p: [
            'Each decision is recorded with its context, the options considered, and the consequences, in ',
            { code: 'docs/architecture/decisions' },
            '.',
          ],
        },
        { fact: 'decisions' },
      ],
    },
  ],
  next: { label: 'See what is being built', href: '/roadmap' },
};

export const roadmap: Page = {
  path: 'roadmap',
  group: 'Project',
  eyebrow: 'Roadmap',
  title: 'Roadmap',
  summary:
    'What is built, what is in progress, and what is planned, counted from the implementation plan.',
  sections: [
    {
      id: 'status',
      title: 'Status',
      blocks: [
        {
          note: [
            'Oddkin is in beta. The status below is generated from the checklists in ',
            { link: 'IMPLEMENTATION_PLAN.md', href: `${repository}IMPLEMENTATION_PLAN.md` },
            ', and the recorded evidence for each item is in ',
            { link: 'docs/verification.md', href: `${repository}docs/verification.md` },
            '.',
          ],
        },
        { fact: 'milestones' },
      ],
    },
  ],
  next: { label: 'Get help and release information', href: '/support' },
};

export const support: Page = {
  path: 'support',
  group: 'Project',
  eyebrow: 'Help and releases',
  title: 'Help and releases',
  summary: 'Supported browsers, how releases are made, and how to report a problem or contribute.',
  sections: [
    {
      id: 'help',
      title: 'Help',
      blocks: [
        {
          cards: [
            {
              title: 'Browser support',
              text: 'The supported browsers and every platform feature Oddkin uses, with what happens below its baseline.',
              href: '/support/browsers',
              action: 'Explore browser support',
              meta: 'Generated from the compatibility registry',
            },
            {
              title: 'Report an issue',
              text: 'Describe what you expected and what happened, with the smallest page that shows it.',
              href: `${source}/issues`,
              action: 'Open the issue tracker',
              meta: 'GitHub',
            },
            {
              title: 'Contributing',
              text: 'Package boundaries, component organization, CSS and browser support, the workflow, and commits.',
              href: `${repository}CONTRIBUTING.md`,
              action: 'Read the contributing guide',
              meta: 'CONTRIBUTING.md',
            },
          ],
        },
      ],
    },
    {
      id: 'releases',
      title: 'Releases',
      blocks: [
        {
          p: [
            'The current release is a beta of all eight packages, on the ',
            { code: 'beta' },
            ' tag: ',
            { code: 'npm install @oddkin/core@beta' },
            '. Contracts may still change before 1.0.0; the checklist each release passes is in ',
            { link: 'release-process.md', href: `${repository}docs/release-process.md` },
            '.',
          ],
        },
      ],
    },
  ],
};
