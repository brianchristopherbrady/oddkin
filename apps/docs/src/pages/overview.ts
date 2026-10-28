import type { Page } from './model.js';

export const overview: Page = {
  path: '',
  group: 'Start here',
  eyebrow: 'Documentation',
  title: 'Oddkin',
  label: 'Overview',
  summary:
    'Web components, design tokens, and the tools around them. Use as little or as much as you need: every package works without the ones above it.',
  sections: [
    {
      id: 'packages',
      title: 'Packages',
      blocks: [
        {
          p: [
            'Each package depends only on the ones it needs. Tokens work without JavaScript; components work in any framework or none; state, app services, and the tooling are optional.',
          ],
        },
        { fact: 'packages' },
        {
          note: [
            'Beta: the packages install from the ',
            { code: 'beta' },
            ' tag on npm (',
            { code: 'npm install @oddkin/core@beta' },
            '), and their contracts may still change before 1.0.0.',
          ],
        },
      ],
    },
    {
      id: 'choose',
      title: 'Choose a starting point',
      blocks: [
        {
          table: {
            caption: 'Starting points by goal',
            head: ['You want to', 'Start with', 'Packages'],
            rows: [
              [
                ['Theme plain CSS or another component library'],
                [{ link: 'Tokens only', href: '/getting-started/tokens' }],
                [{ code: '@oddkin/tokens' }],
              ],
              [
                ['Use accessible components in an existing app'],
                [{ link: 'Components in any app', href: '/getting-started/components' }],
                [{ code: '@oddkin/components' }, ', ', { code: '@oddkin/tokens' }],
              ],
              [
                ['Write your own custom elements'],
                [{ link: 'Author custom elements', href: '/getting-started/author' }],
                [{ code: '@oddkin/core' }],
              ],
              [
                ['Build a whole application'],
                [{ link: 'A full Oddkin application', href: '/getting-started/app' }],
                [{ code: '@oddkin/app' }, ', ', { code: '@oddkin/state' }, ', and the above'],
              ],
              [
                ['Document a custom-element library'],
                [
                  {
                    link: 'Document your library with Workbench',
                    href: '/getting-started/workbench',
                  },
                ],
                [{ code: '@oddkin/analyzer' }, ', ', { code: '@oddkin/workbench' }],
              ],
            ],
          },
        },
      ],
    },
    {
      id: 'next',
      title: 'Next',
      blocks: [
        {
          list: [
            [
              { link: 'Installation', href: '/installation' },
              ': npm, native ES modules, and import maps.',
            ],
            [
              { link: 'Core concepts', href: '/core' },
              ': signals, the binding rule, and ownership.',
            ],
            [
              { link: 'Components', href: '/components' },
              ': every published element, from its metadata.',
            ],
            [
              { link: 'Browser support', href: '/support/browsers' },
              ': the supported browsers and what each feature needs.',
            ],
          ],
        },
      ],
    },
  ],
};
