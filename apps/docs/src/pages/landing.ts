import { composition, formsAccessibility, layout, theming } from './guides-core.js';
import type { Card, Page } from './model.js';
import { startApp, startAuthor, startComponents, startTokens, startWorkbench } from './start.js';

const cardOf = (page: Page, action: string, meta: string): Card => ({
  title: page.title,
  text: page.summary,
  href: `/${page.path}`,
  action,
  meta,
});

export const recipes: Page = {
  path: 'recipes',
  group: 'Explore',
  eyebrow: 'Recipes',
  title: 'Recipes',
  summary:
    'Example applications in the repository, built from the same components, tokens, and layout recipes as everything else.',
  sections: [
    {
      id: 'examples',
      title: 'Examples to build on',
      blocks: [
        {
          note: [
            'Run them from a clone of the repository: ',
            { code: 'npm run build' },
            ', then ',
            { code: 'node scripts/serve-static.mjs' },
            ' and open ',
            { code: 'http://localhost:4173/examples/<name>/' },
            '. The AI demos simulate their model responses.',
          ],
        },
        { fact: 'examples' },
      ],
    },
  ],
  next: { label: 'Browse the component catalog', href: '/components' },
};

export const gettingStarted: Page = {
  path: 'getting-started',
  group: 'Start here',
  eyebrow: 'Getting started',
  title: 'Getting started',
  summary:
    'Five starting points, from tokens alone to a whole application. Every package works without the ones above it, so start with the smallest one that does the job.',
  sections: [
    {
      id: 'paths',
      title: 'Choose your path',
      blocks: [
        {
          cards: [
            cardOf(startTokens, 'Use tokens only', '@oddkin/tokens'),
            cardOf(startComponents, 'Use components', '@oddkin/components'),
            cardOf(startAuthor, 'Author elements', '@oddkin/core'),
            cardOf(startApp, 'Build an application', '@oddkin/state, @oddkin/app'),
            cardOf(startWorkbench, 'Document a library', '@oddkin/analyzer, @oddkin/workbench'),
          ],
        },
      ],
    },
  ],
  next: { label: 'Continue to installation', href: '/installation' },
};

export const guides: Page = {
  path: 'guides',
  group: 'Build',
  eyebrow: 'Guides',
  title: 'Theming and layout',
  summary:
    'Change the theme, arrange pages with layout classes and recipes, build forms that behave like native fields, and compose interfaces from markup or data.',
  sections: [
    {
      id: 'guides',
      title: 'Guides',
      blocks: [
        {
          cards: [
            cardOf(theming, 'Read the theming guide', '@oddkin/tokens'),
            cardOf(layout, 'Read the layout guide', '@oddkin/components/css/layout.css'),
            cardOf(formsAccessibility, 'Read the forms guide', '@oddkin/components'),
            cardOf(composition, 'Read the composition guide', '@oddkin/components'),
          ],
        },
      ],
    },
  ],
};
