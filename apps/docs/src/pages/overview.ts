import type { Page } from './model.js';

/** The home page; `home.ts` renders it, and its quick-start samples are verified like any page's. */
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
      id: 'quick-start',
      title: 'Start with one element',
      blocks: [
        {
          code: {
            lang: 'js',
            verify: 'module',
            code: "import '@oddkin/components/define/button';",
          },
        },
        {
          code: {
            lang: 'html',
            verify: 'markup',
            code: `<link rel="stylesheet" href="/node_modules/@oddkin/tokens/dist/css/default.css" />

<odd-button appearance="primary">Continue</odd-button>`,
          },
        },
      ],
    },
  ],
};
