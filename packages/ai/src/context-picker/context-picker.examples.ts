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
    },
    guidance:
      'A source with `browse` can be opened with Browse…: the picker asks `odd-context-query` with a `location` (a source, or a container inside it) and shows what the host answers. A resource with `container` opens to show what is inside it and is never chosen itself; a folder reference is an ordinary resource, chosen on its own, and says so in its description. A `nextCursor` in `results` gives Load more. Only a person opens the browser; this example presses Browse… as one would.',
    async fixture({ scope, element }) {
      host(scope, element);
      await element.updateComplete;
      element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="footer"] button')!.click();
    },
  },
});
