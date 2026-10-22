/**
 * Built-in shell copy (English). Generic and conditional: it never states facts about the
 * library, which come from generated data. Moves to the localizable `./content` catalog (item 818).
 */
export const COPY = {
  skip: 'Skip to main content',
  loading: 'Loading the Workbench…',
  indexFailed: 'The Workbench index could not be loaded',
  indexIncompatible: 'This index was written by a different Workbench version',
  primaryNavigation: 'Primary',
  search: 'Search',
  searchPlaceholder: 'Search pages',
  componentSearch: 'Search components',
  categoryFilter: 'Category',
  allCategories: 'All categories',
  componentResults: (shown: number, total: number) =>
    `Showing ${shown} of ${total} ${total === 1 ? 'component' : 'components'}`,
  noComponentResults: 'No components match these filters.',
  searchResults: (shown: number, total: number) =>
    total === 0
      ? 'No results'
      : shown < total
        ? `Showing ${shown} of ${total} results`
        : `${total} ${total === 1 ? 'result' : 'results'}`,
  appearance: 'Appearance',
  appearances: { system: 'System', light: 'Light', dark: 'Dark' },
  overviewEyebrow: 'Design system',
  summaries: {
    foundations: 'The shared values and rules that components are built on.',
    components: 'Every documented component, grouped by category.',
    'theme-studio': 'Edit the theme configuration and preview it on real components.',
  } as Readonly<Record<string, string>>,
  allPages: (title: string) => `All ${title.toLowerCase()}`,
  showSection: (title: string) => `Show ${title.toLowerCase()}`,
  hideSection: (title: string) => `Hide ${title.toLowerCase()}`,
  onThisPage: 'On this page',
  updated: 'Updated',
  sectionPending: 'This Workbench build does not display this section yet.',
  toolPending: 'This Workbench build does not include Theme Studio yet.',
  noFoundations: 'No foundation data supplied',
  noFoundationsHelp:
    'Foundation pages appear when the library publishes Oddkin metadata with foundations, generated from a theme configuration.',
  noComponents: 'No components were found in the library’s Custom Elements Manifest.',
  notFound: 'Page not found',
  notFoundText: (path: string) => `There is no page at ${path}.`,
  pageFailed: 'This page could not be loaded',
  productsDisabled: 'Products and modes is not enabled in this Workbench.',
  stale: (errors: number) =>
    `The latest changes could not be applied (${errors} ${errors === 1 ? 'error' : 'errors'}); the last valid version is shown.`,
} as const;
