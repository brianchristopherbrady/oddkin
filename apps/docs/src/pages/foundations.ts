import { repository, type Card, type Page } from './model.js';

/** The Foundations section: the default theme's tokens, generated values only (`foundation-facts.mjs`). */
const theming = `${repository}docs/architecture/theming-and-styling.md`;
const cssArchitecture = `${repository}docs/architecture/css-architecture.md`;

const child = (page: Omit<Page, 'group' | 'parent' | 'eyebrow'>): Page => ({
  ...page,
  group: 'Build',
  parent: 'foundations',
  eyebrow: 'Foundations',
});

export const foundationTokens = child({
  path: 'foundations/tokens',
  title: 'Token architecture',
  summary:
    'Tokens come in tiers: reference values, foundation scales, semantic roles, and component roles. A token reads only from its own tier or a lower one, and the generator turns one theme configuration into CSS.',
  sections: [
    {
      id: 'layers',
      title: 'The token layers',
      blocks: [
        {
          p: [
            'Reference tokens (',
            { code: '--odd-ref-*' },
            ') hold the raw scale and palette. Semantic tokens (',
            { code: '--odd-color-text-primary' },
            ', ',
            { code: '--odd-space-md' },
            ') name a purpose. Component tokens belong to their component and are normally unset, with a fallback. The validator rejects a reference the category does not allow, such as a foundation token that aliases a component role.',
          ],
        },
        { fact: 'token-categories' },
      ],
    },
    {
      id: 'pipeline',
      title: 'From configuration to CSS',
      blocks: [
        {
          p: [
            'Stages 1 to 7 are pure and live in ',
            { code: '@oddkin/tokens/generate' },
            ', which also runs in the browser; file input and output and the command line live in ',
            { code: '@oddkin/tokens/node' },
            '. Generation is deterministic: stable key order, fixed number formatting, and no timestamps.',
          ],
        },
        { fact: 'token-pipeline' },
      ],
    },
    {
      id: 'trace',
      title: 'Trace a token',
      blocks: [
        {
          p: [
            'Roles alias the step they use, so a theme changes a step once and every role that reads it follows. ',
            { code: 'card.padding' },
            ' reads a layout role, which reads the space scale:',
          ],
        },
        { fact: 'token-trace' },
      ],
    },
    {
      id: 'overrides',
      title: 'Aliases and overrides',
      blocks: [
        {
          p: [
            'Configuration precedence: Oddkin defaults, then the preset, then the user configuration, then explicit overrides by stable token name. Each resolved token records its origin, so tools can label it generated, preset, configured, or overridden. Generated files are never edited by hand.',
          ],
        },
        {
          p: [
            'Every value on these pages comes from the default theme as ',
            { code: '@oddkin/tokens/inspect/default.json' },
            ' and ',
            { code: '@oddkin/tokens/inspect/default.contrast.json' },
            ' describe it. The ',
            { link: 'theming and token pipeline design', href: theming },
            ' has the full rules.',
          ],
        },
      ],
    },
  ],
  next: { label: 'Color', href: '/foundations/color' },
});

export const foundationColor = child({
  path: 'foundations/color',
  title: 'Color',
  summary:
    'Generated ramps supply the raw colours. Components draw with semantic roles, each with a light and a dark value, and every contracted pair of roles is checked against WCAG 2.2 in both modes.',
  sections: [
    {
      id: 'palettes',
      title: 'Reference palettes',
      blocks: [
        {
          p: [
            'An OKLCH generator builds each ramp and maps it into sRGB in a documented, deterministic way. Generated ramps do not guarantee contrast, so the role pairs that components actually draw are checked instead.',
          ],
        },
        { fact: 'palette' },
      ],
    },
    {
      id: 'roles',
      title: 'Semantic roles',
      blocks: [
        {
          p: [
            'Components read roles, not ramp steps. Each swatch below is drawn by its own token inside a ',
            { code: 'data-odd-mode' },
            ' scope, so it shows the value that mode resolves.',
          ],
        },
        { fact: 'color-roles' },
      ],
    },
    {
      id: 'actions',
      title: 'Interactive states',
      blocks: [
        {
          p: [
            'A primary action has a role per state, and text on it uses ',
            { code: 'color.text.on-action' },
            '.',
          ],
        },
        { fact: 'action-roles' },
      ],
    },
    {
      id: 'tones',
      title: 'Status tones',
      blocks: [
        {
          p: [
            'Each tone has a foreground, a surface, and a decorative edge, which has no contrast minimum. Below, ',
            { code: 'odd-alert' },
            ' in each tone.',
          ],
        },
        { fact: 'tone-roles' },
      ],
    },
    {
      id: 'contrast',
      title: 'Contrast pairs',
      blocks: [
        {
          p: [
            'The contrast report states which foreground role must reach which minimum against which backgrounds (',
            { link: 'semantic colour contracts', href: theming },
            ', section 10.4).',
          ],
        },
        { fact: 'contrast-pairs' },
      ],
    },
  ],
  next: { label: 'Typography', href: '/foundations/typography' },
});

export const foundationTypography = child({
  path: 'foundations/typography',
  title: 'Typography',
  summary:
    'Text styles combine a family, size, weight, line height, and letter spacing from the foundation scales. Sizes are in rem, so text follows the reader’s font size, and Oddkin ships no font files.',
  sections: [
    {
      id: 'families',
      title: 'Families',
      blocks: [
        {
          p: [
            { code: 'font.family.display' },
            ' aliases ',
            { code: 'font.family.sans' },
            ' by default; a theme that wants a separate display face overrides it. Oddkin does not ship or load font files.',
          ],
        },
        { fact: 'font-families' },
      ],
    },
    {
      id: 'scale',
      title: 'Type scale',
      blocks: [
        {
          p: [
            'Type and spacing are in rem with unitless line heights. Nothing forces a root size, so every size follows the reader’s font size (verified at 200%).',
          ],
        },
        { fact: 'type-scale' },
      ],
    },
    {
      id: 'styles',
      title: 'Text styles',
      blocks: [
        {
          p: [
            'Use a style as a set: ',
            {
              code: 'font: var(--odd-type-ui-weight) var(--odd-type-ui-size) / var(--odd-type-ui-line-height) var(--odd-type-ui-family)',
            },
            '. The typography recipe, ',
            { code: '@oddkin/components/css/typography.css' },
            ', has a class for each style, as in the samples.',
          ],
        },
        { fact: 'text-styles' },
      ],
    },
  ],
  next: { label: 'Spacing', href: '/foundations/spacing' },
});

export const foundationSpacing = child({
  path: 'foundations/spacing',
  title: 'Spacing',
  summary:
    'One explicit scale from 0 to 6rem. Layout and component roles choose their steps from it, so changing a layout role never changes control dimensions.',
  sections: [
    {
      id: 'scale',
      title: 'Space scale',
      blocks: [
        {
          p: [
            'The default preset uses the explicit strategy, and density scales it. Bars are drawn at each step’s width.',
          ],
        },
        { fact: 'space-scale' },
      ],
    },
    {
      id: 'roles',
      title: 'Layout vocabulary',
      blocks: [
        {
          p: [
            'Semantic and component roles pick a step deliberately: ',
            { code: 'control.padding.inline.md' },
            ' does not follow ',
            { code: 'layout.gap' },
            ', so a looser page leaves controls as they are.',
          ],
        },
        { fact: 'layout-vocabulary' },
      ],
    },
  ],
  next: { label: 'Borders and radii', href: '/foundations/borders-and-radii' },
});

export const foundationBorders = child({
  path: 'foundations/borders-and-radii',
  title: 'Borders and radii',
  summary:
    'Two border widths, a focus ring with its own width and offset, and a corner scale from square to fully rounded that controls and cards read through their own roles.',
  sections: [
    {
      id: 'widths',
      title: 'Border widths',
      blocks: [{ fact: 'border-widths' }],
    },
    {
      id: 'roles',
      title: 'Border roles',
      blocks: [
        {
          p: [
            { code: 'color.border.strong' },
            ' draws control boundaries and reaches 3:1 against the surfaces controls sit on; ',
            { code: 'color.focus.ring' },
            ' reaches 3:1 against the surface around it.',
          ],
        },
        { fact: 'border-roles' },
      ],
    },
    {
      id: 'radii',
      title: 'Corner radii',
      blocks: [{ fact: 'radii' }],
    },
    {
      id: 'mappings',
      title: 'Component mappings',
      blocks: [{ fact: 'radius-mappings' }],
    },
  ],
  next: { label: 'Elevation', href: '/foundations/elevation' },
});

export const foundationElevation = child({
  path: 'foundations/elevation',
  title: 'Elevation',
  summary:
    'Five two-layer shadows, stronger in dark mode so they stay visible: sm for controls, md for cards, lg for popovers and menus, and xl for dialogs.',
  sections: [
    {
      id: 'levels',
      title: 'Elevation levels',
      blocks: [
        {
          p: [
            'Raised surfaces pair a shadow with ',
            { code: 'color.surface.raised' },
            '; ',
            { code: 'odd-card variant="elevated"' },
            ' uses ',
            { code: 'elevation.md' },
            '. Each specimen is drawn in its mode’s scope.',
          ],
        },
        { fact: 'elevation-levels' },
      ],
    },
  ],
  next: { label: 'Motion', href: '/foundations/motion' },
});

export const foundationMotion = child({
  path: 'foundations/motion',
  title: 'Motion',
  summary:
    'Durations and easings come from motion tokens. Every duration is 0ms when the reader prefers reduced motion, and no state change waits for an animation to finish.',
  sections: [
    {
      id: 'durations',
      title: 'Durations',
      blocks: [{ fact: 'motion-durations' }],
    },
    {
      id: 'easing',
      title: 'Easing',
      blocks: [{ fact: 'motion-easings' }],
    },
    {
      id: 'reduced',
      title: 'Reduced motion',
      blocks: [
        {
          list: [
            [
              'Every open, close, navigation, and state change works with no animation; reduced motion removes or shortens decorative motion.',
            ],
            [
              'The generated token CSS sets every duration to 0ms under ',
              { code: 'prefers-reduced-motion: reduce' },
              ', so transitions that read the tokens stop without a check in each component.',
            ],
            [
              'Cleanup never depends only on ',
              { code: 'transitionend' },
              ' or ',
              { code: 'animationend' },
              ': state, visibility, focus, and accessibility attributes change at once, and an interrupted or zero-length transition settles in the same final state.',
            ],
          ],
        },
        { p: [{ link: 'Motion in the CSS architecture', href: cssArchitecture }] },
      ],
    },
  ],
  next: { label: 'Themes', href: '/foundations/themes' },
});

export const foundationThemes = child({
  path: 'foundations/themes',
  title: 'Themes',
  summary:
    'One configuration generates a theme. Attributes choose its mode, density, and profiles on any element, and the scopes nest in any order, across shadow roots.',
  sections: [
    {
      id: 'modes',
      title: 'Same roles, paired appearances',
      blocks: [
        {
          p: [
            'Each mode-dependent role is one expression switched by two inherited toggles, so mode, product, and density scopes nest in any order. The page follows ',
            { code: 'prefers-color-scheme' },
            ' unless ',
            { code: 'data-odd-mode' },
            ' is set; ',
            { code: 'data-odd-mode="system"' },
            ' restores the system behaviour inside an explicit subtree.',
          ],
        },
        { fact: 'theme-baseline' },
      ],
    },
    {
      id: 'scopes',
      title: 'Scope contract',
      blocks: [
        {
          p: [
            'Density changes spacing and control sizing only, never font sizes, and never takes a target below the documented minimum. ',
            { code: 'odd-theme-scope' },
            ' sets these attributes for you; plain elements with the same attributes work identically.',
          ],
        },
        { fact: 'scope-attributes' },
      ],
    },
    {
      id: 'composition',
      title: 'Composition and precedence',
      blocks: [
        {
          p: [
            'The generated CSS has no rule for a combination of scopes: each product, density, and profile is one rule, and mode is two toggles.',
          ],
        },
        { fact: 'scope-composition' },
      ],
    },
    {
      id: 'create',
      title: 'Create a theme',
      blocks: [
        {
          p: [
            'Theme Studio, part of ',
            { code: '@oddkin/workbench' },
            ', edits a theme configuration, runs the same generator in the browser, previews the components in isolated scopes, and exports the configuration and its CSS. The ',
            { link: 'theming guide', href: '/guides/theming' },
            ' shows how a page applies a theme.',
          ],
        },
      ],
    },
  ],
  next: { label: 'Responsive behavior', href: '/foundations/responsive' },
});

export const foundationResponsive = child({
  path: 'foundations/responsive',
  title: 'Responsive behavior',
  summary:
    'Layout recipes change arrangement with named conditions and profiles. A narrow container changes how things are arranged; it never shrinks text or targets.',
  sections: [
    {
      id: 'conditions',
      title: 'Named conditions',
      blocks: [
        {
          p: [
            'A condition is written once in the theme and emitted as a literal query, because ',
            { code: 'var()' },
            ' cannot appear in a query. Thresholds are rem lengths, so they follow the reader’s font size.',
          ],
        },
        { fact: 'conditions' },
      ],
    },
    {
      id: 'roles',
      title: 'Layout roles',
      blocks: [
        {
          p: [
            'Pages and recipes lay out with these roles. Below, the same items in a container as wide as ',
            { code: 'layout.item-min' },
            ' and in one as wide as ',
            { code: 'layout.measure' },
            '.',
          ],
        },
        { fact: 'layout-roles' },
      ],
    },
    {
      id: 'profiles',
      title: 'Profiles',
      blocks: [
        {
          p: [
            'A profile is a named set of role overrides. It never inspects or rewrites descendants: it declares custom properties where it applies, through ',
            { code: 'data-odd-profile' },
            ' or a recipe condition, and they inherit.',
          ],
        },
        { fact: 'profiles' },
      ],
    },
    {
      id: 'concerns',
      title: 'Keep concerns separate',
      blocks: [{ fact: 'layout-concerns' }],
    },
  ],
  next: { label: 'Components', href: '/components' },
});

const children = [
  foundationTokens,
  foundationColor,
  foundationTypography,
  foundationSpacing,
  foundationBorders,
  foundationElevation,
  foundationMotion,
  foundationThemes,
  foundationResponsive,
];

const cards: Card[] = children.map((page) => ({
  title: page.title,
  text: page.summary.split(/(?<=\.)\s/)[0] ?? page.summary,
  href: `/${page.path}`,
  action: `Read about ${page.title.toLowerCase()}`,
}));

export const foundations: Page = {
  path: 'foundations',
  group: 'Build',
  eyebrow: 'Foundations',
  title: 'Foundations',
  summary:
    'The default theme’s tokens, from reference values to the roles components read, with every value generated by @oddkin/tokens.',
  sections: [
    { id: 'topics', title: 'Topics', blocks: [{ cards }] },
    {
      id: 'source',
      title: 'Where the values come from',
      blocks: [
        {
          p: [
            'The tables, swatches, and specimens read the default theme’s inspection, ',
            { code: '@oddkin/tokens/inspect/default.json' },
            ', and its contrast report when the site is built. Change the theme and rebuild, and the pages follow.',
          ],
        },
      ],
    },
  ],
  next: { label: 'Token architecture', href: '/foundations/tokens' },
};

export const foundationPages: readonly Page[] = [foundations, ...children];
