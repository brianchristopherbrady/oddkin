import type { Scope } from '@oddkin/core/scope';
import { defineExamples } from '@oddkin/workbench/examples';
import type { ContextResource, ContextSource } from '../contracts/types.js';
import type {} from './context-picker.js';

const sources: ContextSource[] = [
  { id: 'drive', label: 'Drive' },
  { id: 'wiki', label: 'Wiki' },
  { id: 'records', label: 'Records' },
];

const library: ContextResource[] = [
  {
    sourceId: 'drive',
    id: 'launch-brief',
    label: 'Launch brief',
    type: 'document',
    path: 'Product / Launch',
    description: '2h ago',
  },
  {
    sourceId: 'wiki',
    id: 'release-checklist',
    label: 'Release checklist',
    type: 'page',
    path: 'Platform team',
    description: 'Yesterday',
  },
  {
    sourceId: 'drive',
    id: 'customer-interviews',
    label: 'Customer interviews',
    type: 'document',
    path: 'Research',
    description: '3 days ago',
  },
  {
    sourceId: 'records',
    id: 'acme-renewal',
    label: 'Acme renewal',
    type: 'account',
    path: 'Account',
    description: 'Updated today',
  },
  {
    sourceId: 'wiki',
    id: 'launch-checklist',
    label: 'Launch checklist',
    type: 'page',
    path: 'Platform team',
    description: 'Yesterday',
  },
  {
    sourceId: 'drive',
    id: 'launch-retrospective',
    label: 'Launch retrospective',
    type: 'document',
    path: 'Research',
    description: 'Last month',
  },
  {
    sourceId: 'drive',
    id: 'pricing-notes',
    label: 'Pricing notes',
    type: 'document',
    path: 'Sales',
    unavailable: 'Unavailable · Remove or replace',
  },
];

type Picker = HTMLElementTagNameMap['odd-context-picker'];

/** What each container holds, by the container's id (a source's top level by the source's id). */
const folders: Record<string, ContextResource[]> = {
  drive: [
    {
      sourceId: 'drive',
      id: 'product',
      label: 'Product',
      type: 'folder',
      description: 'Open collection',
      container: true,
    },
    {
      sourceId: 'drive',
      id: 'research',
      label: 'Research',
      type: 'folder',
      description: 'Open collection',
      container: true,
    },
  ],
  product: [
    {
      sourceId: 'drive',
      id: 'launch',
      label: 'Launch',
      type: 'folder',
      description: 'Open collection',
      container: true,
    },
  ],
  launch: [
    {
      sourceId: 'drive',
      id: 'launch-folder',
      label: 'Launch folder',
      type: 'folder',
      kind: 'folder',
      description: 'Folder reference · contents not selected',
    },
    {
      sourceId: 'drive',
      id: 'launch-brief',
      label: 'Launch brief',
      type: 'document',
      description: '2h ago',
    },
  ],
  research: [
    {
      sourceId: 'drive',
      id: 'customer-interviews',
      label: 'Customer interviews',
      type: 'document',
      description: '3 days ago',
    },
  ],
};
/** A folder icon for resources of kind `folder` (any SVG URL the page may load). */
const folderIcon =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="black" stroke-width="1.5" stroke-linejoin="round"%3E%3Cpath d="M2.75 5h4.5l1.5 1.75h8.5v8.5H2.75z"/%3E%3C/svg%3E';
/** The host: answers each search from `library` after a short delay; every change applies. */
function host(scope: Scope, element: Picker): void {
  scope.listen<GlobalEventHandlersEventMap['odd-context-query']>(
    element,
    'odd-context-query',
    ({ detail }) => {
      const query = detail.query.toLocaleLowerCase();
      scope.timeout(() => {
        if (detail.signal.aborted) return;
        element.results = {
          requestId: detail.requestId,
          items: detail.location
            ? (folders[detail.location.id ?? detail.location.sourceId] ?? [])
            : library.filter(
                (r) =>
                  detail.sourceIds.includes(r.sourceId) &&
                  r.label.toLocaleLowerCase().includes(query),
              ),
          sources: detail.sourceIds.map((sourceId) => ({ sourceId, status: 'complete' as const })),
        };
      }, 300);
    },
  );
}

export default defineExamples('odd-context-picker', {
  default: {
    label: 'Choose context from connected sources',
    props: {
      sources,
      multiple: true,
      open: true,
      results: {
        requestId: 'recent',
        items: [
          {
            sourceId: 'drive',
            id: 'launch-brief',
            label: 'Launch brief',
            type: 'document',
            path: 'Product / Launch',
            description: '2h ago',
          },
          {
            sourceId: 'wiki',
            id: 'release-checklist',
            label: 'Release checklist',
            type: 'page',
            path: 'Platform team',
            description: 'Yesterday',
          },
        ],
      },
      value: [
        {
          sourceId: 'drive',
          id: 'launch-brief',
          label: 'Launch brief',
          type: 'document',
          path: 'Product / Launch',
          description: '2h ago',
        },
      ],
    },
    recommended: true,
    guidance:
      'The host answers each `odd-context-query` with `results` carrying its `requestId`. A change applies unless the host cancels `odd-context-change`, to refuse it or to set `value` later. Show the chosen resources outside the picker (chips or rows), each removable.',
    fixture({ scope, element }) {
      host(scope, element);
    },
  },
  confirm: {
    label: 'Choose one, then apply',
    props: { sources, commit: 'confirm' },
    guidance:
      'With `commit="confirm"` choices stay a draft until Add N; Cancel, Close, Escape, or leaving the surface discards them. Without `multiple`, choosing replaces the choice.',
    fixture({ scope, element }) {
      host(scope, element);
    },
  },
  browse: {
    label: 'Browse the sources',
    props: {
      sources: [
        { id: 'drive', label: 'Drive', description: '240 resources', browse: true },
        { id: 'wiki', label: 'Wiki', description: '86 pages', browse: true },
      ],
      multiple: true,
      open: true,
      icons: { folder: folderIcon },
      results: {
        requestId: 'recent',
        items: [folders['drive']![0]!, library[0]!, library[2]!],
      },
    },
    guidance:
      'When a source has `browse`, Browse… opens the expanded browser: a modal dialog that keeps the search, scope, location, and draft, lists the sources beside the collection, and reviews the choice as removable chips. Browsing asks `odd-context-query` with a `location` (a source, or a container inside it) and shows what the host answers. A resource with `container` opens to show what is inside it, here in the surface itself, and is never chosen itself; a folder reference is an ordinary resource, chosen on its own, and says so in its description. A `nextCursor` in `results` gives Load more. Only a person browses: this example opens Product from the recent resources as one would. A resource’s `kind` picks its icon from `icons` (URLs the page may load); others show the document icon.',
    async fixture({ scope, element }) {
      host(scope, element);
      await element.updateComplete;
      element.shadowRoot!.querySelector<HTMLButtonElement>('.container')!.click();
    },
  },
  iconTrigger: {
    label: 'A plus button where the text does not fit',
    props: { sources, multiple: true, trigger: 'icon' },
    guidance:
      'With `trigger="icon"` the trigger is a plus button. Its text (`label`, by default Add context) stays its accessible name and shows as its tooltip on hover and focus.',
    fixture({ scope, element }) {
      host(scope, element);
    },
  },
  sheet: {
    label: 'A full-screen sheet the host chooses',
    props: { sources, multiple: true, commit: 'confirm', presentation: 'sheet' },
    guidance:
      'With `presentation="sheet"` the picker opens a full-screen modal dialog with the same search, list, and choice. The host chooses it, for example in its own phone layout; the picker never chooses it by width, and a change while it is open applies after it closes. Escape, Close, Cancel, and Add N return focus to the trigger.',
    fixture({ scope, element }) {
      host(scope, element);
    },
  },
});
